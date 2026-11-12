// Baut die 3D-Welt aus den echten OpenStreetMap-Daten (data/levelN.json)
import * as THREE from '../lib/three.module.min.js';
import * as T from './textures.js';
import { RGBELoader } from '../lib/addons/loaders/RGBELoader.js';

export const ROAD_HALF = 3.5;      // halbe Fahrbahnbreite der Spielstrecke

const WIDTH = {
  motorway: 12, trunk: 12, trunk_link: 6, primary: 10, primary_link: 6, secondary: 9, secondary_link: 6,
  tertiary: 7.5, unclassified: 6.5, residential: 6, living_street: 5.5, service: 3.6, track: 3,
  cycleway: 2.4, pedestrian: 4.5, footway: 1.8, path: 1.6,
};
const PAVED_LIGHT = new Set(['cycleway', 'pedestrian', 'footway', 'path', 'living_street']);

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------------- Route ----------------
export function makeRoute(flat) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) {
    const v = new THREE.Vector3(flat[i], 0, flat[i + 1]);
    if (!pts.length || pts[pts.length - 1].distanceTo(v) > 1.5) pts.push(v);
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  const N = Math.ceil(len / 2);
  const sp = curve.getSpacedPoints(N);
  const step = len / N;
  const xs = new Float32Array(N + 1), zs = new Float32Array(N + 1), tx = new Float32Array(N + 1), tz = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { xs[i] = sp[i].x; zs[i] = sp[i].z; }
  for (let i = 0; i <= N; i++) {
    const a = Math.max(0, i - 2), b = Math.min(N, i + 2);
    const dx = xs[b] - xs[a], dz = zs[b] - zs[a], L = Math.hypot(dx, dz) || 1;
    tx[i] = dx / L; tz[i] = dz / L;
  }
  const route = {
    len, N, step, xs, zs, tx, tz,
    // Position auf der Strecke: s = Meter ab Start, l = Meter nach rechts
    at(s, l = 0, out = {}) {
      const f = Math.min(Math.max(s / step, 0), N - 0.001), i = Math.floor(f), k = f - i;
      const x = xs[i] + (xs[i + 1] - xs[i]) * k, z = zs[i] + (zs[i + 1] - zs[i]) * k;
      let ax = tx[i] + (tx[i + 1] - tx[i]) * k, az = tz[i] + (tz[i + 1] - tz[i]) * k;
      const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
      out.x = x - az * l; out.z = z + ax * l; out.tx = ax; out.tz = az;
      out.yaw = Math.atan2(-ax, -az);
      return out;
    },
    project(x, z) {
      let best = 0, bd = 1e18;
      for (let i = 0; i <= N; i++) { const d = (xs[i] - x) ** 2 + (zs[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      const l = -(x - xs[best]) * tz[best] + (z - zs[best]) * tx[best];
      return { s: best * step, l, d: Math.sqrt(bd) };
    },
  };
  return route;
}

// ---------------- Geometrie-Helfer ----------------
class Buf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  quad(a, b, c, d, n, uvs, col) { // a,b,c,d = [x,y,z]; Dreiecke a-b-c, a-c-d
    for (const [v, t] of [[a, 0], [b, 1], [c, 2], [a, 0], [c, 2], [d, 3]]) {
      this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]);
      this.uv.push(uvs[t][0], uvs[t][1]);
      if (col) this.c.push(col.r, col.g, col.b);
    }
  }
  tri(a, b, c, n, col, uvScale = 0.1) {
    for (const v of [a, b, c]) {
      this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(v[0] * uvScale, v[2] * uvScale);
      if (col) this.c.push(col.r, col.g, col.b);
    }
  }
  mesh(mat, shadows = [false, true]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    const m = new THREE.Mesh(g, mat); m.castShadow = shadows[0]; m.receiveShadow = shadows[1];
    return m;
  }
}
const UP = [0, 1, 0];

