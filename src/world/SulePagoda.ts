import * as THREE from 'three';

/** Sule Pagoda: golden octagonal stupa with banded spire, hti and finial; octagonal ring of white shop-houses with blue balconies, sawtooth awnings and a gold carved fascia;
 *  four green tiered gate pavilions with gold arches; small gold tiered spires on the roof; red-white kerb around the island.
 *  `fit` is the usable island radius in metres (centre to the inside of the roundabout kerb). */

const gold = new THREE.MeshStandardMaterial({ color: 0xf0b429, metalness: 0.85, roughness: 0.32, emissive: 0x6b4400, emissiveIntensity: 0.35, flatShading: true });
const goldMat = gold;
const goldDeep = new THREE.MeshStandardMaterial({ color: 0xd9971a, metalness: 0.8, roughness: 0.4, emissive: 0x4a2c00, emissiveIntensity: 0.3 });
const white = new THREE.MeshLambertMaterial({ color: 0xf1ede2 });
const cream = new THREE.MeshLambertMaterial({ color: 0xf2e2b2 });
const green = new THREE.MeshLambertMaterial({ color: 0x2f8a62 });
const blue = new THREE.MeshLambertMaterial({ color: 0x2f6fc4 });
const roofWhite = new THREE.MeshLambertMaterial({ color: 0xe8ecee });
const dark = new THREE.MeshLambertMaterial({ color: 0x241a14 });
const red = new THREE.MeshLambertMaterial({ color: 0xc8202a });

function facadeTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d')!;
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 256, 192);
  // upper floor: windows, blue balcony rail
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 6);
  for (const px of [30, 150]) { x.fillStyle = '#4a5560'; x.fillRect(px, 18, 76, 58); x.fillStyle = '#dfe6ea'; x.fillRect(px + 36, 18, 3, 58); x.fillStyle = '#fff'; x.fillRect(px - 4, 14, 84, 5); }
  x.fillStyle = '#2f6fc4'; x.fillRect(0, 84, 256, 6); x.fillRect(0, 108, 256, 4); x.fillStyle = '#e9ecee';
  for (let i = 4; i < 256; i += 10) x.fillRect(i, 90, 3, 18);
  // ground floor shops
  x.fillStyle = '#e0d9c5'; x.fillRect(0, 118, 256, 74);
  const cols = ['#c8202a', '#1c3b9c', '#e8a020', '#2a8a5a'];
  for (let i = 0; i < 2; i++) { const o = i * 128; x.fillStyle = cols[i * 2]; x.fillRect(o + 8, 122, 112, 14); x.fillStyle = '#fff'; x.fillRect(o + 14, 126, 60, 5);
    x.fillStyle = '#7a8086'; x.fillRect(o + 10, 142, 70, 50); x.strokeStyle = '#5c6268'; x.lineWidth = 2; for (let k = 0; k < 7; k++) { x.beginPath(); x.moveTo(o + 10, 146 + k * 7); x.lineTo(o + 80, 146 + k * 7); x.stroke(); }
    x.fillStyle = '#2b3640'; x.fillRect(o + 88, 142, 30, 50); x.fillStyle = cols[i * 2 + 1]; x.fillRect(o + 88, 142, 30, 5); }
  x.fillStyle = '#f4f1ea'; for (const px of [0, 124]) x.fillRect(px, 118, 8, 74);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function stripeTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; x.fillRect(0, 0, 32, 16); x.fillStyle = '#c8202a'; x.fillRect(32, 0, 32, 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(36, 1); return t;
}
function signTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d')!;
  x.fillStyle = '#c8202a'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#f2c21b'; x.lineWidth = 3; x.strokeRect(3, 3, 250, 58);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '600 34px "Padauk","Noto Sans Myanmar","Myanmar Text",sans-serif'; x.fillText('ဆူးလေဘုရား', 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function goldTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, '#d9a020'); g.addColorStop(0.5, '#ffd870'); g.addColorStop(1, '#d9a020'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '120,70,0' : '255,240,170'},${Math.random() * 0.12})`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 14, 1 + Math.random() * 2); }
  x.strokeStyle = 'rgba(120,70,0,.35)'; x.lineWidth = 2; for (let y = 16; y < 256; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); }
  x.fillStyle = 'rgba(140,85,0,.28)'; for (let y = 0; y < 256; y += 32) for (let xx = 16; xx < 256; xx += 32) { x.beginPath(); x.moveTo(xx, y + 6); x.lineTo(xx + 7, y + 16); x.lineTo(xx, y + 26); x.lineTo(xx - 7, y + 16); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const oct = (rt: number, rb: number, h: number) => new THREE.CylinderGeometry(rt, rb, h, 8).rotateY(Math.PI / 8);

/** small multi-tier gold spire used on the roof corners */
function tieredSpire(s: number): THREE.Group {
  const g = new THREE.Group(); let y = 0;
  for (let i = 0; i < 5; i++) { const r = (1.5 - i * 0.24) * s, h = (0.9 - i * 0.06) * s; const m = new THREE.Mesh(oct(r * 0.82, r, h), i % 2 ? goldDeep : gold); m.position.y = y + h / 2; g.add(m); y += h; }
  const sp = new THREE.Mesh(new THREE.ConeGeometry(0.28 * s, 2.6 * s, 8), gold); sp.position.y = y + 1.3 * s; g.add(sp);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 6), gold); ball.position.y = y + 2.7 * s; g.add(ball);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

