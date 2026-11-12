// Moin Bremen! – Die Radtour.  Spiel-Logik, Steuerung, HUD, Ton.
import * as THREE from '../lib/three.module.min.js';
import { LEVELS, VEHICLES, NITRO } from './levels.js';
import { t, lang, setLang, LANGS } from './i18n.js';
const TEXT = { get warn() { return t('warn'); }, get hit() { return t('hit'); }, get kid() { return t('kid'); } };
import { buildWorld, ROAD_HALF } from './world.js';
import * as A from './actors.js';

const $ = id => document.getElementById(id);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------------- Renderer ----------------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 7000);
camera.rotation.order = 'YXZ'; scene.add(camera);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------------- Zustand ----------------
const G = { state: 'menu', levelIndex: 0, level: null, world: null, vehicle: VEHICLES[0], obs: [], actors: new THREE.Group(), t: 0, surprises: [], ampeln: [], oncomingT: 4, rig: null };
const player = { s: 0, l: 1.7, v: 0, steer: 0, hearts: 3, nitro: 0, nitroT: 0, inv: 0, time: 0, shake: 0, wobble: 0, hits: 0, cans: 0 };
scene.add(G.actors);
window.__g = { G, player, keys: null, tick: null };
const keys = {};
const P = {}, P2 = {};

// ---------------- Ton (WebAudio, alles synthetisch) ----------------
let ac = null, windGain = null, ufoOsc = null, ufoGain = null;
function initAudio() {
  if (ac) { ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.4;
    windGain = ac.createGain(); windGain.gain.value = 0; src.connect(f).connect(windGain).connect(ac.destination); src.start();
    ufoOsc = ac.createOscillator(); ufoOsc.type = 'sine'; ufoOsc.frequency.value = 220; ufoGain = ac.createGain(); ufoGain.gain.value = 0;
    const lfo = ac.createOscillator(); lfo.frequency.value = 6; const lg = ac.createGain(); lg.gain.value = 40; lfo.connect(lg).connect(ufoOsc.frequency); lfo.start();
    ufoOsc.connect(ufoGain).connect(ac.destination); ufoOsc.start();
    G.noise = buf;
  } catch (e) { ac = null; }
}
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noiseBurst(dur, vol, freq = 800) {
  if (!ac) return; const s = ac.createBufferSource(); s.buffer = G.noise; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(); s.stop(ac.currentTime + dur);
}
const sfx = {
  bell() { for (const d of [0, 0.22]) { tone(2350, 0.5, 'sine', 0.12, 0, d); tone(3120, 0.4, 'sine', 0.07, 0, d); } },
  pickup() { tone(880, 0.1, 'triangle', 0.15); tone(1320, 0.18, 'triangle', 0.15, 0, 0.09); },
  heart() { tone(660, 0.12, 'sine', 0.15); tone(990, 0.25, 'sine', 0.15, 0, 0.1); },
  crash() { noiseBurst(0.45, 0.5, 900); tone(110, 0.3, 'square', 0.12, -60); },
  bump() { noiseBurst(0.15, 0.3, 400); },
  nitro() { noiseBurst(1.2, 0.35, 2500); tone(180, 1.1, 'sawtooth', 0.1, 900); },
  ready() { [660, 880, 1100].forEach((f, i) => tone(f, 0.14, 'square', 0.07, 0, i * 0.1)); },
  warn() { tone(740, 0.12, 'square', 0.06); tone(740, 0.12, 'square', 0.06, 0, 0.2); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, 0, i * 0.15)); },
  monkey() { for (let i = 0; i < 5; i++) tone(900 + Math.random() * 700, 0.09, 'square', 0.05, 300, i * 0.1); },
};

// ---------------- HUD ----------------
let warnT = 0, kidT = 0, kidNext = 8, lmT = 0;
function warn(text, big = false) {
  const el = $('warn'); el.textContent = '⚠ ' + text; el.className = big ? 'show big' : 'show'; warnT = big ? 4.5 : 2.6; sfx.warn();
}
function kidSay(cat) { $('kidText').textContent = pick(TEXT.kid[cat]); $('kid').classList.add('show'); kidT = 3; }
function toast(text, cls = '') { const el = $('toast'); el.textContent = text; el.className = 'show ' + cls; clearTimeout(toast.t); toast.t = setTimeout(() => el.className = '', 1800); }
function hudHearts() { $('hearts').innerHTML = '❤'.repeat(player.hearts) + '<span>' + '❤'.repeat(Math.max(0, 3 - player.hearts)) + '</span>'; }
function hudNitro() {
  const full = player.nitro >= NITRO.needed, act = player.nitroT > 0;
  for (let i = 0; i < NITRO.needed; i++) $('can' + i).className = 'can' + (i < player.nitro ? ' on' : '');
  $('nitroFill').style.width = (act ? player.nitroT / NITRO.duration : player.nitro / NITRO.needed) * 100 + '%';
  $('nitro').className = act ? 'active' : full ? 'full' : '';
  $('nitroHint').textContent = act ? t('nitroOn') : full ? t('nitroReady') : t('nitroCount', { n: player.nitro, m: NITRO.needed });
}

