import * as THREE from 'three';

interface Road { w: number; pts: number[]; ow: number; hw: string; rb?: number }

interface Arm {
  jx: number; jz: number;          // junction vertex on the ring
  ox: number; oz: number;          // unit vector pointing away from the ring
  canEnter: boolean; canExit: boolean;
  poly: number[]; idx: number; side: 1 | -1;
  w: number; angle: number;        // polar angle of the junction around the centre
}

const KEY = (x: number, z: number) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
const DRIVABLE = ['primary', 'secondary', 'tertiary', 'trunk', 'residential', 'unclassified'];

export class Roundabout {
  group = new THREE.Group();
  cx = 0; cz = 0; radius = 50;
  ok = false;
  circ = -1;                         // angular sign of travel around the ring (atan2 on x,z)
  arms: Arm[] = [];
  // lesson route
  entry: Arm | null = null; exit: Arm | null = null;
  yieldLine: { x: number; z: number; fx: number; fz: number; rx: number; rz: number; half: number } | null = null;
  spawn: { x: number; z: number; heading: number } | null = null;
  exitTarget: { x: number; z: number } | null = null;
  exitJunction: { x: number; z: number } | null = null;

  constructor(roads: Road[]) {
    const rb = roads.filter((r) => r.rb);
    if (!rb.length) return;
    const ringKeys = new Set<string>();
    let sx = 0, sz = 0, n = 0;
    for (const r of rb) for (let i = 0; i < r.pts.length; i += 2) { ringKeys.add(KEY(r.pts[i], r.pts[i + 1])); sx += r.pts[i]; sz += r.pts[i + 1]; n++; }
    this.cx = sx / n; this.cz = sz / n;
    let rs = 0; for (const r of rb) for (let i = 0; i < r.pts.length; i += 2) rs += Math.hypot(r.pts[i] - this.cx, r.pts[i + 1] - this.cz);
    this.radius = rs / n;

    // circulation direction from the ring's own way order
    let tot = 0;
    for (const r of rb) for (let i = 0; i < r.pts.length - 2; i += 2) {
      const a = Math.atan2(r.pts[i + 1] - this.cz, r.pts[i] - this.cx), b = Math.atan2(r.pts[i + 3] - this.cz, r.pts[i + 2] - this.cx);
      let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; tot += d;
    }
    this.circ = tot >= 0 ? 1 : -1;

    // arms: non-ring roads that touch a ring vertex
    for (const r of roads) {
      if (r.rb || r.w < 7 || !DRIVABLE.includes(r.hw)) continue;
      const m = r.pts.length / 2;
      for (let i = 0; i < m; i++) {
        const x = r.pts[i * 2], z = r.pts[i * 2 + 1];
        if (!ringKeys.has(KEY(x, z))) continue;
        for (const side of [1, -1] as const) {
          const j = i + side; if (j < 0 || j >= m) continue;
          let ox = r.pts[j * 2] - x, oz = r.pts[j * 2 + 1] - z; const L = Math.hypot(ox, oz); if (L < 2) continue; ox /= L; oz /= L;
          // oneway roads run toward increasing index: side +1 leaves the ring, side -1 comes in
          const canExit = !r.ow || side === 1, canEnter = !r.ow || side === -1;
          this.arms.push({ jx: x, jz: z, ox, oz, canEnter, canExit, poly: r.pts, idx: i, side, w: r.w, angle: Math.atan2(z - this.cz, x - this.cx) });
        }
      }
    }
    this.chooseRoute();
    if (this.ok) this.buildMarking();
  }

  /** Length of road available from the junction going outward along the arm (up to max). */
  private walk(a: Arm, dist: number): { x: number; z: number; len: number } {
    const m = a.poly.length / 2;
    let idx = a.idx, px = a.jx, pz = a.jz, acc = 0, x = px, z = pz;
    while (acc < dist) {
      idx += a.side; if (idx < 0 || idx >= m) break;
      const nx = a.poly[idx * 2], nz = a.poly[idx * 2 + 1], L = Math.hypot(nx - px, nz - pz);
      if (acc + L >= dist) { const k = (dist - acc) / L; x = px + (nx - px) * k; z = pz + (nz - pz) * k; acc = dist; break; }
      acc += L; px = nx; pz = nz; x = nx; z = nz;
    }
    return { x, z, len: acc };
  }

  private chooseRoute() {
    // entry: an entering arm with a long straight run-in, nearest to the origin
    const entries = this.arms.filter((a) => a.canEnter && this.walk(a, 130).len >= 100);
    entries.sort((p, q) => Math.hypot(p.jx, p.jz) - Math.hypot(q.jx, q.jz));
    for (const e of entries) {
      const ahead = (a: Arm) => { let d = (a.angle - e.angle) * this.circ; while (d < 0.05) d += 2 * Math.PI; while (d > 2 * Math.PI) d -= 2 * Math.PI; return d; };
      // distinct exit junctions in travel order, excluding the arm we came in by
      const exits = this.arms.filter((a) => a.canExit && Math.hypot(a.jx - e.jx, a.jz - e.jz) > 8 && this.walk(a, 40).len >= 30);
      const uniq: Arm[] = [];
      for (const a of exits.sort((p, q) => ahead(p) - ahead(q))) if (!uniq.some((u) => Math.hypot(u.jx - a.jx, u.jz - a.jz) < 12)) uniq.push(a);
      if (uniq.length < 2) continue;
      this.entry = e; this.exit = uniq[1];
      const back = this.walk(e, 130);
      const fx = e.jx - back.x, fz = e.jz - back.z, L = Math.hypot(fx, fz);
      const ux = fx / L, uz = fz / L, rx = -uz, rz = ux;
      const lane = e.poly && !this.isOneway(e) ? e.w / 4 : 0;
      this.spawn = { x: back.x + rx * lane, z: back.z + rz * lane, heading: Math.atan2(-ux, -uz) };
      // give-way line 7 m before the ring
      this.yieldLine = { x: e.jx - ux * 7 + rx * lane, z: e.jz - uz * 7 + rz * lane, fx: ux, fz: uz, rx, rz, half: e.w / (lane ? 4 : 2) - 0.3 };
      const t = this.walk(uniq[1], 35);
      this.exitTarget = { x: t.x, z: t.z }; this.exitJunction = { x: uniq[1].jx, z: uniq[1].jz };
      this.ok = true;
      return;
    }
  }

  private isOneway(a: Arm) { return a.canEnter !== a.canExit; }

  private buildMarking() {
    const y = this.yieldLine!;
    const pos: number[] = [], idx: number[] = [];
    // dashed give-way line
    for (let u = -y.half; u < y.half; u += 0.9) {
      const b = pos.length / 3, u2 = Math.min(y.half, u + 0.5);
      for (const [uu, ff] of [[u, -0.2], [u2, -0.2], [u2, 0.2], [u, 0.2]]) pos.push(y.x + y.rx * uu + y.fx * ff, 0.14, y.z + y.rz * uu + y.fz * ff);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    this.group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff })));
  }
}
