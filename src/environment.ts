import { vp } from './core/Viewport';
import * as THREE from 'three';

interface Road { w: number; pts: number[]; hw: string }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixColor = (out: THREE.Color, a: number, b: number, t: number) => out.set(a).lerp(new THREE.Color(b), t);

/** Day/night, rain, fog and lighting, with smooth transitions. */
export class Environment {
  night = false; rain = false;
  nightT = 0; rainT = 0;
  headlights = false; wipers = false;
  private tmpA = new THREE.Color(); private tmpB = new THREE.Color(); private sky = new THREE.Color();
  private lamps: THREE.Group = new THREE.Group();
  private glowGroup = new THREE.Group();
  private glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  private poolMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  spot: THREE.SpotLight;
  roadMat: THREE.MeshStandardMaterial | null = null;

  constructor(private scene: THREE.Scene, private hemi: THREE.HemisphereLight, private sun: THREE.DirectionalLight, private car: THREE.Object3D) {
    scene.add(this.lamps);
    this.spot = new THREE.SpotLight(0xfff2d4, 0, 85, 0.5, 0.55, 1.6);
    this.spot.position.set(0, 0.9, -1.8);
    this.spot.target.position.set(0, 0.2, -30);
    car.add(this.spot, this.spot.target);
  }

  /** Street lamps (glow + pool of light) along the bigger roads. */
  buildLamps(roads: Road[]) {
    const pts: [number, number][] = [];
    let flip = 1;
    for (const r of roads) {
      if (!['primary', 'secondary', 'tertiary', 'trunk'].includes(r.hw) || r.w < 9) continue;
      let carry = 20;
      for (let i = 0; i < r.pts.length / 2 - 1; i++) {
        const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], bz = r.pts[i * 2 + 3];
        const L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        for (let d = carry; d < L; d += 45) {
          flip = -flip;
          const off = (r.w / 2 + 1.2) * flip;
          pts.push([ax + dx * d - dz * off, az + dz * d + dx * off]);
          carry = d + 45 - L;
        }
        if (carry < 0) carry = 0; else carry = carry; // continue spacing across segments
      }
    }
    const n = pts.length; if (!n) return;
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 6.5, 4); poleGeo.translate(0, 3.25, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x5b5f66 }), n);
    const glow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 5, 4), this.glowMat, n);
    const poolGeo = new THREE.CircleGeometry(10, 10); poolGeo.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(poolGeo, this.poolMat, n);
    const m = new THREE.Matrix4();
    // mostly warm sodium (#ff8800) with some neon cyan (#00f0ff) and magenta (#ff0055); glow is HDR so it blooms
    const tint = [new THREE.Color(0xff8800), new THREE.Color(0x00f0ff), new THREE.Color(0xff0055)], cc = new THREE.Color();
    pts.forEach(([x, z], i) => {
      poles.setMatrixAt(i, m.makeTranslation(x, 0, z));
      glow.setMatrixAt(i, m.makeTranslation(x, 6.6, z));
      pools.setMatrixAt(i, m.makeTranslation(x, 0.17, z));
      const t = tint[i % 7 === 3 ? 1 : i % 7 === 6 ? 2 : 0];
      glow.setColorAt(i, cc.copy(t).multiplyScalar(3)); pools.setColorAt(i, cc.copy(t).multiplyScalar(0.35));
    });
    for (const o of [poles, glow, pools]) o.frustumCulled = false;
    this.lamps.add(poles); this.glowGroup.add(glow, pools); this.lamps.add(this.glowGroup);
    glow.renderOrder = 2; pools.renderOrder = 1;
  }

  update(dt: number) {
    this.nightT += ((this.night ? 1 : 0) - this.nightT) * Math.min(1, 1.5 * dt);
    this.rainT += ((this.rain ? 1 : 0) - this.rainT) * Math.min(1, 1.5 * dt);
    const n = this.nightT, r = this.rainT;

    mixColor(this.tmpA, 0x9ad1f0, 0x8d99a4, r);   // day clear -> day rain
    mixColor(this.tmpB, 0x070b18, 0x0a0f18, r);   // night clear -> night rain
    this.sky.copy(this.tmpA).lerp(this.tmpB, n);
    this.scene.background = this.sky;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.sky);
    fog.near = lerp(lerp(80, 25, r), lerp(40, 18, r), n);
    fog.far = lerp(lerp(360, 170, r), lerp(230, 120, r), n);

    this.hemi.intensity = lerp(lerp(1.6, 1.2, r), lerp(0.32, 0.26, r), n);
    this.hemi.color.set(0xffffff).lerp(new THREE.Color(0x7a8cc0), n);
    this.sun.intensity = lerp(lerp(1.4, 0.35, r), lerp(0.22, 0.12, r), n);
    this.sun.color.set(0xfff2d6).lerp(new THREE.Color(0x8aa0d8), n);

    const lampVis = Math.max(0, (n - 0.15) / 0.85);
    this.glowGroup.visible = lampVis > 0.02;
    this.glowMat.opacity = lampVis * 0.95;
    this.poolMat.opacity = lampVis * 0.55;

    this.spot.intensity = this.headlights ? 2600 : 0;
    if (this.roadMat) { this.roadMat.color.setScalar(lerp(1, 0.72, r)); this.roadMat.roughness = lerp(1, 0.55, r); } // wet asphalt is darker and shinier
  }

  get wet() { return this.rainT; }
}