function ribbon(buf, flat, width, y) {
  const n = flat.length / 2, h = width / 2;
  let px, pz, plx, plz, prx, prz, acc = 0;
  for (let i = 0; i < n; i++) {
    const x = flat[2 * i], z = flat[2 * i + 1];
    const ax = flat[2 * Math.max(0, i - 1)], az = flat[2 * Math.max(0, i - 1) + 1];
    const bx = flat[2 * Math.min(n - 1, i + 1)], bz = flat[2 * Math.min(n - 1, i + 1) + 1];
    let dx = bx - ax, dz = bz - az; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const lx = x + dz * h, lz = z - dx * h, rx = x - dz * h, rz = z + dx * h;
    if (i > 0) {
      const d = Math.hypot(x - px, z - pz), v0 = acc / 6, v1 = (acc + d) / 6; acc += d;
      buf.quad([plx, y, plz], [prx, y, prz], [rx, y, rz], [lx, y, lz], UP, [[0, v0], [width / 6, v0], [width / 6, v1], [0, v1]]);
    }
    px = x; pz = z; plx = lx; plz = lz; prx = rx; prz = rz;
  }
}

function polygon(buf, flat, y, col, uvScale) {
  const contour = [];
  for (let i = 0; i < flat.length; i += 2) contour.push(new THREE.Vector2(flat[i], flat[i + 1]));
  if (contour.length > 2 && contour[0].equals(contour[contour.length - 1])) contour.pop();
  if (contour.length < 3) return;
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch (e) { return; }
  for (const t of tris) {
    const [a, b, c] = t.map(i => [contour[i].x, y, contour[i].y]);
    buf.tri(a, b, c, UP, col, uvScale);
  }
}

