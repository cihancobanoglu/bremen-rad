// Prozedurale Texturen (Canvas) – keine externen Bilddateien noetig
import * as THREE from '../lib/three.module.min.js';

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function noise(g, w, h, n, a, dark = true) {
  for (let i = 0; i < n; i++) {
    const v = Math.random();
    g.fillStyle = dark ? `rgba(0,0,0,${v * a})` : `rgba(255,255,255,${v * a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

// Fahrbahn: u = quer (7 m), v = laengs (9 m Kachel: 3 m Strich, 6 m Luecke)
export function roadTexture() {
  // nur die Markierungen (transparent) – der Asphalt selbst ist eine Foto-Textur
  const [c, g] = canvas(512, 512);
  g.fillStyle = 'rgba(15,15,17,0.28)';          // Flickstellen
  g.fillRect(90, 60, 70, 120); g.fillRect(330, 300, 90, 60);
  g.fillStyle = '#e9e9e4';
  g.fillRect(250, 0, 10, 170);                 // Leitlinie
  g.fillStyle = 'rgba(233,233,228,0.85)';
  g.fillRect(10, 0, 8, 512); g.fillRect(494, 0, 8, 512); // Randlinien
  return tex(c);
}
export function asphaltTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#46484b'; g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 4000, 0.25); noise(g, 256, 256, 2000, 0.1, false);
  return tex(c);
}
export function pavingTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#9d9a94'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = 140 + Math.random() * 35;
    g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
    g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 32 + 1, 30, 30);
  }
  noise(g, 256, 256, 2500, 0.15);
  return tex(c);
}
export function zebraTexture() {
  const [c, g] = canvas(256, 64);
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = '#f1f1ec';
  for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 4, 0, 18, 64);
  noise(g, 256, 64, 600, 0.2);
  const t = tex(c); return t;
}
export function groundTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#7d8273'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 50},${105 + Math.random() * 45},${80 + Math.random() * 30},0.25)`;
    g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 40, 0, 7); g.fill();
  }
  noise(g, 512, 512, 12000, 0.18);
  return tex(c, 400, 400);
}
export function grassTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 70},${95 + Math.random() * 80},${30 + Math.random() * 40},0.5)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
  }
  return tex(c);
}

function windowPane(g, x, y, w, h, frame = '#f2f0ea', lit = false) {
  g.fillStyle = frame; g.fillRect(x - 4, y - 4, w + 8, h + 8);
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  if (lit) { gr.addColorStop(0, '#f6dfa0'); gr.addColorStop(1, '#c9a860'); }
  else { gr.addColorStop(0, '#5c7f9c'); gr.addColorStop(0.5, '#243647'); gr.addColorStop(1, '#3d566b'); }
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = frame; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.36, w, 3);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * 0.5, y); g.lineTo(x + w * 0.75, y); g.lineTo(x + w * 0.25, y + h); g.fill();
}

// Fassaden-Kachel: 4 m breit x 3.2 m hoch (ein Fenster je Geschoss)
export function brickFacade() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#6b3a2c'; g.fillRect(0, 0, 256, 256);
  const bw = 32, bh = 11;
  for (let y = 0; y < 256 / bh + 1; y++) for (let x = -1; x < 256 / bw + 1; x++) {
    const r = 150 + Math.random() * 50, gg = 70 + Math.random() * 30, b = 52 + Math.random() * 22;
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(x * bw + (y % 2) * bw / 2 + 1, y * bh + 1, bw - 2, bh - 2);
  }
  noise(g, 256, 256, 3000, 0.2);
  g.fillStyle = '#d8d2c4'; g.fillRect(74, 52, 108, 8);   // Sturz
  windowPane(g, 82, 64, 92, 128);
  g.fillStyle = '#cfc8b8'; g.fillRect(74, 196, 108, 8);  // Fensterbank
  return tex(c);
}
export function plasterFacade() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f1efe9'; g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 2500, 0.06);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 250, 256, 6);
  windowPane(g, 70, 56, 116, 140, '#e2e0da');
  g.fillStyle = 'rgba(60,60,60,0.5)';               // Balkongelaender
  g.fillRect(60, 200, 136, 4);
  for (let i = 0; i < 12; i++) g.fillRect(62 + i * 12, 200, 2, 30);
  g.fillRect(60, 230, 136, 4);
  return tex(c);
}
export function glassFacade() {
  const [c, g] = canvas(256, 256);
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, '#9fc3dc'); gr.addColorStop(0.5, '#4f7591'); gr.addColorStop(1, '#84aac4');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.beginPath(); g.moveTo(0, 256); g.lineTo(140, 0); g.lineTo(200, 0); g.lineTo(60, 256); g.fill();
  g.fillStyle = '#39424a';
  g.fillRect(0, 0, 256, 14); g.fillRect(0, 0, 6, 256); g.fillRect(125, 0, 6, 256);
  g.fillStyle = '#c9ced2'; g.fillRect(0, 14, 256, 26);   // Bruestung
  return tex(c);
}
export function metalFacade() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#b9bdc0'; g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, 3, 128);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x + 4, 0, 2, 128);
  }
  noise(g, 128, 128, 800, 0.1);
  return tex(c);
}
export function roofTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#5a5c5e'; g.fillRect(0, 0, 128, 128);
  noise(g, 128, 128, 2500, 0.3); noise(g, 128, 128, 800, 0.15, false);
  return tex(c);
}
// Blattwerk-Karte fuer Baumkronen (transparent)
export function leafTexture() {
  const [c, g] = canvas(256, 256);
  for (let i = 0; i < 230; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 104, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r, s = 7 + Math.random() * 10;
    const l = 30 + Math.random() * 30;
    g.save(); g.translate(x, y); g.rotate(Math.random() * 6.28);
    g.fillStyle = `hsl(${88 + Math.random() * 34},${45 + Math.random() * 25}%,${l}%)`;
    g.beginPath(); g.ellipse(0, 0, s, s * 0.5, 0, 0, 6.28); g.fill();
    g.strokeStyle = `hsla(100,40%,${l + 14}%,0.6)`; g.lineWidth = 1; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function cloudTexture() {
  const [c, g] = canvas(256, 128);
  for (let i = 0; i < 22; i++) {
    const x = 40 + Math.random() * 176, y = 45 + Math.random() * 40, r = 18 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Beschriftetes Schild (Text auf farbigem Grund)
export function labelTexture(lines, { bg = '#fff', fg = '#111', w = 512, h = 256, font = 'bold 64px Arial', border = null } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const arr = [].concat(lines);
  arr.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (arr.length - 1) / 2) * parseInt(font.match(/(\d+)px/)[1]) * 1.15));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
