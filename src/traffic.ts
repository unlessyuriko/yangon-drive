import * as THREE from 'three';
import { Signals, lightState } from './signals';
import { Crossings } from './crossings';
import { YbsBus } from './vehicle/YbsBus';
import { Taxi } from './vehicle/Taxi';

interface Road { w: number; pts: number[]; ow: number; hw: string }
interface Edge { a: number; b: number; ax: number; az: number; dx: number; dz: number; len: number; w: number; ow: boolean; bus: boolean }
export interface Agent {
  bus: boolean; e: number; next: number; x: number; z: number; h: number; v: number; cruise: number;
  slot: number; len: number; active: boolean; stuck: number; taxi?: boolean; script?: boolean;
}

const DRIVABLE = ['primary', 'secondary', 'tertiary', 'trunk', 'residential', 'unclassified'];
const BUS_ROADS = ['primary', 'secondary', 'tertiary', 'trunk'];
const CAR_COLORS = [0xf4f4f4, 0xc9ccd1, 0x2b2f36, 0xb32424, 0x2c5faa, 0xf2c230, 0x4b8a5a, 0x8a8f99];

export class Traffic {
  group = new THREE.Group();
  agents: Agent[] = [];
  /** lesson 5 stages its own traffic: ordinary AI is switched off */
  suspend = false;
  private edges: Edge[] = [];
  private out: number[][] = [];
  private carBody: THREE.InstancedMesh; private carCabin: THREE.InstancedMesh;
  private carWheels: THREE.InstancedMesh; private buses: YbsBus[] = []; private taxis: Taxi[] = [];
  private dummy = new THREE.Object3D();
  private lampF: THREE.InstancedMesh; private lampR: THREE.InstancedMesh;
  private carEdges: number[] = []; private busEdgeList: number[] = [];