// ---------------- Level befuellen ----------------
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const isFree = s => G.world.freeRanges.some(([a, b]) => s >= a && s < b);
function addObs(o) { G.actors.add(o.obj); o.hl ??= o.obj.userData.hl; o.hw ??= o.obj.userData.hw; o.v ??= 0; o.kind ??= 'crash'; G.obs.push(o); place(o); return o; }
function place(o, y = 0, yawAdd = 0) {
  const p = G.world.route.at(o.s + (o.z0 || 0), o.l, P);
  o.obj.position.set(p.x, y + (o.y || 0), p.z); o.obj.rotation.y = p.yaw + yawAdd + (o.yaw || 0);
}

function populate() {
  const { level, world } = G, route = world.route, R = rng(level.seed + 7), len = route.len;
  G.actors.clear(); G.obs = []; G.surprises = []; G.ampeln = [];
  const zones = level.surprises.map(sp => sp.at * len);
  const inZone = (s, m = 75) => zones.some(z => Math.abs(s - z) < m);
  const addWalker = s => { const side = R() < 0.5 ? -1 : 1; addObs({ type: 'walker', obj: A.person(R), s, l: side * (0.5 + R() * 2.8), dir: -side, yaw: side * Math.PI / 2, speed: 0.8 + R() * 0.6 }); };
  const taken = [];

  // Ampeln (echte Positionen)
  for (const s of world.data.signals) {
    const lights = [-1, 1].map(side => { const a = A.ampel(); const p = route.at(s, side * (ROAD_HALF + 0.6), P); a.position.set(p.x, 0, p.z); a.rotation.y = p.yaw + Math.PI; G.actors.add(a); return a; });
    G.ampeln.push({ s, lights, phase: R() * 14, state: 'gruen', warned: false }); taken.push(s);
  }
  // Fussgaenger an echten Zebrastreifen
  for (const s of world.data.crossings) {
    if (s < 70 || s > len - 40 || inZone(s) || R() > level.pedestrianChance || taken.some(t => Math.abs(t - s) < 25)) continue;
    const side = R() < 0.5 ? -1 : 1;
    addObs({ type: 'pedestrian', obj: A.person(R), s, l: side * 5.6, dir: -side, walking: false, yaw: side * Math.PI / 2, speed: 1.3 + R() * 0.5 });
    taken.push(s);
  }
  // Verkehrs-Hindernisse
  const W = [['parked', 22], ['slowcar', 11], ['van', 10], ['cyclist', 12], ['baustelle', 12], ['pothole', 17], ['bin', 10]];
  const total = W.reduce((a, w) => a + w[1], 0);
  let s = 85;
  while (s < len - 70) {
    s += level.obstacleGap[0] + R() * (level.obstacleGap[1] - level.obstacleGap[0]);
    if (inZone(s) || taken.some(t => Math.abs(t - s) < 12)) continue;
    let r = R() * total, type = W[0][0]; for (const [n, w] of W) { if ((r -= w) < 0) { type = n; break; } }
    if (isFree(s) && ['parked', 'slowcar', 'van'].includes(type)) type = 'walker';
    if (type === 'walker') addWalker(s);
    else if (type === 'parked') addObs({ type, obj: A.car(R), s, l: 2.5 });
    else if (type === 'slowcar') addObs({ type, obj: A.car(R), s, l: 1.75, v: 3 + R() * 1.5 });
    else if (type === 'van') addObs({ type, obj: A.car(R, true), s, l: 2.35 });
    else if (type === 'cyclist') addObs({ type, obj: A.cyclist(R), s, l: 2.5, v: 2.6 + R() * 1.2 });
    else if (type === 'baustelle') addObs({ type, obj: A.baustelle(), s, l: 2.15, z0: 1.1 });
    else if (type === 'pothole') addObs({ type, obj: A.pothole(), s, l: -0.6 + R() * 3.4, kind: 'bump' });
    else addObs({ type, obj: A.bin(R), s, l: 0.8 + R() * 2.2, yaw: R() * 3 });
    taken.push(s);
  }
  // Nitro-Kanister + Herzen
  for (let c = 110; c < len - 50; c += level.nitroEvery * (0.8 + R() * 0.4)) {
    let cs = c; while (taken.some(t => Math.abs(t - cs) < 7)) cs += 9;
    addObs({ type: 'nitro', obj: A.canister(), s: cs, l: pick([-1.7, 0, 1.2, 2.4]), y: 1.1, kind: 'pickup' });
  }
  for (const f of [0.45, 0.82]) addObs({ type: 'herz', obj: A.brezel(), s: f * len, l: -1.2 + R() * 3, y: 1.15, kind: 'pickup' });

  // Ueberraschungen
  for (const sp of level.surprises) {
    const s0 = sp.at * len, S = { type: sp.type, s: s0, state: 'wait', t: 0, parts: [] };
    if (sp.type === 'ufo') {
      S.ufo = A.ufo(); S.ufo.visible = false; G.actors.add(S.ufo);
      S.beam = addObs({ type: 'beam', obj: new THREE.Group(), s: s0, l: 0, hl: 1.3, hw: 1.4, hidden: true });
      [-17, -8, 9, 18].forEach((d, i) => S.parts.push(addObs({ type: 'alien', obj: A.alien(), s: s0 + d, l: 0, amp: 2.7, w: 0.9 + i * 0.25, ph: i * 1.7, hidden: true })));
      S.parts.forEach(a => a.obj.visible = false);
    } else if (sp.type === 'affen') {
      for (let i = 0; i < 8; i++) { const side = i % 2 ? 1 : -1; S.parts.push(addObs({ type: 'monkey', obj: A.monkey(), s: s0 - 22 + i * 10, l: side * 6.5, dir: -side, speed: 4 + R() * 2.5, trig: 26 + R() * 14, run: false, hidden: true, hw: 0.4, hl: 0.5 })); }
      for (let i = 0; i < 6; i++) S.parts.push(addObs({ type: 'banana', obj: A.banana(), s: s0 - 15 + i * 13 + R() * 5, l: -2.6 + R() * 5.2, kind: 'slip', hidden: true }));
      S.parts.forEach(a => a.obj.visible = false);
    } else if (sp.type === 'pinguine') {
      for (let grp = 0; grp < 2; grp++) for (let i = 0; i < 5; i++) { const side = grp ? 1 : -1; S.parts.push(addObs({ type: 'pinguin', obj: A.penguin(), s: s0 + grp * 36, l: side * (6 + i * 1.7), dir: -side, speed: 1.7, trig: 55, run: false, hidden: true })); }
      S.parts.forEach(a => a.obj.visible = false);
    } else if (sp.type === 'dino') {
      S.parts.push(addObs({ type: 'dino', obj: A.dino(), s: s0, l: -13, dir: 1, speed: 2.4, hidden: true }));
      S.parts.forEach(a => a.obj.visible = false);
    }
    G.surprises.push(S);
  }
  world.landmarks.forEach(l => l.shown = false);
}

