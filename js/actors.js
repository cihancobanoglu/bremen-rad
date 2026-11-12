// 3D-Modelle fuer Hindernisse, Sammelobjekte, Ueberraschungen und das Cockpit.
// Alle Modelle schauen in Richtung -Z (Fahrtrichtung).
import * as THREE from '../lib/three.module.min.js';
import { labelTexture } from './textures.js';
import { GLTFLoader } from '../lib/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from '../lib/addons/utils/SkeletonUtils.js';

// ---------------- Echte 3D-Modelle (Kenney Car Kit, CC0) ----------------
const MODELS = {};
const CAR_FILES = ['sedan', 'sedan-sports', 'hatchback-sports', 'suv', 'suv-luxury', 'taxi', 'sedan', 'suv', 'hatchback-sports', 'police'];
const VAN_FILES = ['van', 'delivery', 'truck'];
export async function loadAssets() {
  if (MODELS.done) return;
  const loader = new GLTFLoader();
  await Promise.all([...new Set([...CAR_FILES, ...VAN_FILES])].map(async n => {
    try {
      const g = await loader.loadAsync('assets/models/cars/' + n + '.glb');
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material.roughness = 0.32; o.material.metalness = 0.35; o.material.envMapIntensity = 1.1; } });
      MODELS[n] = g.scene;
    } catch (e) { console.warn('Modell fehlt:', n); }
  }));
  // Modelle von Sketchfab (CC BY, siehe assets/photos/CREDITS.md)
  await Promise.all(Object.entries(SPEC).map(async ([n, spec]) => {
    try {
      const g = await loader.loadAsync(DL + n + '.glb');
      await fixSpecGloss(g);
      REAL[n] = { scene: normalize(g.scene, spec), clips: g.animations, spec };
    } catch (e) { console.warn('Modell fehlt:', n, e); }
  }));
  // Sophia hat nur eine Steh-Animation -> Nathans Gang auf ihr (gleiches) Skelett uebertragen
  if (REAL.sophia && REAL.nathan) {
    const src = REAL.nathan.clips[0].clone(), A = 'rp_nathan_animated_003_walking_', B = 'rp_sophia_animated_003_idling_';
    src.tracks = src.tracks.filter(t => !t.name.endsWith('.scale'));
    for (const t of src.tracks) { t.name = t.name.replace(A, B); if (t.name.includes('_hip_') && t.name.endsWith('.position')) for (let i = 0; i < t.values.length; i++) t.values[i] *= 84.16 / 94.58; }
    REAL.sophia.clips = [src];
  }
  MODELS.done = true;
}

