import * as THREE from 'three';

/** Chibi Burmese pedestrians: big head with drawn face, eingyi/lace top, longyi/htamein, sandals, bag or basket, head wrap or hair bun with jasmine. */

const SKIN = ['#e6b48a', '#d49c70', '#bd8156'];
const HAIR = 0x1d1512;
const TOPS_M = [0xf1ead2, 0xeef0f4, 0xb88a4a, 0xf4f4f4];
const TOPS_F = [0xf0d8e0, 0xf1e6d2, 0xd8a8c8, 0x9acd6a, 0xe8dcc0];
const SHAWL = [0x4a90d0, 0xf07fa8, 0xe0c060, 0x4cc0b0, 0x9a60d0];

const rngPick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length) % a.length];

/* ------------ cached textures ------------ */
const faceCache = new Map<string, THREE.CanvasTexture>();
function faceTex(skin: string, female: boolean, thanaka: boolean): THREE.CanvasTexture {
  const key = skin + female + thanaka;
  let t = faceCache.get(key); if (t) return t;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d')!;
  c.fillStyle = skin; c.fillRect(0, 0, 512, 256);
  const cx = 128, cy = 140; // sphere front (u = 0.25)
  if (thanaka) {
    c.fillStyle = 'rgba(240,222,150,.75)';
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 42, cy + 22, 17, 12, s * 0.5, 0, 7); c.fill(); }
  }
  c.fillStyle = 'rgba(230,110,100,.28)';
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 44, cy + 20, 13, 8, 0, 0, 7); c.fill(); }
  // eyes: big chibi brown eyes with highlights
  for (const s of [-1, 1]) {
    const ex = cx + s * 27, ey = cy - 2;
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, 14, 17, 0, 0, 7); c.fill();
    c.fillStyle = '#6b4126'; c.beginPath(); c.ellipse(ex, ey + 1, 11, 14, 0, 0, 7); c.fill();
    c.fillStyle = '#1a0f0a'; c.beginPath(); c.ellipse(ex, ey + 2, 6, 8, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - 4, ey - 5, 4, 0, 7); c.fill(); c.beginPath(); c.arc(ex + 4, ey + 5, 2, 0, 7); c.fill();
    c.strokeStyle = '#2a1810'; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.arc(ex, ey, 15, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    c.lineWidth = female ? 3 : 5;
    c.beginPath(); c.moveTo(ex - 13, ey - 27); c.quadraticCurveTo(ex, ey - 33 - (female ? 0 : 2), ex + 13, ey - 27); c.stroke();
  }
  // nose + smile
  c.strokeStyle = 'rgba(120,70,40,.7)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(cx - 3, cy + 17); c.quadraticCurveTo(cx, cy + 21, cx + 4, cy + 17); c.stroke();
  c.strokeStyle = '#7a2a22'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(cx - 14, cy + 36); c.quadraticCurveTo(cx, cy + 49, cx + 14, cy + 36); c.stroke();
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  faceCache.set(key, t); return t;
}

const clothCache = new Map<string, THREE.CanvasTexture>();
/** longyi (checks / stripes) or htamein (colourful woven bands) */
function clothTex(kind: 'check' | 'stripe' | 'band' | 'floral', base: string, accent: string): THREE.CanvasTexture {
  const key = kind + base + accent;
  let t = clothCache.get(key); if (t) return t;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  c.fillStyle = base; c.fillRect(0, 0, 128, 128);
  c.fillStyle = accent;
  if (kind === 'check') {
    c.globalAlpha = 0.55; for (let i = 0; i < 128; i += 32) { c.fillRect(i, 0, 14, 128); c.fillRect(0, i, 128, 14); } c.globalAlpha = 1;
  } else if (kind === 'stripe') {
    for (let i = 0; i < 128; i += 16) c.fillRect(i, 0, 5, 128);
  } else if (kind === 'band') {
    const cols = [accent, '#fff6d0', '#e04a8a', '#3aa0c8'];
    for (let y = 0; y < 128; y += 32) {
      c.fillStyle = cols[(y / 32) % cols.length]; c.fillRect(0, y, 128, 10);
      c.fillStyle = '#fff6'; for (let x = 0; x < 128; x += 16) { c.beginPath(); c.moveTo(x, y + 18); c.lineTo(x + 8, y + 10); c.lineTo(x + 16, y + 18); c.lineTo(x + 8, y + 26); c.fill(); }
    }
  } else {
    for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? accent : '#e8a0b8'; c.beginPath(); c.arc(Math.random() * 128, Math.random() * 128, 7, 0, 7); c.fill(); }
  }
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  clothCache.set(key, t); return t;
}