function spawnOncoming() {
  const route = G.world.route, s = player.s + 200;
  if (isFree(s) || isFree(player.s) || isFree(player.s + 100)) return;
  if (s > route.len - 30 || G.surprises.some(S => Math.abs(S.s - s) < 110 && S.state !== 'done')) return;
  addObs({ type: 'oncoming', obj: A.car(Math.random, Math.random() < 0.15), s, l: -1.75, v: -(7 + Math.random() * 4), yaw: Math.PI, dynamic: true });
}

// ---------------- Spielablauf ----------------
async function startGame() {
  initAudio();
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('loading').classList.remove('hidden');
  G.level = LEVELS[G.levelIndex];
  await new Promise(r => setTimeout(r, 60));
  if (!G.world || G.worldLevel !== G.level.id) {
    if (G.world) { G.actors.clear(); G.world.dispose(); G.world = null; }
    const j = async (u, d) => { try { const r = await fetch(u); return r.ok ? await r.json() : d; } catch (e) { return d; } };
    const data = await j(G.level.data);
    data.ortho = await j(G.level.data.replace('.json', '.ortho.json'), []);
    data.orthoHi = await j(G.level.data.replace('.json', '.orthohi.json'), []);
    data.photos = await j(G.level.data.replace('.json', '.photos.json'), []);
    G.world = await buildWorld(scene, renderer, G.level, data); G.worldLevel = G.level.id;
  }
  await A.loadAssets();
  if (G.rig) camera.remove(G.rig);
  G.rig = A.cockpit(G.vehicle); camera.add(G.rig);
  populate();
  Object.assign(player, { s: 22, l: 1.7, v: 0, steer: 0, hearts: 3, nitro: 0, nitroT: 0, inv: 0, time: 0, shake: 0, wobble: 0, hits: 0, cans: 0 });
  G.t = 0; G.oncomingT = 3; kidNext = 9; G.streetIdx = -1;
  hudHearts(); hudNitro(); updateCamera(0);
  renderer.compile(scene, camera); renderer.render(scene, camera);
  $('loading').classList.add('hidden'); $('hud').classList.remove('hidden');
  G.state = 'countdown'; G.count = 3.2; kidSay('start');
}