const DL = 'assets/models/indirilenler/', REAL = {};
// Three.js r160 kennt KHR_materials_pbrSpecularGlossiness nicht mehr -> Diffus-Textur selbst zuweisen
async function fixSpecGloss(gltf) {
  const jobs = [], seen = new Set();
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      const e = m.userData.gltfExtensions && m.userData.gltfExtensions.KHR_materials_pbrSpecularGlossiness;
      if (!e || seen.has(m)) continue;
      seen.add(m);
      if (e.diffuseTexture) jobs.push(gltf.parser.getDependency('texture', e.diffuseTexture.index).then(t => { t.colorSpace = THREE.SRGBColorSpace; m.map = t; m.needsUpdate = true; }));
      if (e.diffuseFactor) m.color.setRGB(e.diffuseFactor[0], e.diffuseFactor[1], e.diffuseFactor[2]);
      m.transparent = false; m.depthWrite = true; m.metalness = 0; m.roughness = 0.85;
    }
  });
  await Promise.all(jobs);
}
// h = Zielhoehe in Metern, len = Ziellaenge (Fahrzeuge), yaw = Drehung damit das Modell nach -Z schaut
const SPEC = {
  nathan: { h: 1.8, yaw: Math.PI }, sophia: { h: 1.68, yaw: Math.PI },
  alien: { h: 1.3, yaw: Math.PI }, penguin: { h: 0.8, yaw: Math.PI },
  trex: { h: 5.0, yaw: Math.PI, clip: '02_Walk' }, chimp: { h: 0.9, yaw: Math.PI, clip: '03_Gallop' },
  milano: { len: 4.3, yaw: 0 }, kiri: { len: 4.0, yaw: 0 }, bmw: { len: 4.3, yaw: 0 },
  shvan: { len: 4.9, yaw: 0 }, eurovan: { len: 5.4, yaw: 0 },
  bicycle: { raw: true },                 // Hollandrad, 1,9 m lang, vorne = +X
  boy: { raw: true },                     // sitzendes Kind (Scan), schaut nach +X
  helmet: { raw: true },                  // Kinderhelm
  mansit: { raw: true, clip: 'mixamo.com' },   // sitzender Mann, schaut nach +Z
};
function normalize(scene, spec) {
  const outer = new THREE.Group(), yawG = new THREE.Group(); outer.add(yawG); yawG.add(scene);
  if (spec.raw) { scene.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; } }); return outer; }
  const box = new THREE.Box3(), size = new THREE.Vector3(), c = new THREE.Vector3();
  const measure = () => { outer.updateMatrixWorld(true); box.setFromObject(scene); box.getSize(size); box.getCenter(c); };
  measure();
  if (spec.len && size.x > size.z) { scene.rotation.y += Math.PI / 2; measure(); }
  scene.scale.multiplyScalar(spec.len ? spec.len / size.z : spec.h / size.y); measure();
  scene.position.x -= c.x; scene.position.z -= c.z; scene.position.y -= box.min.y;
  yawG.rotation.y = spec.yaw || 0;
  scene.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.isSkinnedMesh) o.frustumCulled = false; } });
  outer.userData.size = size.clone();
  return outer;
}
const TINTS = [0xffffff, 0xffffff, 0x6f7480, 0xbfd4ff, 0xffe9c4, 0x9fb7a4, 0x4a4d55], tintCache = new Map();
function tint(g, name, ti) {
  if (!ti || TINTS[ti] === 0xffffff) return g;
  g.traverse(o => {
    if (!o.isMesh) return;
    const key = name + ':' + ti + ':' + o.material.uuid;
    if (!tintCache.has(key)) { const m = o.material.clone(); m.color.multiply(new THREE.Color(TINTS[ti])); tintCache.set(key, m); }
    o.material = tintCache.get(key);
  });
  return g;
}
function real(name, rate = 1) {
  const m = REAL[name]; if (!m) return null;
  const g = cloneSkinned(m.scene); g.userData = {};
  const clip = m.clips && (m.clips.find(c => c.name === m.spec.clip) || m.clips[0]);
  if (clip) { const mixer = new THREE.AnimationMixer(g); mixer.clipAction(clip).play(); g.userData.anim = (t, speed = 1) => mixer.setTime(Math.abs(t) * speed * rate); }
  else g.userData.anim = () => {};
  return g;
}
export function person(R = Math.random) {
  const g = real(R() < 0.5 ? 'nathan' : 'sophia'); if (!g) return personPrimitive(R);
  g.userData.hl = 0.35; g.userData.hw = 0.35; return g;
}
export function alien() { const g = real('alien'); if (!g) return alienPrimitive(); g.userData.hl = 0.4; g.userData.hw = 0.35; return g; }
export function monkey() { const g = real('chimp', 1.3); if (!g) return monkeyPrimitive(); g.userData.hl = 0.45; g.userData.hw = 0.4; return g; }
export function penguin() { const g = real('penguin', 1.4); if (!g) return penguinPrimitive(); g.userData.hl = 0.35; g.userData.hw = 0.3; return g; }
export function dino() { const g = real('trex'); if (!g) return dinoPrimitive(); g.userData.hl = 1.6; g.userData.hw = 1.6; return g; }


const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true;
  if (parent) parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r1, r2, h, n = 12) => new THREE.CylinderGeometry(r1, r2, h, n);
const sph = (r, n = 14) => new THREE.SphereGeometry(r, n, Math.max(8, n - 4));

const CAR_COLORS = [0xb8bcc0, 0x22252a, 0xf2f2f2, 0x1f3f78, 0x8c1c1c, 0x2f5d3a, 0x6a6f75, 0xd9b23a, 0x35607a];
const tire = std(0x151515, { roughness: 0.9 }), glassM = std(0x1b2a36, { roughness: 0.08, metalness: 0.8 });
const lampW = new THREE.MeshBasicMaterial({ color: 0xfff6d0 }), lampR = new THREE.MeshBasicMaterial({ color: 0xd01010 });