// ---------------- Welt ----------------
export async function buildWorld(scene, renderer, level, data) {
  const R = rng(level.seed);
  const route = makeRoute(data.route);
  const world = { route, data, group: new THREE.Group(), extra: [], landmarks: [] };
  world.dispose = () => {
    scene.remove(world.group, ...world.extra);
    scene.background = null; scene.environment = null; if (world.hdr) world.hdr.dispose();
    world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) for (const m of [].concat(o.material)) { if (m.map) m.map.dispose(); m.dispose(); } });
  };
  const loader = new THREE.TextureLoader(), ORTHO = data.ortho && data.ortho.length ? data.ortho : null;
  scene.add(world.group);
  const add = o => (world.group.add(o), o);

  // --- Himmel: echtes HDRI-Foto (Poly Haven, CC0) als Hintergrund UND Lichtquelle ---
  const hdr = await new RGBELoader().loadAsync('assets/sky/sky_4k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr; scene.environment = hdr; scene.backgroundIntensity = 0.85;
  world.hdr = hdr;
  const sunDir = new THREE.Vector3(0.45, 0.62, 0.64).normalize();
  { // Sonnenrichtung = hellster Punkt im Himmelsfoto
    const d = hdr.image.data, W = hdr.image.width, H = hdr.image.height; let best = -1, bi = 0;
    for (let k = 0; k < d.length; k += 28) { const v = d[k] + d[k + 1]; if (v > best) { best = v; bi = k / 4; } }
    const u = (bi % W + 0.5) / W, v = 1 - (Math.floor(bi / W) + 0.5) / H, phi = (u - 0.5) * 2 * Math.PI, th = (v - 0.5) * Math.PI;
    if (th > 0.15) sunDir.set(Math.cos(th) * Math.cos(phi), Math.sin(th), Math.cos(th) * Math.sin(phi));
  }
  scene.fog = new THREE.Fog(0xc4d2e0, 180, 1900);
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6b6a5a, 0.18); scene.add(hemi); world.extra.push(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 600;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target); world.extra.push(sun, sun.target); world.sun = sun; world.sunDir = sunDir;

  // --- Boden, Gruen, Wasser ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ map: T.groundTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; add(ground);

  const asphalt = new THREE.MeshStandardMaterial({ map: T.asphaltTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const paving = new THREE.MeshStandardMaterial({ map: T.pavingTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const tileMats = new Map();
  if (ORTHO) {
    // Echte Luftbilder (DOP20, GeoInformation Bremen) als Boden
    await Promise.all(ORTHO.map(async t => {
      const tx = await loader.loadAsync(t.f); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 16;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(t.s, t.s), new THREE.MeshStandardMaterial({ map: tx, roughness: 1, color: 0xa4a4a4 }));
      m.rotation.x = -Math.PI / 2; m.position.set(t.x + t.s / 2, 0.02, t.z + t.s / 2); m.receiveShadow = true; add(m);
      tileMats.set(Math.floor(t.x / t.s) + ',' + Math.floor(t.z / t.s), { t, tx, buf: new Buf() });
    }));
    // scharfer Streifen (10 cm/Pixel) direkt an der Strecke
    await Promise.all((data.orthoHi || []).map(async t => {
      const tx = await loader.loadAsync(t.f); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 16;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(t.s, t.s), new THREE.MeshStandardMaterial({ map: tx, roughness: 1, color: 0xa4a4a4, polygonOffset: true, polygonOffsetFactor: -1 }));
      m.rotation.x = -Math.PI / 2; m.position.set(t.x + t.s / 2, 0.04, t.z + t.s / 2); m.receiveShadow = true; add(m);
    }));
  } else {
    const gb = new Buf(); for (const g of data.green) polygon(gb, g, 0.03, null, 0.12);
    add(gb.mesh(new THREE.MeshStandardMaterial({ map: T.grassTexture(), roughness: 1, side: THREE.DoubleSide })));
    const rb = new Buf(), pb = new Buf();
    for (const r of data.roads) {
      const w = WIDTH[r.k]; if (!w) continue;
      const light = PAVED_LIGHT.has(r.k);
      ribbon(light ? pb : rb, r.p, r.l > 2 ? Math.max(w, r.l * 3.2) : w, light ? 0.07 : 0.09);
    }
    add(rb.mesh(asphalt)); add(pb.mesh(paving));
    const tb = new Buf(); for (const t of data.tram) { ribbon(tb, t, 0.12, 0.115); }
    add(tb.mesh(new THREE.MeshStandardMaterial({ color: 0x8a8d90, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide })));
  }
  const wb = new Buf(); for (const w of data.water) polygon(wb, w, 0.05, null, 0.02);
  add(wb.mesh(new THREE.MeshStandardMaterial({ color: 0x35607a, roughness: 0.12, metalness: 0.75, envMapIntensity: 1.3, side: THREE.DoubleSide, transparent: !!ORTHO, opacity: ORTHO ? 0.6 : 1 })));

  // --- Spielstrecke (Fahrbahn + Gehwege) ---
  const P = {};
  function strip(buf, l0, l1, y, vTile, s0 = 0, s1 = route.len, uRange = [0, 1]) {
    const i0 = Math.floor(s0 / route.step), i1 = Math.ceil(s1 / route.step);
    for (let i = i0; i < i1; i++) {
      const a0 = route.at(i * route.step, l0, {}), a1 = route.at(i * route.step, l1, {});
      const b0 = route.at((i + 1) * route.step, l0, {}), b1 = route.at((i + 1) * route.step, l1, {});
      const v0 = i * route.step / vTile, v1 = (i + 1) * route.step / vTile;
      buf.quad([a0.x, y, a0.z], [a1.x, y, a1.z], [b1.x, y, b1.z], [b0.x, y, b0.z], UP, [[uRange[0], v0], [uRange[1], v0], [uRange[1], v1], [uRange[0], v1]]);
    }
  }
  // Asphalt: fotogescannte PBR-Textur (Poly Haven, CC0) + Markierungen darueber
  const lt = (f, srgb) => { const t = loader.load(f); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; return t; };
  // Fussgaengerzonen (aus levels.js: carFree) bekommen Pflaster statt Asphalt und keine Fahrbahnmarkierung
  const fr = [], st = data.streets;
  st.forEach(([s0, n], i) => { if ((level.carFree || []).includes(n)) fr.push([s0, i + 1 < st.length ? st[i + 1][0] : route.len]); });
  world.freeRanges = fr;
  const drive = []; { let c = 0; for (const [a, b] of fr) { if (a > c) drive.push([c, a]); c = Math.max(c, b); } if (c < route.len) drive.push([c, route.len]); }
  if (fr.length) { const pv = new Buf(); for (const [a, b] of fr) strip(pv, -ROAD_HALF, ROAD_HALF, 0.11, 3, a, b, [0, 2.4]); add(pv.mesh(new THREE.MeshStandardMaterial({ map: T.pavingTexture(), roughness: 0.9, color: 0xb9b2a6, side: THREE.DoubleSide }))); }
  const road = new Buf(); for (const [a, b] of drive) strip(road, -ROAD_HALF, ROAD_HALF, 0.11, 7, a, b);
  add(road.mesh(new THREE.MeshStandardMaterial({ map: lt('assets/tex/asphalt_diff.jpg', true), normalMap: lt('assets/tex/asphalt_nor_gl.jpg'), roughnessMap: lt('assets/tex/asphalt_rough.jpg'), color: 0x8c8c8c, side: THREE.DoubleSide })));
  const lines = new Buf(); for (const [a, b] of drive) strip(lines, -ROAD_HALF, ROAD_HALF, 0.118, 9, a, b);
  add(lines.mesh(new THREE.MeshStandardMaterial({ map: T.roadTexture(), transparent: true, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })));
  if (!ORTHO) {
    const walk = new Buf();
    strip(walk, -ROAD_HALF - 2.6, -ROAD_HALF, 0.2, 3, 0, route.len, [0, 0.9]);
    strip(walk, ROAD_HALF, ROAD_HALF + 2.6, 0.2, 3, 0, route.len, [0, 0.9]);
    add(walk.mesh(paving));
  }
  const kerb = new Buf();
  strip(kerb, -ROAD_HALF - 0.14, -ROAD_HALF + 0.02, 0.21, 3); strip(kerb, ROAD_HALF - 0.02, ROAD_HALF + 0.14, 0.21, 3);
  add(kerb.mesh(new THREE.MeshStandardMaterial({ color: 0xb9b7b0, roughness: 0.9, side: THREE.DoubleSide })));
  const zebra = new Buf();
  for (const s of data.crossings) strip(zebra, -ROAD_HALF + 0.2, ROAD_HALF - 0.2, 0.125, 4, s - 2, s + 2, [0, 1]);
  const zt = T.zebraTexture();
  add(zebra.mesh(new THREE.MeshStandardMaterial({ map: zt, transparent: true, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })));

  // Start- und Ziellinie
  const banner = (s, text, bg) => {
    const p = route.at(s, 0, P), g = new THREE.Group();
    const poleM = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.4 });
    for (const l of [-4.2, 4.2]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6), poleM); m.position.set(l, 3, 0); m.castShadow = true; g.add(m); }
    const b = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.5), new THREE.MeshBasicMaterial({ map: T.labelTexture(text, { bg, fg: '#fff', w: 1024, h: 180, font: 'bold 64px Arial' }), side: THREE.DoubleSide }));
    b.position.y = 5.2; g.add(b);
    g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw; add(g);
  };
  banner(14, 'START · ' + level.startName.toUpperCase(), '#c8102e'); banner(route.len - 12, 'ZIEL · ' + level.finishName.toUpperCase(), '#c8102e');

  // --- Gebaeude ---
  const mats = {
    brick: new THREE.MeshStandardMaterial({ map: T.brickFacade(), roughness: 0.85, vertexColors: true }),
    plaster: new THREE.MeshStandardMaterial({ map: T.plasterFacade(), roughness: 0.8, vertexColors: true }),
    glass: new THREE.MeshStandardMaterial({ map: T.glassFacade(), roughness: 0.18, metalness: 0.55, vertexColors: true, envMapIntensity: 1.2 }),
    metal: new THREE.MeshStandardMaterial({ map: T.metalFacade(), roughness: 0.5, metalness: 0.35, vertexColors: true }),
  };
  const bufs = { brick: new Buf(), plaster: new Buf(), glass: new Buf(), metal: new Buf() }, roofs = new Buf();
  const col = new THREE.Color(), rc = new THREE.Color();
  const PLASTER = [0xffffff, 0xf3ead8, 0xe6e6e6, 0xf5e3b8, 0xdcd3c4, 0xc9d3d8, 0xefd7c8];
  const BRICKC = [0xffffff, 0xe8d8d0, 0xc9b0a8, 0xffe9d9, 0x8f8480, 0xd8c4b0];
  const byName = {};
  for (const b of data.buildings) {
    let p = b.p; const n = p.length / 2; if (n < 3) continue;
    let A = 0, cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; A += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; cx += p[2 * i]; cz += p[2 * i + 1]; }
    cx /= n; cz /= n;
    if (b.n) byName[b.n] = { x: cx, z: cz, h: b.h };
    if (A < 0) { const q = []; for (let i = n - 1; i >= 0; i--) q.push(p[2 * i], p[2 * i + 1]); p = q; }
    const pr = route.project(cx, cz);
    if (pr.d < ROAD_HALF + 1) continue;        // Bruecken/Ueberbauten ueber der Strecke weglassen
    const nm = b.n.toLowerCase(), r = R();
    let kind;
    if (/speicher|schuppen|kaffee|röster|tabak|kontor|zollamt|werft|feuerwache/.test(nm) || b.t === 'warehouse') kind = 'brick';
    else if (b.h < 5 || ['garage', 'garages', 'shed', 'roof', 'hangar', 'service', 'carport'].includes(b.t)) kind = 'metal';
    else if (b.h >= 24 || ['office', 'commercial', 'hotel'].includes(b.t)) kind = r < 0.7 ? 'glass' : 'plaster';
    else if (b.t === 'industrial') kind = r < 0.5 ? 'metal' : 'brick';
    else kind = r < 0.48 ? 'brick' : 'plaster';
    const pal = kind === 'brick' ? BRICKC : kind === 'plaster' ? PLASTER : [0xffffff, 0xdfe8ee, 0xc8d4dc];
    col.setHex(pal[Math.floor(R() * pal.length)]); col.multiplyScalar(0.86 + R() * 0.16);
    const floors = Math.max(1, Math.round(b.h / 3.2)), buf = bufs[kind];
    let u = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, x0 = p[2 * i], z0 = p[2 * i + 1], x1 = p[2 * j], z1 = p[2 * j + 1];
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05) continue;
      const du = L < 2.5 ? L / 4 : Math.max(1, Math.round(L / 4));
      // etwas Rand an der Kachel abschneiden wenn Wand sehr kurz -> keine halben Fenster
      const u0 = L < 2.5 ? 0.02 : u, u1 = L < 2.5 ? 0.02 + Math.min(du, 0.14) : u + du;
      buf.quad([x0, 0, z0], [x0, b.h, z0], [x1, b.h, z1], [x1, 0, z1], [dz / L, 0, -dx / L], [[u0, 0], [u0, floors], [u1, floors], [u1, 0]], col);
      if (L >= 2.5) u += du;
    }
    const tm = ORTHO && tileMats.get(Math.floor(cx / ORTHO[0].s) + ',' + Math.floor(cz / ORTHO[0].s));
    if (tm) { const n0 = tm.buf.p.length / 3; polygon(tm.buf, p, b.h, null, 1);
      for (let i = n0; i < tm.buf.p.length / 3; i++) { tm.buf.uv[2 * i] = (tm.buf.p[3 * i] - tm.t.x) / tm.t.s; tm.buf.uv[2 * i + 1] = 1 - (tm.buf.p[3 * i + 2] - tm.t.z) / tm.t.s; } }
    else { rc.setScalar(0.75 + R() * 0.5); polygon(roofs, p, b.h, rc, 0.15); }
  }
  for (const k in bufs) add(bufs[k].mesh(mats[k], [true, true]));
  if (roofs.p.length) add(roofs.mesh(new THREE.MeshStandardMaterial({ map: T.roofTexture(), roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }), [true, true]));
  for (const tm of tileMats.values()) if (tm.buf.p.length) add(tm.buf.mesh(new THREE.MeshStandardMaterial({ map: tm.tx, roughness: 0.9, side: THREE.DoubleSide }), [true, false]));

  // --- Baeume (echte Positionen) ---
  const treePos = [];
  for (let i = 0; i < data.trees.length; i += 2) {
    const pr = route.project(data.trees[i], data.trees[i + 1]);
    if (pr.d > ROAD_HALF + 0.8) treePos.push([data.trees[i], data.trees[i + 1]]);
  }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }), treePos.length);
  // Kronen: dunkler Kern + viele Blattwerk-Karten (wirkt wie echtes Laub statt wie ein Klotz)
  const CARDS = 30;
  const core = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x3f5f2c, roughness: 1 }), treePos.length);
  const crown = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: T.leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }), treePos.length * CARDS);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), E = new THREE.Euler();
  treePos.forEach(([x, z], i) => {
    const h = 7 + R() * 7, th = h * 0.45, cr = h * 0.3, cy = th + cr * 0.85, hue = 0.2 + R() * 0.1;
    M.compose(V.set(x, th / 2 + 0.3, z), Q.identity(), S.set(0.8 + h / 30, th + 0.6, 0.8 + h / 30)); trunk.setMatrixAt(i, M);
    M.compose(V.set(x, cy, z), Q.setFromEuler(E.set(R() * 3, R() * 3, 0)), S.set(cr * 0.5, cr * 0.6, cr * 0.5)); core.setMatrixAt(i, M);
    for (let k = 0; k < CARDS; k++) {
      const a = R() * 6.283, b = Math.acos(2 * R() - 1), rr = cr * (0.45 + 0.55 * R()), sz = cr * (1.15 + R() * 0.7);
      Q.setFromEuler(E.set(R() * 6.283, R() * 6.283, R() * 6.283));
      M.compose(V.set(x + Math.sin(b) * Math.cos(a) * rr, cy + Math.cos(b) * rr * 0.85, z + Math.sin(b) * Math.sin(a) * rr), Q, S.set(sz, sz, sz));
      crown.setMatrixAt(i * CARDS + k, M);
      crown.setColorAt(i * CARDS + k, col.setHSL(hue + R() * 0.04, 0.3, 0.74 + R() * 0.22));
    }
  });
  trunk.castShadow = crown.castShadow = core.castShadow = true; crown.receiveShadow = true;
  trunk.frustumCulled = crown.frustumCulled = core.frustumCulled = false;
  add(trunk); add(crown); add(core);

  // --- Laternen entlang der Strecke ---
  const nL = Math.floor(route.len / 45);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 7, 6), new THREE.MeshStandardMaterial({ color: 0x555b60, metalness: 0.7, roughness: 0.4 }), nL);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.1, 0.9), new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 0.5, roughness: 0.3 }), nL);
  for (let i = 0; i < nL; i++) {
    const side = i % 2 ? 1 : -1, p = route.at(20 + i * 45, side * (ROAD_HALF + 0.7), P);
    M.compose(V.set(p.x, 3.5, p.z), Q.identity(), S.set(1, 1, 1)); poles.setMatrixAt(i, M);
    const q = route.at(20 + i * 45, side * (ROAD_HALF + 0.25), P);
    Q.setFromEuler(E.set(0, p.yaw + Math.PI / 2, 0)); M.compose(V.set(q.x, 7, q.z), Q, S.set(1, 1, 1)); heads.setMatrixAt(i, M);
  }
  poles.castShadow = true; poles.frustumCulled = heads.frustumCulled = false; add(poles); add(heads);

  // --- Echte Orte: Info-Tafeln mit Foto ---
  const marks = (level.landmarks || []).map(l => ({ ...l, big: true })).concat((data.photos || []).map(p => ({ s: p.s, side: p.side, title: p.title, credit: p.by, photo: p.f })));
  const boardPos = [];
  for (const lm of marks) {
    let s = lm.s ?? (lm.at != null ? lm.at * route.len : null), side = lm.side || 1;
    if (lm.building && byName[lm.building]) { const pr = route.project(byName[lm.building].x, byName[lm.building].z); s = pr.s; side = pr.l < 0 ? -1 : 1; }
    if (s == null) continue;
    s = Math.min(Math.max(s, 40), route.len - 60);
    if (!lm.big && boardPos.some(q => Math.abs(q - s) < 30)) continue;
    boardPos.push(s);
    const p = route.at(s, side * (ROAD_HALF + 4.6), P), g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.6, 0.14), new THREE.MeshStandardMaterial({ color: 0x1d2b3a, roughness: 0.6 }));
    frame.position.y = 3.3; frame.castShadow = true; g.add(frame);
    lm.photo = lm.photo.includes('/') ? lm.photo : 'assets/photos/' + lm.photo;
    const tex = loader.load(lm.photo); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), new THREE.MeshBasicMaterial({ map: tex }));
    ph.position.set(0, 3.65, 0.08); g.add(ph);
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.6), new THREE.MeshBasicMaterial({ map: T.labelTexture(lm.title, { bg: '#1d2b3a', fg: '#fff', w: 1024, h: 146, font: 'bold ' + (lm.title.length > 22 ? 44 : lm.title.length > 15 ? 60 : 84) + 'px Arial' }) }));
    cap.position.set(0, 1.95, 0.08); g.add(cap);
    for (const x of [-1.8, 1.8]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6), frame.material); leg.position.set(x, 0.8, 0); g.add(leg); }
    g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw - side * 0.35;   // dem Fahrer zugewandt
    add(g);
    world.landmarks.push({ ...lm, s, side, shown: false });
  }

  // --- Minimap ---
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i <= route.N; i++) { x0 = Math.min(x0, route.xs[i]); x1 = Math.max(x1, route.xs[i]); z0 = Math.min(z0, route.zs[i]); z1 = Math.max(z1, route.zs[i]); }
  x0 -= 350; x1 += 350; z0 -= 350; z1 += 350;
  const MS = 2048 / Math.max(x1 - x0, z1 - z0);
  const mc = document.createElement('canvas'); mc.width = Math.ceil((x1 - x0) * MS); mc.height = Math.ceil((z1 - z0) * MS);
  const g = mc.getContext('2d');
  const path = (flat, close) => { g.beginPath(); for (let i = 0; i < flat.length; i += 2) g[i ? 'lineTo' : 'moveTo']((flat[i] - x0) * MS, (flat[i + 1] - z0) * MS); if (close) g.closePath(); };
  g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, mc.width, mc.height);
  g.fillStyle = '#bfe0a8'; for (const p of data.green) { path(p, true); g.fill(); }
  g.fillStyle = '#8fc1e8'; for (const p of data.water) { path(p, true); g.fill(); }
  g.fillStyle = '#c9bfb0'; for (const b of data.buildings) { path(b.p, true); g.fill(); }
  g.strokeStyle = '#ffffff'; g.lineCap = 'round';
  for (const r of data.roads) { const w = WIDTH[r.k]; if (!w) continue; g.lineWidth = Math.max(1, w * MS); path(r.p); g.stroke(); }
  g.strokeStyle = '#e2001a'; g.lineWidth = 5; g.beginPath();
  for (let i = 0; i <= route.N; i++) g[i ? 'lineTo' : 'moveTo']((route.xs[i] - x0) * MS, (route.zs[i] - z0) * MS);
  g.stroke();
  world.map = { canvas: mc, x0, z0, scale: MS };

  return world;
}
