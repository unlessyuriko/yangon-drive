import * as THREE from 'three';

/** Procedural dry asphalt: aggregate-speckled albedo with mottling, repair patches, cracks and oil stains; roughness that is matte with small damp
 *  patches (rain lowers the material roughness, so those patches turn shiny first); and a fine-grain normal map. All tileable, 512 px (about 8 m on the road). */
export function makeAsphaltMaps(): { map: THREE.Texture; roughnessMap: THREE.Texture; normalMap: THREE.Texture } {
  const N = 512;
  const grid = (cells: number) => { const a = new Float32Array(cells * cells); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; };
  const sample = (a: Float32Array, cells: number, x: number, y: number) => {
    const fx = x * cells, fy = y * cells, x0 = Math.floor(fx) % cells, y0 = Math.floor(fy) % cells, x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy), sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const v = (xx: number, yy: number) => a[yy * cells + xx];
    return (v(x0, y0) * (1 - sx) + v(x1, y0) * sx) * (1 - sy) + (v(x0, y1) * (1 - sx) + v(x1, y1) * sx) * sy;
  };
  const octs = [[4, 0.3], [8, 0.2], [16, 0.15], [64, 0.15], [128, 0.12], [256, 0.08]].map(([c, w]) => ({ c, w, g: grid(c) }));
  const mott = grid(5), damp = grid(4), dampFine = grid(14);
  const h = new Float32Array(N * N), rough = new Uint8ClampedArray(N * N);

  // ---- albedo: speckle + mottling, then painted repairs, cracks and oil ----
  const ac = document.createElement('canvas'); ac.width = ac.height = N;
  const actx = ac.getContext('2d')!, ad = actx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = y * N + x;
    let s = 0; for (const o of octs) s += sample(o.g, o.c, u, v) * o.w;
    h[i] = s;
    const m = sample(mott, 5, u, v), grain = Math.random();
    // aggregate: occasional light chips among darker bitumen
    const chip = grain > 0.93 ? 0.16 : grain < 0.12 ? -0.1 : 0;
    const l = Math.max(0.5, Math.min(1, 0.78 + (m - 0.5) * 0.2 + (s - 0.5) * 0.28 + chip + (grain - 0.5) * 0.06));
    const k = Math.round(l * 255); const o4 = i * 4;
    ad.data[o4] = k; ad.data[o4 + 1] = k; ad.data[o4 + 2] = Math.round(k * 0.985); ad.data[o4 + 3] = 255;
    const wet = Math.min(1, Math.max(0, (sample(damp, 4, u, v) * 0.6 + sample(dampFine, 14, u, v) * 0.4 - 0.55) * 4));
    rough[i] = Math.round((0.9 - wet * 0.32 - (s - 0.5) * 0.12) * 255);
  }
  actx.putImageData(ad, 0, 0);
  const wrapDraw = (fn: (ox: number, oy: number) => void) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) fn(ox, oy); };
  const rr = (a: number, b: number) => a + Math.random() * (b - a);
  // repair patches: slightly different tone, dark seam round the edge
  for (let p = 0; p < 4; p++) {
    const x = rr(0, N), y = rr(0, N), w = rr(60, 190), hh = rr(40, 130), tone = Math.random() < 0.5 ? 'rgba(20,20,22,0.1)' : 'rgba(255,255,255,0.06)';
    wrapDraw((ox, oy) => { actx.fillStyle = tone; actx.fillRect(x + ox, y + oy, w, hh); actx.strokeStyle = 'rgba(10,10,12,0.5)'; actx.lineWidth = 2; actx.strokeRect(x + ox, y + oy, w, hh); });
  }
  // oil / grease stains
  for (let p = 0; p < 7; p++) {
    const x = rr(0, N), y = rr(0, N), r = rr(14, 40);
    wrapDraw((ox, oy) => { const g = actx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, 'rgba(8,8,10,0.4)'); g.addColorStop(1, 'rgba(8,8,10,0)'); actx.fillStyle = g; actx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); });
  }
  // cracks: random walks, thin and dark
  for (let p = 0; p < 9; p++) {
    let x = rr(0, N), y = rr(0, N), a = rr(0, 6.28); const pts: [number, number][] = [[x, y]];
    for (let s = 0; s < 14; s++) { a += rr(-0.7, 0.7); x += Math.cos(a) * rr(6, 16); y += Math.sin(a) * rr(6, 16); pts.push([x, y]); }
    wrapDraw((ox, oy) => { actx.strokeStyle = 'rgba(6,6,8,0.55)'; actx.lineWidth = rr(0.8, 1.6); actx.beginPath(); pts.forEach(([px, py], k) => (k ? actx.lineTo(px + ox, py + oy) : actx.moveTo(px + ox, py + oy))); actx.stroke(); });
  }

  const rc = document.createElement('canvas'); rc.width = rc.height = N;
  const rctx = rc.getContext('2d')!, rd = rctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { rd.data[i * 4] = rd.data[i * 4 + 1] = rd.data[i * 4 + 2] = rough[i]; rd.data[i * 4 + 3] = 255; }
  rctx.putImageData(rd, 0, 0);
  const nc = document.createElement('canvas'); nc.width = nc.height = N;
  const nctx = nc.getContext('2d')!, nd = nctx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const hx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)], hy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
    const nx = -hx * 5, ny = -hy * 5, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
    nd.data[i] = (nx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
  }
  nctx.putImageData(nd, 0, 0);
  const tex = (c: HTMLCanvasElement, srgb = false) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: tex(ac, true), roughnessMap: tex(rc), normalMap: tex(nc) };
}
