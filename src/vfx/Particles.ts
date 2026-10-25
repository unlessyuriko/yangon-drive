import * as THREE from 'three';

interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number }

/** Two instanced pools: tyre smoke (soft grey puffs) and wall-scrape sparks (HDR orange so they bloom). One draw call each. */
export class Particles {
  private smoke: THREE.InstancedMesh; private sparks: THREE.InstancedMesh;
  private sp: P[] = []; private kp: P[] = [];
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private s = new THREE.Vector3(); private v = new THREE.Vector3();
  private si = 0; private ki = 0;

  constructor(scene: THREE.Scene, private nSmoke = 90, private nSparks = 70) {
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xd6d9dc, transparent: true, opacity: 0.32, depthWrite: false }), nSmoke);
    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), nSparks);
    const hot = new THREE.Color(4, 1.6, 0.25);
    for (let i = 0; i < nSparks; i++) this.sparks.setColorAt(i, hot);
    for (const o of [this.smoke, this.sparks]) { o.frustumCulled = false; scene.add(o); }
    const dead = (): P => ({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0 });
    for (let i = 0; i < nSmoke; i++) this.sp.push(dead());
    for (let i = 0; i < nSparks; i++) this.kp.push(dead());
  }

  emitSmoke(x: number, y: number, z: number, vx: number, vz: number) {
    const p = this.sp[this.si++ % this.nSmoke];
    p.x = x + (Math.random() - 0.5) * 0.3; p.y = y; p.z = z + (Math.random() - 0.5) * 0.3;
    p.vx = vx * 0.15 + (Math.random() - 0.5) * 0.6; p.vy = 0.5 + Math.random() * 0.5; p.vz = vz * 0.15 + (Math.random() - 0.5) * 0.6;
    p.life = p.max = 1.0 + Math.random() * 0.6; p.size = 0.5 + Math.random() * 0.4;
  }

  emitSparks(x: number, y: number, z: number, nx: number, nz: number, count = 6) {
    for (let i = 0; i < count; i++) {
      const p = this.kp[this.ki++ % this.nSparks], a = Math.random() * 6.283, sp = 3 + Math.random() * 6;
      p.x = x; p.y = y; p.z = z;
      p.vx = nx * sp * 0.5 + Math.cos(a) * sp * 0.5; p.vy = 1 + Math.random() * 3; p.vz = nz * sp * 0.5 + Math.sin(a) * sp * 0.5;
      p.life = p.max = 0.25 + Math.random() * 0.35; p.size = 1;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.nSmoke; i++) {
      const p = this.sp[i];
      if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt; }
      const t = p.life > 0 ? 1 - p.life / p.max : 1;
      const sc = p.life > 0 ? p.size * (0.4 + t * 2.4) * Math.min(1, (1 - t) * 3) : 0;
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.s.set(sc, sc, sc)); this.smoke.setMatrixAt(i, this.m);
    }
    for (let i = 0; i < this.nSparks; i++) {
      const p = this.kp[i];
      if (p.life > 0) { p.life -= dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y = Math.max(0.02, p.y + p.vy * dt); p.z += p.vz * dt; }
      const sc = p.life > 0 ? Math.min(1, p.life / p.max * 2) : 0;
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.s.set(sc, sc, sc)); this.sparks.setMatrixAt(i, this.m);
    }
    this.smoke.instanceMatrix.needsUpdate = true; this.sparks.instanceMatrix.needsUpdate = true;
  }
}
