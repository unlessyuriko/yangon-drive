import * as THREE from 'three';
import { makePedestrian, animatePedestrian } from './world/Pedestrian';

interface Road { w: number; pts: number[]; ow: number; hw: string }

export interface Crossing {
  c: THREE.Vector2;       // centre
  f: THREE.Vector2;       // along the road
  r: THREE.Vector2;       // across the road
  w: number;              // road width
  spawn: { x: number; z: number; heading: number; len: number }; // start point before the crossing
  dir: THREE.Vector2;     // travel direction of the spawn approach
  // pedestrian
  u: number; sign: number; active: boolean; timer: number; hitDone: boolean; fineCool: number;
  mesh: THREE.Group;
}

const SKIN = [0xe0b48f, 0xc68c64, 0xa86f48];
const SHIRT = [0xd04a3c, 0x3c7ad0, 0x3caa5a, 0xe0b030, 0x8a4ac0, 0xf0f0f0];

export class Crossings {
  group = new THREE.Group();
  list: Crossing[] = [];
  scripted: Crossing | null = null;
  private prevA = new Map<Crossing, number>();

  constructor(points: [number, number][], roads: Road[]) {
    const pos: number[] = [], idx: number[] = [];
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    for (const [px, pz] of points) {
      let best = 7, bi = -1, bseg = 0, bt = 0;
      roads.forEach((r, ri) => {
        if (r.w < 7 || !['primary', 'secondary', 'tertiary', 'trunk', 'residential', 'unclassified'].includes(r.hw)) return;
        for (let i = 0; i < r.pts.length / 2 - 1; i++) {
          const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], ex = r.pts[i * 2 + 2] - ax, ez = r.pts[i * 2 + 3] - az;
          const L2 = ex * ex + ez * ez || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / L2));
          const d = Math.hypot(ax + ex * t - px, az + ez * t - pz);
          if (d < best) { best = d; bi = ri; bseg = i; bt = t; }
        }
      });
      if (bi < 0) continue;
      const road = roads[bi];
      const ax = road.pts[bseg * 2], az = road.pts[bseg * 2 + 1], bx = road.pts[bseg * 2 + 2], bz = road.pts[bseg * 2 + 3];
      const f = new THREE.Vector2(bx - ax, bz - az); const segLen = f.length(); if (segLen < 6) continue; f.normalize();
      const c = new THREE.Vector2(ax + (bx - ax) * bt, az + (bz - az) * bt);
      const r = new THREE.Vector2(-f.y, f.x);

      // zebra stripes: bars along the road, repeated across its width
      const hw = road.w / 2 - 0.4;
      for (let u = -hw; u <= hw; u += 1.0) {
        const base = pos.length / 3, y = 0.13;
        const x0 = c.x + r.x * u, z0 = c.y + r.y * u;
        for (const [a, b] of [[-1.5, -0.25], [-1.5, 0.25], [1.5, 0.25], [1.5, -0.25]]) {
          pos.push(x0 + f.x * a + r.x * b, y, z0 + f.y * a + r.y * b);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }

      // spawn point: walk back along the polyline ~130 m in whichever direction has more road
      const walk = (dir: 1 | -1) => {
        const n = road.pts.length / 2;
        let idx2 = dir > 0 ? bseg + 1 : bseg, acc = 0, pxp = c.x, pzp = c.y, sx = c.x, sz = c.y;
        while (acc < 130) {
          idx2 -= dir; if (idx2 < 0 || idx2 >= n) break;
          const nx = road.pts[idx2 * 2], nz = road.pts[idx2 * 2 + 1], L = Math.hypot(nx - pxp, nz - pzp);
          if (acc + L >= 130) { const k = (130 - acc) / L; sx = pxp + (nx - pxp) * k; sz = pzp + (nz - pzp) * k; acc = 130; break; }
          acc += L; pxp = nx; pzp = nz; sx = nx; sz = nz;
        }
        return { sx, sz, acc };
      };
      const w1 = walk(1), w2 = walk(-1);
      const pick = w1.acc >= w2.acc ? { ...w1, dir: 1 } : { ...w2, dir: -1 };
      const tdir = new THREE.Vector2(c.x - pick.sx, c.y - pick.sz).normalize();
      const lane = road.ow ? 0 : road.w / 4, rr = new THREE.Vector2(-tdir.y, tdir.x);

      // pedestrian model (hidden until it walks)
      const mesh = makePedestrian(rnd);
      mesh.visible = false;
      this.group.add(mesh);

      this.list.push({
        c, f, r, w: road.w, dir: tdir,
        spawn: { x: pick.sx + rr.x * lane, z: pick.sz + rr.y * lane, heading: Math.atan2(-tdir.x, -tdir.y), len: pick.acc },
        u: 0, sign: 1, active: false, timer: 4 + rnd() * 14, hitDone: false, fineCool: 0, mesh,
      });
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xf2c21b })));
  }

  /** Choose the nearest crossing with a long run-in for the lesson. */
  pickLesson(): Crossing | null {
    let best: Crossing | null = null, bd = Infinity;
    for (const k of this.list) {
      if (k.spawn.len < 110) continue;
      const d = Math.hypot(k.c.x, k.c.y);
      if (d < bd) { bd = d; best = k; }
    }
    this.scripted = best;
    return best;
  }

  private startPed(k: Crossing, sign: number) {
    k.active = true; k.sign = sign; k.u = -sign * (k.w / 2 + 1.5); k.hitDone = false; k.mesh.visible = true;
  }

  pedOnRoad(k: Crossing) { return k.active && Math.abs(k.u) < k.w / 2 + 0.6; }

  /** Move pedestrians; returns rule events for the car front point. */
  update(dt: number, fx: number, fz: number, speed: number): { giveWay: boolean; hit: boolean } {
    const ev = { giveWay: false, hit: false };
    for (const k of this.list) {
      k.fineCool -= dt;
      if (k.active) {
        k.u += k.sign * 1.35 * dt;
        // across-road position, slightly to one side of the stripes' centre line
        k.mesh.position.set(k.c.x + k.r.x * k.u + k.f.x * 0.9, 0, k.c.y + k.r.y * k.u + k.f.y * 0.9);
        animatePedestrian(k.mesh, k.u);
        k.mesh.rotation.y = Math.atan2(k.r.x * k.sign, k.r.y * k.sign);
        if (Math.abs(k.u) > k.w / 2 + 1.7 && k.u * k.sign > 0) { k.active = false; k.mesh.visible = false; k.timer = 6 + Math.random() * 18; }
      } else if (k !== this.scripted) {
        k.timer -= dt;
        // only spawn near the player to save work
        if (k.timer <= 0 && Math.hypot(k.c.x - fx, k.c.y - fz) < 150) this.startPed(k, Math.random() < 0.5 ? 1 : -1);
        else if (k.timer <= 0) k.timer = 3;
      }

      // car vs pedestrian and give-way
      const dx = fx - k.c.x, dz = fz - k.c.y;
      const a = dx * k.f.x + dz * k.f.y, lat = dx * k.r.x + dz * k.r.y;
      const pa = this.prevA.get(k); this.prevA.set(k, a);
      if (k.active) {
        const pdx = k.mesh.position.x - fx, pdz = k.mesh.position.z - fz;
        if (!k.hitDone && Math.hypot(pdx, pdz) < 1.6 && Math.abs(speed) > 1) { k.hitDone = true; ev.hit = true; }
      }
      if (pa !== undefined && Math.abs(pa) >= 2 && Math.abs(a) < 2 && Math.abs(lat) < k.w / 2 && Math.abs(speed) > 1.5 && this.pedOnRoad(k) && k.fineCool <= 0) {
        k.fineCool = 6; ev.giveWay = true;
      }
    }
    return ev;
  }

  /** Make a pedestrian step out for the scripted lesson crossing. */
  forceScripted() {
    const k = this.scripted;
    if (k && !k.active) this.startPed(k, 1);
  }
}
