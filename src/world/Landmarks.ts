import * as THREE from 'three';

/** Hand-built landmarks around Sule Pagoda. Local frame: footprint centre at the origin, front facade toward +z, y up. */
export interface Landmark { id: string; cx: number; cz: number; w: number; d: number; yaw: number; build(): THREE.Group }

// ---------------------------------------------------------------- textures (one tile = 4 m x 4 m of facade)
type Draw = (x: CanvasRenderingContext2D) => void;
function canvasTex(draw: Draw, size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d')!; draw(x);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const grain = (x: CanvasRenderingContext2D, a = 0.06) => { for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 3); } };
const stainDown = (x: CanvasRenderingContext2D, px: number, w: number, y: number) => { const g = x.createLinearGradient(0, y, 0, y + 40); g.addColorStop(0, 'rgba(70,58,40,.25)'); g.addColorStop(1, 'rgba(70,58,40,0)'); x.fillStyle = g; x.fillRect(px, y, w, 40); };

/** City Hall: cream stucco, paired arched windows with green shutters, a plain cornice band */
const cityWall: Draw = (x) => {
  x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, 128, 128); grain(x);
  x.fillStyle = '#d3c6a6'; x.fillRect(0, 0, 128, 7); x.fillRect(0, 118, 128, 10);
  for (const px of [14, 70]) {
    x.fillStyle = '#f4efe0'; x.beginPath(); x.moveTo(px - 3, 112); x.lineTo(px - 3, 50); x.arc(px + 21, 50, 24, Math.PI, 0); x.lineTo(px + 45, 112); x.fill();
    x.fillStyle = '#2f4a45'; x.beginPath(); x.moveTo(px + 1, 108); x.lineTo(px + 1, 50); x.arc(px + 21, 50, 20, Math.PI, 0); x.lineTo(px + 41, 108); x.fill();
    x.fillStyle = '#6a8f7e'; for (let i = 0; i < 6; i++) x.fillRect(px + 1, 40 + i * 11, 40, 3);
    x.fillStyle = '#d6cba8'; x.fillRect(px - 5, 108, 52, 5);
  }
  stainDown(x, 0, 128, 108);
};
const cityArcade: Draw = (x) => {
  x.fillStyle = '#e2d5b6'; x.fillRect(0, 0, 128, 128); grain(x);
  for (const px of [4, 68]) { x.fillStyle = '#2a2622'; x.beginPath(); x.moveTo(px, 128); x.lineTo(px, 52); x.arc(px + 28, 52, 28, Math.PI, 0); x.lineTo(px + 56, 128); x.fill(); x.fillStyle = '#3d362e'; x.fillRect(px + 6, 70, 44, 58); }
  x.fillStyle = '#f2ebd6'; x.fillRect(60, 0, 8, 128); x.fillRect(0, 0, 4, 128); x.fillRect(124, 0, 4, 128);
  x.fillStyle = '#cfc2a0'; x.fillRect(0, 0, 128, 8);
};
/** High Court: red brick with white stone bands and pointed arch windows */
const brickWall: Draw = (x) => {
  x.fillStyle = '#a24c38'; x.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 32; r++) for (let c = -1; c < 17; c++) { const o = (r % 2) * 4; x.fillStyle = `rgb(${150 + Math.random() * 26},${64 + Math.random() * 20},${44 + Math.random() * 16})`; x.fillRect(c * 8 + o + 0.5, r * 4 + 0.5, 7, 3); }
  x.fillStyle = '#e6dfd0'; x.fillRect(0, 0, 128, 6); x.fillRect(0, 62, 128, 4);
  for (const px of [18, 78]) {
    x.fillStyle = '#e6dfd0'; x.beginPath(); x.moveTo(px - 3, 112); x.lineTo(px - 3, 42); x.lineTo(px + 15, 14); x.lineTo(px + 33, 42); x.lineTo(px + 33, 112); x.fill();
    x.fillStyle = '#1f2a33'; x.beginPath(); x.moveTo(px + 1, 108); x.lineTo(px + 1, 44); x.lineTo(px + 15, 22); x.lineTo(px + 29, 44); x.lineTo(px + 29, 108); x.fill();
    x.fillStyle = '#d6cfc0'; x.fillRect(px + 14, 24, 2, 84); x.fillRect(px + 1, 62, 28, 2);
  }
  x.fillStyle = '#e6dfd0'; x.fillRect(0, 118, 128, 10);
};
/** Rowe & Co / AYA Bank: warm buff stucco with pilasters, round-headed windows and a heavy cornice */
const buffWall: Draw = (x) => {
  x.fillStyle = '#e6d2a4'; x.fillRect(0, 0, 128, 128); grain(x);
  x.fillStyle = '#f3e8c8'; for (const px of [0, 118]) x.fillRect(px, 0, 10, 128);
  x.fillRect(0, 0, 128, 8); x.fillRect(0, 56, 128, 5);
  for (const row of [0, 1]) { const y0 = row ? 66 : 14, h = 46;
    x.fillStyle = '#f7f0d9'; x.beginPath(); x.moveTo(30, y0 + h); x.lineTo(30, y0 + 14); x.arc(64, y0 + 14, 34, Math.PI, 0); x.lineTo(98, y0 + h); x.fill();
    x.fillStyle = '#31404a'; x.beginPath(); x.moveTo(36, y0 + h - 4); x.lineTo(36, y0 + 14); x.arc(64, y0 + 14, 28, Math.PI, 0); x.lineTo(92, y0 + h - 4); x.fill();
    x.fillStyle = '#e9e0c4'; x.fillRect(63, y0 - 10, 2, h + 6); }
  stainDown(x, 0, 128, 100);
};
const buffArcade: Draw = (x) => {
  x.fillStyle = '#d9c391'; x.fillRect(0, 0, 128, 128); grain(x);
  x.fillStyle = '#2b2a2a'; x.beginPath(); x.moveTo(16, 128); x.lineTo(16, 56); x.arc(64, 56, 48, Math.PI, 0); x.lineTo(112, 128); x.fill();
  x.fillStyle = '#7f9aa6'; x.fillRect(26, 70, 76, 58); x.fillStyle = '#e9dfc0'; x.fillRect(62, 70, 4, 58);
  x.fillStyle = '#f3e8c8'; for (const px of [0, 118]) x.fillRect(px, 0, 10, 128);
};
const churchWall: Draw = (x) => {
  x.fillStyle = '#ddd7c8'; x.fillRect(0, 0, 128, 128); grain(x, 0.09);
  x.fillStyle = '#c9c2b0'; x.fillRect(0, 0, 128, 6); x.fillRect(0, 122, 128, 6);
  x.fillStyle = '#f2eee4'; x.beginPath(); x.moveTo(44, 104); x.lineTo(44, 40); x.lineTo(64, 12); x.lineTo(84, 40); x.lineTo(84, 104); x.fill();
  x.fillStyle = '#3b4a5a'; x.beginPath(); x.moveTo(50, 100); x.lineTo(50, 42); x.lineTo(64, 20); x.lineTo(78, 42); x.lineTo(78, 100); x.fill();
  x.fillStyle = '#ddd7c8'; x.fillRect(63, 24, 2, 76); x.fillRect(50, 60, 28, 2);
  stainDown(x, 0, 128, 96);
};
const glassWall: Draw = (x) => {
  const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#7fa2b8'); g.addColorStop(0.5, '#a9c5d4'); g.addColorStop(1, '#5d7f96'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#cfd6da'; x.fillRect(0, 0, 128, 5); x.fillRect(0, 0, 4, 128); x.fillRect(62, 0, 3, 128);
  x.fillStyle = '#8c969c'; x.fillRect(0, 104, 128, 24);
  x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(8, 8, 20, 90);
};
const podiumWall: Draw = (x) => {
  x.fillStyle = '#c9c4b8'; x.fillRect(0, 0, 128, 128); grain(x);
  x.fillStyle = '#2f4452'; x.fillRect(6, 24, 116, 70);
  x.fillStyle = '#b9b4a8'; for (const px of [6, 40, 74, 110]) x.fillRect(px, 24, 4, 70);
  x.fillStyle = '#a7a296'; x.fillRect(0, 0, 128, 12);
};
const roofTile = (c: string, line: string): Draw => (x) => { x.fillStyle = c; x.fillRect(0, 0, 128, 128); x.fillStyle = line; for (let i = 0; i < 128; i += 8) x.fillRect(i, 0, 2, 128); grain(x, 0.05); };
const stone: Draw = (x) => { x.fillStyle = '#cfc9bb'; x.fillRect(0, 0, 128, 128); grain(x, 0.1); };

