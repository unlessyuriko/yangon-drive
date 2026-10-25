// Generates simple PNG app icons (blue background, gold stupa) without extra dependencies.
import fs from 'node:fs'; import zlib from 'node:zlib';
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size; let r = 27, g = 86, b = 165;        // blue
      if (v > 0.78) { r = 74; g = 77; b = 82; }                            // road
      // stupa: bell silhouette
      const cx = 0.5, h = (0.78 - v) / 0.6;                                 // 0 at base, 1 at top
      if (h > 0 && h < 1) { const hw = 0.22 * Math.pow(1 - h, 1.4) + 0.02; if (Math.abs(u - cx) < hw) { r = 242; g = 185; b = 48; } }
      if (v > 0.15 && v < 0.2 && Math.abs(u - cx) < 0.03) { r = 242; g = 185; b = 48; } // hti tip
      const o = y * (size * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync('public/icons', { recursive: true });
for (const s of [192, 512]) fs.writeFileSync(`public/icons/icon-${s}.png`, png(s));
console.log('icons ok');