function endGame(win) {
  G.state = 'end'; $('hud').classList.add('hidden'); $('end').classList.remove('hidden');
  if (windGain) windGain.gain.value = 0; if (ufoGain) ufoGain.gain.value = 0;
  const m = Math.floor(player.time / 60), s = Math.floor(player.time % 60).toString().padStart(2, '0');
  const stars = win ? 1 + (player.hearts >= 2) + (player.hearts === 3) : 0;
  const next = LEVELS[G.levelIndex + 1];
  $('endTitle').textContent = t(win ? 'winTitle' : 'loseTitle');
  $('endText').innerHTML = win
    ? `<div class="stars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></div>` + t('winText', { goal: G.level.finishName, time: `${m}:${s}`, hearts: player.hearts, cans: player.cans }) + (next ? '' : `<br><small>${t('allDone')}</small>`)
    : t('loseText', { m: Math.round(player.s) });
  G.advance = win && !!next;
  $('again').textContent = win ? (next ? t('next', { n: next.id }) : t('again')) : t('retry');
  if (win) { sfx.win(); }
}

function hit(o) {
  const nitro = player.nitroT > 0;
  if (o.kind === 'pickup') {
    o.dead = true; o.obj.visible = false;
    if (o.type === 'nitro') {
      player.cans++;
      if (player.nitroT <= 0 && player.nitro < NITRO.needed) { player.nitro++; if (player.nitro >= NITRO.needed) { sfx.ready(); kidSay('nitroReady'); toast(t('tNitroReady'), 'blue'); } else { sfx.pickup(); toast(t('tCan'), 'blue'); if (Math.random() < 0.4) kidSay('pickup'); } } else sfx.pickup();
      hudNitro();
    } else { if (player.hearts < 3) player.hearts++; hudHearts(); sfx.heart(); toast(t('tHeart'), 'red'); }
    return;
  }
  if (nitro) { o.passed = true; return; }
  if (player.inv > 0) return;
  o.passed = true;
  if (o.kind === 'bump') { player.v *= 0.6; player.shake = 0.35; sfx.bump(); toast(TEXT.hit[o.type]); return; }
  if (o.kind === 'slip') { player.v *= 0.55; player.wobble = 1.3; player.shake = 0.3; sfx.bump(); toast(TEXT.hit[o.type]); o.dead = true; o.obj.visible = false; return; }
  damage(TEXT.hit[o.type] || 'Autsch!');
}
function damage(text) {
  player.hearts--; player.hits++; player.v *= 0.2; player.inv = 1.8; player.shake = 0.7;
  hudHearts(); sfx.crash(); toast(text, 'red'); kidSay('hit');
  $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go');
  if (player.hearts <= 0) setTimeout(() => endGame(false), 700);
}

function fireNitro() {
  if (G.state !== 'play' || player.nitro < NITRO.needed || player.nitroT > 0) return;
  player.nitro = 0; player.nitroT = NITRO.duration; sfx.nitro(); kidSay('nitro'); hudNitro();
  document.body.classList.add('nitro');
}

