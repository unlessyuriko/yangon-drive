import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Road { w: number; pts: number[]; ow: number; hw: string }

export type Light = 'red' | 'yellow' | 'green';
export interface Approach {
  cluster: number; phase: 0 | 1;
  s: THREE.Vector2;      // stop line centre
  f: THREE.Vector2;      // travel direction
  half: number;          // half length of the stop line
  r: THREE.Vector2;      // right vector
  w: number;
  arcStart: { x: number; z: number; heading: number; len: number }; // spawn point before the line
  lampBase: number; cd: number;
}

const GREEN = 14, YELLOW = 3, ALLRED = 1.5;
const CYCLE = (GREEN + YELLOW + ALLRED) * 2;

/** Light state of a phase at a given time for a given cluster. */
export function lightState(cluster: number, phase: 0 | 1, t: number): Light {
  const u = ((t + cluster * 7.3) % CYCLE + CYCLE) % CYCLE;
  const p = phase === 0 ? u : (u + CYCLE / 2) % CYCLE;
  if (p < GREEN) return 'green';
  if (p < GREEN + YELLOW) return 'yellow';
  return 'red';
}

/** whole seconds until this phase changes colour */
export function remaining(cluster: number, phase: 0 | 1, t: number): number {
  const u = ((t + cluster * 7.3) % CYCLE + CYCLE) % CYCLE;
  const p = phase === 0 ? u : (u + CYCLE / 2) % CYCLE;
  if (p < GREEN) return Math.ceil(GREEN - p);
  if (p < GREEN + YELLOW) return Math.ceil(GREEN + YELLOW - p);
  return Math.ceil(CYCLE - p);
}

const HDR = (c: number, k = 3) => new THREE.Color(c).multiplyScalar(k);
const mats = {
  redOn: { color: HDR(0xff2a1f) }, redOff: { color: new THREE.Color(0x2a0d0b) },
  yelOn: { color: HDR(0xffc21a) }, yelOff: { color: new THREE.Color(0x2a2208) },
  grnOn: { color: HDR(0x2dff6a) }, grnOff: { color: new THREE.Color(0x0a2412) },
};

export class Signals {
  group = new THREE.Group();
  approaches: Approach[] = [];
  private prev = new Map<Approach, number>();
  private lastState = new Map<Approach, Light>();

  constructor(centres: [number, number][], roads: Road[]) {
    const lines: number[] = [], lidx: number[] = [];
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 7, 8);
    const headGeo = new THREE.BoxGeometry(2.3, 0.62, 0.34);
    const lampGeo = new THREE.CircleGeometry(0.2, 16);
    const staticGeos: THREE.BufferGeometry[] = [], headGeos: THREE.BufferGeometry[] = [];
    const lampMats: THREE.Matrix4[] = [], cdMats: THREE.Matrix4[] = [];

