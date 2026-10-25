import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Road { w: number; pts: number[]; ow: number; hw: string }

/** YBS bus shelters like the Yangon ones: flat white canopy, glass back panel, bench, backlit advert box at one end, YBS sign on a post, yellow painted kerb. */

const ADS = [
  { bg: '#1f9a4a', fg: '#fff', t: 'MALTO', sub: 'ENERGY DRINK' },
  { bg: '#e8742a', fg: '#fff', t: 'FRESHCOLA', sub: 'ICE COLD' },
  { bg: '#2b6fd0', fg: '#fff', t: 'PARAFAST', sub: 'FAST RELIEF' },
  { bg: '#d8286a', fg: '#fff', t: 'GLOWSKIN', sub: 'DAILY CARE' },
];

function adTexture(i: number): THREE.CanvasTexture {
  const a = ADS[i % ADS.length], c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, a.bg); g.addColorStop(1, '#0d3a1c'); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  x.fillStyle = '#ffffff22'; x.beginPath(); x.arc(64, 150, 70, 0, 7); x.fill();
  x.fillStyle = a.fg; x.textAlign = 'center'; x.font = '700 30px "Rajdhani","Arial",sans-serif'; x.fillText(a.t, 64, 40);
  x.font = '600 14px "Rajdhani","Arial",sans-serif'; x.fillText(a.sub, 64, 60);
  x.fillStyle = '#f4d2a8'; x.beginPath(); x.arc(44, 140, 16, 0, 7); x.fill(); x.beginPath(); x.arc(84, 144, 15, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.fillRect(30, 158, 28, 70); x.fillStyle = '#222'; x.fillRect(70, 160, 28, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function ybsTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 192); x.fillStyle = '#d4202c';
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(40 + k * 58, 36 + r * 40, 14, 0, 7); x.fill(); }
  x.fillStyle = '#c8202c'; x.fillRect(0, 100, 256, 6);
  x.fillStyle = '#1c3b9c'; x.font = '700 80px "Rajdhani","Arial",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('YBS', 128, 148);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function nameTexture(name: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d')!;
  x.fillStyle = '#f4f6f8'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#1c3b9c'; x.fillRect(0, 84, 512, 12);
  x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 44px "Padauk","Rajdhani","Arial",sans-serif'; x.fillText(name, 256, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const NAMES = ['ဆူးလေ', 'မဟာဗန္ဓုလ', 'ဗိုလ်ချုပ်လမ်း', 'ကမ်းနားလမ်း', 'ပန်းဆိုးတန်း', 'ရွှေဘုံသာ', 'ကုန်သည်လမ်း', 'သိမ်ဖြူ'];

