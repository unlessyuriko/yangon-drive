import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface Bld { h: number; pts: number[] }

/** Detailed Yangon-style buildings: shopfront ground floor, four upper-floor facade types (punched shutters, ribbon windows, colonial arches, glass curtain),
 *  weathered tints, flat roofs with PVC water tanks, windows that light up at night. */

const BAY = 3.4, FLOOR = 3.3, GROUND = 3.8;
const TINTS = [0xe8dcc0, 0xd9b8a8, 0xc4d4c4, 0xe9e2cf, 0xd4cfa8, 0xeccf94, 0xc9b8d0, 0xaecbd0, 0xd9d4cc, 0xc8b49a];

type Draw = (x: CanvasRenderingContext2D, mask: boolean) => void;
const noise = (x: CanvasRenderingContext2D, a: number) => { for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 3); } };
const stain = (x: CanvasRenderingContext2D, px: number, w: number, y: number) => { const g = x.createLinearGradient(0, y, 0, y + 34); g.addColorStop(0, 'rgba(60,50,40,.28)'); g.addColorStop(1, 'rgba(60,50,40,0)'); x.fillStyle = g; x.fillRect(px, y, w, 34); };
const wall = (x: CanvasRenderingContext2D, mask: boolean) => { x.fillStyle = mask ? '#000' : '#f1eee6'; x.fillRect(0, 0, 128, 128); if (!mask) noise(x, 0.07); };

const punched: Draw = (x, m) => {
  wall(x, m);
  if (!m) { stain(x, 26, 76, 96); x.fillStyle = '#d8d3c6'; x.fillRect(0, 0, 128, 6); x.fillStyle = '#fff'; x.fillRect(24, 22, 80, 84); }
  x.fillStyle = m ? '#fff' : '#2c3944'; x.fillRect(30, 28, 68, 72);
  if (!m) { x.strokeStyle = '#8a9096'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(30, 36 + i * 11); x.lineTo(64, 36 + i * 11); x.stroke(); } x.fillStyle = '#e8e8e4'; x.fillRect(28, 100, 72, 6); x.fillStyle = '#4a5560'; x.fillRect(64, 28, 2, 72); }
};
const ribbon: Draw = (x, m) => {
  wall(x, m);
  if (!m) { x.fillStyle = '#d4d0c4'; x.fillRect(0, 0, 128, 14); x.fillRect(0, 104, 128, 24); stain(x, 0, 128, 104); }
  x.fillStyle = m ? '#fff' : '#3a5468'; x.fillRect(0, 26, 128, 60);
  if (!m) { x.fillStyle = '#c8ccd0'; for (const px of [0, 32, 64, 96]) x.fillRect(px, 26, 3, 60); x.fillStyle = '#f2f2ee'; x.fillRect(0, 86, 128, 4); x.strokeStyle = '#4a4a4c'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 104); x.lineTo(128, 104); x.stroke(); for (let i = 4; i < 128; i += 8) { x.beginPath(); x.moveTo(i, 96); x.lineTo(i, 104); x.stroke(); } }
};
const colonial: Draw = (x, m) => {
  wall(x, m);
  if (!m) { x.fillStyle = '#e3dccb'; x.fillRect(0, 0, 128, 8); x.fillStyle = '#cfc7b4'; x.fillRect(0, 8, 128, 3); stain(x, 30, 68, 100); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(30, 108); x.lineTo(30, 46); x.arc(64, 46, 34, Math.PI, 0); x.lineTo(98, 108); x.fill(); }
  x.fillStyle = m ? '#fff' : '#27333d'; x.beginPath(); x.moveTo(37, 104); x.lineTo(37, 46); x.arc(64, 46, 27, Math.PI, 0); x.lineTo(91, 104); x.fill();
  if (!m) { x.fillStyle = '#e8e2d2'; x.fillRect(63, 20, 2, 84); x.fillRect(37, 62, 54, 2); x.fillStyle = '#d2cbb8'; x.fillRect(26, 108, 76, 5); }
};
const curtain: Draw = (x, m) => {
  x.fillStyle = m ? '#fff' : '#5f8095'; x.fillRect(0, 0, 128, 128);
  if (!m) { const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.fillStyle = '#c4ccd2'; x.fillRect(0, 0, 128, 5); x.fillRect(0, 0, 4, 128); x.fillRect(62, 0, 3, 128); x.fillStyle = '#9ca7ae'; x.fillRect(0, 98, 128, 30); }
  else { x.fillStyle = '#000'; x.fillRect(0, 98, 128, 30); }
};
const shopfront: Draw = (x, m) => {
  x.fillStyle = m ? '#000' : '#e4e0d6'; x.fillRect(0, 0, 128, 128); if (!m) noise(x, 0.1);
  // sign band
  x.fillStyle = m ? '#fff' : '#f4f0e0'; x.fillRect(6, 4, 116, 26);
  if (!m) { x.fillStyle = '#c0282c'; x.fillRect(10, 8, 40, 18); x.fillStyle = '#1c3b9c'; x.fillRect(54, 8, 64, 18); }
  // roller shutter or glass
  x.fillStyle = m ? '#000' : '#8a9096'; x.fillRect(8, 38, 76, 90);
  if (!m) { x.strokeStyle = '#6c7278'; x.lineWidth = 2; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(8, 42 + i * 7.5); x.lineTo(84, 42 + i * 7.5); x.stroke(); } }
  x.fillStyle = m ? '#fff' : '#26323c'; x.fillRect(90, 40, 32, 88);
  if (!m) { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(92, 42, 12, 84); }
};

