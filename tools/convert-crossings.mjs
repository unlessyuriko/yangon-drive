// Pedestrian crossing nodes (not already inside a signalised junction) in local metres.
import fs from 'node:fs';
const LAT0 = 16.7748, LON0 = 96.1593, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sig = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const pts = d.elements.filter(e => e.tags.highway === 'crossing' && e.tags.crossing !== 'traffic_signals')
  .map(e => [Math.round((e.lon - LON0) * KX * 10) / 10, Math.round(-(e.lat - LAT0) * KZ * 10) / 10]);
const out = [];
for (const p of pts) {
  if (sig.some(s => Math.hypot(s[0] - p[0], s[1] - p[1]) < 35)) continue;
  if (out.some(o => Math.hypot(o[0] - p[0], o[1] - p[1]) < 15)) continue;
  out.push(p);
}
fs.writeFileSync(process.argv[4], JSON.stringify(out));
console.log(pts.length, '->', out.length);
