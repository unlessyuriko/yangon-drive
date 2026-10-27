import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDING_TYPES, pickType } from './BuildingTypes';

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

const arched: Draw = (x, m) => {
  wall(x, m);
  if (!m) { x.fillStyle = '#e3dccb'; x.fillRect(0, 0, 128, 10); x.fillStyle = '#cfc7b4'; x.fillRect(0, 10, 128, 3); stain(x, 8, 112, 96); }
  for (const px of [10, 72]) {
    if (!m) { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(px, 108); x.lineTo(px, 52); x.arc(px + 23, 52, 23, Math.PI, 0); x.lineTo(px + 46, 108); x.fill(); }
    x.fillStyle = m ? '#fff' : '#27333d'; x.beginPath(); x.moveTo(px + 4, 104); x.lineTo(px + 4, 52); x.arc(px + 23, 52, 19, Math.PI, 0); x.lineTo(px + 42, 104); x.fill();
    if (!m) { x.strokeStyle = '#7a5a3a'; x.lineWidth = 2; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(px + 4, 62 + i * 8); x.lineTo(px + 42, 62 + i * 8); x.stroke(); } x.fillStyle = '#d2cbb8'; x.fillRect(px - 4, 104, 54, 6); }
  }
};
const pilaster: Draw = (x, m) => {
  wall(x, m);
  if (!m) { x.fillStyle = '#e9e0cc'; for (const px of [0, 118]) x.fillRect(px, 0, 10, 128); x.fillRect(0, 0, 128, 12); x.fillRect(0, 112, 128, 16); stain(x, 12, 104, 100); }
  x.fillStyle = m ? '#fff' : '#26323c'; x.fillRect(30, 26, 68, 78);
  if (!m) { x.fillStyle = '#f2ecdc'; x.fillRect(24, 18, 80, 8); x.fillRect(26, 104, 76, 6); x.fillRect(63, 26, 2, 78); x.fillRect(30, 62, 68, 2); }
};
const balcony: Draw = (x, m) => {
  wall(x, m);
  if (!m) { stain(x, 0, 128, 90); stain(x, 40, 30, 8); x.fillStyle = '#bdb7aa'; x.fillRect(0, 98, 128, 12); x.fillStyle = '#e1dccf'; x.fillRect(0, 0, 128, 5); }
  x.fillStyle = m ? '#fff' : '#2f4250'; x.fillRect(16, 16, 52, 62);
  if (!m) {
    x.fillStyle = '#d6d6d0'; x.fillRect(40, 16, 2, 62);
    x.strokeStyle = '#4a4a4c'; x.lineWidth = 1.5; for (let i = 6; i < 124; i += 7) { x.beginPath(); x.moveTo(i, 78); x.lineTo(i, 98); x.stroke(); }
    x.beginPath(); x.moveTo(4, 78); x.lineTo(124, 78); x.stroke();
    x.fillStyle = '#c0392b'; x.fillRect(84, 52, 10, 24); x.fillStyle = '#2b6fd0'; x.fillRect(96, 56, 10, 20); x.fillStyle = '#e8e8e2'; x.fillRect(86, 22, 30, 18); x.fillStyle = '#9aa0a4'; x.fillRect(90, 28, 22, 6);
  }
};
const bandwin: Draw = (x, m) => {
  wall(x, m);
  if (!m) { x.fillStyle = '#eae4d4'; x.fillRect(0, 0, 128, 8); x.fillRect(0, 96, 128, 32); stain(x, 0, 128, 96); }
  x.fillStyle = m ? '#fff' : '#4a6a80'; x.fillRect(10, 22, 108, 64);
  if (!m) { x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(12, 24, 40, 60); x.fillStyle = '#c8ccd0'; for (const px of [10, 46, 82, 117]) x.fillRect(px, 22, 3, 64); x.fillRect(10, 52, 108, 3); x.fillStyle = '#b4472e'; x.fillRect(0, 100, 128, 5); }
};
const lowhouse: Draw = (x, m) => {
  wall(x, m);
  if (!m) { stain(x, 0, 128, 90); x.fillStyle = '#9c9484'; x.fillRect(0, 106, 128, 22); }
  for (const px of [18, 78]) {
    x.fillStyle = m ? '#fff' : '#2c3944'; x.fillRect(px, 34, 34, 46);
    if (!m) { x.fillStyle = '#6b8c58'; x.fillRect(px - 5, 32, 8, 50); x.fillRect(px + 31, 32, 8, 50); x.fillStyle = '#d8d3c6'; x.fillRect(px - 2, 80, 40, 5); }
  }
};

function tex(draw: Draw, mask: boolean, repeatY = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; draw(x, mask);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = repeatY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.anisotropy = 4;
  t.colorSpace = mask ? THREE.NoColorSpace : THREE.SRGBColorSpace; return t;
}

