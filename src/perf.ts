import type * as THREE from 'three';

/** Frame timing + renderer stats; overlay shown with ?debug or the F3 key. Also drives adaptive resolution. */
export class Perf {
  private el = document.createElement('div');
  private acc: Record<string, number> = {};
  private frames = 0; private t0 = performance.now(); private worst = 0;
  fps = 60; frameMs = 16;
  report = '';
  onSlow?: () => void; onFast?: () => void;
  private slowFor = 0; private fastFor = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:50;background:#000a;color:#9f9;font:11px/1.35 monospace;padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre;display:none';
    document.body.appendChild(this.el);
    if (/[?&]debug/.test(location.search)) this.el.style.display = 'block';
    addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); this.el.style.display = this.el.style.display === 'none' ? 'block' : 'none'; } });
  }

  /** Time a section (ms accumulated per second). */
  time<T>(name: string, fn: () => T): T {
    const s = performance.now(); const r = fn();
    this.acc[name] = (this.acc[name] ?? 0) + (performance.now() - s);
    return r;
  }

  frame(dtMs: number) {
    this.frames++; this.worst = Math.max(this.worst, dtMs);
    const now = performance.now();
    if (now - this.t0 < 1000) return;
    const secs = (now - this.t0) / 1000;
    this.fps = this.frames / secs; this.frameMs = 1000 / this.fps;
    const info = this.renderer.info;
    const sect = Object.entries(this.acc).map(([k, v]) => `${k} ${(v / this.frames).toFixed(2)}ms`).join('  ');
    this.report = `${this.fps.toFixed(0)} fps (${this.frameMs.toFixed(1)} ms, worst ${this.worst.toFixed(0)})\ncalls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k  geo ${info.memory.geometries}  tex ${info.memory.textures}\n${sect}\npx ${this.renderer.getPixelRatio().toFixed(2)}`;
    this.el.textContent = this.report;
    // adaptive quality: sustained slow / fast
    if (this.frameMs > 26) { this.slowFor++; this.fastFor = 0; } else if (this.frameMs < 15) { this.fastFor++; this.slowFor = 0; } else { this.slowFor = this.fastFor = 0; }
    if (this.slowFor >= 2) { this.slowFor = 0; this.onSlow?.(); }
    if (this.fastFor >= 6) { this.fastFor = 0; this.onFast?.(); }
    this.frames = 0; this.t0 = now; this.worst = 0; this.acc = {};
  }
}
