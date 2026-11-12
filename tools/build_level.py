#!/usr/bin/env python3
"""OSM-Rohdaten (Overpass JSON) -> kompaktes Level-JSON fuer das Spiel.

Aufruf: python3 -I tools/build_level.py tools/level1.cfg.json
Die Route wird per Dijkstra ueber das echte Strassennetz zwischen zwei
Strassen-Endpunkten gesucht (bevorzugt die benannten Strassen in PREFER).
"""
import json, math, sys, heapq, collections

CFG = json.load(open(sys.argv[1]))
SRC, DST = CFG["src"], CFG["dst"]
PREFER = set(CFG.get("prefer", []))
CORRIDOR = CFG.get("corridor", 480.0)   # Meter links/rechts der Route, die mitgeladen werden
WAY = CFG["waypoints"]                  # [[lat, lon], ...] Start, Zwischenpunkte, Ziel

d = json.load(open(SRC))
els = d["elements"]

RIDE = {"primary", "secondary", "tertiary", "unclassified", "residential",
        "living_street", "cycleway", "service", "pedestrian"}

ways = [e for e in els if e["type"] == "way"]
hw = [w for w in ways if "highway" in w.get("tags", {})]

lat0 = (WAY[0][0] + WAY[-1][0]) / 2
lon0 = (WAY[0][1] + WAY[-1][1]) / 2
KX = 111320.0 * math.cos(math.radians(lat0))
KZ = 110540.0

def proj(lat, lon):
    return ((lon - lon0) * KX, -(lat - lat0) * KZ)

# ---- Graph ----
adj = collections.defaultdict(list)
pos = {}
for w in hw:
    t = w["tags"]
    if t["highway"] not in RIDE:
        continue
    pen = 1.0 if t.get("name") in PREFER else (6.0 if t["highway"] != "service" else 15.0)
    ns, gs = w["nodes"], w["geometry"]
    for i, (nid, g) in enumerate(zip(ns, gs)):
        pos[nid] = proj(g["lat"], g["lon"])
    for i in range(len(ns) - 1):
        a, b = ns[i], ns[i + 1]
        L = math.dist(pos[a], pos[b])
        adj[a].append((b, L * pen, t.get("name", "")))
        adj[b].append((a, L * pen, t.get("name", "")))

main_nodes = set()
for w in hw:
    if w["tags"]["highway"] in RIDE and w["tags"]["highway"] != "service":
        main_nodes.update(w["nodes"])

def nearest(latlon):
    p = proj(*latlon)
    return min(main_nodes, key=lambda n: (pos[n][0] - p[0]) ** 2 + (pos[n][1] - p[1]) ** 2)

def leg(a, b):
    dist = {a: 0.0}; prev = {}; pq = [(0.0, a)]
    while pq:
        dd, u = heapq.heappop(pq)
        if u == b:
            break
        if dd > dist.get(u, 1e18):
            continue
        for v, wgt, nm in adj[u]:
            nd = dd + wgt
            if nd < dist.get(v, 1e18):
                dist[v] = nd; prev[v] = (u, nm); heapq.heappush(pq, (nd, v))
    pth, nms = [b], []
    while pth[-1] != a:
        u, nm = prev[pth[-1]]
        nms.append(nm); pth.append(u)
    pth.reverse(); nms.reverse()
    return pth, nms

stops = [nearest(w) for w in WAY]
path, names = [stops[0]], []
for a, b in zip(stops, stops[1:]):
    if a == b:
        continue
    pth, nms = leg(a, b)
    path += pth[1:]; names += nms
route = [pos[n] for n in path]
route_len = sum(math.dist(route[i], route[i + 1]) for i in range(len(route) - 1))

# Knoten mit Ampel / Zebrastreifen auf der Route
node_tags = {e["id"]: e.get("tags", {}) for e in els if e["type"] == "node"}
cum = [0.0]
for i in range(len(route) - 1):
    cum.append(cum[-1] + math.dist(route[i], route[i + 1]))
crossings, signals = [], []
for nid, s in zip(path, cum):
    t = node_tags.get(nid, {})
    if t.get("highway") == "crossing":
        crossings.append(round(s, 1))
    if t.get("highway") == "traffic_signals":
        signals.append(round(s, 1))

# Strassennamen-Abschnitte
segs = []
for nm, s in zip(names, cum):
    if nm and (not segs or segs[-1][1] != nm):
        segs.append([round(s, 1), nm])