// ---------------------------------------------------------------- helpers
const mat = (t: THREE.Texture, rx = 1, ry = 1) => { const m = new THREE.MeshLambertMaterial({ map: t }); void rx; void ry; return m; };
let cache: Record<string, THREE.Material> | null = null;
function M() {
  if (cache) return cache;
  const lam = (d: Draw) => mat(canvasTex(d));
  cache = {
    city: lam(cityWall), cityArc: lam(cityArcade), brick: lam(brickWall), buff: lam(buffWall), buffArc: lam(buffArcade), church: lam(churchWall), glass: lam(glassWall), podium: lam(podiumWall),
    maroon: lam(roofTile('#7d2c24', '#5f1f19')), slate: lam(roofTile('#4b5560', '#394149')), copper: lam(roofTile('#5f9a86', '#4b8470')), grey: lam(roofTile('#8d8a85', '#7a7772')), stone: lam(stone),
    cream: new THREE.MeshLambertMaterial({ color: 0xeee3c6 }), white: new THREE.MeshLambertMaterial({ color: 0xf1ede3 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8a93a, metalness: 0.7, roughness: 0.35 }), dark: new THREE.MeshLambertMaterial({ color: 0x2a2a2c }),
  };
  return cache;
}
const TILE = 4;
/** facade slab: side faces use `side` material tiled every 4 m, top/bottom use `top` */
function slab(g: THREE.Group, side: THREE.Material, top: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, tile = TILE) {
  const geo = new THREE.BoxGeometry(w, h, d); const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    if (f < 2) uv.setXY(k, uv.getX(k) * d / tile, uv.getY(k) * h / tile);
    else if (f >= 4) uv.setXY(k, uv.getX(k) * w / tile, uv.getY(k) * h / tile);
  }
  const m = new THREE.Mesh(geo, [side, side, top, top, side, side]); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m;
}
function plain(g: THREE.Group, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y + h / 2, z); me.castShadow = me.receiveShadow = true; g.add(me); return me;
}
/** floors stacked: ground (arcade tile) + n upper floors of fh metres; returns top y */
function floors(g: THREE.Group, lo: THREE.Material, up: THREE.Material, top: THREE.Material, w: number, d: number, x: number, z: number, y0: number, gh: number, n: number, fh: number) {
  if (gh > 0.01) slab(g, lo, top, w, gh, d, x, y0, z, gh);
  let y = y0 + gh;
  for (let i = 0; i < n; i++) { slab(g, up, top, w, fh, d, x, y, z, Math.min(fh, 4.6)); y += fh; }
  return y;
}
/** hip roof over w x d, rising h */
function hip(g: THREE.Group, m: THREE.Material, w: number, d: number, h: number, x: number, y: number, z: number) {
  const r = new THREE.Mesh(new THREE.ConeGeometry(0.7071, 1, 4), m); r.rotation.y = Math.PI / 4; r.scale.set(w * 1.04, h, d * 1.04); r.position.set(x, y + h / 2, z); r.castShadow = true; g.add(r); return r;
}
/** gable roof, ridge along z */
function gable(g: THREE.Group, roof: THREE.Material, gableEnd: THREE.Material, w: number, d: number, h: number, x: number, y: number, z: number) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.3, 0); s.lineTo(w / 2 + 0.3, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d + 0.6, bevelEnabled: false });
  const m = new THREE.Mesh(geo, [gableEnd, roof]); m.position.set(x, y, z - d / 2 - 0.3); m.castShadow = true; g.add(m); return m;
}
function spire(g: THREE.Group, m: THREE.Material, w: number, h: number, x: number, y: number, z: number) {
  const r = new THREE.Mesh(new THREE.ConeGeometry(0.7071, 1, 4), m); r.rotation.y = Math.PI / 4; r.scale.set(w, h, w); r.position.set(x, y + h / 2, z); r.castShadow = true; g.add(r); return r;
}
/** Burmese pyatthat: stacked tiers of shrinking hip roofs separated by cream bands, gold hti on top */
function pyatthat(g: THREE.Group, w0: number, tiers: number, tierH: number, x: number, y: number, z: number, roofMat: THREE.Material) {
  const m = M(); let w = w0, cy = y;
  for (let i = 0; i < tiers; i++) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.34, w * 0.7071, tierH, 4, 1), roofMat); r.rotation.y = Math.PI / 4; r.position.set(x, cy + tierH / 2, z); r.castShadow = true; g.add(r);
    cy += tierH; const nw = w * 0.74;
    plain(g, m.cream, nw * 0.96, 0.9, nw * 0.96, x, cy, z); cy += 0.9; w = nw;
  }
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.28, 3.6, 8), m.gold); f.position.set(x, cy + 1.8, z); g.add(f);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), m.gold); b.position.set(x, cy + 0.9, z); g.add(b);
  return cy + 3.6;
}
/** row of columns along x at depth z */
function columns(g: THREE.Group, m: THREE.Material, n: number, span: number, h: number, x: number, y: number, z: number, r = 0.42) {
  for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r, h, 10), m); c.position.set(x - span / 2 + (span * i) / (n - 1), y + h / 2, z); c.castShadow = true; g.add(c); }
}