    centres.forEach(([cx, cz], ci) => {
      const found: { f: THREE.Vector2; P: THREE.Vector2; w: number; ow: number; poly: number[]; seg: number }[] = [];
      for (const r of roads) {
        if (r.w < 7 || !['primary', 'secondary', 'tertiary', 'trunk', 'residential', 'unclassified'].includes(r.hw)) continue;
        let best = 22, bp: THREE.Vector2 | null = null, bt = new THREE.Vector2(), bseg = 0;
        for (let i = 0; i < r.pts.length / 2 - 1; i++) {
          const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], bz = r.pts[i * 2 + 3];
          const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
          const t = Math.max(0, Math.min(1, ((cx - ax) * ex + (cz - az) * ez) / L2));
          const qx = ax + ex * t, qz = az + ez * t, d = Math.hypot(qx - cx, qz - cz);
          if (d < best) { best = d; bp = new THREE.Vector2(qx, qz); bt = new THREE.Vector2(ex, ez).normalize(); bseg = i; }
        }
        if (bp) found.push({ f: bt, P: bp, w: r.w, ow: r.ow, poly: r.pts, seg: bseg });
      }
      // two phases: roads roughly parallel to the first one share a phase
      const ref = found[0]?.f;
      for (const a of found) {
        const phase: 0 | 1 = ref && Math.abs(a.f.dot(ref)) > 0.7 ? 0 : 1;
        for (const dir of a.ow ? [1] : [1, -1]) {
          const f = a.f.clone().multiplyScalar(dir);
          const right = new THREE.Vector2(-f.y, f.x);
          const setback = 10 + a.w / 2 * 0.3;
          const half = a.ow ? a.w / 2 - 0.3 : a.w / 4 - 0.2;
          const lat = a.ow ? 0 : a.w / 4;
          const s = a.P.clone().addScaledVector(f, -setback).addScaledVector(right, lat);
          // stop line quad
          const y = 0.14, base = lines.length / 3, hw = 0.2;
          const ax = s.x - right.x * half, az = s.y - right.y * half, bx = s.x + right.x * half, bz = s.y + right.y * half;
          lines.push(ax - f.x * hw, y, az - f.y * hw, bx - f.x * hw, y, bz - f.y * hw, bx + f.x * hw, y, bz + f.y * hw, ax + f.x * hw, y, az + f.y * hw);
          lidx.push(base, base + 1, base + 2, base, base + 2, base + 3);

          // signal head on a pole at the kerb beside the stop line, facing the oncoming driver
          const px = s.x + right.x * (a.w / 2 - lat + 1.0), pz = s.y + right.y * (a.w / 2 - lat + 1.0);
          const rotY = Math.atan2(-f.x, -f.y); // front (+z) points back toward approaching cars
          // Yangon style: tall grey pole at the kerb, horizontal mast arm over the lane, black horizontal head (red | amber | green) with a countdown timer
          const dist = a.w / 2 - lat + 1.0, HEAD_Y = 6.1;
          const pg = poleGeo.clone(); pg.translate(px, 3.5, pz); staticGeos.push(pg.toNonIndexed());
          const arm = new THREE.CylinderGeometry(0.06, 0.07, dist, 6); arm.rotateZ(Math.PI / 2);
          arm.rotateY(Math.atan2(-right.y, right.x) + Math.PI); arm.translate(px - right.x * dist / 2, 6.7, pz - right.y * dist / 2); staticGeos.push(arm.toNonIndexed());
          const hx = px - right.x * dist, hz = pz - right.y * dist;
          const hdr = new THREE.BoxGeometry(0.06, 0.5, 0.06); hdr.translate(hx, 6.45, hz); staticGeos.push(hdr.toNonIndexed());
          const hg = headGeo.clone(); hg.rotateY(rotY); hg.translate(hx, HEAD_Y, hz); headGeos.push(hg.toNonIndexed());
          const lampBase = lampMats.length;
          const headM = new THREE.Matrix4().makeRotationY(rotY).setPosition(hx, HEAD_Y, hz);
          for (let k = 0; k < 3; k++) lampMats.push(new THREE.Matrix4().multiplyMatrices(headM, new THREE.Matrix4().makeTranslation(-0.82 + k * 0.54, 0, 0.175)));
          cdMats.push(new THREE.Matrix4().multiplyMatrices(headM, new THREE.Matrix4().makeTranslation(0.88, 0, 0.176)));

          // spawn point: walk back along the road polyline up to ~150 m
          const ptsArr = a.poly; const n = ptsArr.length / 2;
          const seg = a.seg; let acc = 0, sx = a.P.x, sz = a.P.y, heading = 0, idx = dir > 0 ? seg + 1 : seg;
          let prevx = sx, prevz = sz;
          while (acc < 150) {
            idx -= dir; if (idx < 0 || idx >= n) break;
            const nx = ptsArr[idx * 2], nz = ptsArr[idx * 2 + 1];
            const L = Math.hypot(nx - prevx, nz - prevz);
            if (acc + L >= 150) { const k = (150 - acc) / L; sx = prevx + (nx - prevx) * k; sz = prevz + (nz - prevz) * k; acc = 150; prevx = sx; prevz = sz; break; }
            acc += L; prevx = nx; prevz = nz; sx = nx; sz = nz;
          }
          const dx = a.P.x - sx, dz = a.P.y - sz;
          heading = Math.atan2(-dx, -dz);
          // lane offset to the right
          const spawnR = new THREE.Vector2(-dz, dx).normalize();
          this.approaches.push({
            cluster: ci, phase, s, f, half, r: right, w: a.w,
            arcStart: { x: sx + spawnR.x * (lat || 0), z: sz + spawnR.y * (lat || 0), heading, len: acc },
            lampBase, cd: cdMats.length - 1,
          });
        }
      }
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    g.setIndex(lidx);
    this.group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff })));
    // all poles/heads in merged meshes, lamps + countdown digits instanced (colour per instance)
    if (staticGeos.length) {
      const strip = (x: THREE.BufferGeometry) => { x.deleteAttribute('uv'); return x; };
      this.group.add(new THREE.Mesh(mergeGeometries(staticGeos.map(strip))!, new THREE.MeshLambertMaterial({ color: 0x9a9ea6 })));
      this.group.add(new THREE.Mesh(mergeGeometries(headGeos.map(strip))!, new THREE.MeshLambertMaterial({ color: 0x0e0f11 })));
      const lm = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      this.lampMesh = new THREE.InstancedMesh(lampGeo, lm, lampMats.length);
      lampMats.forEach((m, i) => { this.lampMesh!.setMatrixAt(i, m); this.lampMesh!.setColorAt(i, mats.redOff.color); });
      this.lampMesh.frustumCulled = false; this.group.add(this.lampMesh);
      // countdown timer: atlas of numbers 0-99, per-instance uv offset
      const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 800; const x = cv.getContext('2d')!;
      x.fillStyle = '#000'; x.fillRect(0, 0, 1000, 800); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 62px "Chakra Petch","Consolas",monospace';
      for (let n = 0; n < 100; n++) x.fillText(String(n), (n % 10) * 100 + 50, Math.floor(n / 10) * 80 + 42);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const cg = new THREE.PlaneGeometry(0.5, 0.4);
      const off = new Float32Array(cdMats.length * 2); this.cdOff = new THREE.InstancedBufferAttribute(off, 2); this.cdOff.setUsage(THREE.DynamicDrawUsage);
      cg.setAttribute('uvOff', this.cdOff);
      const cm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      cm.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute vec2 uvOff;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vec2(uv.x * 0.1 + uvOff.x, uv.y * 0.1 + uvOff.y);\n#endif');
      };
      this.cdMesh = new THREE.InstancedMesh(cg, cm, cdMats.length);
      cdMats.forEach((m, i) => { this.cdMesh!.setMatrixAt(i, m); this.cdMesh!.setColorAt(i, new THREE.Color(0, 0, 0)); });
      this.cdMesh.frustumCulled = false; this.group.add(this.cdMesh);
    }
  }
  private cdMesh: THREE.InstancedMesh | null = null; private cdOff: THREE.InstancedBufferAttribute | null = null; private lastRem = new Map<Approach, number>();
  private lampMesh: THREE.InstancedMesh | null = null;

  /** Update lamp colours and countdown digits. */
  update(t: number) {
    const lm = this.lampMesh, cd = this.cdMesh; if (!lm || !cd || !this.cdOff) return;
    let changed = false, cdChanged = false;
    const red = new THREE.Color(1, 0.12, 0.1).multiplyScalar(3), green = new THREE.Color(0.15, 1, 0.3).multiplyScalar(3);
    for (const a of this.approaches) {
      const st = lightState(a.cluster, a.phase, t);
      const rem = remaining(a.cluster, a.phase, t);
      if (this.lastState.get(a) !== st) {
        this.lastState.set(a, st); changed = true;
        lm.setColorAt(a.lampBase, (st === 'red' ? mats.redOn : mats.redOff).color);
        lm.setColorAt(a.lampBase + 1, (st === 'yellow' ? mats.yelOn : mats.yelOff).color);
        lm.setColorAt(a.lampBase + 2, (st === 'green' ? mats.grnOn : mats.grnOff).color);
        cd.setColorAt(a.cd, st === 'red' ? red : st === 'green' ? green : new THREE.Color(0, 0, 0)); cdChanged = true;
      }
      if (this.lastRem.get(a) !== rem) {
        this.lastRem.set(a, rem); const n = Math.min(99, rem);
        this.cdOff.setXY(a.cd, (n % 10) / 10, 1 - (Math.floor(n / 10) + 1) / 10); cdChanged = true;
      }
    }
    if (changed && lm.instanceColor) lm.instanceColor.needsUpdate = true;
    if (cdChanged) { if (cd.instanceColor) cd.instanceColor.needsUpdate = true; this.cdOff.needsUpdate = true; }
  }

  /** Returns events for the car front point (x,z): crossings of a stop line. */
  check(x: number, z: number, t: number, moving: boolean): { approach: Approach; state: Light }[] {
    const out: { approach: Approach; state: Light }[] = [];
    for (const a of this.approaches) {
      const dx = x - a.s.x, dz = z - a.s.y;
      const d = dx * a.f.x + dz * a.f.y;
      const lat = dx * a.r.x + dz * a.r.y;
      const p = this.prev.get(a);
      this.prev.set(a, d);
      if (p === undefined || !moving) continue;
      if (Math.abs(d) < 8 && p < 0 && d >= 0 && Math.abs(lat) <= a.half + 1.5) out.push({ approach: a, state: lightState(a.cluster, a.phase, t) });
    }
    return out;
  }

  /** Nearest approach with a long straight run-in, for lesson spawn. */
  pickLessonApproach(): Approach | null {
    let best: Approach | null = null, bd = Infinity;
    for (const a of this.approaches) {
      if (a.arcStart.len < 120) continue;
      const d = Math.hypot(a.s.x, a.s.y);
      if (d < bd) { bd = d; best = a; }
    }
    return best ?? this.approaches.reduce<Approach | null>((m, a) => (!m || a.arcStart.len > m.arcStart.len ? a : m), null);
  }
}