export function car(R = Math.random, van = false) {
  const rl = (van ? ['shvan', 'eurovan'] : ['milano', 'kiri', 'bmw']).filter(n => REAL[n]);
  if (rl.length) { const n = rl[Math.floor(R() * rl.length)], g = tint(real(n), n, Math.floor(R() * TINTS.length)), sz = REAL[n].scene.userData.size; g.userData.hl = REAL[n].spec.len / 2; g.userData.hw = sz.x * (REAL[n].spec.len / sz.z) / 2 - 0.08; return g; }
  const list = van ? VAN_FILES : CAR_FILES, src = MODELS[list[Math.floor(R() * list.length)]];
  if (!src) return carPrimitive(R, van);
  const g = new THREE.Group(), m = src.clone(true);
  const sx = van ? 1.3 : 1.2, sz = van ? 1.85 : 1.66;
  m.scale.set(sx, sx, sz); m.rotation.y = Math.PI;                 // Modell schaut nach +Z, Spiel nach -Z
  m.traverse(o => { if (o.name && o.name.startsWith('wheel')) o.scale.z = sx / sz; });   // Raeder rund halten
  g.add(m);
  const bb = new THREE.Box3().setFromObject(g);
  g.userData = { hl: (bb.max.z - bb.min.z) / 2, hw: (bb.max.x - bb.min.x) / 2 - 0.05 };
  return g;
}
function carPrimitive(R = Math.random, van = false) {
  const g = new THREE.Group();
  const color = van ? 0xf4f4f0 : CAR_COLORS[Math.floor(R() * CAR_COLORS.length)];
  const paint = std(color, { roughness: 0.28, metalness: 0.55 });
  const W = van ? 1.95 : 1.78, L = van ? 5.2 : 4.3, H = van ? 1.25 : 0.7;
  mesh(box(W, H, L), paint, 0, 0.32 + H / 2, 0, g);
  if (van) {
    mesh(box(W - 0.06, 0.95, L * 0.72), paint, 0, 0.32 + H + 0.47, L * 0.13, g);
    mesh(box(W - 0.1, 0.8, 1.2), glassM, 0, 0.32 + H + 0.38, -L * 0.3, g).rotation.x = 0.35;
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), new THREE.MeshBasicMaterial({ map: labelTexture('PAKET-EXPRESS', { bg: '#f4f4f0', fg: '#d98a00', w: 512, h: 138, font: 'bold 60px Arial' }) }));
    logo.position.set(W / 2 + 0.01, 1.6, 0.6); logo.rotation.y = Math.PI / 2; g.add(logo);
    const l2 = logo.clone(); l2.position.x = -W / 2 - 0.01; l2.rotation.y = -Math.PI / 2; g.add(l2);
  } else {
    const cab = mesh(box(W - 0.2, 0.58, L * 0.5), glassM, 0, 0.32 + H + 0.28, L * 0.04, g);
    mesh(box(W - 0.16, 0.06, L * 0.42), paint, 0, 0.32 + H + 0.59, L * 0.04, g);
    cab.scale.z = 1;
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const w = mesh(cyl(0.33, 0.33, 0.24, 16), tire, x * (W / 2 - 0.08), 0.33, z * L * 0.31, g); w.rotation.z = Math.PI / 2;
  }
  for (const x of [-1, 1]) {
    mesh(box(0.34, 0.14, 0.05), lampW, x * (W / 2 - 0.3), 0.72, -L / 2 - 0.01, g);
    mesh(box(0.34, 0.12, 0.05), lampR, x * (W / 2 - 0.3), 0.75, L / 2 + 0.01, g);
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.12), new THREE.MeshBasicMaterial({ map: labelTexture('HB·' + 'ABCDEKLMRS'[Math.floor(R() * 10)] + 'X ' + Math.floor(100 + R() * 899), { w: 256, h: 60, font: 'bold 40px Arial', border: '#111' }) }));
  plate.position.set(0, 0.5, L / 2 + 0.04); g.add(plate);
  const p2 = plate.clone(); p2.position.z = -L / 2 - 0.04; p2.rotation.y = Math.PI; g.add(p2);
  g.userData = { hl: L / 2, hw: W / 2 };
  return g;
}

const SKIN = [0xf1c9a5, 0xd9a47a, 0x9a6a48, 0xf6d7bd], CLOTH = [0xc8102e, 0x1f4f9a, 0x2f7d4a, 0xe0a81c, 0x4a4a52, 0x8e3d8e, 0xf2f2f2, 0x222222];
function personPrimitive(R = Math.random, scale = 1) {
  const g = new THREE.Group(), skin = std(SKIN[Math.floor(R() * SKIN.length)]), top = std(CLOTH[Math.floor(R() * CLOTH.length)]), pant = std([0x23304a, 0x33363b, 0x5a4a3a][Math.floor(R() * 3)]);
  mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), top, 0, 1.15, 0, g);
  mesh(sph(0.13), skin, 0, 1.68, 0, g);
  mesh(sph(0.135), std([0x2a1d14, 0x6b4a2a, 0xd8c08a, 0x111111, 0x999999][Math.floor(R() * 5)]), 0, 1.72, 0.03, g).scale.set(1, 0.85, 1);
  const legs = [], arms = [];
  for (const x of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(x * 0.1, 0.86, 0); g.add(hip);
    mesh(new THREE.CapsuleGeometry(0.075, 0.68, 4, 8), pant, 0, -0.42, 0, hip); legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(x * 0.27, 1.42, 0); g.add(sh);
    mesh(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), top, 0, -0.28, 0, sh); arms.push(sh);
  }
  g.scale.setScalar(scale);
  g.userData = { hl: 0.35, hw: 0.35, anim(t, speed = 1) { const a = Math.sin(t * 7 * speed) * 0.6; legs[0].rotation.x = a; legs[1].rotation.x = -a; arms[0].rotation.x = -a * 0.7; arms[1].rotation.x = a * 0.7; } };
  return g;
}