/* ------------ cached geometry ------------ */
const G = {
  head: new THREE.SphereGeometry(0.21, 24, 16),
  hairBack: new THREE.SphereGeometry(0.222, 20, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, 1.75),
  hairTop: new THREE.SphereGeometry(0.224, 20, 10, 0, Math.PI * 2, 0, 0.78),
  bun: new THREE.SphereGeometry(0.085, 10, 8),
  flower: new THREE.SphereGeometry(0.03, 6, 5),
  torso: new THREE.CapsuleGeometry(0.15, 0.2, 4, 10),
  arm: (() => { const g = new THREE.CapsuleGeometry(0.048, 0.3, 3, 6); g.translate(0, -0.2, 0); return g; })(),
  hand: new THREE.SphereGeometry(0.05, 8, 6),
  skirt: (() => { const g = new THREE.CylinderGeometry(0.18, 0.235, 0.72, 16, 1, true); g.translate(0, 0.46, 0); return g; })(),
  knot: new THREE.SphereGeometry(0.07, 8, 6),
  foot: new THREE.BoxGeometry(0.1, 0.05, 0.22),
  wrap: new THREE.SphereGeometry(0.235, 16, 10, 0, Math.PI * 2, 0, 1.15),
  wrapKnot: new THREE.ConeGeometry(0.07, 0.18, 8),
  bag: new THREE.BoxGeometry(0.2, 0.2, 0.08),
  strap: new THREE.BoxGeometry(0.03, 0.5, 0.02),
  shawl: new THREE.BoxGeometry(0.12, 0.5, 0.05),
  basket: new THREE.CylinderGeometry(0.1, 0.07, 0.12, 10),
};
G.hairTop.translate(0, 0, 0);

const lam = (color: number | string, map?: THREE.Texture, side: THREE.Side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ color, map, side });

export interface PedParts { armL: THREE.Object3D; armR: THREE.Object3D; footL: THREE.Object3D; footR: THREE.Object3D; torso: THREE.Object3D; skirt: THREE.Object3D }