# ---- Korridor-Filter ----
CELL = 60.0
grid = collections.defaultdict(list)
for i in range(len(route) - 1):
    a, b = route[i], route[i + 1]
    n = max(1, int(math.dist(a, b) / 20))
    for k in range(n + 1):
        p = (a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n)
        grid[(int(p[0] // CELL), int(p[1] // CELL))].append(p)

def near(p, r=CORRIDOR):
    cx, cy = int(p[0] // CELL), int(p[1] // CELL)
    k = int(r // CELL) + 1
    for i in range(cx - k, cx + k + 1):
        for j in range(cy - k, cy + k + 1):
            for q in grid.get((i, j), ()):
                if (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < r * r:
                    return True
    return False

def R(pts):
    out = []
    for x, z in pts:
        out += [round(x, 1), round(z, 1)]
    return out

def geom(w):
    return [proj(g["lat"], g["lon"]) for g in w["geometry"]]

def num(s, default=None):
    try:
        return float(str(s).replace(",", ".").split()[0])
    except Exception:
        return default

# ---- Strassen ----
roads = []
path_edges = set()
for i in range(len(path) - 1):
    path_edges.add((path[i], path[i + 1])); path_edges.add((path[i + 1], path[i]))
for w in hw:
    t = w["tags"]; k = t["highway"]
    if k in ("proposed", "construction", "platform", "steps", "corridor", "elevator"):
        continue
    g = geom(w)
    if not any(near(p) for p in g[:: max(1, len(g) // 6)] + [g[-1]]):
        continue
    roads.append({"k": k, "n": t.get("name", ""), "p": R(g),
                  "l": int(num(t.get("lanes"), 0) or 0),
                  "b": 1 if t.get("bridge") else 0})

# ---- Gebaeude ----
buildings = []
for w in ways:
    t = w.get("tags", {})
    if "building" not in t and "building:part" not in t:
        continue
    g = geom(w)
    if len(g) < 4:
        continue
    cx = sum(p[0] for p in g) / len(g); cz = sum(p[1] for p in g) / len(g)
    if not near((cx, cz)):
        continue
    h = num(t.get("height"))
    if h is None:
        lv = num(t.get("building:levels"))
        if lv is not None:
            h = lv * 3.2 + 1.0
    if h is None:
        kind = t.get("building")
        h = {"garage": 3, "garages": 3, "shed": 3, "roof": 4, "hut": 3,
             "industrial": 10, "warehouse": 11, "commercial": 12, "office": 16,
             "apartments": 14, "retail": 7, "house": 8, "residential": 10}.get(kind, 9)
    buildings.append({"p": R(g[:-1] if g[0] == g[-1] else g), "h": round(h, 1),
                      "t": t.get("building", "yes"), "n": t.get("name", ""),
                      "c": t.get("building:colour", ""), "m": t.get("building:material", "")})

# ---- Wasser (Wege + Multipolygon-Relationen) ----
def stitch(parts):
    parts = [list(p) for p in parts if len(p) > 1]
    rings = []
    while parts:
        cur = parts.pop()
        changed = True
        while changed and cur[0] != cur[-1]:
            changed = False
            for i, p in enumerate(parts):
                if p[0] == cur[-1]:
                    cur += p[1:]; parts.pop(i); changed = True; break
                if p[-1] == cur[-1]:
                    cur += p[::-1][1:]; parts.pop(i); changed = True; break
                if p[-1] == cur[0]:
                    cur = p + cur[1:]; parts.pop(i); changed = True; break
                if p[0] == cur[0]:
                    cur = p[::-1] + cur[1:]; parts.pop(i); changed = True; break
        rings.append(cur)
    return rings

water = []
for e in els:
    t = e.get("tags", {})
    if not (t.get("natural") == "water" or t.get("waterway") in ("riverbank", "dock")):
        continue
    if e["type"] == "way":
        g = geom(e)
        if len(g) > 3:
            water.append(R(g))
    elif e["type"] == "relation":
        outers = [[(m_g["lat"], m_g["lon"]) for m_g in m["geometry"]]
                  for m in e.get("members", []) if m.get("role") in ("outer", "") and "geometry" in m]
        for ring in stitch(outers):
            if len(ring) > 3:
                water.append(R([proj(a, b) for a, b in ring]))

# ---- Gruenflaechen ----
green = []
for w in ways:
    t = w.get("tags", {})
    if t.get("landuse") in ("grass", "meadow", "forest", "recreation_ground", "village_green") \
            or t.get("leisure") == "park":
        g = geom(w)
        if len(g) > 3 and g[0] == g[-1] and near(g[0], 350):
            green.append(R(g[:-1]))

# ---- Baeume, Strassenbahn ----
trees = []
for e in els:
    if e["type"] == "node" and e.get("tags", {}).get("natural") == "tree":
        p = proj(e["lat"], e["lon"])
        if near(p, 380):
            trees += [round(p[0], 1), round(p[1], 1)]
tram = [R(geom(w)) for w in ways if w.get("tags", {}).get("railway") == "tram"
        and any(near(p, 380) for p in geom(w)[::3])]

out = {
    "name": CFG.get("name", ""), "origin": [lat0, lon0], "kx": KX, "kz": KZ, "length": round(route_len, 1),
    "route": R(route), "streets": segs, "crossings": crossings, "signals": signals,
    "roads": roads, "buildings": buildings, "water": water, "green": green,
    "trees": trees, "tram": tram,
}
json.dump(out, open(DST, "w"), ensure_ascii=False, separators=(",", ":"))
print("Route: %.0f m, %d Punkte" % (route_len, len(route)))
print("Strassen:", segs)
print("Zebrastreifen:", len(crossings), "Ampeln:", len(signals))
print("roads %d buildings %d water %d green %d trees %d tram %d" % (
    len(roads), len(buildings), len(water), len(green), len(trees) // 2, len(tram)))
named = [b["n"] for b in buildings if b["n"]]
print("Benannte Gebaeude:", named[:60])