export function buildSulePagoda(fit: number): THREE.Group {
  const g = new THREE.Group();
  const A = Math.min(30, fit * 0.82);          // apothem of the outer ring wall (real ring is ~60 m across)
  const D = A * 0.32, WH = 4.4, LEN = 2 * A * Math.tan(Math.PI / 8) + 0.6;
  const add = (o: THREE.Object3D, p: THREE.Object3D = g) => { p.add(o); o.traverse((q) => { if ((q as THREE.Mesh).isMesh) { q.castShadow = true; q.receiveShadow = true; } }); return o; };

  // ground + kerb
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(fit, fit, 0.12, 64), new THREE.MeshLambertMaterial({ color: 0xcfc9b8 })); ground.position.y = 0.06; ground.receiveShadow = true; g.add(ground);
  const kerb = new THREE.Mesh(new THREE.CylinderGeometry(fit + 0.1, fit + 0.1, 0.34, 96, 1, true), new THREE.MeshLambertMaterial({ map: stripeTex(), side: THREE.DoubleSide })); kerb.position.y = 0.17; g.add(kerb);

  // ---- octagonal ring of shop-houses (outward = local -z)
  const fac = facadeTex(); fac.repeat.set(LEN / 6.4, 1);
  const facM = new THREE.MeshLambertMaterial({ map: fac });
  const toothG = (() => {
    const s = new THREE.Shape(); s.moveTo(D / 2, 0); s.lineTo(-D / 2, 0); s.lineTo(-D / 2, 2.2); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 2.7, bevelEnabled: false }); geo.rotateY(Math.PI / 2); geo.translate(-1.35, 0, 0); return geo;
  })();
  const flameG = new THREE.ConeGeometry(0.28, 1.1, 5);
  for (let k = 0; k < 8; k++) {
    const th = k * Math.PI / 4, side = new THREE.Group();
    side.position.set(Math.cos(th) * (A - D / 2), 0, Math.sin(th) * (A - D / 2)); side.rotation.y = -(th + Math.PI / 2); g.add(side);
    add(new THREE.Mesh(new THREE.BoxGeometry(LEN, WH, D), white), side).position.y = WH / 2;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(LEN, WH), facM); f.position.set(0, WH / 2, -D / 2 - 0.03); f.rotation.y = Math.PI; side.add(f);
    // gold carved fascia with flame ornaments along the outer top edge
    add(new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.9, 0.5), goldDeep), side).position.set(0, WH + 0.35, -D / 2 + 0.2);
    for (let i = 0; i < Math.floor(LEN / 1.3); i++) { const fl = new THREE.Mesh(flameG, gold); fl.position.set(-LEN / 2 + 0.65 + i * 1.3, WH + 1.3, -D / 2 + 0.2); side.add(fl); fl.castShadow = true; }
    // sawtooth awnings rising towards the stupa
    const nT = Math.floor(LEN / 3.2);
    for (let i = 0; i < nT; i++) { const t = new THREE.Mesh(toothG, roofWhite); t.position.set(-LEN / 2 + (i + 0.5) * (LEN / nT), WH, 0); t.castShadow = true; side.add(t); }
    // gate pavilion on every second side
    if (k % 2 === 0) {
      const gate = new THREE.Group(); gate.position.set(0, 0, -D / 2 - 1.4); side.add(gate);
      add(new THREE.Mesh(new THREE.BoxGeometry(8.5, 6.2, 5.2), cream), gate).position.y = 3.1;
      const arch = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.2), dark); arch.position.set(0, 2.2, -2.62); arch.rotation.y = Math.PI; gate.add(arch);
      add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 0.4), gold), gate).position.set(0, 4.5, -2.7);
      for (const s of [-1, 1]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.5, 8), gold), gate).position.set(s * 2.0, 2.25, -2.75); add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, 0.5), goldDeep), gate).position.set(s * 2.6, 2.3, -2.7); }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: signTex() })); sign.position.set(0, 5.2, -2.65); sign.rotation.y = Math.PI; gate.add(sign);
      // three green tiers with gold trim and a gold spire
      const tiers: [number, number, number][] = [[6.0, 1.7, 6.4], [4.6, 1.7, 8.1], [3.2, 1.9, 9.9]];
      for (const [r, h, y] of tiers) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4).rotateY(Math.PI / 4), green); m.position.y = y; add(m, gate); const tr = new THREE.Mesh(new THREE.BoxGeometry(r * 1.42, 0.22, r * 1.42), gold); tr.position.y = y - h / 2; tr.rotation.y = Math.PI / 4 * 0; gate.add(tr); }
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4.4, 8), gold); sp.position.y = 13.1; add(sp, gate);
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), gold); bl.position.y = 15.4; gate.add(bl);
    }
    // gold tiered spire at each corner between sides
    const cth = th + Math.PI / 8, rr = (A - D * 0.35) / Math.cos(Math.PI / 8);
    const sp = tieredSpire(1.35); sp.position.set(Math.cos(cth) * rr, WH + 0.5, Math.sin(cth) * rr); g.add(sp);
  }

  // ---- central core, terraces and the golden stupa (Wikipedia: Mon-style octagonal chedi, 7.3 m per side, 44.13 m tall)
  const STUPA_H = 44.13, SIDE = 7.3, Rb = SIDE / (2 * Math.sin(Math.PI / 8));   // 9.54 m circumradius
  const coreAp = A - D - 0.4, coreR = coreAp / Math.cos(Math.PI / 8);
  const coreH = WH + 0.4;
  add(new THREE.Mesh(oct(coreR, coreR, coreH), cream)).position.y = coreH / 2;
  add(new THREE.Mesh(oct(coreR + 0.3, coreR + 0.3, 0.6), gold)).position.y = coreH;
  // green tiled roof sloping up from the ring to the core, gold ridge at the foot
  const ringRoofR = (A - D * 0.35) / Math.cos(Math.PI / 8);
  const roofSlope = new THREE.Mesh(new THREE.CylinderGeometry(coreR + 0.6, ringRoofR, 2.6, 8, 1, true).rotateY(Math.PI / 8), new THREE.MeshLambertMaterial({ color: 0x24785a, side: THREE.DoubleSide }));
  roofSlope.position.y = WH + 1.3; add(roofSlope);
  // terraces with a ring of small gold finials at every corner
  let y0 = coreH + 0.3; const finG = new THREE.ConeGeometry(0.22, 0.9, 6);
  const terraces: [number, number][] = [[Rb * 1.55, 1.1], [Rb * 1.34, 1.0], [Rb * 1.16, 0.9]];
  for (const [r, h] of terraces) {
    add(new THREE.Mesh(oct(r, r, h), goldMat)).position.y = y0 + h / 2;
    add(new THREE.Mesh(oct(r + 0.15, r + 0.15, 0.18), goldDeep)).position.y = y0 + 0.09;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8, rr = r / Math.cos(0) * 0.99; const f = new THREE.Mesh(finG, gold); f.position.set(Math.cos(a) * rr, y0 + h + 0.45, Math.sin(a) * rr); f.castShadow = true; g.add(f); }
    y0 += h;
  }
  const baseY = y0, bodyH = STUPA_H - baseY - 4.9;   // leave ~4.9 m for the hti, vane and finial on top
  // octagonal bell + banded spire: profile in (radius/Rb, height/bodyH)
  const prof: [number, number][] = [[1.0, 0.0], [1.0, 0.025], [1.04, 0.03], [1.04, 0.05], [0.97, 0.06], [0.93, 0.10], [0.84, 0.16], [0.72, 0.23], [0.6, 0.30], [0.5, 0.36], [0.44, 0.40], [0.50, 0.405], [0.50, 0.42],
    [0.43, 0.425], [0.41, 0.45], [0.39, 0.49], [0.44, 0.495], [0.37, 0.51], [0.35, 0.55], [0.39, 0.555], [0.32, 0.57], [0.30, 0.61], [0.34, 0.615], [0.27, 0.63], [0.25, 0.67], [0.29, 0.675], [0.22, 0.69], [0.21, 0.73],
    [0.25, 0.735], [0.19, 0.75], [0.17, 0.78], [0.32, 0.79], [0.27, 0.805], [0.19, 0.82], [0.14, 0.84], [0.22, 0.85], [0.17, 0.87], [0.12, 0.90], [0.14, 0.93], [0.09, 0.97], [0.05, 1.0]];
  const gt = goldTex(); gt.repeat.set(8, bodyH / 4);
  const stupaMat = new THREE.MeshStandardMaterial({ map: gt, color: 0xffffff, metalness: 0.8, roughness: 0.34, emissive: 0x6b4400, emissiveIntensity: 0.33, flatShading: true });
  const stupa = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r * Rb, h * bodyH)), 8), stupaMat);
  stupa.position.y = baseY; stupa.rotation.y = Math.PI / 8; add(stupa);
  // eight raised ribs running up the corners of the bell
  const ribG = new THREE.BoxGeometry(0.28, 1, 0.28);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    for (let i = 0; i < 5; i++) {
      const t0 = i * 0.06 + 0.03, r0 = Rb * (1.0 - t0 * 2.0 * 0.72), h0 = t0 * bodyH;
      const rib = new THREE.Mesh(ribG, goldDeep); rib.scale.y = 2.2; rib.position.set(Math.cos(a) * r0, baseY + h0 + 1.0, Math.sin(a) * r0); rib.rotation.set(0, -a, 0); rib.castShadow = true; g.add(rib);
    }
  }
  // lotus petals ring below the hti
  const petalG = new THREE.ConeGeometry(0.34, 1.1, 4);
  const lotusY = baseY + bodyH * 0.805, lotusR = Rb * 0.28;
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, p = new THREE.Mesh(petalG, gold); p.position.set(Math.cos(a) * lotusR, lotusY + 0.4, Math.sin(a) * lotusR); p.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(p); }
  // hti umbrella: tiers of flared discs, then the vane, diamond bud and finial
  const topY = baseY + bodyH;
  for (let i = 0; i < 6; i++) {
    const r = 1.55 - i * 0.22, m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, 0.3, 14), i % 2 ? goldDeep : gold); m.position.y = topY + 0.15 + i * 0.5; add(m);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), gold); b.position.set(Math.cos(a) * r, topY + 0.1 + i * 0.5, Math.sin(a) * r); g.add(b); }
  }
  const sp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 2.2, 8), gold); sp.position.y = topY + 3.0 + 1.1; add(sp);
  const bud = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), gold); bud.position.y = topY + 5.3; bud.scale.y = 1.6; add(bud);
  // four small ornate stupas on the terrace corners (cardinal sides)
  for (let k = 0; k < 4; k++) { const th = k * Math.PI / 2 + Math.PI / 4, s = tieredSpire(1.7); s.position.set(Math.cos(th) * coreR * 0.82, coreH + 0.3, Math.sin(th) * coreR * 0.82); g.add(s); }
  return g;
}