export function makePedestrian(rnd: () => number): THREE.Group {
  const female = rnd() < 0.5;
  const skin = rngPick(SKIN, rnd);
  const g = new THREE.Group();
  const skinM = lam(skin);
  const top = lam(female ? rngPick(TOPS_F, rnd) : rngPick(TOPS_M, rnd));
  const kinds: ('check' | 'stripe' | 'band' | 'floral')[] = female ? ['band', 'floral', 'stripe'] : ['check', 'stripe'];
  const bases = female ? ['#c05a98', '#cfe0f4', '#d89a40', '#3a9a6a'] : ['#2f4a70', '#3a6a4a', '#4a3a58', '#55402e'];
  const base = rngPick(bases, rnd);
  const skirtM = lam(0xffffff, clothTex(rngPick(kinds, rnd), base, female ? '#f0c830' : '#9ab0d0'), THREE.DoubleSide);

  // longyi / htamein
  const skirt = new THREE.Mesh(G.skirt, skirtM); g.add(skirt);
  if (!female) { const knot = new THREE.Mesh(G.knot, skirtM); knot.position.set(0, 0.95, 0.19); g.add(knot); }

  // feet (sandals)
  const sand = lam(0x2a1c12);
  const footL = new THREE.Mesh(G.foot, sand), footR = new THREE.Mesh(G.foot, sand);
  footL.position.set(-0.09, 0.03, 0.04); footR.position.set(0.09, 0.03, 0.04); g.add(footL, footR);

  // torso
  const torso = new THREE.Mesh(G.torso, top); torso.position.y = 1.18; g.add(torso);

  // arms (swing from the shoulder)
  const mkArm = (s: number) => {
    const a = new THREE.Group(); a.position.set(s * 0.2, 1.36, 0);
    a.add(new THREE.Mesh(G.arm, top));
    const hand = new THREE.Mesh(G.hand, skinM); hand.position.y = -0.46; a.add(hand);
    g.add(a); return a;
  };
  const armL = mkArm(-1), armR = mkArm(1);

  // head + face
  const head = new THREE.Mesh(G.head, new THREE.MeshLambertMaterial({ map: faceTex(skin, female, female || rnd() < 0.3) }));
  head.position.y = 1.62; head.scale.set(1.05, 1, 1.02); g.add(head);
  const hairM = lam(HAIR);
  const hb = new THREE.Mesh(G.hairBack, hairM), ht = new THREE.Mesh(G.hairTop, hairM);
  hb.position.y = ht.position.y = 1.62; g.add(hb, ht);
  const turban = !female && rnd() < 0.4;
  if (turban) {
    const w = new THREE.Mesh(G.wrap, lam(0xf4f4f0)); w.position.y = 1.64; w.scale.set(1.05, 1, 1.05);
    const k = new THREE.Mesh(G.wrapKnot, lam(0xf4f4f0)); k.position.set(0.12, 1.84, 0.08); k.rotation.z = -0.9; g.add(w, k);
  } else if (female) {
    const bun = new THREE.Mesh(G.bun, hairM); bun.position.set(0, 1.86, -0.08); bun.scale.set(1.3, 1, 1.3); g.add(bun);
    if (rnd() < 0.6) for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(G.flower, lam(0xffffff)); const a = i * 1.25; f.position.set(Math.cos(a) * 0.1, 1.87 + Math.sin(a) * 0.05, -0.08 + Math.sin(a) * 0.08); g.add(f); }
  }

  // accessories
  if (female) {
    const sh = new THREE.Mesh(G.shawl, lam(rngPick(SHAWL, rnd))); sh.position.set(0.12, 1.12, 0.1); sh.rotation.z = -0.12; g.add(sh);
    if (rnd() < 0.4) { const b = new THREE.Mesh(G.basket, lam(0xb8844a)); b.position.set(0, -0.46, 0); armR.add(b); }
  } else if (rnd() < 0.6) {
    const bag = new THREE.Mesh(G.bag, lam(0x8a5a30)); bag.position.set(-0.22, 0.98, 0.0);
    const strap = new THREE.Mesh(G.strap, lam(0x6a4424)); strap.position.set(-0.04, 1.16, 0.16); strap.rotation.z = 0.5;
    g.add(bag, strap);
  }

  g.userData.parts = { armL, armR, footL, footR, torso, skirt } as PedParts;
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return g;
}

/** walking animation; `phase` advances with distance walked */
export function animatePedestrian(g: THREE.Group, phase: number) {
  const p = g.userData.parts as PedParts | undefined; if (!p) return;
  const s = Math.sin(phase * 2.2);
  p.armL.rotation.x = s * 0.7; p.armR.rotation.x = -s * 0.7;
  p.footL.position.z = 0.04 + s * 0.12; p.footR.position.z = 0.04 - s * 0.12;
  p.footL.position.y = 0.03 + Math.max(0, s) * 0.05; p.footR.position.y = 0.03 + Math.max(0, -s) * 0.05;
  p.torso.rotation.z = s * 0.04; p.skirt.rotation.y = s * 0.08;
  g.position.y = Math.abs(Math.cos(phase * 2.2)) * 0.035;
}