// Lage des sitzenden Mannes auf dem Sattel (Gruppe: vorne = -Z)
const RIDER = { y: 0.47, z: 0.42 };
function bikeFrame(color = 0x2a6fb0) {
  const g = new THREE.Group(), fr = std(color, { metalness: 0.5, roughness: 0.35 });
  for (const z of [-0.55, 0.55]) { const w = mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 24), tire, 0, 0.35, z, g); w.rotation.y = Math.PI / 2; }
  const tube = (a, b, r = 0.022) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = mesh(cyl(r, r, A.distanceTo(B), 8), fr, 0, 0, 0, g); m.position.copy(A).lerp(B, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); };
  tube([0, 0.35, 0.55], [0, 0.9, 0.2]); tube([0, 0.9, 0.2], [0, 0.95, -0.38]); tube([0, 0.95, -0.38], [0, 0.35, -0.55]);
  tube([0, 0.35, 0.55], [0, 0.38, 0.05]); tube([0, 0.38, 0.05], [0, 0.9, 0.2]); tube([0, 0.38, 0.05], [0, 0.95, -0.38]);
  tube([-0.25, 1.0, -0.38], [0.25, 1.0, -0.38]);
  mesh(box(0.14, 0.05, 0.26), std(0x1a1a1a), 0, 0.95, 0.22, g);
  return g;
}
export function cyclist(R = Math.random) {
  if (REAL.bicycle && REAL.mansit) {
    const g = new THREE.Group();
    const bike = tint(real('bicycle'), 'bicycle', Math.floor(R() * TINTS.length)); bike.rotation.y = Math.PI / 2; g.add(bike);   // +X -> -Z
    const man = real('mansit'); man.scale.setScalar(0.51); man.rotation.y = Math.PI; man.position.set(0, RIDER.y, RIDER.z); g.add(man);
    man.userData.anim(1.2);
    g.userData = { hl: 0.95, hw: 0.35, anim: (t) => bike.userData.anim(t, 1.6) };
    return g;
  }
  const g = new THREE.Group(); g.add(bikeFrame(CLOTH[Math.floor(R() * CLOTH.length)]));
  const p = personPrimitive(R); p.position.set(0, 0.12, 0.18); p.rotation.x = -0.25; g.add(p);
  mesh(sph(0.15), std(0xf4f4f4), 0, 1.88, 0.02, g).scale.set(1, 0.7, 1.15);
  g.userData = { hl: 0.9, hw: 0.32, anim: (t) => p.userData.anim(t, 0.8) };
  return g;
}

export function baustelle() {
  const g = new THREE.Group(), red = std(0xd41a1a), white = std(0xf4f4f4), W = 2.4;
  for (const z of [0, 2.2]) {
    for (let i = 0; i < 6; i++) mesh(box(W / 6, 0.26, 0.05), i % 2 ? white : red, -W / 2 + W / 12 + i * W / 6, 0.95, z, g);
    for (let i = 0; i < 6; i++) mesh(box(W / 6, 0.2, 0.05), i % 2 ? red : white, -W / 2 + W / 12 + i * W / 6, 0.55, z, g);
    for (const x of [-1, 1]) { mesh(box(0.06, 1.1, 0.06), std(0x777777), x * (W / 2 - 0.1), 0.55, z, g); mesh(box(0.5, 0.1, 0.3), std(0x222222), x * (W / 2 - 0.1), 0.05, z, g); }
  }
  for (const x of [-0.9, 0.9]) { const l = mesh(sph(0.09), new THREE.MeshBasicMaterial({ color: 0xffb400 }), x, 1.22, 0, g); l.userData.blink = true; }
  mesh(new THREE.ConeGeometry(0.9, 0.5, 12), std(0x8a7a5a, { roughness: 1 }), 0, 0.25, 1.1, g);   // Sandhaufen
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.42, 3), new THREE.MeshBasicMaterial({ map: labelTexture('!', { bg: '#fff', fg: '#111', w: 128, h: 128, font: 'bold 80px Arial', border: '#d41a1a' }) }));
  sign.position.set(-W / 2 - 0.3, 1.7, -0.3); sign.rotation.z = -Math.PI / 6; sign.rotation.y = Math.PI; g.add(sign);
  mesh(cyl(0.03, 0.03, 1.5, 6), std(0x888888), -W / 2 - 0.3, 0.75, -0.3, g);
  g.userData = { hl: 1.5, hw: W / 2, z0: 1.1, blinkers: g.children.filter(c => c.userData.blink) };
  return g;
}
export function pothole() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.135; m.scale.set(1, 0.7, 1); g.add(m);
  const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 14), new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 }));
  r.rotation.x = -Math.PI / 2; r.position.y = 0.13; r.scale.set(1, 0.7, 1); g.add(r);
  g.userData = { hl: 0.4, hw: 0.5 };
  return g;
}
export function bin(R = Math.random) {
  const g = new THREE.Group(), c = std([0x2b2b2b, 0x1f5fa8, 0x8a5a2a, 0xd8b21a][Math.floor(R() * 4)], { roughness: 0.5 });
  mesh(box(0.55, 0.95, 0.65), c, 0, 0.6, 0, g); mesh(box(0.6, 0.08, 0.72), c, 0, 1.11, 0, g);
  for (const x of [-1, 1]) mesh(cyl(0.1, 0.1, 0.06), tire, x * 0.24, 0.1, 0.28, g).rotation.z = Math.PI / 2;
  g.userData = { hl: 0.4, hw: 0.33 };
  return g;
}

