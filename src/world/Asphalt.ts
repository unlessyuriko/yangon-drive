import * as THREE from 'three';

/** Procedural wet-asphalt maps: roughness 0.15..0.5 (shiny wet streaks) plus a fine-grain normal map. Tileable, 256 px. */
export function makeAsphaltMaps(): { roughnessMap: THREE.Texture; normalMap: THREE.Texture } {
  const N = 256;
  const h = new Float32Array(N * N);
  const grid = (cells: number) => { const a = new Float32Array(cells * cells); for (let i = 0; i < a.length; i++) a[i] = Math.random(); return a; };
  const sample = (a: Float32Array, cells: number, x: number, y: number) => {
    const fx = x * cells, fy = y * cells, x0 = Math.floor(fx) % cells, y0 = Math.floor(fy) % cells, x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy), sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const v = (xx: number, yy: number) => a[yy * cells + xx];
    return (v(x0, y0) * (1 - sx) + v(x1, y0) * sx) * (1 - sy) + (v(x0, y1) * (1 - sx) + v(x1, y1) * sx) * sy;
  };
  const octs = [[4, 0.45], [8, 0.3], [16, 0.2], [64, 0.12], [128, 0.1]].map(([c, w]) => ({ c, w, g: grid(c) }));
  const blob = grid(3), streak = grid(12);
  const rough = new Uint8ClampedArray(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    let s = 0; for (const o of octs) s += sample(o.g, o.c, u, v) * o.w;
    h[y * N + x] = s;
    const wet = Math.min(1, Math.max(0, (sample(blob, 3, u, v) * 0.7 + sample(streak, 12, u, v) * 0.3 - 0.45) * 4));
    rough[y * N + x] = Math.round((0.5 - wet * 0.35 - (s - 0.6) * 0.1) * 255);
  }
  const rc = document.createElement('canvas'); rc.width = rc.height = N;
  const rctx = rc.getContext('2d')!, rd = rctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { rd.data[i * 4] = rd.data[i * 4 + 1] = rd.data[i * 4 + 2] = rough[i]; rd.data[i * 4 + 3] = 255; }
  rctx.putImageData(rd, 0, 0);
  const nc = document.createElement('canvas'); nc.width = nc.height = N;
  const nctx = nc.getContext('2d')!, nd = nctx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const hx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)], hy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
    const nx = -hx * 3, ny = -hy * 3, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
    nd.data[i] = (nx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
  }
  nctx.putImageData(nd, 0, 0);
  const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { roughnessMap: tex(rc), normalMap: tex(nc) };
}
