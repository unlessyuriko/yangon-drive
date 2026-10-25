// Clusters OSM traffic-signal nodes into intersections (centre in local metres).
import fs from 'node:fs';
const LAT0 = 16.7748, LON0 = 96.1593, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pts = d.elements.filter(e => e.tags.highway === 'traffic_signals' || e.tags.crossing === 'traffic_signals')
  .map(e => [(e.lon - LON0) * KX, -(e.lat - LAT0) * KZ]);
const cl = [];
for (const p of pts) {
  const c = cl.find(c => Math.hypot(c.x / c.n - p[0], c.z / c.n - p[1]) < 30);
  if (c) { c.x += p[0]; c.z += p[1]; c.n++; } else cl.push({ x: p[0], z: p[1], n: 1 });
}
const out = cl.map(c => [Math.round(c.x / c.n * 10) / 10, Math.round(c.z / c.n * 10) / 10]);
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(out.length, 'intersections', JSON.stringify(out));
