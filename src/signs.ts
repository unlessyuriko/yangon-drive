import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Road { w: number; pts: number[]; name: string; en: string; my: string; hw: string; ow?: number; rb?: number }

const isMy = (s: string) => /[က-႟]/.test(s);
const PHONE = matchMedia('(pointer: coarse)').matches;
const SC = PHONE ? 0.5 : 1;
const CELL_W = 400 * SC, CELL_H = 100 * SC, COLS = 5;

/** Arrow-shaped street-name blades (as on Yangon corner poles) at the true start and end of each named road.
 *  Where a road ends at another road, the blade stands at the corner facing the traffic of that other road, shaped as an arrow that points the way
 *  the named road leads, so "35th Street >" really is where 35th Street goes. Both faces read correctly. Dead ends get a plain blade facing along the road.
 *  One-way roads (traffic runs toward increasing vertex index) also get a blue ONE WAY sign at the entry and a red NO ENTRY sign at the far end. */
export function buildSigns(roads: Road[]): THREE.Group {
  const label = (r: Road) => {
    const my = r.my || (isMy(r.name) ? r.name : '');
    const en = r.en || (r.name && !isMy(r.name) ? r.name : '');
    return { my, en, key: `${my}|${en}` };
  };
  const sel = roads.filter((r) => r.w >= 7 && (r.name || r.en || r.my));
  const keys = new Map<string, { my: string; en: string; idx: number }>();
  for (const r of sel) {
    const l = label(r);
    if (!l.my && !l.en) continue;
    if (!keys.has(l.key)) keys.set(l.key, { my: l.my, en: l.en, idx: keys.size });
  }
  const rows = Math.ceil(keys.size / COLS);
  const W = CELL_W * COLS, H = CELL_H * rows * 3;       // block 0: plain, block 1: arrow right, block 2: arrow left

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const mf = '"Noto Sans Myanmar","Myanmar Text","Padauk",sans-serif', ef = 'system-ui,Arial,sans-serif';
  for (const { my, en, idx } of keys.values()) {
    for (let variant = 0; variant < 3; variant++) {
      const x = (idx % COLS) * CELL_W, y = (variant * rows + Math.floor(idx / COLS)) * CELL_H;
      const tip = 34 * SC, b = 4 * SC;
      // outline: plain board, or board with a pointed end
      const path = () => {
        c.beginPath();
        if (variant === 0) { c.rect(x + b, y + b, CELL_W - 2 * b, CELL_H - 2 * b); return; }
        if (variant === 1) { c.moveTo(x + b, y + b); c.lineTo(x + CELL_W - tip, y + b); c.lineTo(x + CELL_W - b, y + CELL_H / 2); c.lineTo(x + CELL_W - tip, y + CELL_H - b); c.lineTo(x + b, y + CELL_H - b); }
        else { c.moveTo(x + CELL_W - b, y + b); c.lineTo(x + tip, y + b); c.lineTo(x + b, y + CELL_H / 2); c.lineTo(x + tip, y + CELL_H - b); c.lineTo(x + CELL_W - b, y + CELL_H - b); }
        c.closePath();
      };
      path(); c.fillStyle = '#1b56a5'; c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = 4 * SC; c.lineJoin = 'round'; c.stroke();
      c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const shift = variant === 1 ? -tip / 3 : variant === 2 ? tip / 3 : 0, avail = CELL_W - 28 * SC - tip * (variant ? 1 : 0);
      const fit = (txt: string, size: number, cy: number, font: string) => {
        let s = size * SC; cy *= SC;
        do { c.font = `bold ${s}px ${font}`; s -= 2 * SC; } while (c.measureText(txt).width > avail && s > 6);
        c.fillText(txt, x + CELL_W / 2 + shift, y + cy);
      };
      if (my && en) { fit(my, 40, 33, mf); fit(en, 34, 71, ef); }
      else if (my) fit(my, 50, 50, mf);
      else fit(en, 44, 50, ef);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  // symbols atlas: [ONE WAY, NO ENTRY]
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 128; const x = sc.getContext('2d')!;
  x.fillStyle = '#1b56a5'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeRect(5, 5, 118, 118);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(64, 14); x.lineTo(94, 52); x.lineTo(74, 52); x.lineTo(74, 84); x.lineTo(54, 84); x.lineTo(54, 52); x.lineTo(34, 52); x.closePath(); x.fill();
  x.font = 'bold 15px system-ui,Arial,sans-serif'; x.textAlign = 'center'; x.fillText('ONE WAY', 64, 104); x.font = 'bold 13px "Noto Sans Myanmar","Myanmar Text",sans-serif'; x.fillText('တစ်လမ်းသွား', 64, 120);
  x.fillStyle = '#c8202a'; x.beginPath(); x.arc(192, 64, 56, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 5; x.stroke(); x.fillStyle = '#fff'; x.fillRect(158, 54, 68, 20);
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;

  const k = (x: number, z: number) => `${Math.round(x * 5)},${Math.round(z * 5)}`;
  const vertexRoads = new Map<string, { ri: number; i: number }[]>();
  roads.forEach((r, ri) => { for (let i = 0; i < r.pts.length / 2; i++) { const kk = k(r.pts[i * 2], r.pts[i * 2 + 1]); const l = vertexRoads.get(kk) ?? []; vertexRoads.set(kk, l); l.push({ ri, i }); } });

  const bp: number[] = [], buv: number[] = [], bidx: number[] = [];      // name blades
  const sp: number[] = [], suv: number[] = [], sidx: number[] = [];      // symbols
  const poles: THREE.BufferGeometry[] = [];
  const placed = new Map<string, [number, number][]>();
  let n = 0;
  const HL = 1.4, YB = 2.5, YT = 3.2;

  /** front-facing quad whose normal is (Nx,Nz); the viewer's right is (Nz,-Nx) so text reads left to right */
  const quad = (P: number[], U: number[], I: number[], cx: number, cz: number, Nx: number, Nz: number, hl: number, yb: number, yt: number, u0: number, v0: number, u1: number, v1: number) => {
    const Rx = Nz, Rz = -Nx, b = P.length / 3, ox = Nx * 0.012, oz = Nz * 0.012;
    P.push(cx - Rx * hl + ox, yb, cz - Rz * hl + oz, cx + Rx * hl + ox, yb, cz + Rz * hl + oz, cx + Rx * hl + ox, yt, cz + Rz * hl + oz, cx - Rx * hl + ox, yt, cz - Rz * hl + oz);
    U.push(u0, v0, u1, v0, u1, v1, u0, v1); I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const tangent = (r: Road, i: number): [number, number] => {
    const m = r.pts.length / 2, p = Math.max(0, i - 1), q = Math.min(m - 1, i + 1);
    let dx = r.pts[q * 2] - r.pts[p * 2], dz = r.pts[q * 2 + 1] - r.pts[p * 2 + 1]; const L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L];
  };
  const cellUV = (idx: number, variant: number) => {
    const col = idx % COLS, row = Math.floor(idx / COLS), tr = rows * 3, r0 = variant * rows + row;
    return [col / COLS, 1 - (r0 + 1) / tr, (col + 1) / COLS, 1 - r0 / tr] as const;
  };

  roads.forEach((r) => {
    if (r.w < 7 || r.rb) return;
    const l = label(r); const e = keys.get(l.key); if (!e) return;
    const m = r.pts.length / 2; if (m < 2) return;
    for (const end of [0, 1]) {
      const vi = end ? m - 1 : 0, nb = end ? m - 2 : 1;
      const x0 = r.pts[vi * 2], z0 = r.pts[vi * 2 + 1];
      const here = vertexRoads.get(k(x0, z0)) ?? [];
      // the road carries on through this vertex under the same name: not a real end
      if (here.some((h) => roads[h.ri] !== r && roads[h.ri].w >= 7 && label(roads[h.ri]).key === l.key)) continue;
      let fx = x0 - r.pts[nb * 2], fz = z0 - r.pts[nb * 2 + 1]; const len = Math.hypot(fx, fz); if (len < 1) continue; fx /= len; fz /= len;   // out of the road at this end
      const rx = -fz, rz = fx;                                         // right kerb for a driver heading toward the end
      // the road that this one runs into (widest other named road at the vertex)
      let Y: { r: Road; i: number } | null = null;
      for (const h of here) { const o = roads[h.ri]; if (o === r || o.rb || o.w < 7) continue; if (!Y || o.w > Y.r.w) Y = { r: o, i: h.i }; }
      let cx: number, cz: number, Nx: number, Nz: number, poleSide: number;
      if (Y) {
        const [tx, tz] = tangent(Y.r, Y.i);                            // direction of the cross road
        const px = -tz, pz = tx;                                       // perpendicular to it
        const sgn = (-fx * px + -fz * pz) >= 0 ? 1 : -1;               // which side of the cross road the named road lies on
        // pole on the corner of the junction (just outside the named road's mouth, on the cross road's kerb); the blade's flat end is bolted to it and the arrow tip points out toward the named road
        const along = r.w / 2 + 0.9, kerb = Y.r.w / 2 + 0.7;
        const polex = x0 + px * sgn * kerb + tx * along, polez = z0 + pz * sgn * kerb + tz * along;
        const reach = HL + 0.06;
        cx = polex + px * sgn * reach; cz = polez + pz * sgn * reach;
        Nx = tx; Nz = tz;
        const key = l.key; const list = placed.get(key) ?? []; placed.set(key, list);
        if (list.some(([qx, qz]) => Math.hypot(qx - cx, qz - cz) < 25)) continue; list.push([cx, cz]);
        // two faces, one for each direction of traffic on the cross road; the arrow tip is on the side away from the pole
        for (const dir of [1, -1]) {
          const nx = Nx * dir, nz = Nz * dir, R = [nz, -nx];                  // viewer's right
          const toward = (px * sgn * R[0] + pz * sgn * R[1]) >= 0 ? 1 : 2;   // 1: arrow right, 2: arrow left
          const [u0, v0, u1, v1] = cellUV(e.idx, toward);
          quad(bp, buv, bidx, cx, cz, nx, nz, HL, YB, YT, u0, v0, u1, v1);
        }
        poleSide = 0;
        const pole = new THREE.CylinderGeometry(0.06, 0.07, YT + 0.2, 6); pole.translate(polex, (YT + 0.2) / 2, polez); poles.push(pole);
        void poleSide;
      } else {
        // dead end: plain blade facing along the road, pole at its kerb end
        cx = x0 - fx * 5 + rx * (r.w / 2 + 1.6); cz = z0 - fz * 5 + rz * (r.w / 2 + 1.6);
        const list = placed.get(l.key) ?? []; placed.set(l.key, list);
        if (list.some(([qx, qz]) => Math.hypot(qx - cx, qz - cz) < 25)) continue; list.push([cx, cz]);
        const [u0, v0, u1, v1] = cellUV(e.idx, 0);
        quad(bp, buv, bidx, cx, cz, fx, fz, HL, YB, YT, u0, v0, u1, v1); quad(bp, buv, bidx, cx, cz, -fx, -fz, HL, YB, YT, u0, v0, u1, v1);
        const pole = new THREE.CylinderGeometry(0.06, 0.07, YT + 0.2, 6); pole.translate(cx + rx * (HL + 0.07), (YT + 0.2) / 2, cz + rz * (HL + 0.07)); poles.push(pole);
      }
      n++;
      if (r.ow) {
        // traffic runs toward the last vertex: ONE WAY at the entry, NO ENTRY at the exit facing oncoming wrong-way drivers
        const sx = x0 - fx * (end === 0 ? 3 : 0.5) - rx * (r.w / 2 + 0.9), sz = z0 - fz * (end === 0 ? 3 : 0.5) - rz * (r.w / 2 + 0.9);
        if (end === 0) quad(sp, suv, sidx, sx, sz, fx, fz, 0.35, 2.0, 2.7, 0, 0, 0.5, 1);
        else quad(sp, suv, sidx, sx, sz, fx, fz, 0.35, 2.0, 2.7, 0.5, 0, 1, 1);
        const p2 = new THREE.CylinderGeometry(0.05, 0.06, 2.8, 6); p2.translate(sx - rx * 0.4, 1.4, sz - rz * 0.4); poles.push(p2);
      }
    }
  });

  const g = new THREE.Group();
  if (!n) return g;
  const mkMesh = (P: number[], U: number[], I: number[], map: THREE.Texture, alpha: boolean) => {
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); bg.setIndex(I);
    g.add(new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ map, alphaTest: alpha ? 0.5 : 0 })));
  };
  mkMesh(bp, buv, bidx, tex, true);
  if (sp.length) mkMesh(sp, suv, sidx, stex, false);
  const pg = mergeGeometries(poles.map((p) => p.toNonIndexed()))!;
  g.add(new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: 0x8a8e95 })));
  console.info(`street signs: ${n}, names: ${keys.size}`);
  return g;
}