export interface BuildingSet { setNight(n: number): void }

export function buildBuildings(scene: THREE.Scene, blds: Bld[], centre: [number, number] = [0, 0]): BuildingSet {
  const UP: Record<string, Draw> = { arched, pilaster, balcony, bandwin, ribbon, curtain, lowhouse, punched };
  const LO: Record<string, Draw> = { shop: shopfront, arcade: colonial };
  const mk = (d: Draw, night: number) => new THREE.MeshLambertMaterial({ map: tex(d, false), emissiveMap: tex(d, true), emissive: new THREE.Color(0xffd79a), emissiveIntensity: 0, vertexColors: true, side: THREE.DoubleSide });
  const T = BUILDING_TYPES;
  const upper = T.map((t) => mk(UP[t.upper], 0));
  const grounds = T.map((t) => (t.lower ? mk(LO[t.lower], 0) : null));
  // optional real photos: public/buildings/<id>.jpg (upper floors) and <id>_ground.jpg (shopfront) replace the procedural facade when present
  const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL;
  const photo = (mat: THREE.MeshLambertMaterial | null, url: string) => {
    if (!mat) return;
    new THREE.TextureLoader().load(url, (t) => {
      if (!t.image || (t.image as HTMLImageElement).width < 8) return;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      mat.map = t; mat.emissiveMap = null; mat.emissive.set(0x000000); mat.vertexColors = false; mat.needsUpdate = true;
    }, undefined, () => { /* no photo supplied: keep procedural */ });
  };
  T.forEach((t, i) => { photo(upper[i], base + 'buildings/' + t.id + '.jpg'); photo(grounds[i], base + 'buildings/' + t.id + '_ground.jpg'); });
  const roofM = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const CH = 300;

  interface Acc { pos: number[]; nor: number[]; uv: number[]; col: number[] }
  const mkAcc = (): Acc => ({ pos: [], nor: [], uv: [], col: [] });
  const chunks = new Map<string, { up: Acc[]; gr: Acc[]; roof: Acc; tanks: THREE.Matrix4[] }>();
  const counts: Record<string, number> = {};
  const boxes: THREE.Matrix4[] = [];
  interface Inst { m: THREE.Matrix4; c: number }
  const awnings: Inst[] = [], blades: Inst[] = [], acs: Inst[] = [];
  const AWN = [0xb8322c, 0x2a5aa8, 0x2f7d4f, 0xd9a82a, 0xe8e4d8, 0x7a3a8a], SIGN = [0xc0282c, 0x1c3b9c, 0xf2f0e4, 0x2f7d4f, 0xe5b524];
  const c = new THREE.Color(), tmp = new THREE.Color();
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  blds.forEach((b, bi) => {
    let pts: [number, number][] = [];
    for (let k = 0; k < b.pts.length; k += 2) pts.push([b.pts[k], b.pts[k + 1]]);
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    if (pts.length < 3) return;
    const key = `${Math.floor(pts[0][0] / CH)},${Math.floor(pts[0][1] / CH)}`;
    let ch = chunks.get(key); if (!ch) { ch = { up: T.map(mkAcc), gr: T.map(mkAcc), roof: mkAcc(), tanks: [] }; chunks.set(key, ch); }
    const h = b.h;
    let cx0 = 0, cz0 = 0; for (const p of pts) { cx0 += p[0]; cz0 += p[1]; } cx0 /= pts.length; cz0 /= pts.length;
    const dC = Math.hypot(cx0 - centre[0], cz0 - centre[1]);
    let area = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
    const sgn = area > 0 ? 1 : -1;
    let roofTint = 0x8c8a86;
    const cen = { x: cx0, z: cz0 };
    const scaled = (k: number): [number, number][] => pts.map((p) => [cen.x + (p[0] - cen.x) * k, cen.z + (p[1] - cen.z) * k]);
    // tiers: big tall buildings get a podium with the tower set back on top, very tall ones a second setback
    const big = Math.abs(area) > 300;
    const tiers: { poly: [number, number][]; y0: number; y1: number }[] = [];
    if (h >= 28 && big) {
      const ph = Math.min(h * 0.4, 12 + rnd() * 3);
      if (h >= 60) { const m = h * (0.72 + rnd() * 0.06); tiers.push({ poly: pts, y0: 0, y1: ph }, { poly: scaled(0.84), y0: ph, y1: m }, { poly: scaled(0.68), y0: m, y1: h }); }
      else tiers.push({ poly: pts, y0: 0, y1: ph }, { poly: scaled(0.82), y0: ph, y1: h });
    } else tiers.push({ poly: pts, y0: 0, y1: h });
    const emit = (poly: [number, number][], y0: number, y1: number, ground: boolean) => {
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz); if (L < 0.3) continue;
        const nx = (dz / L) * sgn, nz = (-dx / L) * sgn;
        // split the frontage into lots (5-14 m); each lot gets its own building type, tint and ground floor
        let s0 = 0;
        while (s0 < L - 0.01) {
          let lw = 5 + rnd() * 9; if (L - s0 - lw < 4) lw = L - s0;
          const s1 = s0 + lw, t = pickType(h, dC, rnd()), ti = T.indexOf(t);
          counts[t.id] = (counts[t.id] ?? 0) + 1; if (s0 === 0 && i === 0 && y0 === 0) roofTint = t.roof;
          tmp.set(t.tints[Math.floor(rnd() * t.tints.length)]).multiplyScalar(0.92 + rnd() * 0.14);
          const ax = p[0] + (dx / L) * s0, az = p[1] + (dz / L) * s0, bx = p[0] + (dx / L) * s1, bz = p[1] + (dz / L) * s1;
          const bays = Math.max(1, Math.round(lw / t.bay));
          const quad = (a: Acc, ya: number, yb: number, v1: number, tint: THREE.Color) => {
            a.pos.push(ax, ya, az, bx, ya, bz, bx, yb, bz, ax, ya, az, bx, yb, bz, ax, yb, az);
            a.uv.push(0, 0, bays, 0, bays, v1, 0, 0, bays, v1, 0, v1);
            for (let k = 0; k < 6; k++) { a.nor.push(nx, 0, nz); a.col.push(tint.r, tint.g, tint.b); }
          };
          if (ground && t.lower) {
            const gh = Math.min(t.groundH, y1);
            quad(ch.gr[ti], y0, y0 + gh, 1, tmp.clone().lerp(new THREE.Color(0xffffff), 0.35));
            if (y1 - y0 > gh + 0.8) quad(ch.up[ti], y0 + gh, y1, Math.max(1, Math.round((y1 - y0 - gh) / t.floor)), tmp);
          } else quad(ch.up[ti], y0, y1, Math.max(1, Math.round((y1 - y0) / t.floor)), tmp);
          // street-level detail as instances: shop awnings, blade signs, wall AC units
          const ang = Math.atan2(-dz / L, dx / L), mxp = (ax + bx) / 2, mzp = (az + bz) / 2;
          const put = (list: Inst[], off: number, y: number, along: number, w: number, hh: number, d: number, tilt: number, col: number) => {
            const ox = mxp + (dx / L) * along + nx * off, oz = mzp + (dz / L) * along + nz * off;
            const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
            if (tilt) qy.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
            list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(ox, y, oz), qy, new THREE.Vector3(w, hh, d)), c: col });
          };
          if (ground && t.lower === 'shop' && y0 === 0 && lw > 3.5) {
            const gh = Math.min(t.groundH, y1);
            if (rnd() < 0.5) put(awnings, 0.65, gh - 0.35, 0, lw * 0.86, 0.07, 1.3, -sgn * 0.2, AWN[Math.floor(rnd() * AWN.length)]);
            if (rnd() < 0.35) put(blades, 0.45, gh + 0.5, (rnd() - 0.5) * lw * 0.7, 0.12, 0.9, 0.9, 0, SIGN[Math.floor(rnd() * SIGN.length)]);
          }
          if (t.id !== 'low-house' && y1 - y0 > 7 && rnd() < (t.id === 'colonial-grand' ? 0.2 : 0.75)) {
            const n = 1 + Math.floor(rnd() * 3);
            for (let k = 0; k < n; k++) put(acs, 0.25, y0 + 4.6 + Math.floor(rnd() * Math.max(1, (y1 - y0 - 5) / t.floor)) * t.floor, (rnd() - 0.5) * lw * 0.8, 0.85, 0.55, 0.5, 0, 0xe6e6e2);
          }
          s0 = s1;
        }
      }
    };
    tiers.forEach((tr, k) => emit(tr.poly, tr.y0, tr.y1, k === 0));
    const rc = new THREE.Color(roofTint).lerp(tmp, 0.15);
    const flat = (poly: [number, number][], y: number, col: THREE.Color) => {
      try {
        const tri = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], p[1])), []);
        const r = ch!.roof;
        for (const t of tri) for (const k of t) { r.pos.push(poly[k][0], y + 0.02, poly[k][1]); r.nor.push(0, 1, 0); r.uv.push(0, 0); r.col.push(col.r, col.g, col.b); }
      } catch { /* degenerate footprint */ }
    };
    // parapet: a low rim round the top of a flat roof
    const parapet = (poly: [number, number][], y: number, ph: number, col: THREE.Color) => {
      const r = ch!.roof;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz); if (L < 0.3) continue;
        const nx = (dz / L) * sgn, nz = (-dx / L) * sgn;
        r.pos.push(p[0], y, p[1], q[0], y, q[1], q[0], y + ph, q[1], p[0], y, p[1], q[0], y + ph, q[1], p[0], y + ph, p[1]);
        for (let k = 0; k < 6; k++) { r.nor.push(nx, 0, nz); r.uv.push(0, 0); r.col.push(col.r, col.g, col.b); }
      }
    };
    const hip = h < 10 && Math.abs(area) < 260 && rnd() < 0.7;
    if (hip) {
      // pitched zinc / tile roof: every edge rises to a ridge point over the centroid
      const r = ch.roof, rise = 1.4 + rnd() * 1.2, zc = new THREE.Color(rnd() < 0.6 ? 0x8f8a82 : 0x9a5a44).multiplyScalar(0.9 + rnd() * 0.2);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const ux = (p[0] - cx0) * 0.12, uz = (p[1] - cz0) * 0.12, vx = (q[0] - cx0) * 0.12, vz = (q[1] - cz0) * 0.12;
        const e = (x: number, y: number, z: number) => { r.pos.push(x, y, z); r.nor.push(0, 1, 0); r.uv.push(0, 0); r.col.push(zc.r, zc.g, zc.b); };
        e(p[0], h, p[1]); e(q[0], h, q[1]); e(cx0 + vx, h + rise, cz0 + vz);
        e(p[0], h, p[1]); e(cx0 + vx, h + rise, cz0 + vz); e(cx0 + ux, h + rise, cz0 + uz);
      }
      // overhanging eave so the roof reads as a roof from the street
    } else {
      tiers.forEach((tr, k) => { flat(tr.poly, tr.y1, k === tiers.length - 1 ? rc : rc.clone().multiplyScalar(0.92)); parapet(tr.poly, tr.y1, k === tiers.length - 1 ? 0.7 : 0.9, rc.clone().multiplyScalar(1.08)); });
      // lift / stair head on mid and high roofs
      if (h >= 18 && big) { const top = tiers[tiers.length - 1].poly; let tx = 0, tz = 0; for (const p of top) { tx += p[0]; tz += p[1]; } tx /= top.length; tz /= top.length; boxes.push(new THREE.Matrix4().compose(new THREE.Vector3(tx + (rnd() - 0.5) * 3, h + 1.3, tz + (rnd() - 0.5) * 3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 3.14), new THREE.Vector3(3 + rnd() * 3, 2.6, 3 + rnd() * 2.5))); }
    }
    // rooftop water tank on some larger buildings
    if (!hip && Math.abs(area) > 120 && rnd() < 0.5) {
      let cx = 0, cz = 0; for (const p of pts) { cx += p[0]; cz += p[1]; } cx /= pts.length; cz /= pts.length;
      ch.tanks.push(new THREE.Matrix4().makeTranslation(cx + (rnd() - 0.5) * 2, h, cz + (rnd() - 0.5) * 2));
    }
  });

  const toGeo = (a: Acc) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(a.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3)); return g; };
  (window as unknown as { __buildingTypes: unknown }).__buildingTypes = counts;
  const allTanks: THREE.Matrix4[] = [];
  for (const ch of chunks.values()) {
    ch.up.forEach((a, i) => { if (a.pos.length) { const m = new THREE.Mesh(toGeo(a), upper[i]); m.castShadow = m.receiveShadow = true; scene.add(m); } });
    ch.gr.forEach((a, i) => { if (a.pos.length && grounds[i]) { const m = new THREE.Mesh(toGeo(a), grounds[i]!); m.castShadow = m.receiveShadow = true; scene.add(m); } });
    if (ch.roof.pos.length) { const m = new THREE.Mesh(toGeo(ch.roof), roofM); m.receiveShadow = true; scene.add(m); }
    allTanks.push(...ch.tanks);
  }
  if (allTanks.length) {
    const tg = mergeGeometries([new THREE.CylinderGeometry(0.7, 0.7, 1.3, 12).translate(0, 0.75, 0), new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8).translate(0, 1.45, 0), new THREE.BoxGeometry(2.4, 0.2, 2.4).translate(0, 0.1, 0)])!;
    const im = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: 0x3d6ea8 }), allTanks.length);
    allTanks.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.frustumCulled = false; scene.add(im);
  }
  for (const list of [awnings, blades, acs]) {
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
    const col = new THREE.Color();
    list.forEach((o, i) => { im.setMatrixAt(i, o.m); im.setColorAt(i, col.set(o.c)); });
    im.castShadow = true; im.frustumCulled = false; scene.add(im);
  }
  if (boxes.length) {
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xb9b4a8 }), boxes.length);
    boxes.forEach((m, i) => bm.setMatrixAt(i, m)); bm.castShadow = true; bm.frustumCulled = false; scene.add(bm);
  }
  return { setNight(n: number) { for (const m of upper) m.emissiveIntensity = n * 0.4; for (const g of grounds) if (g) g.emissiveIntensity = n * 0.5; } };
}
