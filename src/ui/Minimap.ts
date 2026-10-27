interface Road { w: number; pts: number[]; hw: string; name: string; en: string }
export interface Landmark { x: number; z: number; label: string }
interface Mob { x: number; z: number; active: boolean; bus: boolean }

import { coarse } from '../core/Viewport';
const PHONE = coarse;
const SIZE = PHONE ? 118 : 160;
const ZOOMS = [0.35, 0.7, 1.4]; // screen px per metre

/** GTA-style round radar: roads drawn once to an offscreen canvas, then rotated so the car always points up. */
export class Minimap {
  private cv = document.createElement('canvas'); private c: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private minX = 0; private minZ = 0; private bs = 0.5; private ready = false;
  private zoom = 1; private frames = 0;
  private labels: { x: number; z: number; text: string }[] = []; private marks: Landmark[] = [];

  constructor() {
    const dpr = Math.min(devicePixelRatio, 2);
    this.cv.width = this.cv.height = Math.round(SIZE * dpr);
    this.cv.style.cssText = `position:fixed;top:12px;right:12px;width:${SIZE}px;height:${SIZE}px;border-radius:50%;border:0;box-shadow:inset 0 2px 6px #000;background:#1e2a26;z-index:4;pointer-events:auto;touch-action:manipulation`;
    this.cv.title = 'Map (M to zoom)';
    // physical bezel: brushed gunmetal ring -> dark groove (the canvas edge) -> convex glass lens
    const ring = document.createElement('div'), lens = document.createElement('div');
    const R = 11;
    ring.style.cssText = `position:fixed;top:${12 - R}px;right:${12 - R}px;width:${SIZE + R * 2}px;height:${SIZE + R * 2}px;border-radius:50%;z-index:3;pointer-events:none;background:conic-gradient(from 30deg,#9a9da6,#5b5e66 12%,#b4b7c0 25%,#60636b 40%,#a0a3ac 55%,#575a62 70%,#b0b3bc 85%,#9a9da6);box-shadow:0 8px 18px #000c,0 0 0 1px #000,inset 0 1px 0 #ffffff55,inset 0 -2px 3px #0008`;
    const groove = document.createElement('div');
    groove.style.cssText = `position:fixed;top:${12 - 4}px;right:${12 - 4}px;width:${SIZE + 8}px;height:${SIZE + 8}px;border-radius:50%;z-index:3;pointer-events:none;background:#0a0a0c;box-shadow:inset 0 2px 6px #000,0 1px 0 #ffffff33`;
    lens.style.cssText = `position:fixed;top:12px;right:12px;width:${SIZE}px;height:${SIZE}px;border-radius:50%;z-index:5;pointer-events:none;backdrop-filter:blur(0.6px);background:linear-gradient(155deg,#ffffff38 0%,#ffffff0d 32%,transparent 34%),radial-gradient(circle at 50% 120%,#ffffff12,transparent 55%);box-shadow:inset 0 0 14px #000a,inset 0 1px 1px #ffffff55`;
    document.body.append(ring, groove, lens, this.cv);
    this.c = this.cv.getContext('2d')!; this.c.scale(dpr, dpr);
    const next = () => { this.zoom = (this.zoom + 1) % ZOOMS.length; };
    this.cv.addEventListener('click', next);
    addEventListener('keydown', (e) => { if (e.code === 'KeyM') next(); });
  }

