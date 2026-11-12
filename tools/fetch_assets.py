#!/usr/bin/env python3
"""Laedt fuer ein Level echte Bilder:
  1) Luftbild-Kacheln (DOP20 2023, GeoInformation Bremen, WMS) als Boden
  2) Geokodierte Fotos von Wikimedia Commons entlang der Strecke

Aufruf: python3 -I tools/fetch_assets.py 1 [ortho|photos]
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request

N = sys.argv[1]
WHAT = sys.argv[2] if len(sys.argv) > 2 else "all"
L = json.load(open("data/level%s.json" % N))
lat0, lon0 = L["origin"]; KX, KZ = L["kx"], L["kz"]
R = L["route"]; pts = [(R[i], R[i + 1]) for i in range(0, len(R), 2)]
UA = {"User-Agent": "osm-game-prototype/0.1"}

def get(url, tries=4):
    for k in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except Exception as e:
            time.sleep(2 + 3 * k)
    return None

# dichte Stuetzpunkte der Route
dense = []; cum = 0.0
for (a, b) in zip(pts, pts[1:]):
    d = math.dist(a, b); n = max(1, int(d / 5))
    for k in range(n):
        dense.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, cum + d * k / n))
    cum += d

def project(x, z):
    bx, bz, bs = min(dense, key=lambda q: (q[0] - x) ** 2 + (q[1] - z) ** 2)
    i = dense.index((bx, bz, bs)); j = min(len(dense) - 1, i + 1); i2 = max(0, j - 1)
    tx, tz = dense[j][0] - dense[i2][0], dense[j][1] - dense[i2][1]
    side = -(x - bx) * tz + (z - bz) * tx
    return bs, math.hypot(x - bx, z - bz), (1 if side >= 0 else -1)

# ---------------- 1) Luftbild ----------------
if WHAT in ("all", "ortho"):
    T, PX = 384.0, 1536
    os.makedirs("assets/ortho", exist_ok=True)
    xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
    i0, i1 = math.floor((min(xs) - 300) / T), math.floor((max(xs) + 300) / T)
    j0, j1 = math.floor((min(zs) - 300) / T), math.floor((max(zs) + 300) / T)
    tiles = []
    for i in range(i0, i1 + 1):
        for j in range(j0, j1 + 1):
            x, z = i * T, j * T
            dmin = min(math.hypot(max(x - q[0], 0, q[0] - x - T), max(z - q[1], 0, q[1] - z - T)) for q in dense[::6])
            if dmin > 300:
                continue
            w, e = lon0 + x / KX, lon0 + (x + T) / KX
            n, s = lat0 - z / KZ, lat0 - (z + T) / KZ
            f = "assets/ortho/L%s_%d_%d.jpg" % (N, i, j)
            if not os.path.exists(f) or os.path.getsize(f) < 20000:
                url = ("https://geodienste.bremen.de/wms_dop20_2023?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap"
                       "&LAYERS=DOP20_2023_HB&STYLES=&SRS=EPSG:4326&FORMAT=image/jpeg&WIDTH=%d&HEIGHT=%d&BBOX=%f,%f,%f,%f" % (PX, PX, w, s, e, n))
                data = get(url)
                if not data or data[:2] != b"\xff\xd8":
                    print("FEHLER Kachel", i, j, (data or b"")[:120]); continue
                open(f, "wb").write(data); time.sleep(0.3)
            tiles.append({"f": f, "x": x, "z": z, "s": T})
    json.dump(tiles, open("data/level%s.ortho.json" % N, "w"))
    print("Luftbild-Kacheln:", len(tiles))

# ---------------- 1b) scharfer Luftbild-Streifen direkt an der Strecke (DOP10) ----------------
if WHAT in ("all", "orthohi"):
    T, PX = 96.0, 1024
    os.makedirs("assets/ortho/hi", exist_ok=True)
    cells = set()
    for q in dense:
        for dx in (-42, 0, 42):
            for dz in (-42, 0, 42):
                cells.add((math.floor((q[0] + dx) / T), math.floor((q[1] + dz) / T)))
    tiles = []
    for (i, j) in sorted(cells):
        x, z = i * T, j * T
        w, e = lon0 + x / KX, lon0 + (x + T) / KX
        n, s_ = lat0 - z / KZ, lat0 - (z + T) / KZ
        f = "assets/ortho/hi/L%s_%d_%d.jpg" % (N, i, j)
        if not os.path.exists(f) or os.path.getsize(f) < 20000:
            url = ("https://geodienste.bremen.de/wms_dop10_2023?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap"
                   "&LAYERS=DOP10_2023_HB&STYLES=&SRS=EPSG:4326&FORMAT=image/jpeg&WIDTH=%d&HEIGHT=%d&BBOX=%f,%f,%f,%f" % (PX, PX, w, s_, e, n))
            data = get(url)
            if not data or data[:2] != b"\xff\xd8":
                print("FEHLER Kachel", i, j); continue
            open(f, "wb").write(data); time.sleep(0.2)
        tiles.append({"f": f, "x": x, "z": z, "s": T})
    json.dump(tiles, open("data/level%s.orthohi.json" % N, "w"))
    print("Scharfe Kacheln:", len(tiles))

# ---------------- 2) Fotos ----------------
if WHAT in ("all", "photos"):
    out_dir = "assets/photos/L%s" % N; os.makedirs(out_dir, exist_ok=True)
    cand = {}
    for q in dense[::30]:                       # alle ~150 m
        lat, lon = lat0 - q[1] / KZ, lon0 + q[0] / KX
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "format": "json", "generator": "geosearch", "ggscoord": "%f|%f" % (lat, lon),
            "ggsradius": 400, "ggslimit": 200, "ggsnamespace": 6, "prop": "imageinfo|coordinates",
            "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 960, "colimit": 200})
        data = get(url)
        if not data:
            continue
        for p in json.loads(data).get("query", {}).get("pages", {}).values():
            ii = (p.get("imageinfo") or [{}])[0]; co = (p.get("coordinates") or [{}])[0]
            if ii.get("mime") != "image/jpeg" or ii.get("width", 0) < 1000 or "lat" not in co:
                continue
            if ii["width"] < ii["height"] * 1.05 or ii["width"] > ii["height"] * 2.4:
                continue                         # nur Querformat
            t = p["title"][5:]
            if re.search(r"(1[5-9]\d\d|Karte|Plan|Wappen|Stolperstein|Gedenktafel|Schild|Detail|innen|Innen|Interior|Portrait|Logo|Luftbild|aerial|Fotoflug|fotoflug|geograph|Sandness|Unsplash|Vibrator|Sex|Erotik|Dessous|Bier|Beer|Wein|Wine|Zigarett|Cigar|FindID|Infotafel|Gedenk|Marmorsaal)", t):
                continue
            m = ii.get("extmetadata", {})
            cand[t] = {"t": t, "lat": co["lat"], "lon": co["lon"], "thumb": ii.get("thumburl"),
                       "lic": m.get("LicenseShortName", {}).get("value", ""),
                       "by": re.sub("<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()[:60]}
        time.sleep(0.4)
    print("Kandidaten:", len(cand))
    items = []
    for c in cand.values():
        s, d, side = project((c["lon"] - lon0) * KX, -(c["lat"] - lat0) * KZ)
        if d < 380 and 45 < s < cum - 50 and c["thumb"]:
            items.append((s, d, side, c))
    items.sort(key=lambda a: a[1])              # nahe an der Strecke zuerst
    chosen, used = [], []
    for s, d, side, c in items:
        if any(abs(s - u[0]) < 30 for u in used) or len(chosen) >= 70:
            continue
        stem = re.sub(r"\s*\(?\d{4}[-\d]*\)?|IMG[_ ]?\d+|DSC[_ ]?\d+|\b\d{5,}\b|\.jpe?g$", "", c["t"], flags=re.I)
        stem = re.sub(r"[_\-–,]+", " ", stem); stem = re.sub(r"\s+", " ", stem).strip(" .-")
        chosen.append({"s": round(s, 1), "side": side, "title": stem[:46] or "Bremen", "c": c}); used.append((s,))
    # Luecken mit Fotos aus dem Stadtteil fuellen (ohne exakte Koordinate)
    QUERIES = {"1": ["Überseestadt Bremen", "Europahafen Bremen", "Speicher XI Bremen", "Weser Tower Bremen", "Waller Sand", "Überseestadt Hafen Bremen Walle", "Schuppen Bremen Überseestadt", "Holz- und Fabrikenhafen Bremen"],
               "2": ["Bremen Marktplatz", "Bremer Roland", "Bremer Rathaus", "Obernstraße Bremen", "Bremer Stadtmusikanten", "Böttcherstraße Bremen", "Schlachte Bremen", "Bremer Dom", "Faulenstraße Bremen", "Stephaniviertel Bremen"]}
    extra = {}
    for qy in QUERIES.get(N, []):
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "format": "json", "generator": "search", "gsrsearch": qy + " filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 30,
            "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 960})
        data = get(url)
        for p in (json.loads(data).get("query", {}).get("pages", {}).values() if data else []):
            ii = (p.get("imageinfo") or [{}])[0]; t = p["title"][5:]
            if ii.get("mime") != "image/jpeg" or ii.get("width", 0) < 1000 or t in cand or not ii.get("thumburl"):
                continue
            if ii["width"] < ii["height"] * 1.05 or ii["width"] > ii["height"] * 2.4:
                continue
            if re.search(r"(1[5-9]\d\d|Karte|Plan|Wappen|Stolperstein|Gedenktafel|Detail|innen|Innen|Interior|Portrait|Logo|Luftbild|aerial|Fotoflug|fotoflug|Briefmarke|stamp|geograph|Sandness|Unsplash|Vibrator|Sex|Erotik|Dessous|Bier|Beer|Wein|Wine|Zigarett|Cigar|FindID|Infotafel|Gedenk|Marmorsaal)", t):
                continue
            m = ii.get("extmetadata", {})
            extra[t] = {"t": t, "thumb": ii["thumburl"], "lic": m.get("LicenseShortName", {}).get("value", ""),
                        "by": re.sub("<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()[:60]}
        time.sleep(0.4)
    pool = list(extra.values()); s = 70.0; k = 0
    while s < cum - 60 and pool and len(chosen) < 90:
        if all(abs(s - u[0]) >= 42 for u in used):
            c = pool.pop((k * 7) % len(pool)); k += 1
            stem = re.sub(r"\s*\(?\d{4}[-\d]*\)?|IMG[_ ]?\d+|DSC[_ ]?\d+|\b\d{5,}\b|\.jpe?g$", "", c["t"], flags=re.I)
            stem = re.sub(r"[_\-–,]+", " ", stem); stem = re.sub(r"\s+", " ", stem).strip(" .-")
            chosen.append({"s": round(s, 1), "side": 1 if k % 2 else -1, "title": stem[:46] or "Bremen", "c": c}); used.append((s,))
        s += 14
    chosen.sort(key=lambda a: a["s"])
    # HINWEIS: Titel-Filter reicht nicht; neue Fotos vor dem Veroeffentlichen immer ansehen (Kontaktbogen).
    meta, credits = [], []
    for k, ch in enumerate(chosen):
        f = "%s/%02d.jpg" % (out_dir, k)
        if not os.path.exists(f) or os.path.getsize(f) < 8000:
            data = get(ch["c"]["thumb"])
            if not data or data[:2] != b"\xff\xd8":
                print("FEHLER Foto", ch["c"]["t"]); continue
            open(f, "wb").write(data); time.sleep(0.6)
        meta.append({"f": f, "s": ch["s"], "side": ch["side"], "title": ch["title"], "by": ch["c"]["by"], "lic": ch["c"]["lic"]})
        credits.append("| %s | %s | %s | %s |" % (f, ch["c"]["t"], ch["c"]["by"], ch["c"]["lic"]))
    json.dump(meta, open("data/level%s.photos.json" % N, "w"), ensure_ascii=False, indent=0)
    open("assets/photos/CREDITS_L%s.md" % N, "w").write(
        "# Bildnachweise Level %s (Wikimedia Commons)\n\n| Datei | Titel auf Commons | Urheber | Lizenz |\n|---|---|---|---|\n%s\n\n"
        "Luftbilder: DOP20 2023, © GeoInformation Bremen.\n" % (N, "\n".join(credits)))
    print("Fotos:", len(meta))
    for m in meta:
        print(" %6.0f %+d %s" % (m["s"], m["side"], m["title"]))