function updateSurprise(S, dt) {
  const ds = S.s - player.s, route = G.world.route;
  if (S.type === 'ufo') {
    if (S.state === 'wait' && ds < 175) { S.state = 'come'; S.t = 0; S.ufo.visible = true; warn(TEXT.warn.ufo, true); kidSay('ufo'); }
    if (S.state === 'wait' || S.state === 'done') return;
    S.t += dt;
    const p = route.at(S.s, 0, P);
    let h = 11;
    if (S.state === 'come') { const k = clamp(S.t / 3.5, 0, 1), e = 1 - (1 - k) ** 3; h = 90 - 79 * e; S.ufo.position.set(p.x + (1 - e) * 120, h, p.z - (1 - e) * 60); if (k >= 1) { S.state = 'hover'; S.parts.forEach(a => { a.hidden = false; a.obj.visible = true; }); S.beam.hidden = false; } }
    else if (S.state === 'hover') { h = 11 + Math.sin(G.t * 1.6) * 0.6; S.ufo.position.set(p.x, h, p.z); if (ds < -30) { S.state = 'leave'; S.t = 0; S.parts.forEach(a => a.hidden = true); S.beam.hidden = true; } }
    else if (S.state === 'leave') { h = 11 + S.t * S.t * 14; S.ufo.position.set(p.x, h, p.z); S.parts.forEach(a => { a.obj.position.y += S.t * 6; a.obj.scale.setScalar(Math.max(0.01, 1 - S.t * 0.5)); }); if (S.t > 3.5) { S.state = 'done'; S.ufo.visible = false; S.parts.forEach(a => { a.dead = true; a.obj.visible = false; }); } }
    S.ufo.userData.anim(G.t, S.state === 'hover' ? h : 0.01);
    S.ufo.userData.beam.visible = S.state === 'hover';
    if (S.state === 'hover') for (const a of S.parts) { a.l = Math.sin(G.t * a.w + a.ph) * a.amp; place(a, 0, Math.cos(G.t * a.w + a.ph) > 0 ? -Math.PI / 2 : Math.PI / 2); a.obj.userData.anim(G.t); }
    if (ufoGain) ufoGain.gain.value = S.state === 'done' ? 0 : clamp(0.07 - Math.abs(ds) / 3500, 0, 0.07);
  } else if (S.type === 'affen') {
    if (S.state === 'wait' && ds < 95) { S.state = 'go'; warn(TEXT.warn.affen, true); kidSay('affen'); sfx.monkey(); S.parts.forEach(a => { a.hidden = false; a.obj.visible = true; }); }
    if (S.state !== 'go') return;
    for (const a of S.parts) {
      if (a.type !== 'monkey' || a.dead) continue;
      if (!a.run && a.s - player.s < a.trig) { a.run = true; if (Math.random() < 0.5) sfx.monkey(); }
      if (a.run) { a.l += a.dir * a.speed * dt; if (Math.abs(a.l) > 7) { a.dir *= -1; a.l = Math.sign(a.l) * 7; a.run = a.s - player.s > 6; a.trig = 20; } }
      place(a, 0, a.dir > 0 ? -Math.PI / 2 : Math.PI / 2); a.obj.userData.anim(G.t + a.s);
    }
    if (ds < -90) { S.state = 'done'; }
  } else if (S.type === 'pinguine') {
    if (S.state === 'wait' && ds < 110) { S.state = 'go'; warn(TEXT.warn.pinguine, true); kidSay('pinguine'); S.parts.forEach(a => { a.hidden = false; a.obj.visible = true; }); }
    if (S.state !== 'go') return;
    for (const a of S.parts) {
      if (a.dead) continue;
      if (!a.run && a.s - player.s < a.trig) a.run = true;
      if (a.run && a.l * a.dir < 9) a.l += a.dir * a.speed * dt;
      place(a, 0, a.dir > 0 ? -Math.PI / 2 : Math.PI / 2); a.obj.userData.anim(G.t + a.l);
    }
    if (ds < -90) S.state = 'done';
  } else if (S.type === 'dino') {
    if (S.state === 'wait' && ds < 170) { S.state = 'go'; warn(TEXT.warn.dino, true); kidSay('dino'); tone(70, 1.6, 'sawtooth', 0.22, -30); noiseBurst(1.4, 0.3, 500); S.parts.forEach(a => { a.hidden = false; a.obj.visible = true; }); }
    if (S.state !== 'go') return;
    const a = S.parts[0];
    a.l += a.dir * a.speed * dt; if (Math.abs(a.l) > 13) { a.dir *= -1; a.l = Math.sign(a.l) * 13; }
    place(a, 0, a.dir > 0 ? -Math.PI / 2 : Math.PI / 2); a.obj.userData.anim(G.t);
    const step = Math.sin(G.t * 2.6) > 0;
    if (step !== S.step) { S.step = step; if (Math.abs(ds) < 70) { player.shake = Math.max(player.shake, 0.3 * (1 - Math.abs(ds) / 70)); noiseBurst(0.25, 0.35 * (1 - Math.abs(ds) / 70), 180); } }
    if (ds < -70) { S.state = 'done'; a.dead = true; a.obj.visible = false; }
  }
}