export function canister() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x14d6ff, emissive: 0x0a7fb0, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.25 });
  mesh(cyl(0.2, 0.2, 0.6, 16), m, 0, 0, 0, g); mesh(sph(0.2), m, 0, 0.3, 0, g); mesh(cyl(0.07, 0.09, 0.16, 10), std(0xdddddd, { metalness: 0.9, roughness: 0.2 }), 0, 0.54, 0, g);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: labelTexture('N₂O', { bg: '#ffffff', fg: '#0a5f88', w: 128, h: 128, font: 'bold 56px Arial' }) }));
  lab.position.z = 0.205; g.add(lab); const l2 = lab.clone(); l2.position.z = -0.205; l2.rotation.y = Math.PI; g.add(l2);
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -1.0; g.add(glow);
  g.traverse(o => o.castShadow = false);
  g.userData = { hl: 0.9, hw: 0.7 };
  return g;
}
export function brezel() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xb0102e, emissiveIntensity: 0.9, roughness: 0.3 });
  // Herz aus zwei Kugeln + Kegel
  mesh(sph(0.2), m, -0.15, 0.1, 0, g); mesh(sph(0.2), m, 0.15, 0.1, 0, g);
  const c = mesh(new THREE.ConeGeometry(0.33, 0.45, 14), m, 0, -0.2, 0, g); c.rotation.x = Math.PI; c.scale.z = 0.6;
  g.traverse(o => o.castShadow = false);
  g.userData = { hl: 0.9, hw: 0.7 };
  return g;
}

export function ampel() {
  const g = new THREE.Group(), dark = std(0x2a2d30);
  mesh(cyl(0.07, 0.07, 3.4, 8), dark, 0, 1.7, 0, g); mesh(box(0.34, 1.0, 0.3), dark, 0, 3.0, 0, g);
  const mk = (y) => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: 0x222222 })); l.position.set(0, y, 0.16); g.add(l); return l; };
  const red = mk(3.32), yellow = mk(3.0), green = mk(2.68);
  g.userData = { set(state) { red.material.color.setHex(state === 'rot' ? 0xff2a1a : 0x331111); yellow.material.color.setHex(state === 'gelb' ? 0xffc21a : 0x332a11); green.material.color.setHex(state === 'gruen' ? 0x2aff5a : 0x113318); } };
  return g;
}

// ---------------- Ueberraschungen ----------------
export function ufo() {
  const g = new THREE.Group(), hull = std(0xaab4be, { metalness: 0.95, roughness: 0.18 });
  const d = mesh(sph(4.2, 32), hull, 0, 0, 0, g); d.scale.y = 0.2;
  const dome = mesh(sph(1.7, 24), new THREE.MeshStandardMaterial({ color: 0x8ff0ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3, emissive: 0x1a6a7a }), 0, 0.5, 0, g); dome.scale.y = 0.75;
  const lights = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, l = new THREE.Mesh(sph(0.2, 8), new THREE.MeshBasicMaterial({ color: 0x7dff5a })); l.position.set(Math.cos(a) * 3.5, -0.35, Math.sin(a) * 3.5); g.add(l); lights.push(l); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x7dff7a, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(beam);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ color: 0x7dff7a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; g.add(pool);
  g.userData = { beam, lights, anim(t, height) { g.rotation.y = t * 0.8; beam.scale.y = height; beam.position.y = -height / 2; pool.position.y = -height + 0.2; pool.visible = beam.visible; beam.material.opacity = 0.26 + Math.sin(t * 9) * 0.08; lights.forEach((l, i) => l.material.color.setHSL((t * 0.4 + i / 12) % 1, 1, 0.6)); } };
  return g;
}
function alienPrimitive() {
  const g = new THREE.Group(), skin = std(0x62d94a, { roughness: 0.4 }), black = std(0x050505, { roughness: 0.05, metalness: 0.6 });
  mesh(new THREE.CapsuleGeometry(0.17, 0.3, 4, 10), skin, 0, 0.6, 0, g);
  const head = mesh(sph(0.27, 18), skin, 0, 1.08, 0, g); head.scale.set(1, 1.2, 0.95);
  for (const x of [-1, 1]) {
    const e = mesh(sph(0.1), black, x * 0.12, 1.1, -0.2, g); e.scale.set(0.8, 1.25, 0.5); e.rotation.z = x * 0.5;
    mesh(cyl(0.012, 0.012, 0.3, 5), skin, x * 0.12, 1.5, 0, g); mesh(sph(0.04, 8), new THREE.MeshBasicMaterial({ color: 0xffe94a }), x * 0.12, 1.66, 0, g);
  }
  const legs = [], arms = [];
  for (const x of [-1, 1]) {
    const h = new THREE.Group(); h.position.set(x * 0.09, 0.4, 0); g.add(h); mesh(cyl(0.045, 0.04, 0.4, 6), skin, 0, -0.2, 0, h); legs.push(h);
    const a = new THREE.Group(); a.position.set(x * 0.2, 0.78, 0); g.add(a); mesh(cyl(0.035, 0.03, 0.42, 6), skin, 0, -0.2, 0, a); a.rotation.z = x * 2.4; arms.push(a);
  }
  g.userData = { hl: 0.4, hw: 0.35, anim(t) { const a = Math.sin(t * 9) * 0.6; legs[0].rotation.x = a; legs[1].rotation.x = -a; arms[0].rotation.z = -2.4 + Math.sin(t * 6) * 0.4; arms[1].rotation.z = 2.4 - Math.sin(t * 6) * 0.4; } };
  return g;
}
function monkeyPrimitive() {
  const g = new THREE.Group(), fur = std(0x6b4423, { roughness: 1 }), face = std(0xe2b98a, { roughness: 0.8 });
  const body = mesh(new THREE.CapsuleGeometry(0.19, 0.28, 4, 10), fur, 0, 0.5, 0.05, g); body.rotation.x = 0.5;
  mesh(sph(0.19), fur, 0, 0.9, -0.12, g);
  mesh(sph(0.12), face, 0, 0.86, -0.25, g).scale.set(1, 0.85, 0.7);
  for (const x of [-1, 1]) { mesh(sph(0.075, 8), face, x * 0.19, 0.93, -0.1, g); mesh(sph(0.025, 6), std(0x000000), x * 0.06, 0.93, -0.3, g); }
  const limbs = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const h = new THREE.Group(); h.position.set(x * 0.14, 0.5, z * 0.18 + 0.03); g.add(h); mesh(cyl(0.05, 0.04, 0.5, 6), fur, 0, -0.24, 0, h); limbs.push(h); }
  const tail = mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 14, Math.PI * 1.2), fur, 0, 0.72, 0.42, g); tail.rotation.y = Math.PI / 2;
  g.userData = { hl: 0.45, hw: 0.4, anim(t) { const a = Math.sin(t * 14) * 0.9; limbs[0].rotation.x = a; limbs[1].rotation.x = -a; limbs[2].rotation.x = -a; limbs[3].rotation.x = a; g.position.y += Math.abs(Math.sin(t * 7)) * 0.28; tail.rotation.z = Math.sin(t * 5) * 0.3; } };
  return g;
}
export function banana() {
  const g = new THREE.Group(), y = std(0xffd92e, { roughness: 0.5 });
  for (let i = 0; i < 4; i++) { const c = mesh(new THREE.ConeGeometry(0.06, 0.34, 6), y, 0, 0.17, 0, g); c.rotation.z = Math.PI / 2 - 0.25; c.rotation.y = i * Math.PI / 2; c.position.set(Math.cos(i * Math.PI / 2) * 0.14, 0.18, -Math.sin(i * Math.PI / 2) * 0.14); }
  mesh(cyl(0.035, 0.05, 0.14, 6), y, 0, 0.24, 0, g);
  g.userData = { hl: 0.35, hw: 0.3 };
  return g;
}