  build(roads: Road[], landmarks: Landmark[] = []) {
    this.marks = landmarks;
    const seen: { x: number; z: number; t: string }[] = [];
    for (const r of roads) {
      const t = r.en || (/[က-႟]/.test(r.name) ? '' : r.name);
      if (!t || r.w < 9 || r.pts.length < 6) continue;
      const i = Math.floor(r.pts.length / 4) * 2, x = r.pts[i], z = r.pts[i + 1];
      if (seen.some((o) => o.t === t && Math.hypot(o.x - x, o.z - z) < 260)) continue;
      seen.push({ x, z, t }); this.labels.push({ x, z, text: t.replace(/ (Road|Street)$/i, ' Rd') });
    }
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const r of roads) for (let i = 0; i < r.pts.length; i += 2) {
      x0 = Math.min(x0, r.pts[i]); x1 = Math.max(x1, r.pts[i]); z0 = Math.min(z0, r.pts[i + 1]); z1 = Math.max(z1, r.pts[i + 1]);
    }
    const pad = 40; x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
    this.bs = Math.min(0.7, 2600 / Math.max(x1 - x0, z1 - z0));
    this.minX = x0; this.minZ = z0;
    this.base.width = Math.ceil((x1 - x0) * this.bs); this.base.height = Math.ceil((z1 - z0) * this.bs);
    const c = this.base.getContext('2d')!;
    c.fillStyle = '#2b3a33'; c.fillRect(0, 0, this.base.width, this.base.height);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const pass = (minW: number, maxW: number, col: string, extra: number) => {
      c.strokeStyle = col;
      for (const r of roads) {
        if (r.w < minW || r.w >= maxW) continue;
        c.lineWidth = Math.max(1.2, (r.w + extra) * this.bs);
        c.beginPath();
        for (let i = 0; i < r.pts.length; i += 2) {
          const px = (r.pts[i] - x0) * this.bs, pz = (r.pts[i + 1] - z0) * this.bs;
          i ? c.lineTo(px, pz) : c.moveTo(px, pz);
        }
        c.stroke();
      }
    };
    pass(0, 7, '#8f98a0', 2); pass(7, 99, '#c4cad0', 3);
    pass(0, 7, '#5b636b', 0); pass(7, 99, '#8b939b', 0);
    this.ready = true;
  }

  update(x: number, z: number, heading: number, traffic: Mob[] | undefined, target?: { x: number; z: number } | null) {
    if (!this.ready || (++this.frames & 1)) return; // 30 Hz is plenty
    const c = this.c, S = SIZE, k = ZOOMS[this.zoom], r = S / 2;
    c.save();
    c.clearRect(0, 0, S, S);
    c.beginPath(); c.arc(r, r, r, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#1e2a26'; c.fillRect(0, 0, S, S);
    // player at the lower-middle of the circle, map rotated so the car points up
    c.translate(r, r * 1.2);
    c.rotate(heading);
    c.scale(k / this.bs, k / this.bs);
    c.drawImage(this.base, -(x - this.minX) * this.bs, -(z - this.minZ) * this.bs);
    const mob = (mx: number, mz: number, col: string, rad: number) => {
      const px = mx - x, pz = mz - z; if (px * px + pz * pz > 90000) return;
      c.fillStyle = col; c.beginPath(); c.arc(px * this.bs, pz * this.bs, rad / k * this.bs, 0, Math.PI * 2); c.fill();
    };
    if (traffic) for (const a of traffic) if (a.active) mob(a.x, a.z, a.bus ? '#f2b930' : '#7ec8ff', a.bus ? 3.2 : 2.4);
    if (target) mob(target.x, target.z, '#ff4d4d', 4.5);
    c.restore();
    // upright labels: landmarks always, road names when zoomed in
    c.save(); c.beginPath(); c.arc(r, r, r - 2, 0, Math.PI * 2); c.clip();
    c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = '#000b';
    const cs = Math.cos(heading), sn = Math.sin(heading);
    const put = (lx: number, lz: number, text: string, col: string, size: number) => {
      const dx = (lx - x) * k, dz = (lz - z) * k; // rotate by +heading, same as the canvas transform
      const sx = r + dx * cs - dz * sn, sy = r * 1.2 + dx * sn + dz * cs;
      if ((sx - r) ** 2 + (sy - r) ** 2 > (r - 12) ** 2) return;
      c.font = `bold ${size}px system-ui`; c.strokeText(text, sx, sy); c.fillStyle = col; c.fillText(text, sx, sy);
    };
    if (k >= 0.7) for (const l of this.labels) put(l.x, l.z, l.text, '#dfe6ee', 8);
    for (const m of this.marks) put(m.x, m.z, m.label, '#ffd23a', 10);
    c.restore();
    // player arrow (screen space)
    c.save(); c.translate(r, r * 1.2);
    c.fillStyle = '#fff'; c.strokeStyle = '#1b56a5'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -9); c.lineTo(6.5, 7); c.lineTo(0, 3.5); c.lineTo(-6.5, 7); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // north marker
    c.save(); c.translate(r, r); c.rotate(heading);
    c.fillStyle = '#ff6b5e'; c.font = 'bold 11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', 0, -r + 11); c.restore();
  }
}