function update(dt) {
  const veh = G.vehicle, route = G.world.route;
  G.t += dt; player.time += dt;
  // --- Steuerung ---
  const left = keys.ArrowLeft || keys.KeyA, right = keys.ArrowRight || keys.KeyD, up = keys.ArrowUp || keys.KeyW, down = keys.ArrowDown || keys.KeyS;
  const target = (right ? 1 : 0) - (left ? 1 : 0);
  player.steer += (target - player.steer) * Math.min(1, dt * 9);
  const nitro = player.nitroT > 0;
  let vt = down ? 0 : up ? veh.vmax : veh.cruise; if (nitro) vt = veh.vmax * NITRO.factor;
  if (player.v < vt) player.v = Math.min(vt, player.v + (nitro ? 16 : veh.accel) * dt);
  else player.v = Math.max(vt, player.v - (down ? veh.brake : nitro ? 0 : 2.2) * dt);
  let lat = veh.steer * player.steer * clamp(player.v / 3, 0.2, 1.15);
  if (player.wobble > 0) { player.wobble -= dt; lat += Math.sin(G.t * 14) * 3.2 * player.wobble; }
  player.l += lat * dt;
  const lim = ROAD_HALF - 0.42;
  if (Math.abs(player.l) > lim) { player.l = Math.sign(player.l) * lim; if (Math.abs(player.steer) > 0.3) { player.v *= 1 - 0.9 * dt; player.shake = Math.max(player.shake, 0.08); } }
  const s0 = player.s; player.s += player.v * dt;
  if (player.inv > 0) player.inv -= dt;
  if (nitro) { player.nitroT -= dt; if (player.nitroT <= 0) { player.nitroT = 0; document.body.classList.remove('nitro'); } hudNitro(); }

  // --- Ampeln ---
  for (const a of G.ampeln) {
    const ph = (G.t + a.phase) % 15, st = ph < 7.5 ? 'gruen' : ph < 9 ? 'gelb' : 'rot';
    if (st !== a.state) { a.state = st; a.lights.forEach(l => l.userData.set(st)); }
    const ds = a.s - player.s;
    if (st === 'rot' && ds > 0 && ds < 45 && !a.warned) { a.warned = true; warn(TEXT.warn.ampel); }
    if (ds < -5) a.warned = true; else if (st !== 'rot') a.warned = false;
    if (st === 'rot' && s0 < a.s - 1 && player.s >= a.s - 1 && !nitro && player.inv <= 0) damage(TEXT.hit.ampel);
  }

  // --- Hindernisse ---
  G.oncomingT -= dt; if (G.oncomingT <= 0) { spawnOncoming(); G.oncomingT = G.level.oncomingEvery[0] + Math.random() * (G.level.oncomingEvery[1] - G.level.oncomingEvery[0]); }
  for (let i = G.obs.length - 1; i >= 0; i--) {
    const o = G.obs[i]; if (o.dead) { if (o.dynamic) { G.actors.remove(o.obj); G.obs.splice(i, 1); } continue; }
    let ds = o.s - player.s;
    if (ds < -30 && !o.hidden && o.type !== 'alien' && o.type !== 'dino') { o.dead = true; o.obj.visible = false; continue; }
    if (ds > 420) { o.obj.visible = false; continue; } else if (!o.hidden) o.obj.visible = true;
    if (o.hidden) continue;
    if (o.v) {
      let v = o.v;
      if (v > 0) for (const q of G.obs) if (q !== o && !q.dead && !q.hidden && q.kind === 'crash' && q.s > o.s && q.s - o.s < 9 + q.hl && Math.abs(q.l - o.l) < 1.6) { v = 0; break; }
      if (v > 0 && isFree(o.s + 10) && o.type === 'slowcar') v = 0;
      o.s += v * dt; place(o); if (o.obj.userData.anim && v) o.obj.userData.anim(G.t + o.s);
      ds = o.s - player.s;
    }
    if (o.type === 'walker') {
      o.l += o.dir * o.speed * dt; if (Math.abs(o.l) > 3.6 && Math.sign(o.l) === o.dir) { o.dir *= -1; o.yaw = -o.dir * Math.PI / 2; }
      place(o); o.obj.userData.anim(G.t + o.s, 0.8);
    } else if (o.type === 'pedestrian') {
      if (!o.walking && ds < 24 + player.v * 2.2 && ds > 0) o.walking = true;
      if (o.walking && Math.abs(o.l) < 6.2 || (o.walking && Math.sign(o.l) !== o.dir)) { o.l += o.dir * o.speed * dt; place(o); o.obj.userData.anim(G.t); }
    } else if (o.kind === 'pickup') { o.obj.rotation.y = G.t * 2.5; o.obj.position.y = o.y + Math.sin(G.t * 3 + o.s) * 0.12; }
    else if (o.type === 'baustelle') o.obj.userData.blinkers.forEach(b => b.visible = Math.sin(G.t * 8) > 0);
    // Warnung
    if (!o.warned && ds > 0 && ds < 22 + player.v * 3.2 && TEXT.warn[o.type] && warnT <= 0.6) {
      const rel = o.type === 'pedestrian' || o.type === 'walker' || Math.abs(o.l - player.l) < o.hw + 1.4;
      if (rel && !['monkey', 'alien', 'banana', 'beam', 'dino', 'pinguin'].includes(o.type)) { o.warned = true; if (o.type !== 'oncoming' || player.l < 0.2) warn(TEXT.warn[o.type]); }
    }
    // Kollision
    if (!o.passed && Math.abs(ds) < o.hl + 0.55 && Math.abs(o.l - player.l) < o.hw + veh.halfWidth) hit(o);
  }
  for (const S of G.surprises) updateSurprise(S, dt);

  // --- Orte, Strassennamen, Kind ---
  for (const lm of G.world.landmarks) if (!lm.shown && player.s > lm.s - 75) {
    lm.shown = true; lmT = lm.big ? 6.5 : 4.2; $('lmImg').src = lm.photo; $('lmTitle').textContent = lm.title; $('lmTag').textContent = t(lm.big ? 'sight' : 'photo');
    $('lmText').textContent = t(lm.side < 0 ? 'left' : 'right') + (lm.big && lm.text && lang() === 'de' ? ' · ' + lm.text : lm.credit ? ' · © ' + lm.credit : '');
    $('landmark').classList.add('show'); if (lm.big && Math.random() < 0.6) kidSay('landmark');
  }
  if (lmT > 0 && (lmT -= dt) <= 0) $('landmark').classList.remove('show');
  const st = G.world.data.streets; let idx = 0; for (let i = 0; i < st.length; i++) if (player.s >= st[i][0]) idx = i;
  if (idx !== G.streetIdx) { G.streetIdx = idx; $('street').textContent = st[idx][1]; $('street').classList.remove('pop'); void $('street').offsetWidth; $('street').classList.add('pop'); }
  if (warnT > 0 && (warnT -= dt) <= 0) $('warn').className = '';
  if (kidT > 0 && (kidT -= dt) <= 0) $('kid').classList.remove('show');
  if ((kidNext -= dt) <= 0) { kidNext = 13 + Math.random() * 10; if (kidT <= 0) kidSay('idle'); }

  // --- HUD ---
  $('speed').textContent = Math.round(player.v * 3.6);
  $('progFill').style.width = clamp(player.s / route.len, 0, 1) * 100 + '%';
  $('dist').textContent = Math.max(0, Math.round(route.len - 12 - player.s)) + ' ' + t('toGoal');
  const tm = Math.floor(player.time); $('time').textContent = Math.floor(tm / 60) + ':' + (tm % 60).toString().padStart(2, '0');
  if (windGain) windGain.gain.value = clamp(player.v / 30, 0, 0.5) * 0.25;

  if (player.s >= route.len - 12 && G.state === 'play') { kidSay('win'); endGame(true); }
}

