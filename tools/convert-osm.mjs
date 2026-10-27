// Converts raw Overpass JSON into a compact local-metre JSON for the game.
// Usage: node tools/convert-osm.mjs data/sule_raw.json public/map/sule.json [data/globfp_sule.json]
// The optional third file holds 3D-GloBFP building heights (Che et al. 2024, CC BY 4.0) in local metres; they fill in buildings that OSM gives no height for.
// 3D-GloBFP over-estimates downtown Yangon by 2-4x (e.g. a 4-storey post office comes out at 39 m), so only its RANKING is used: each height is mapped through its
// percentile onto a realistic downtown distribution (median ~4-5 storeys, a few towers). OSM heights and storey counts always win where they exist.
import fs from 'node:fs'; import path from 'node:path';
const [,, inp, out, hfile] = process.argv;
const LAT0 = 16.7748, LON0 = 96.1593; // Sule Pagoda = origin
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const proj = (g) => [Math.round((g.lon - LON0) * KX * 10) / 10, Math.round(-(g.lat - LAT0) * KZ * 10) / 10];
const W = { motorway:14, trunk:14, primary:13, secondary:11, tertiary:10, unclassified:7, residential:7, service:4, living_street:5, pedestrian:5, footway:2, path:2, steps:2, cycleway:2, track:3 };
const raw = JSON.parse(fs.readFileSync(inp, 'utf8'));
const roads = [], buildings = [];
// height lookup: grid of 3D-GloBFP footprints; a building takes the height of the footprint under its centroid (else the nearest centroid within 10 m)
const CELL = 60, hgrid = new Map(); let hsrc = 0, hmiss = 0;
if (hfile && fs.existsSync(hfile)) {
  for (const f of JSON.parse(fs.readFileSync(hfile, 'utf8'))) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, cx = 0, cz = 0; for (const p of f.ring) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); cx += p[0]; cz += p[1]; }
    f.bb = [x0, z0, x1, z1]; f.c = [cx / f.ring.length, cz / f.ring.length];
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) { const k = gx + ',' + gz; (hgrid.get(k) ?? hgrid.set(k, []).get(k)).push(f); }
  }
}
const ANCH = [[0, 3.5], [0.08, 6.5], [0.2, 9.5], [0.4, 13], [0.6, 17], [0.78, 22], [0.9, 30], [0.96, 42], [0.99, 65], [1, 100]];
const allH = [...new Set(hgrid.values())].length ? [...new Set([...hgrid.values()].flat())].map((f) => f.h.Height).sort((a, b) => a - b) : [];
function calibrate(g) {
  let lo = 0, hi = allH.length; while (lo < hi) { const m = (lo + hi) >> 1; if (allH[m] < g) lo = m + 1; else hi = m; }
  const q = allH.length ? lo / allH.length : 0.5;
  for (let i = 1; i < ANCH.length; i++) if (q <= ANCH[i][0]) { const t = (q - ANCH[i - 1][0]) / (ANCH[i][0] - ANCH[i - 1][0]); return ANCH[i - 1][1] + t * (ANCH[i][1] - ANCH[i - 1][1]); }
  return ANCH[ANCH.length - 1][1];
}
const inRing = (ring, x, z) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
function globfpHeight(pts) {
  if (!hgrid.size) return 0;
  let cx = 0, cz = 0; const n = pts.length / 2; for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cz += pts[i + 1]; } cx /= n; cz /= n;
  const list = hgrid.get(Math.floor(cx / CELL) + ',' + Math.floor(cz / CELL)) ?? [];
  let hit = list.find((f) => cx >= f.bb[0] && cx <= f.bb[2] && cz >= f.bb[1] && cz <= f.bb[3] && inRing(f.ring, cx, cz));
  if (!hit) { let bd = 10; for (const f of list) { const d = Math.hypot(f.c[0] - cx, f.c[1] - cz); if (d < bd) { bd = d; hit = f; } } }
  return hit ? hit.h.Height : 0;
}
let hs = 12345; const rnd = () => ((hs = (hs * 16807) % 2147483647) / 2147483647);
for (const e of raw.elements) {
  if (e.type !== 'way' || !e.geometry) continue;
  const t = e.tags || {};
  const pts = e.geometry.map(proj);
  if (t.highway) {
    const hw = t.highway.replace('_link', '');
    if (!(hw in W) || ['footway','path','steps','cycleway','track'].includes(hw)) continue;
    const lanes = parseInt(t.lanes);
    const rev = t.oneway === "-1";
    const oneway = t.oneway === "yes" || rev || t.junction === "roundabout";
    if (rev) pts.reverse();
    const w = lanes ? Math.max(W[hw] * 0.6, lanes * 3.3) : W[hw];
    roads.push({ w, pts: pts.flat(), name: t.name || '', en: t['name:en'] || '', my: t['name:my'] || '', hw, ow: oneway ? 1 : 0, rb: t.junction === "roundabout" ? 1 : 0, br: t.bridge ? 1 : 0 });
  } else if (t.building) {
    if (pts.length < 4) continue;
    let h = parseFloat(t.height) || (parseFloat(t['building:levels']) || 0) * 3.2;
    if (!h) { const g = globfpHeight(pts.slice(0, -1).flat()); if (g > 0) { h = Math.max(3.5, Math.round(calibrate(g) * 2) / 2); hsrc++; } else { h = 8 + Math.floor(rnd() * 5) * 3; hmiss++; } }
    buildings.push({ h: Math.round(h * 10) / 10, pts: pts.slice(0, -1).flat() });
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ origin: [LAT0, LON0], roads, buildings }));
console.log(`heights from 3D-GloBFP ${hsrc}, random fallback ${hmiss}`);
console.log(`roads ${roads.length}, buildings ${buildings.length}, size ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
const named = [...new Set(roads.map(r => r.name).filter(Boolean))];
console.log('named roads', named.length, named.slice(0, 15).join(' | '));