  constructor(roads: Road[], private signals: Signals, private crossings: Crossings, nCars: number, nBuses: number, nTaxis = 0) {
    // ---- road graph from shared polyline vertices
    const nodes = new Map<string, number>();
    const node = (x: number, z: number) => {
      const k = `${Math.round(x * 2)},${Math.round(z * 2)}`;
      let i = nodes.get(k); if (i === undefined) { i = nodes.size; nodes.set(k, i); this.out.push([]); }
      return i;
    };
    for (const r of roads) {
      if (r.w < 7 || !DRIVABLE.includes(r.hw)) continue;
      const bus = BUS_ROADS.includes(r.hw);
      const n = r.pts.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], bz = r.pts[i * 2 + 3];
        const len = Math.hypot(bx - ax, bz - az); if (len < 1) continue;
        const a = node(ax, az), b = node(bx, bz); if (a === b) continue;
        const add = (e: Edge) => { this.out[e.a].push(this.edges.length); this.edges.push(e); };
        add({ a, b, ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, len, w: r.w, ow: !!r.ow, bus });
        if (!r.ow) add({ a: b, b: a, ax: bx, az: bz, dx: (ax - bx) / len, dz: (az - bz) / len, len, w: r.w, ow: false, bus });
      }
    }
    this.edges.forEach((e, i) => { if (e.len >= 12 && this.out[e.b].length) { this.carEdges.push(i); if (e.bus && e.len >= 25) this.busEdgeList.push(i); } });

    // ---- instanced meshes
    const lam = (c = 0xffffff) => new THREE.MeshLambertMaterial({ color: c });
    this.carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.65, 4.2), lam(), nCars);
    this.carCabin = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.55, 2.1), lam(0x34414f), nCars);
    for (let i = 0; i < nTaxis; i++) { const t = new Taxi(); t.group.visible = false; this.taxis.push(t); this.group.add(t.group); }
    for (let i = 0; i < nBuses; i++) { const b = new YbsBus(); b.group.visible = false; this.buses.push(b); this.group.add(b.group); }
    const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14); wg.rotateZ(Math.PI / 2);
    this.carWheels = new THREE.InstancedMesh(wg, new THREE.MeshLambertMaterial({ color: 0x151517 }), nCars * 4); this.carWheels.frustumCulled = false; this.group.add(this.carWheels);
    const lg = new THREE.BoxGeometry(0.42, 0.2, 0.12);
    this.lampF = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xfff4c8 }), (nCars + nBuses + nTaxis) * 2);
    this.lampR = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xff2a1a }), (nCars + nBuses + nTaxis) * 2);
    this.lampF.visible = this.lampR.visible = false;
    for (const m of [this.carBody, this.carCabin, this.lampF, this.lampR]) { m.frustumCulled = false; this.group.add(m); }

    let rnd = 5; const rr = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    const mk = (bus: boolean, slot: number) => this.agents.push({ bus, e: 0, next: -1, x: 0, z: 0, h: 0, v: 0, cruise: bus ? 6.5 : 7.5 + rr() * 3, slot, len: bus ? 10.5 : 4.2, active: false, stuck: 0 });
    for (let i = 0; i < nCars; i++) { mk(false, i); this.carBody.setColorAt(i, new THREE.Color(CAR_COLORS[Math.floor(rr() * CAR_COLORS.length)])); }
    for (let i = 0; i < nBuses; i++) mk(true, i);
    for (let i = 0; i < nTaxis; i++) { mk(false, i); this.agents[this.agents.length - 1].taxi = true; this.agents[this.agents.length - 1].len = 4.4; }
  }

  setNight(on: boolean) { this.lampF.visible = this.lampR.visible = on; }

  get edgeCount() { return this.edges.length; }

  private laneOf(e: Edge) { return e.ow ? 0 : e.w / 4; }

  private chooseNext(ei: number): number {
    const e = this.edges[ei];
    const outs = this.out[e.b];
    const cand = outs.filter((o) => this.edges[o].b !== e.a);
    const list = cand.length ? cand : outs;
    if (!list.length) return -1;
    // prefer going straight
    let sum = 0; const w = list.map((o) => { const t = this.edges[o]; const k = 0.6 + Math.max(0, e.dx * t.dx + e.dz * t.dz) * 1.6; sum += k; return k; });
    let r = Math.random() * sum;
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  private place(a: Agent, px: number, pz: number, minD: number, maxD: number): boolean {
    const pool = a.bus ? this.busEdgeList : this.carEdges;
    for (let tries = 0; tries < 40; tries++) {
      const ei = pool[Math.floor(Math.random() * pool.length)];
      const e = this.edges[ei];
      const s = Math.random() * e.len;
      const lane = this.laneOf(e);
      const x = e.ax + e.dx * s - e.dz * lane, z = e.az + e.dz * s + e.dx * lane;
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD) continue;
      // keep clear of other vehicles
      if (this.agents.some((o) => o !== a && o.active && Math.hypot(o.x - x, o.z - z) < 14)) continue;
      const nx = this.chooseNext(ei); if (nx < 0) continue;
      a.e = ei; a.next = nx; a.x = x; a.z = z; a.h = Math.atan2(e.dx, e.dz); a.v = 0; a.active = true; a.stuck = 0;
      if (a.taxi) this.taxis[a.slot].setVariant(Math.floor(Math.random() * 4));
      if (a.bus) this.buses[a.slot].setRoute(1 + Math.floor(Math.random() * 100), Math.random() < 0.25);
      return true;
    }
    return false;
  }

  /** take over one bus and two taxis for a scripted scene; the caller moves them */
  claimScripted(): { bus: Agent; taxis: Agent[] } {
    const bus = this.agents.find((a) => a.bus)!, taxis = this.agents.filter((a) => a.taxi).slice(0, 2);
    for (const a of [bus, ...taxis]) { a.script = true; a.active = false; a.v = 0; }
    this.suspend = true;
    return { bus, taxis };
  }
  releaseScripted() {
    for (const a of this.agents) if (a.script) { a.script = false; a.active = false; }
    this.suspend = false;
  }

  /** player: position, heading (rad, forward = (-sin h, -cos h)) and speed. */
  update(dt: number, t: number, px: number, pz: number, ph: number, pv: number) {
    const pfx = -Math.sin(ph), pfz = -Math.cos(ph);
    for (const a of this.agents) {
      if (a.script) continue;
      if (this.suspend) { a.active = false; continue; }
      if (!a.active) { this.place(a, px, pz, 70, 260); continue; }
      const e = this.edges[a.e];
      let s = (a.x - e.ax) * e.dx + (a.z - e.az) * e.dz;
      if (s >= e.len - 0.3) {
        a.e = a.next; a.next = this.chooseNext(a.e);
        if (a.next < 0) { a.active = false; continue; }
        continue;
      }
      // ---- steering: pure pursuit toward a lane point ahead
      const look = Math.max(5, a.v * 1.0 + 3);
      let tx: number, tz: number, ahead = s + look;
      if (ahead <= e.len) {
        const lane = this.laneOf(e);
        tx = e.ax + e.dx * ahead - e.dz * lane; tz = e.az + e.dz * ahead + e.dx * lane;
      } else {
        const n = this.edges[a.next], lane = this.laneOf(n), d = Math.min(ahead - e.len, n.len);
        tx = n.ax + n.dx * d - n.dz * lane; tz = n.az + n.dz * d + n.dx * lane;
      }
      const want = Math.atan2(tx - a.x, tz - a.z);
      let dh = want - a.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      const maxRate = Math.max(0.6, Math.min(2.4, a.v * 0.45 + 0.6));
      a.h += Math.max(-maxRate * dt, Math.min(maxRate * dt, dh * 4 * dt));

      // ---- speed caps
      let cap = a.cruise;
      const toEnd = e.len - s;
      if (toEnd < 22) { const n = this.edges[a.next]; const dot = e.dx * n.dx + e.dz * n.dz; const ang = Math.acos(Math.max(-1, Math.min(1, dot))); cap = Math.min(cap, 8 - Math.min(1, ang / 1.2) * 4.8); }
      const fx = Math.sin(a.h), fz = Math.cos(a.h);
      // traffic lights
      for (const ap of this.signals.approaches) {
        const dx = ap.s.x - a.x, dz = ap.s.y - a.z;
        const d = dx * ap.f.x + dz * ap.f.y - a.len / 2;
        if (d < -0.5 || d > 30) continue;
        if (fx * ap.f.x + fz * ap.f.y < 0.85) continue;
        if (Math.abs(dx * ap.r.x + dz * ap.r.y) > ap.half + 2.5) continue;
        const st = lightState(ap.cluster, ap.phase, t);
        if (st === 'green') continue;
        if (st === 'yellow' && d < a.v * a.v / 7) continue; // too close to stop comfortably
        cap = Math.min(cap, Math.sqrt(2 * 3.2 * Math.max(0, d - 1)));
      }
      // pedestrians on crossings ahead
      for (const k of this.crossings.list) {
        if (!k.active) continue;
        const dx = k.c.x - a.x, dz = k.c.y - a.z;
        const d = dx * fx + dz * fz - a.len / 2;
        if (d < -1 || d > 22 || Math.abs(dx * fz - dz * fx) > 4.5) continue;
        if (this.crossings.pedOnRoad(k) || Math.abs(k.u) < k.w / 2 + 3) cap = Math.min(cap, Math.sqrt(2 * 4 * Math.max(0, d - 2)));
      }
      // vehicles ahead (including the player)
      const lead = (ox: number, oz: number, ov: number, olen: number) => {
        const dx = ox - a.x, dz = oz - a.z;
        const along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
        if (along <= 0 || along > 40 || lat > 2.4) return;
        const gap = along - a.len / 2 - olen / 2 - 2.5;
        cap = Math.min(cap, Math.max(0, ov) * 0.9 + Math.sqrt(2 * 4 * Math.max(0, gap)));
      };
      for (const o of this.agents) if (o !== a && o.active) lead(o.x, o.z, o.v, o.len);
      lead(px, pz, pv, 4.2);

      if (a.v > cap) a.v = Math.max(cap, a.v - 7 * dt); else a.v = Math.min(cap, a.v + 2.4 * dt);
      a.x += Math.sin(a.h) * a.v * dt; a.z += Math.cos(a.h) * a.v * dt;

      // stuck for a long time far from the player -> relocate
      a.stuck = a.v < 0.3 ? a.stuck + dt : 0;
      const dp = Math.hypot(a.x - px, a.z - pz);
      if (dp > 330 || (a.stuck > 40 && dp > 90)) a.active = false;
    }
    this.writeInstances();
  }

  private writeInstances() {
    const d = this.dummy; let ci = 0, bi = 0;
    for (const a of this.agents) {
      const hidden = !a.active;
      d.position.set(a.x, 0, a.z); d.rotation.set(0, a.h, 0); d.scale.setScalar(hidden ? 0 : 1);
      if (a.bus) {
        const bm = this.buses[a.slot]; bm.group.visible = a.active; bm.group.position.set(a.x, 0, a.z); bm.group.rotation.y = a.h; bi++;
      } else if (a.taxi) {
        const tm = this.taxis[a.slot]; tm.group.visible = a.active; tm.group.position.set(a.x, 0, a.z); tm.group.rotation.y = a.h;
      } else {
        d.position.y = 0.65; d.updateMatrix(); this.carBody.setMatrixAt(a.slot, d.matrix);
        d.position.y = 1.2; d.position.x += Math.sin(a.h) * -0.1; d.position.z += Math.cos(a.h) * -0.1; d.updateMatrix(); this.carCabin.setMatrixAt(a.slot, d.matrix); ci++;
        const fx = Math.sin(a.h), fz = Math.cos(a.h), rx = Math.cos(a.h), rz = -Math.sin(a.h);
        let w = a.slot * 4;
        for (const f of [1.3, -1.3]) for (const sg of [-1, 1]) {
          d.position.set(a.x + fx * f + rx * sg * 0.84, 0.32, a.z + fz * f + rz * sg * 0.84); d.updateMatrix(); this.carWheels.setMatrixAt(w++, d.matrix);
        }
      }
    }
    let li = 0;
    for (const a of this.agents) {
      const fx = Math.sin(a.h), fz = Math.cos(a.h), rx = Math.cos(a.h), rz = -Math.sin(a.h), y = a.bus ? 0.75 : 0.7, h = a.len / 2;
      for (const sgn of [-1, 1]) {
        for (const [mesh, f] of [[this.lampF, h], [this.lampR, -h]] as [THREE.InstancedMesh, number][]) {
          d.position.set(a.x + fx * f + rx * sgn * (a.bus ? 0.95 : 0.65), y, a.z + fz * f + rz * sgn * (a.bus ? 0.95 : 0.65));
          d.rotation.set(0, a.h, 0); d.scale.setScalar(a.active ? 1 : 0); d.updateMatrix();
          mesh.setMatrixAt(li, d.matrix);
        }
        li++;
      }
    }
    this.lampF.instanceMatrix.needsUpdate = this.lampR.instanceMatrix.needsUpdate = true;
    for (const m of [this.carBody, this.carCabin, this.carWheels]) m.instanceMatrix.needsUpdate = true;
    if (this.carBody.instanceColor) this.carBody.instanceColor.needsUpdate = true;
  }

  /** Push-out vector for a player circle against all vehicles. */
  pushPlayer(x: number, z: number, r: number): [number, number] {
    let ox = 0, oz = 0;
    for (const a of this.agents) {
      if (!a.active || Math.abs(a.x - x) > 9 || Math.abs(a.z - z) > 9) continue;
      const fx = Math.sin(a.h), fz = Math.cos(a.h);
      const rad = a.bus ? 1.35 : 1.0, n = a.bus ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : (i - 1) * 3.5;
        const cx = a.x + fx * (n === 1 ? 1.2 : o), cz = a.z + fz * (n === 1 ? 1.2 : o);
        const cs = n === 1 ? [cx, cx - fx * 2.4] : [cx];
        for (let j = 0; j < cs.length; j++) {
          const px = n === 1 ? a.x + fx * (j ? -1.2 : 1.2) : cx, pz = n === 1 ? a.z + fz * (j ? -1.2 : 1.2) : cz;
          const d = Math.hypot(x - px, z - pz), m = r + rad;
          if (d < m) { const l = d || 1; ox += ((x - px) / l) * (m - d); oz += ((z - pz) / l) * (m - d); }
        }
      }
    }
    return [ox, oz];
  }
}
