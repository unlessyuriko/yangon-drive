interface R { w: number; pts: number[] }

/** Is a point on any road surface? Uses a grid of road segments; margin shrinks (negative grows) each road's half-width. */
export function makeOnRoad(roads: R[]) {
  const CELL = 40, grid = new Map<string, number[]>();
  const segs: number[][] = [];
  for (const r of roads) for (let i = 0; i < r.pts.length / 2 - 1; i++) {
    const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], bz = r.pts[i * 2 + 3];
    const id = segs.push([ax, az, bx, bz, r.w / 2]) - 1;
    const x0 = Math.floor((Math.min(ax, bx) - r.w / 2) / CELL), x1 = Math.floor((Math.max(ax, bx) + r.w / 2) / CELL);
    const z0 = Math.floor((Math.min(az, bz) - r.w / 2) / CELL), z1 = Math.floor((Math.max(az, bz) + r.w / 2) / CELL);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = gx + ',' + gz; (grid.get(k) ?? grid.set(k, []).get(k)!).push(id); }
  }
  return (x: number, z: number, margin = 0.5): boolean => {
    const ids = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); if (!ids) return false;
    for (const id of ids) {
      const [ax, az, bx, bz, hw] = segs[id];
      const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2));
      if (Math.hypot(ax + ex * t - x, az + ez * t - z) < hw - margin) return true;
    }
    return false;
  };
}