export function buildBusStops(roads: Road[], avoid: [number, number][]): THREE.Group {
  const group = new THREE.Group();
  const geos = new Map<string, THREE.BufferGeometry[]>();
  const push = (key: string, g: THREE.BufferGeometry, m: THREE.Matrix4) => { const c = g.clone(); c.applyMatrix4(m); c.deleteAttribute('uv'); (geos.get(key) ?? geos.set(key, []).get(key)!).push(c.index ? c.toNonIndexed() : c); };
  const box = (key: string, w: number, h: number, d: number, x: number, y: number, z: number, base: THREE.Matrix4) =>
    push(key, new THREE.BoxGeometry(w, h, d), new THREE.Matrix4().multiplyMatrices(base, new THREE.Matrix4().makeTranslation(x, y, z)));

  const texMats: THREE.Mesh[] = [];
  const ybsMat = new THREE.MeshBasicMaterial({ map: ybsTexture() });
  const adMats = ADS.map((_, i) => new THREE.MeshBasicMaterial({ map: adTexture(i) }));
  const planeG = new THREE.PlaneGeometry(1, 1);
  const place = (mat: THREE.Material, w: number, h: number, base: THREE.Matrix4, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(planeG, mat); m.scale.set(w, h, 1); m.rotation.y = ry; m.position.set(x, y, z); m.applyMatrix4(base); m.matrixAutoUpdate = true;
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.matrix.decompose(p, q, s); m.position.copy(p); m.quaternion.copy(q); m.scale.copy(s);
    group.add(m); texMats.push(m);
  };

  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let count = 0;
  for (const r of roads) {
    if (r.w < 7 || !['primary', 'secondary', 'tertiary', 'trunk'].includes(r.hw)) continue;
    const n = r.pts.length / 2; let acc = 0, next = 25 + rnd() * 60, side = rnd() < 0.5 ? 1 : -1;
    for (let i = 0; i < n - 1; i++) {
      const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], bz = r.pts[i * 2 + 3];
      const L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
      const fx = (bx - ax) / L, fz = (bz - az) / L;
      while (next < acc + L) {
        const s = next - acc; const cx = ax + fx * s, cz = az + fz * s;
        next += 110 + rnd() * 70; side = -side;
        if (r.ow && side < 0) continue;                       // one-way: right kerb only
        if (L < 14) continue;
        if (avoid.some((p) => Math.hypot(p[0] - cx, p[1] - cz) < 22)) continue;
        // stop on the 'side' kerb, shelter faces the road; buses travel along -x local so use the direction of the kerb's traffic
        const dir = side; const dfx = fx * dir, dfz = fz * dir;           // direction of traffic on that kerb (right-hand traffic)
        const rightx = -dfz, rightz = dfx;                                  // kerb side
        const off = r.w / 2 + 2.3;
        const px = cx + rightx * off, pz = cz + rightz * off;
        const th = Math.atan2(dfz, -dfx);
        const base = new THREE.Matrix4().makeRotationY(th).setPosition(px, 0, pz);
        // canopy + fascia
        box('white', 4.4, 0.07, 2.0, 0, 2.55, 0, base); box('white', 4.4, 0.22, 0.05, 0, 2.45, 1.0, base);
        // posts
        for (const x of [-2.1, 0, 2.1]) box('metal', 0.08, 2.55, 0.08, x, 1.27, -0.85, base);
        for (const x of [-2.1, 2.1]) box('metal', 0.08, 2.55, 0.08, x, 1.27, 0.9, base);
        // back glass + bench
        box('glass', 4.1, 1.55, 0.03, 0, 1.55, -0.85, base);
        box('metal', 3.4, 0.06, 0.42, 0, 0.5, -0.55, base); box('metal', 0.06, 0.5, 0.36, -1.5, 0.25, -0.55, base); box('metal', 0.06, 0.5, 0.36, 1.5, 0.25, -0.55, base);
        // advert lightbox at the upstream end (faces the road)
        box('frame', 1.12, 2.0, 0.16, -2.65, 1.05, 0.45, base);
        place(adMats[Math.floor(rnd() * ADS.length)], 1.0, 1.85, base, -2.65, 1.05, 0.54);
        // YBS sign on a pole at the downstream end, facing oncoming buses
        box('metal', 0.07, 3.2, 0.07, 2.75, 1.6, 0.75, base);
        place(ybsMat, 0.62, 0.46, base, 2.75, 3.05, 0.75, Math.PI / 2);
        // station name board on the fascia
        place(nameMat(NAMES[Math.floor(rnd() * NAMES.length)]), 1.5, 0.28, base, 0, 2.45, 1.035);
        // painted yellow kerb line
        const kx = px - rightx * 2.3 + rightx * 0.15, kz = pz - rightz * 2.3 + rightz * 0.15;
        push('yellow', new THREE.PlaneGeometry(10, 0.32).rotateX(-Math.PI / 2), new THREE.Matrix4().makeRotationY(th).setPosition(kx, 0.16, kz));
        count++;
      }
      acc += L;
    }
  }
  const mats: Record<string, THREE.Material> = {
    white: new THREE.MeshLambertMaterial({ color: 0xeceff2 }), metal: new THREE.MeshLambertMaterial({ color: 0x9aa0a8 }),
    frame: new THREE.MeshLambertMaterial({ color: 0xd8dce0 }), yellow: new THREE.MeshBasicMaterial({ color: 0xf2c21b }),
    glass: new THREE.MeshLambertMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.28, depthWrite: false }),
  };
  for (const [k, list] of geos) { const m = new THREE.Mesh(mergeGeometries(list)!, mats[k]); m.castShadow = k !== 'yellow' && k !== 'glass'; group.add(m); }
  return group;

  function nameMat(name: string) { return new THREE.MeshBasicMaterial({ map: nameTexture(name) }); }
}