function penguinPrimitive() {
  const g = new THREE.Group(), black = std(0x15171c, { roughness: 0.5 }), white = std(0xf6f6f2), orange = std(0xff9a1a);
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.32, 4, 12), black, 0, 0.42, 0, g);
  mesh(sph(0.19), white, 0, 0.4, -0.07, g).scale.set(0.85, 1.25, 0.7);
  mesh(sph(0.15), black, 0, 0.82, 0, g);
  for (const x of [-1, 1]) { mesh(sph(0.045, 8), white, x * 0.07, 0.85, -0.11, g); mesh(sph(0.02, 6), black, x * 0.07, 0.855, -0.15, g); mesh(box(0.13, 0.04, 0.2), orange, x * 0.1, 0.02, -0.06, g); }
  mesh(new THREE.ConeGeometry(0.045, 0.14, 8), orange, 0, 0.79, -0.19, g).rotation.x = -Math.PI / 2;
  const fl = [-1, 1].map(x => { const f = mesh(box(0.04, 0.36, 0.14), black, x * 0.23, 0.46, 0, g); f.rotation.z = x * 0.25; return f; });
  g.userData = { hl: 0.35, hw: 0.3, anim(t) { g.rotation.z = Math.sin(t * 9) * 0.2; fl[0].rotation.z = -0.25 - Math.abs(Math.sin(t * 9)) * 0.4; fl[1].rotation.z = 0.25 + Math.abs(Math.sin(t * 9)) * 0.4; body.position.y = 0.42; } };
  return g;
}
function dinoPrimitive() {
  const g = new THREE.Group(), skin = std(0x4f7a3a, { roughness: 0.85 }), belly = std(0xb9b27a, { roughness: 0.9 }), dark = std(0x2f4a22, { roughness: 0.9 });
  const torso = new THREE.Group(); torso.position.y = 3.3; g.add(torso);
  mesh(sph(1, 20), skin, 0, 0, 0, torso).scale.set(1.0, 1.15, 2.1);
  mesh(sph(0.9, 16), belly, 0, -0.3, -0.3, torso).scale.set(0.9, 0.9, 1.7);
  const tail = mesh(new THREE.ConeGeometry(0.75, 4.2, 12), skin, 0, 0.1, 3.4, torso); tail.rotation.x = Math.PI / 2 - 0.1;
  const neck = mesh(cyl(0.55, 0.8, 1.6, 12), skin, 0, 0.9, -1.7, torso); neck.rotation.x = -0.7;
  const head = new THREE.Group(); head.position.set(0, 1.6, -2.5); torso.add(head);
  mesh(box(1.0, 0.75, 1.9), skin, 0, 0.15, -0.5, head);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.2, 0.2); head.add(jaw); mesh(box(0.85, 0.28, 1.6), dark, 0, -0.14, -0.7, jaw);
  for (let i = 0; i < 7; i++) for (const x of [-1, 1]) { mesh(new THREE.ConeGeometry(0.06, 0.2, 5), std(0xfffbe8), x * 0.4, -0.3, -0.1 - i * 0.2, head).rotation.x = Math.PI; }
  for (const x of [-1, 1]) { mesh(sph(0.11, 8), new THREE.MeshBasicMaterial({ color: 0xffd21a }), x * 0.46, 0.38, -0.55, head); mesh(sph(0.05, 6), std(0x000000), x * 0.52, 0.38, -0.6, head);
    const arm = mesh(cyl(0.09, 0.06, 0.7, 6), skin, x * 0.75, -0.5, -1.3, torso); arm.rotation.x = -1.0; }
  for (let i = 0; i < 6; i++) mesh(new THREE.ConeGeometry(0.16, 0.5, 4), dark, 0, 1.15 - Math.abs(i - 2) * 0.05, -1 + i * 0.6, torso);
  const legs = [-1, 1].map(x => { const hip = new THREE.Group(); hip.position.set(x * 0.85, 3.0, 0.3); g.add(hip);
    mesh(cyl(0.5, 0.36, 1.7, 10), skin, 0, -0.8, 0, hip); mesh(cyl(0.3, 0.26, 1.5, 10), skin, 0, -2.2, 0.15, hip); mesh(box(0.7, 0.3, 1.2), dark, 0, -2.86, -0.25, hip); return hip; });
  g.userData = { hl: 1.6, hw: 1.6, anim(t) { const a = Math.sin(t * 2.6) * 0.45; legs[0].rotation.x = a; legs[1].rotation.x = -a; torso.position.y = 3.3 + Math.abs(Math.cos(t * 2.6)) * 0.15; torso.rotation.x = Math.sin(t * 2.6) * 0.03; jaw.rotation.x = 0.25 + Math.sin(t * 3.1) * 0.22; head.rotation.y = Math.sin(t * 0.9) * 0.3; tail.rotation.z = Math.sin(t * 1.3) * 0.15; } };
  return g;
}