// ---------------------------------------------------------------- the six landmarks
function cityHall(): THREE.Group {
  const g = new THREE.Group(), m = M();
  const W = 90, D = 50, plinth = 1.2;
  plain(g, m.stone, W + 2, plinth, D + 2, 0, 0, 0);
  // central block + two long wings + end pavilions
  const topC = floors(g, m.cityArc, m.city, m.grey, 32, 36, 0, -4, plinth, 5, 2, 4.6);
  for (const s of [-1, 1]) {
    floors(g, m.cityArc, m.city, m.grey, 26, 30, s * 31, -4, plinth, 5, 2, 4.6);
    const topE = floors(g, m.cityArc, m.city, m.grey, 15, 34, s * 37.5, -2, plinth, 5, 2, 4.6);
    hip(g, m.maroon, 26, 30, 4.5, s * 31, plinth + 5 + 9.2, -4);
    pyatthat(g, 13, 3, 2.6, s * 37.5, topE, -2, m.maroon);
  }
  // central portico: columns, entablature, steps
  plain(g, m.stone, 24, 0.5, 4.5, 0, plinth, 18.5); plain(g, m.stone, 22, 0.5, 3, 0, plinth + 0.5, 19.2);
  columns(g, m.white, 8, 20, 9.6, 0, plinth + 1, 19.8, 0.5);
  plain(g, m.white, 23, 1.3, 4.2, 0, plinth + 10.6, 19); plain(g, m.cream, 23, 1.2, 4, 0, plinth + 11.9, 19);
  // seven-tier pyatthat over the centre, on a square drum
  slab(g, m.city, m.grey, 15, 5, 15, 0, topC, -4);
  pyatthat(g, 20, 7, 3, 0, topC + 5, -4, m.maroon);
  hip(g, m.maroon, 32, 36, 4.5, 0, topC, -4);
  return g;
}
function immanuel(): THREE.Group {
  const g = new THREE.Group(), m = M();
  // nave (ridge along z) with lower aisles, twin towers on the front corners
  const nave = floors(g, m.church, m.church, m.grey, 15, 26, 0, -1, 0, 0.001, 1, 11);
  gable(g, m.slate, m.church, 15, 26, 6, 0, nave, -1);
  for (const s of [-1, 1]) {
    const a = floors(g, m.church, m.church, m.grey, 6, 24, s * 10.5, -1, 0, 0.001, 1, 6.5);
    plain(g, m.slate, 7, 0.4, 24.6, s * 10.5, a, -1);
    const t = floors(g, m.church, m.church, m.grey, 8, 8, s * 12.5, 9.5, 0, 0.001, 1, 20);
    plain(g, m.white, 8.6, 0.8, 8.6, s * 12.5, t, 9.5);
    spire(g, m.slate, 7.4, 13, s * 12.5, t + 0.8, 9.5);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 4), m.gold); f.position.set(s * 12.5, t + 14.6, 9.5); g.add(f);
  }
  // front porch between the towers
  slab(g, m.church, m.grey, 8, 7.5, 3, 0, 0, 12.5, 7.5); gable(g, m.slate, m.church, 8, 3, 3, 0, 7.5, 12.5);
  return g;
}
function ayaBank(): THREE.Group {
  const g = new THREE.Group(), m = M();
  const W = 34, D = 30;
  const top = floors(g, m.buffArc, m.buff, m.grey, W, D, 0, 0, 0, 5.2, 2, 5);
  plain(g, m.cream, W + 0.8, 0.9, D + 0.8, 0, top, 0);                          // cornice
  for (let i = 0; i < 18; i++) { plain(g, m.cream, 0.4, 1.0, 0.4, -W / 2 + 1 + i * 1.9, top + 0.9, D / 2 + 0.2); plain(g, m.cream, 0.4, 1.0, 0.4, -W / 2 + 1 + i * 1.9, top + 0.9, -D / 2 - 0.2); }
  // corner turret toward the roundabout (south-west): octagon drum + copper dome
  const cx = -W / 2 + 3.2, cz = D / 2 - 3.2;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 6, 8), m.buff); drum.position.set(cx, top + 3, cz); drum.castShadow = true; g.add(drum);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.6, 8), m.cream); ring.position.set(cx, top + 6.3, cz); g.add(ring);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.copper); dome.position.set(cx, top + 6.6, cz); dome.castShadow = true; g.add(dome);
  const hti = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 3, 6), m.gold); hti.position.set(cx, top + 11.6, cz); g.add(hti);
  // small hipped roof over the rest
  hip(g, m.grey, W - 3, D - 3, 2.2, 1.5, top + 0.9, -1.5);
  return g;
}
function glassTower(W: number, D: number, podH: number, towerW: number, towerD: number, H: number, podW = W, podD = D, tx = 0, tz = 0): THREE.Group {
  const g = new THREE.Group(), m = M();
  slab(g, m.podium, m.grey, podW, podH, podD, 0, 0, 0, 4);
  const tt = H - podH, n = Math.round(tt / 3.6);
  slab(g, m.glass, m.grey, towerW, n * 3.6, towerD, tx, podH, tz, 3.6); const y = podH + n * 3.6;
  slab(g, m.glass, m.grey, towerW * 0.8, 6, towerD * 0.8, tx, y, tz, 3);
  plain(g, m.white, towerW * 0.5, 2.5, towerD * 0.5, tx, y + 6, tz);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, 8, 6), m.white); mast.position.set(tx, y + 12.5, tz); g.add(mast);
  void W; void D;
  return g;
}
function highCourt(): THREE.Group {
  const g = new THREE.Group(), m = M();
  const W = 108, D = 96, topL = 17;
  // wings: two long red-brick ranges with gabled bays; centre block with clock tower; corner turrets
  for (const s of [-1, 1]) {
    floors(g, m.brick, m.brick, m.slate, 34, 40, s * 36, 0, 0, 0.001, 1, topL);
    hip(g, m.slate, 34, 40, 7, s * 36, topL, 0);
    for (const dx of [-9, 9]) { slab(g, m.brick, m.slate, 10, topL + 3, 3, s * 36 + dx, 0, 21.5, 4); gable(g, m.slate, m.brick, 10, 3, 4.5, s * 36 + dx, topL + 3, 21.5); }
  }
  const cTop = floors(g, m.brick, m.brick, m.slate, 40, 44, 0, 2, 0, 0.001, 1, 22);
  hip(g, m.slate, 40, 44, 8, 0, cTop, 2);
  // clock tower
  const tTop = floors(g, m.brick, m.brick, m.slate, 11, 11, 0, 20, 0, 0.001, 1, 46);
  for (const [dx, dz, ry] of [[0, 5.65, 0], [0, -5.65, Math.PI], [5.65, 0, Math.PI / 2], [-5.65, 0, -Math.PI / 2]] as const) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24), new THREE.MeshBasicMaterial({ color: 0xf3efe0 })); face.position.set(dx, 38, 20 + dz); face.rotation.y = ry; g.add(face);
  }
  plain(g, m.white, 12.4, 1.2, 12.4, 0, tTop, 20);
  spire(g, m.slate, 11, 17, 0, tTop + 1.2, 20);
  // corner turrets
  for (const [x, z] of [[-W / 2 + 3, -D / 2 + 3], [W / 2 - 3, -D / 2 + 3], [-W / 2 + 3, D / 2 - 3], [W / 2 - 3, D / 2 - 3]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, topL + 6, 10), m.brick); t.position.set(x, (topL + 6) / 2, z); t.castShadow = true; g.add(t);
    const c = new THREE.Mesh(new THREE.ConeGeometry(3.6, 7, 10), m.slate); c.position.set(x, topL + 6 + 3.5, z); c.castShadow = true; g.add(c);
  }
  void W;
  return g;
}

export const LANDMARKS: Landmark[] = [
  { id: 'city-hall', cx: 51, cz: -37, w: 90, d: 50, yaw: 0, build: cityHall },
  { id: 'immanuel', cx: 129, cz: 84, w: 34, d: 28, yaw: Math.PI, build: immanuel },
  { id: 'aya-bank', cx: 131, cz: 20, w: 34, d: 30, yaw: 0, build: ayaBank },
  { id: 'sakura-tower', cx: 8.6, cz: -469.5, w: 34, d: 29, yaw: 0, build: () => glassTower(34, 29, 14, 28, 23, 74) },
  { id: 'sule-shangri-la', cx: -88, cz: -428, w: 34, d: 121, yaw: 0, build: () => glassTower(34, 121, 12, 30, 32, 70, 34, 121, 0, -44) },
  { id: 'high-court', cx: 171, cz: 190, w: 112, d: 101, yaw: Math.PI, build: highCourt },
];

export function buildLandmarks(): THREE.Group {
  const out = new THREE.Group();
  for (const l of LANDMARKS) { const g = l.build(); g.position.set(l.cx, 0, l.cz); g.rotation.y = l.yaw; g.name = l.id; out.add(g); }
  return out;
}