function updateCamera(dt) {
  const route = G.world.route, veh = G.vehicle;
  const p = route.at(player.s, player.l, P), a = route.at(player.s + 8, player.l, P2);
  let dy = a.yaw - p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  const yaw = p.yaw + dy * 0.5;
  player.shake = Math.max(0, player.shake - dt * 1.4);
  const sh = player.shake, bob = Math.sin(G.t * (2 + player.v * 0.9)) * 0.012 * clamp(player.v / 5, 0, 1);
  camera.position.set(p.x + (Math.random() - 0.5) * sh * 0.12, veh.eye + bob + (Math.random() - 0.5) * sh * 0.1, p.z + (Math.random() - 0.5) * sh * 0.12);
  camera.rotation.set(-0.13 + (Math.random() - 0.5) * sh * 0.05, yaw - player.steer * 0.07, -player.steer * 0.075 * clamp(player.v / 6, 0.2, 1) + Math.sin(G.t * 14) * 0.08 * Math.max(0, player.wobble));
  const fovT = player.nitroT > 0 ? 100 : 72 + clamp(player.v / veh.vmax, 0, 1) * 5;
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 4 + (dt === 0 ? 1 : 0)); camera.updateProjectionMatrix(); }
  const w = G.world;
  const fx = p.x + p.tx * 55, fz = p.z + p.tz * 55;
  w.sun.target.position.set(fx, 0, fz); w.sun.position.set(fx + w.sunDir.x * 300, w.sunDir.y * 300, fz + w.sunDir.z * 300);
  G.rig.userData.update(G.t, player.steer, player.v, player.nitroT > 0);
  G.yaw = yaw;
}

const mm = $('minimap'), mg = mm.getContext('2d');
function drawMinimap() {
  const m = G.world.map, Z = 0.85 / m.scale, c = mm.width / 2, p = G.world.route.at(player.s, player.l, P);
  mg.save(); mg.clearRect(0, 0, mm.width, mm.height);
  mg.beginPath(); mg.arc(c, c, c - 2, 0, 7); mg.clip();
  mg.translate(c, c + 28); mg.rotate(G.yaw); mg.scale(Z, Z);
  mg.drawImage(m.canvas, -(p.x - m.x0) * m.scale, -(p.z - m.z0) * m.scale);
  mg.restore();
  mg.fillStyle = '#e2001a'; mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.beginPath(); mg.moveTo(c, c + 16); mg.lineTo(c - 8, c + 38); mg.lineTo(c + 8, c + 38); mg.closePath(); mg.fill(); mg.stroke();
}