// ---------------- Cockpit (Ich-Perspektive: Lenker + Kind) ----------------
// Lage von Kind-Modell und Helm relativ zur Kopfmitte (in Metern)
const KID = { s: 0.9, y: -0.36, z: 0.0, hs: 0.85, hy: -1.94, hz: 0.0 };
export function cockpit(vehicle) {
  const rig = new THREE.Group(), steer = new THREE.Group();
  const black = std(0x16171a, { roughness: 0.7 }), chrome = std(0xc9ced2, { metalness: 0.95, roughness: 0.2 }), skin = std(0xe8b890, { roughness: 0.7 });
  const scooter = vehicle.id === 'scooter', ebike = vehicle.id === 'ebike';
  const barW = scooter ? 0.24 : 0.33, barY = scooter ? -0.28 : -0.31, barZ = -0.62;
  steer.position.set(0, barY, barZ); rig.add(steer);
  const frameCol = scooter ? 0x1fb86a : ebike ? 0x202428 : 0xc8102e;
  const realBike = !scooter && REAL.bicycle; let bikeRef = null;
  if (realBike) {
    // Griffmitte im Modell ~ (x 0.22, y 1.15) -> an den Ursprung der Lenkgruppe legen
    const bike = ebike ? tint(real('bicycle'), 'bicycle', 6) : real('bicycle');
    bike.rotation.y = Math.PI / 2; bike.position.set(0, -1.15, 0.22); steer.add(bike);
    bikeRef = bike;
  }
  if (!realBike) { const bar = mesh(cyl(0.016, 0.016, barW * 2, 10), ebike || scooter ? black : chrome, 0, 0, 0, steer); bar.rotation.z = Math.PI / 2; }
  for (const x of [-1, 1]) {
    if (!realBike) { const grip = mesh(cyl(0.024, 0.024, 0.13, 10), black, x * (barW - 0.03), 0, 0, steer); grip.rotation.z = Math.PI / 2; }
    // Haende + Unterarme
    // Hand im Fahrradhandschuh, um den Griff geschlossen
    const glove = std(0x1c1d21, { roughness: 0.8 }), hx = realBike ? x * 0.27 : x * (barW - 0.035), hy = realBike ? -0.005 : 0.02;
    const hand = mesh(new THREE.CapsuleGeometry(0.032, 0.06, 4, 10), glove, hx, hy, 0.012, steer); hand.rotation.z = Math.PI / 2; hand.scale.set(0.85, 1, 1.2);
    for (let f = 0; f < 4; f++) mesh(new THREE.CapsuleGeometry(0.0105, 0.028, 3, 6), glove, hx - x * 0.04 + x * f * 0.024, hy - 0.012, -0.028, steer).rotation.x = Math.PI / 2 - 0.9;
    mesh(new THREE.CapsuleGeometry(0.012, 0.035, 3, 6), glove, hx - x * 0.055, hy + 0.012, 0.0, steer).rotation.z = Math.PI / 2;
    const arm = mesh(new THREE.CapsuleGeometry(0.045, 0.5, 4, 8), std(scooter ? 0x2f5d8a : 0x24426b), realBike ? x * 0.33 : x * (barW + 0.02), -0.06, 0.3, steer);
    arm.rotation.x = Math.PI / 2 - 0.25; arm.rotation.z = -x * 0.12;
    if (!realBike) { const lever = mesh(cyl(0.007, 0.007, 0.12, 6), chrome, x * (barW - 0.09), 0.0, -0.05, steer); lever.rotation.z = Math.PI / 2; }
  }
  if (!realBike) {
    mesh(cyl(0.022, 0.026, 0.5, 10), std(frameCol, { metalness: 0.5, roughness: 0.3 }), 0, -0.25, -0.03, steer).rotation.x = -0.12;
    mesh(sph(0.032, 12), chrome, -barW + 0.14, 0.035, 0, steer).scale.y = 0.6;   // Klingel
  }
  // Vorderrad / Schutzblech
  if (realBike) { /* kommt aus dem Modell */ } else if (!scooter) {
    const wheel = mesh(new THREE.TorusGeometry(0.33, 0.03, 8, 28), tire, 0, -0.78, -0.42, steer); wheel.rotation.y = Math.PI / 2;
    mesh(box(0.07, 0.02, 0.5), std(frameCol, { metalness: 0.5, roughness: 0.3 }), 0, -0.42, -0.42, steer);
    // Korb/Lampe
    mesh(cyl(0.035, 0.03, 0.05, 10), chrome, 0, -0.1, -0.1, steer).rotation.x = Math.PI / 2;
  } else {
    mesh(box(0.16, 0.03, 0.9), black, 0, -1.3, 0.2, rig);    // Trittbrett
  }
  // Display (E-Bike / Scooter)
  let display = null;
  if (ebike || scooter) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), new THREE.MeshBasicMaterial({ map: tx }));
    d.position.set(0.15, 0.04, 0.01); d.rotation.x = -0.9; steer.add(d);
    mesh(box(0.12, 0.012, 0.065), black, 0.15, 0.03, 0.014, steer).rotation.x = -0.9 + Math.PI / 2;
    display = { c, tx, g: c.getContext('2d'), last: -1 };
  }
  // Kind (sitzt/steht vor dem Fahrer): Helm, Schultern, kleine Arme
  const kid = new THREE.Group(); kid.position.set(0, scooter ? -0.37 : -0.36, -0.47); rig.add(kid);
  if (REAL.boy && REAL.helmet) {
    // Kopfmitte liegt im Ursprung der Kind-Gruppe
    const boy = real('boy'); boy.scale.setScalar(KID.s); boy.rotation.y = Math.PI / 2; boy.position.set(0, KID.y, KID.z); kid.add(boy);
    const helm = real('helmet'); helm.scale.setScalar(KID.hs); helm.position.set(0, KID.hy, KID.hz); kid.add(helm);
  } else {
  const helmCol = 0xffd21a;
  const helmet = mesh(sph(0.125, 20), std(helmCol, { roughness: 0.3 }), 0, 0.02, 0, kid); helmet.scale.set(1, 0.92, 1.12);
  for (let i = -1; i <= 1; i++) mesh(box(0.022, 0.012, 0.16), std(0x333333), i * 0.05, 0.125 - Math.abs(i) * 0.012, -0.01, kid);   // Lueftungsschlitze
  mesh(box(0.2, 0.012, 0.04), std(0xc8102e), 0, 0.03, -0.142, kid);         // Schirm
  mesh(new THREE.CapsuleGeometry(0.1, 0.12, 4, 10), std(0x2f9bd6), 0, -0.22, 0.01, kid).rotation.z = Math.PI / 2;   // Schultern (Jacke)
  for (const x of [-1, 1]) {
    const a = mesh(new THREE.CapsuleGeometry(0.032, 0.2, 4, 8), std(0x2f9bd6), x * 0.15, -0.16, -0.14, kid); a.rotation.x = Math.PI / 2 - 0.5; a.rotation.z = -x * 0.25;
    mesh(sph(0.03, 8), skin, x * 0.13, -0.09, -0.25, kid);
  }
  }
  rig.traverse(o => { o.castShadow = false; o.receiveShadow = false; if (o.isMesh) o.frustumCulled = false; });
  rig.userData = {
    steer, kid, display,
    update(t, steerIn, speed, nitro) {
      steer.rotation.y = -steerIn * 0.28; steer.rotation.z = -steerIn * 0.05;
      if (bikeRef) bikeRef.userData.anim(t, 0.25 + speed * 0.12);
      kid.rotation.y = Math.sin(t * 0.5) * 0.25 + steerIn * -0.2; kid.rotation.x = Math.sin(t * 1.3) * 0.03;
      kid.position.x = Math.sin(t * 0.9) * 0.008;
      if (display) {
        const k = Math.round(speed * 3.6);
        if (k !== display.last) {
          display.last = k; const g = display.g;
          g.fillStyle = '#061018'; g.fillRect(0, 0, 128, 64); g.fillStyle = nitro ? '#35e0ff' : '#7dff9a';
          g.font = 'bold 44px Arial'; g.textAlign = 'right'; g.fillText(k, 84, 48); g.font = '16px Arial'; g.fillText('km/h', 124, 48);
          display.tx.needsUpdate = true;
        }
      }
    },
  };
  return rig;
}
