interface Road { w: number; pts: number[]; ow: number; hw: string; br?: number; rb?: number }

/** A long straight two-way stretch for the overtaking lesson: origin, unit direction (fx,fz), length and width. */
export interface OvertakeSite { x: number; z: number; fx: number; fz: number; len: number; w: number }

export function pickOvertake(roads: Road[], avoid: [number, number][]): OvertakeSite | null {
  const MIN = 150;
  const verts: [number, number][] = [];
  for (const r of roads) for (let i = 0; i < r.pts.length; i += 2) verts.push([r.pts[i], r.pts[i + 1]]);
  let best: OvertakeSite | null = null, bestScore = -1;
  for (const r of roads) {
    if (r.ow || r.br || r.rb || r.w < 7 || !['primary', 'secondary', 'tertiary', 'trunk'].includes(r.hw)) continue;
    const n = r.pts.length / 2;
    let i = 0;
    while (i < n - 1) {
      // grow a straight run starting at vertex i
      const ax = r.pts[i * 2], az = r.pts[i * 2 + 1];
      let j = i + 1, fx = 0, fz = 0;
      for (; j < n; j++) {
        const dx = r.pts[j * 2] - ax, dz = r.pts[j * 2 + 1] - az, L = Math.hypot(dx, dz);
        if (L < 1e-3) continue;
        if (j > i + 1) {
          const c = (dx * fx + dz * fz) / L;
          if (c < 0.9994) break;                      // > ~2 degrees off the first leg
        } else { fx = dx / L; fz = dz / L; }
        if (j === i + 1) { fx = dx / L; fz = dz / L; }
      }
      const ex = r.pts[(j - 1) * 2], ez = r.pts[(j - 1) * 2 + 1];
      const len = Math.hypot(ex - ax, ez - az);
      if (len >= MIN && j - 1 > i) {
        const rx = -fz, rz = fx;
        let ok = true, clear = 0;
        for (const [vx, vz] of verts) {
          const s = (vx - ax) * fx + (vz - az) * fz, l = Math.abs((vx - ax) * rx + (vz - az) * rz);
          if (s > -15 && s < len + 15 && l < 12 && !(l < 0.6 && s > -0.5 && s < len + 0.5 && isOwn(r, vx, vz))) { ok = false; break; }
        }
        for (const [px, pz] of avoid) {
          const s = (px - ax) * fx + (pz - az) * fz, l = Math.abs((px - ax) * rx + (pz - az) * rz);
          if (s > -30 && s < len + 30 && l < 40) { ok = false; break; }
        }
        if (ok) { clear = len; if (clear > bestScore) { bestScore = clear; best = { x: ax, z: az, fx, fz, len, w: r.w }; } }
      }
      i = Math.max(i + 1, j - 1);
    }
  }
  return best;
}

function isOwn(r: Road, x: number, z: number) {
  for (let i = 0; i < r.pts.length; i += 2) if (Math.abs(r.pts[i] - x) < 1e-6 && Math.abs(r.pts[i + 1] - z) < 1e-6) return true;
  return false;
}