function tex(draw: Draw, mask: boolean, repeatY = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; draw(x, mask);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = repeatY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.anisotropy = 4;
  t.colorSpace = mask ? THREE.NoColorSpace : THREE.SRGBColorSpace; return t;
}

export interface BuildingSet { setNight(n: number): void }

export function buildBuildings(scene: THREE.Scene, blds: Bld[]): BuildingSet {
  const draws: Draw[] = [punched, ribbon, colonial, curtain];
  const mk = (d: Draw, night: number) => new THREE.MeshLambertMaterial({ map: tex(d, false), emissiveMap: tex(d, true), emissive: new THREE.Color(0xffd79a), emissiveIntensity: 0, vertexColors: true, side: THREE.DoubleSide });
  const upper = draws.map((d) => mk(d, 0));
  const ground = mk(shopfront, 0);
  const roofM = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const CH = 300;

  interface Acc { pos: number[]; nor: number[]; uv: number[]; col: number[] }
  const mkAcc = (): Acc => ({ pos: [], nor: [], uv: [], col: [] });
  const chunks = new Map<string, { up: Acc[]; gr: Acc; roof: Acc; tanks: THREE.Matrix4[] }>();
  const c = new THREE.Color(), tmp = new THREE.Color();
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  blds.forEach((b, bi) => {
    let pts: [number, number][] = [];
    for (let k = 0; k < b.pts.length; k += 2) pts.push([b.pts[k], b.pts[k + 1]]);
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    if (pts.length < 3) return;
    const key = `${Math.floor(pts[0][0] / CH)},${Math.floor(pts[0][1] / CH)}`;
    let ch = chunks.get(key); if (!ch) { ch = { up: [mkAcc(), mkAcc(), mkAcc(), mkAcc()], gr: mkAcc(), roof: mkAcc(), tanks: [] }; chunks.set(key, ch); }
    const h = b.h;
    const variant = h > 32 ? 3 : (bi * 5 + Math.floor(h)) % 3;
    const up = ch.up[variant];
    c.set(TINTS[(bi * 7 + Math.floor(h * 3)) % TINTS.length]); tmp.copy(c).multiplyScalar(0.9 + rnd() * 0.15);
    if (variant === 3) tmp.set(0xdfe6ea);
    let area = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
    const sgn = area > 0 ? 1 : -1;
    const gh = Math.min(GROUND, h);
    const floors = Math.max(1, Math.round((h - GROUND) / FLOOR));
    const yTop = h;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz); if (L < 0.3) continue;
      const nx = (dz / L) * sgn, nz = (-dx / L) * sgn, bays = Math.max(1, Math.round(L / BAY));
      const quad = (a: Acc, y0: number, y1: number, v1: number, tint: THREE.Color) => {
        a.pos.push(p[0], y0, p[1], q[0], y0, q[1], q[0], y1, q[1], p[0], y0, p[1], q[0], y1, q[1], p[0], y1, p[1]);
        a.uv.push(0, 0, bays, 0, bays, v1, 0, 0, bays, v1, 0, v1);
        for (let k = 0; k < 6; k++) { a.nor.push(nx, 0, nz); a.col.push(tint.r, tint.g, tint.b); }
      };
      quad(ch.gr, 0, gh, 1, tmp.clone().lerp(new THREE.Color(0xffffff), 0.35));
      if (h > GROUND + 0.8) { const a = up; quad(a, gh, yTop, floors, tmp); }
    }
    // roof
    try {
      const tri = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
      const r = ch.roof; const rc = new THREE.Color(0x8c8a86).lerp(tmp, 0.25);
      for (const t of tri) for (const k of t) { r.pos.push(pts[k][0], yTop + 0.02, pts[k][1]); r.nor.push(0, 1, 0); r.uv.push(0, 0); r.col.push(rc.r, rc.g, rc.b); }
    } catch { /* degenerate footprint */ }
    // rooftop water tank on some larger buildings
    if (Math.abs(area) > 120 && rnd() < 0.5) {
      let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
      ch.tanks.push(new THREE.Matrix4().makeTranslation(cx + (rnd() - 0.5) * 2, h, cz + (rnd() - 0.5) * 2));
    }
  });

  const toGeo = (a: Acc) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(a.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3)); return g; };
  const allTanks: THREE.Matrix4[] = [];
  for (const ch of chunks.values()) {
    ch.up.forEach((a, i) => { if (a.pos.length) { const m = new THREE.Mesh(toGeo(a), upper[i]); m.castShadow = m.receiveShadow = true; scene.add(m); } });
    if (ch.gr.pos.length) { const m = new THREE.Mesh(toGeo(ch.gr), ground); m.castShadow = m.receiveShadow = true; scene.add(m); }
    if (ch.roof.pos.length) { const m = new THREE.Mesh(toGeo(ch.roof), roofM); m.receiveShadow = true; scene.add(m); }
    allTanks.push(...ch.tanks);
  }
  if (allTanks.length) {
    const tg = mergeGeometries([new THREE.CylinderGeometry(0.7, 0.7, 1.3, 12).translate(0, 0.75, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8).translate(0, 1.45, 0), new THREE.BoxGeometry(2.4, 0.2, 2.4).translate(0, 0.1, 0)])!;
    const im = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: 0x3d6ea8 }), allTanks.length);
    allTanks.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.frustumCulled = false; scene.add(im);
  }
  return { setNight(n: number) { for (const m of upper) m.emissiveIntensity = n * 0.4; ground.emissiveIntensity = n * 0.5; } };
}
