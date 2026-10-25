// Converts raw Overpass JSON into a compact local-metre JSON for the game.
// Usage: node tools/convert-osm.mjs data/sule_raw.json public/map/sule.json
import fs from 'node:fs'; import path from 'node:path';
const [,, inp, out] = process.argv;
const LAT0 = 16.7748, LON0 = 96.1593; // Sule Pagoda = origin
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const proj = (g) => [Math.round((g.lon - LON0) * KX * 10) / 10, Math.round(-(g.lat - LAT0) * KZ * 10) / 10];
const W = { motorway:14, trunk:14, primary:13, secondary:11, tertiary:10, unclassified:7, residential:7, service:4, living_street:5, pedestrian:5, footway:2, path:2, steps:2, cycleway:2, track:3 };
const raw = JSON.parse(fs.readFileSync(inp, 'utf8'));
const roads = [], buildings = [];
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
    if (!h) h = 8 + Math.floor(rnd() * 5) * 3;
    buildings.push({ h: Math.round(h * 10) / 10, pts: pts.slice(0, -1).flat() });
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ origin: [LAT0, LON0], roads, buildings }));
console.log(`roads ${roads.length}, buildings ${buildings.length}, size ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
const named = [...new Set(roads.map(r => r.name).filter(Boolean))];
console.log('named roads', named.length, named.slice(0, 15).join(' | '));
