// Circle-vs-building-footprint collision with a uniform grid.
const CELL = 40;
interface Poly { p: number[] }
const grid = new Map<string, Poly[]>();
const circles: { x: number; z: number; r: number }[] = [];
const key = (cx: number, cz: number) => `${cx},${cz}`;

export function addPolygon(p: number[]) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
    z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]);
  }
  const poly = { p };
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
    for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
      const k = key(cx, cz);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(poly);
    }
}
export const addCircle = (x: number, z: number, r: number) => circles.push({ x, z, r });

/** Returns the push-out vector [dx, dz] needed so a circle at (x,z) with radius r clears all obstacles. */
export function pushOut(x: number, z: number, r: number): [number, number] {
  let ox = 0, oz = 0;
  const seen = new Set<Poly>();
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++)
      for (const poly of grid.get(key(cx, cz)) ?? []) {
        if (seen.has(poly)) continue;
        seen.add(poly);
        const p = poly.p;
        let inside = false, bestD = Infinity, bx = 0, bz = 0;
        for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
          const ax = p[j], az = p[j + 1], cxp = p[i], czp = p[i + 1];
          if ((czp > z) !== (az > z) && x < ((ax - cxp) * (z - czp)) / (az - czp) + cxp) inside = !inside;
          const ex = cxp - ax, ez = czp - az;
          const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
          const qx = ax + ex * t, qz = az + ez * t;
          const d = Math.hypot(x - qx, z - qz);
          if (d < bestD) { bestD = d; bx = qx; bz = qz; }
        }
        if (inside) {
          const l = bestD || 1;
          // push toward the nearest edge, then past it by r
          ox += ((bx - x) / l) * (bestD + r); oz += ((bz - z) / l) * (bestD + r);
        } else if (bestD < r) {
          const l = bestD || 1;
          ox += ((x - bx) / l) * (r - bestD); oz += ((z - bz) / l) * (r - bestD);
        }
      }
  for (const c of circles) {
    const d = Math.hypot(x - c.x, z - c.z), m = r + c.r;
    if (d < m) { const l = d || 1; ox += ((x - c.x) / l) * (m - d); oz += ((z - c.z) / l) * (m - d); }
  }
  return [ox, oz];
}