// ---------------- Schleife ----------------
let last = performance.now(), frame = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  tick(dt);
}
function tick(dt) {
  if (!G.world || G.state === 'menu') return;
  if (G.state === 'countdown') {
    G.count -= dt; const n = Math.ceil(G.count - 0.2);
    $('count').textContent = n > 0 ? n : t('start'); $('count').classList.add('show');
    if (n !== G.lastCount) { G.lastCount = n; tone(n > 0 ? 440 : 880, n > 0 ? 0.15 : 0.5, 'square', 0.08); }
    G.t += dt; updateCamera(dt);
    if (G.count <= 0) { G.state = 'play'; setTimeout(() => $('count').classList.remove('show'), 500); }
  } else if (G.state === 'play') { update(dt); if (G.state === 'play') updateCamera(dt); }
  if (G.state === 'pause' || G.state === 'end') { if (G.state === 'end') return; }
  renderer.render(scene, camera);
  // Sicherheitsnetz: falls der Grafiktreiber einen Fehler meldet, Zustand + Schattenkarte neu aufbauen
  if (frame % 90 === 0 && renderer.getContext().getError() !== 0) { renderer.resetState(); const sh = G.world.sun.shadow; if (sh.map) { sh.map.dispose(); sh.map = null; } }
  if (frame++ % 2 === 0 && G.state !== 'end') drawMinimap();
}
requestAnimationFrame(loop);
window.__g.tick = tick; window.__g.keys = keys;

// ---------------- Eingabe & Menue ----------------
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Space') fireNitro();
  if (e.code === 'KeyK' && G.state === 'play') sfx.bell();
  if ((e.code === 'KeyP' || e.code === 'Escape') && (G.state === 'play' || G.state === 'pause')) { G.state = G.state === 'play' ? 'pause' : 'play'; $('pause').classList.toggle('hidden', G.state !== 'pause'); }
  if (e.code === 'Enter' && G.state === 'menu') startGame(); else if (e.code === 'Enter' && G.state === 'end') again();
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function renderMenu() {
  const cards = $('vehicles'); cards.innerHTML = '';
  VEHICLES.forEach(v => {
    const d = document.createElement('button'); d.className = 'veh' + (v === G.vehicle ? ' sel' : ''); const [name, text] = t('veh.' + v.id);
    d.innerHTML = `<div class="ico">${v.icon}</div><h3>${name}</h3><p>${text}</p>` + Object.entries(v.stats).map(([k, n]) => `<div class="stat"><span>${t('stats.' + k)}</span><i>${'●'.repeat(n)}<b>${'●'.repeat(5 - n)}</b></i></div>`).join('') + `<div class="kmh">${t('upTo')} ${Math.round(v.vmax * 3.6)} km/h</div>`;
    d.onclick = () => { G.vehicle = v; renderMenu(); };
    cards.appendChild(d);
  });
  const lv = $('levels'); lv.innerHTML = '';
  LEVELS.forEach((L, i) => { const b = document.createElement('button'); b.className = 'lvl' + (i === G.levelIndex ? ' sel' : ''); b.textContent = `${t('level')} ${L.id}: ${t('levels.' + L.id)[0]}`; b.onclick = () => { G.levelIndex = i; renderMenu(); }; lv.appendChild(b); });
  $('levelSub').textContent = t('levels.' + LEVELS[G.levelIndex].id)[1];
  const lg = $('langs'); lg.innerHTML = '';
  LANGS.forEach(([c, n]) => { const b = document.createElement('button'); b.className = 'lang' + (c === lang() ? ' sel' : ''); b.textContent = n; b.onclick = () => { setLang(c); renderMenu(); }; lg.appendChild(b); });
  $('lead').textContent = t('lead'); $('go').textContent = t('go'); $('credit').textContent = t('credit');
  $('keys').innerHTML = [['←</kbd><kbd>→', 'kSteer'], ['↑', 'kPedal'], ['↓', 'kBrake'], [t('space'), 'kNitro'], ['K', 'kBell'], ['P', 'kPause']].map(([k, l]) => `<span><kbd>${k}</kbd>${t(l)}</span>`).join('');
  $('loadTitle').textContent = t('loading'); $('loadSub').textContent = t('loadingSub'); $('pause').textContent = t('pause'); $('toMenu').textContent = t('menu');
  document.documentElement.lang = lang();
}
renderMenu();
function again() { if (G.advance) { G.levelIndex++; G.advance = false; } startGame(); }
$('go').onclick = startGame; $('again').onclick = again;
$('toMenu').onclick = () => { G.state = 'menu'; G.advance = false; renderMenu(); $('end').classList.add('hidden'); $('menu').classList.remove('hidden'); };
const q = new URLSearchParams(location.search);
if (q.has('level')) G.levelIndex = Math.min(LEVELS.length - 1, Math.max(0, +q.get('level') - 1));
if (q.has('veh')) G.vehicle = VEHICLES.find(v => v.id === q.get('veh')) || G.vehicle;
if (new URLSearchParams(location.search).has('auto')) startGame();