/** Falling rain streaks around the camera. */
export class RainField {
  mesh: THREE.LineSegments; private pos: Float32Array; private vel: Float32Array;
  private count: number; private R = 28;
  constructor(scene: THREE.Scene, count: number) {
    this.count = count;
    this.pos = new Float32Array(count * 6); this.vel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 2 * this.R, y = Math.random() * 25, z = (Math.random() - 0.5) * 2 * this.R;
      this.pos.set([x, y, z, x, y + 0.7, z], i * 6); this.vel[i] = 22 + Math.random() * 8;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfd9e6, transparent: true, opacity: 0.4, depthWrite: false }));
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
  }
  private density = 1;
  setDensity(d: number) { this.density = d; this.mesh.geometry.setDrawRange(0, Math.floor(this.count * d) * 2); }
  update(dt: number, cam: THREE.Vector3, level: number) {
    this.mesh.visible = level > 0.05;
    if (!this.mesh.visible) return;
    (this.mesh.material as THREE.LineBasicMaterial).opacity = 0.4 * Math.min(1, level);
    const R2 = this.R * 2, p = this.pos;
    // positions are stored in world space but wrapped into a box that follows the camera
    for (let i = 0; i < this.count; i++) {
      const o = i * 6;
      let y = p[o + 1] - this.vel[i] * dt;
      let x = p[o], z = p[o + 2];
      if (y < cam.y - 3) { y += 24; }
      x = cam.x + ((((x - cam.x + this.R) % R2) + R2) % R2) - this.R;
      z = cam.z + ((((z - cam.z + this.R) % R2) + R2) % R2) - this.R;
      p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x; p[o + 4] = y + 0.7; p[o + 5] = z;
    }
    (this.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Raindrops on the windscreen and a wiper that clears them. */
export class Windscreen {
  private cv = document.createElement('canvas'); private c: CanvasRenderingContext2D;
  private drops: { x: number; y: number; r: number }[] = [];
  private ang = 175; private dir = -1; private active = false;
  constructor() {
    this.cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    document.body.appendChild(this.cv);
    this.c = this.cv.getContext('2d')!;
  }
  update(dt: number, show: boolean, rain: number, wipers: boolean, speed: number) {
    if (!show || (rain < 0.05 && !this.drops.length)) { this.cv.style.display = 'none'; return; }
    this.cv.style.display = 'block';
    const k = Math.min(devicePixelRatio, 1) * 0.75, W0 = Math.round(vp.w * k), H0 = Math.round(vp.h * k);
    if (this.cv.width !== W0 || this.cv.height !== H0) { this.cv.width = W0; this.cv.height = H0; this.drops.length = 0; }
    const W = this.cv.width, H = this.cv.height;
    // new drops
    const rate = rain * (25 + speed * 2.2);
    for (let n = rate * dt; n > 0; n--) if (Math.random() < Math.min(1, n) && this.drops.length < 140) this.drops.push({ x: Math.random() * W, y: Math.random() * H * 0.92, r: 2 + Math.random() * 5 });
    // wiper
    const px = W * 0.5, py = H * 1.04, len = H * 0.95;
    this.active = wipers;
    const prev = this.ang;
    if (this.active || this.ang < 174) {
      this.ang += this.dir * 150 * dt;
      if (this.ang <= 8) { this.ang = 8; this.dir = 1; }
      if (this.ang >= 175) { this.ang = 175; this.dir = -1; if (!this.active) this.ang = 175; }
      if (!this.active && this.ang >= 175) { /* parked */ }
    }
    const lo = Math.min(prev, this.ang) - 2, hi = Math.max(prev, this.ang) + 2;
    this.drops = this.drops.filter((d) => {
      const a = (Math.atan2(py - d.y, d.x - px) * 180) / Math.PI, dist = Math.hypot(d.x - px, d.y - py);
      return !(a >= lo && a <= hi && dist < len);
    });
    const c = this.c; c.clearRect(0, 0, W, H);
    for (const d of this.drops) {
      c.fillStyle = 'rgba(210,225,240,0.22)'; c.beginPath(); c.ellipse(d.x, d.y, d.r, d.r * 1.3, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.stroke();
    }
    // wiper arm
    const a = (this.ang * Math.PI) / 180;
    c.strokeStyle = '#0d0e10'; c.lineWidth = Math.max(5, H * 0.012); c.lineCap = 'round';
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * len, py - Math.sin(a) * len); c.stroke();
  }
}
