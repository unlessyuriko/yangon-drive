import * as THREE from 'three';

// Procedural Honda Civic Type R (FD2)-style sedan with Mugen-style aero. Metres, car faces -Z, origin on the ground at mid-wheelbase.
// Physical clear-coat paint, environment reflections, detailed lamps and wheels. Original geometry made in code, no manufacturer logos.

interface Station { z: number; yb: number; yt: number; hw: number }

// cross-section ring half (x factor, y factor), bottom-centre -> side -> top-centre; mirrored for the other side
const HALF: [number, number][] = [
  [0, 0], [0.7, 0], [0.9, 0.04], [0.98, 0.14], [1, 0.3], [1, 0.5], [0.985, 0.68], [0.94, 0.82], [0.86, 0.92], [0.72, 0.97], [0.5, 0.995], [0.25, 1], [0, 1],
];
const RING: [number, number][] = [...HALF.slice(0, -1), ...HALF.slice().reverse().slice(0, -1).map(([x, y]) => [-x, y] as [number, number])];

function loft(st: Station[]): THREE.BufferGeometry {
  const n = RING.length, pos: number[] = [], idx: number[] = [];
  for (const s of st) for (const [fx, fy] of RING) pos.push(fx * s.hw, s.yb + fy * (s.yt - s.yb), s.z);
  for (let i = 0; i < st.length - 1; i++) for (let k = 0; k < n; k++) {
    const a = i * n + k, b = i * n + ((k + 1) % n), c = (i + 1) * n + ((k + 1) % n), d = (i + 1) * n + k;
    idx.push(a, b, c, a, c, d);
  }
  const cap = (si: number, front: boolean) => {
    const s = st[si], base = pos.length / 3;
    pos.push(0, (s.yb + s.yt) / 2, s.z);
    for (const [fx, fy] of RING) pos.push(fx * s.hw, s.yb + fy * (s.yt - s.yb), s.z);
    for (let k = 0; k < n; k++) { const p = base + 1 + k, q = base + 1 + ((k + 1) % n); front ? idx.push(base, q, p) : idx.push(base, p, q); }
  };
  cap(0, true); cap(st.length - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Smooth a coarse station list with Catmull-Rom so the body flows instead of faceting. */
function smooth(st: Station[], step = 0.14): Station[] {
  const out: Station[] = [], at = (i: number) => st[Math.max(0, Math.min(st.length - 1, i))];
  const cr = (a: number, b: number, c: number, d: number, t: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < st.length - 1; i++) {
    const k = Math.max(1, Math.ceil((st[i + 1].z - st[i].z) / step));
    for (let j = 0; j < k; j++) {
      const t = j / k, p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      out.push({ z: st[i].z + (st[i + 1].z - st[i].z) * t, yb: cr(p0.yb, p1.yb, p2.yb, p3.yb, t), yt: cr(p0.yt, p1.yt, p2.yt, p3.yt, t), hw: cr(p0.hw, p1.hw, p2.hw, p3.hw, t) });
    }
  }
  out.push(st[st.length - 1]);
  return out;
}

const BODY = smooth([
  { z: -2.27, yb: 0.40, yt: 0.62, hw: 0.50 }, { z: -2.18, yb: 0.30, yt: 0.74, hw: 0.72 }, { z: -1.95, yb: 0.24, yt: 0.80, hw: 0.84 },
  { z: -1.45, yb: 0.22, yt: 0.88, hw: 0.885 }, { z: -0.95, yb: 0.22, yt: 0.95, hw: 0.89 }, { z: 0.0, yb: 0.22, yt: 0.99, hw: 0.89 },
  { z: 1.2, yb: 0.22, yt: 1.0, hw: 0.885 }, { z: 1.8, yb: 0.25, yt: 0.98, hw: 0.85 }, { z: 2.15, yb: 0.32, yt: 0.95, hw: 0.78 },
  { z: 2.27, yb: 0.42, yt: 0.86, hw: 0.66 },
]);
const GLASS = smooth([
  { z: -0.98, yb: 0.94, yt: 0.99, hw: 0.74 }, { z: -0.60, yb: 0.94, yt: 1.20, hw: 0.71 }, { z: -0.15, yb: 0.94, yt: 1.40, hw: 0.66 },
  { z: 0.9, yb: 0.94, yt: 1.42, hw: 0.66 }, { z: 1.5, yb: 0.94, yt: 1.34, hw: 0.68 }, { z: 1.95, yb: 0.94, yt: 1.12, hw: 0.72 }, { z: 2.12, yb: 0.94, yt: 0.99, hw: 0.74 },
], 0.2);
/** body top height at z (linear between smoothed stations) */
const topAt = (z: number) => {
  for (let i = 0; i < BODY.length - 1; i++) if (z <= BODY[i + 1].z) { const a = BODY[i], b = BODY[i + 1], t = (z - a.z) / (b.z - a.z); return a.yt + (b.yt - a.yt) * t; }
  return BODY[BODY.length - 1].yt;
};

const WHEEL_R = 0.335, WHEEL_W = 0.225, AXLE_Z = 1.355, TRACK = 0.83;

export interface CarModel {
  group: THREE.Group;
  update(o: { dist: number; steerAngle: number; braking: boolean; headlights: boolean; night: number }): void;
  /** swap the reflection environment (day sky / neon night) */
  setEnv(t: THREE.Texture): void;
}

const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, rep?: [number, number]) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); }
  return t;
};

export function buildCarModel(envMap?: THREE.Texture): CarModel {
  const g = new THREE.Group();
  const lit: { m: THREE.MeshStandardMaterial; k: number }[] = []; // materials whose reflection strength follows daylight
  const std = (o: THREE.MeshStandardMaterialParameters, k = 1) => { const m = new THREE.MeshStandardMaterial({ envMap, envMapIntensity: k, ...o }); lit.push({ m, k }); return m; };
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xc8111d, metalness: 0.85, roughness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.04, envMap, envMapIntensity: 2.0 });
  lit.push({ m: paint, k: 2 });
  const weave = canvasTex(32, 32, (c) => {
    c.fillStyle = '#15171a'; c.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) { c.fillStyle = ((x + y) / 8) % 2 ? '#2a2d33' : '#0d0e10'; c.fillRect(x, y, 8, 4); c.fillStyle = ((x + y) / 8) % 2 ? '#0d0e10' : '#2a2d33'; c.fillRect(x, y + 4, 8, 4); }
  }, [3, 3]);
  const carbon = std({ color: 0xffffff, map: weave, roughness: 0.35, metalness: 0.4 }, 0.9);
  const black = std({ color: 0x0f1013, roughness: 0.75, metalness: 0.1 }, 0.5);
  const chrome = std({ color: 0xe5e8ec, roughness: 0.07, metalness: 1 }, 1.3);
  const rubber = std({ color: 0x111112, roughness: 0.92, metalness: 0 }, 0.3);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1a24, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.8, envMap, envMapIntensity: 1.5 });
  lit.push({ m: glass as unknown as THREE.MeshStandardMaterial, k: 1.5 });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, ry = 0, rx = 0, parent: THREE.Object3D = g) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.rotation.x = rx; parent.add(o); return o;
  };

  g.add(new THREE.Mesh(loft(BODY), paint));
  g.add(new THREE.Mesh(loft(GLASS), glass));
  box(1.12, 0.03, 1.5, paint, 0, 1.43, 0.7);
  const rod = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w: number, m: THREE.Material = paint) => {
    const L = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), len = L.length();
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, len, w * 0.9), m);
    o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), L.normalize()); g.add(o);
  };
  for (const s of [-1, 1]) {
    rod(s * 0.73, 0.96, -0.97, s * 0.65, 1.4, -0.15, 0.06, black);   // A pillar
    rod(s * 0.69, 0.95, 0.36, s * 0.67, 1.41, 0.36, 0.08, black); // B pillar (black-out)
    rod(s * 0.67, 1.33, 1.45, s * 0.73, 1.03, 2.08, 0.05, black);   // C pillar / hatch quarter
    box(0.025, 0.02, 1.62, black, s * 0.745, 0.955, 0.38);        // glass base trim
    rod(s * 0.665, 1.415, -0.14, s * 0.665, 1.415, 1.0, 0.03, black);
  }

  // hood: carbon vents and a shut line
  const sl = (topAt(-1.2) - topAt(-1.6)) / 0.4;
  box(0.62, 0.012, 0.5, carbon, 0, topAt(-1.4) + 0.003, -1.4, 0, -Math.atan(sl));
  for (const s of [-1, 1]) box(0.012, 0.012, 1.0, black, s * 0.43, topAt(-1.4) + 0.001, -1.45, 0, -Math.atan(sl) * 0.9);
  box(1.6, 0.008, 0.012, black, 0, topAt(-0.97) + 0.002, -0.96);
  // door shut lines
  for (const s of [-1, 1]) for (const z of [-0.58, 0.38, 1.25]) box(0.012, 0.3, 0.012, black, s * 0.888, 0.58, z);
  // Mugen-style aero
  box(1.52, 0.06, 0.34, carbon, 0, 0.29, -2.12);
  box(0.14, 0.04, 0.14, carbon, -0.7, 0.35, -2.02); box(0.14, 0.04, 0.14, carbon, 0.7, 0.35, -2.02);
  for (const s of [-1, 1]) { box(0.07, 0.1, 2.05, carbon, s * 0.9, 0.31, 0.02); box(0.01, 0.012, 2.0, chrome, s * 0.94, 0.355, 0.02); }
  box(1.4, 0.07, 0.3, carbon, 0, 0.33, 2.17);
  for (let i = -3; i <= 3; i++) box(0.012, 0.06, 0.26, black, i * 0.16, 0.33, 2.2);
  box(1.56, 0.035, 0.42, carbon, 0, 1.34, 2.14);
  box(1.56, 0.02, 0.02, carbon, 0, 1.355, 2.34);
  for (const s of [-1, 1]) { box(0.03, 0.2, 0.46, carbon, s * 0.78, 1.34, 2.14); box(0.05, 0.36, 0.06, black, s * 0.38, 1.16, 2.08); }
  // grille (honeycomb) and lower intake
  const hex = canvasTex(64, 32, (c) => {
    c.fillStyle = '#08090b'; c.fillRect(0, 0, 64, 32); c.strokeStyle = '#2b2f36'; c.lineWidth = 2;
    for (let y = 0; y < 36; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 68; x += 8) { c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.stroke(); }
  });
  const grilleM = new THREE.MeshStandardMaterial({ map: hex, roughness: 0.6, metalness: 0.5 });
  box(0.8, 0.14, 0.05, black, 0, 0.56, -2.26); box(0.44, 0.1, 0.05, black, 0, 0.4, -2.22);
  const gp = (w: number, h: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), grilleM); m.position.set(x, y, z); m.rotation.y = Math.PI; g.add(m); };
  gp(0.78, 0.12, 0, 0.56, -2.289); gp(0.42, 0.08, 0, 0.4, -2.249);
  box(0.82, 0.012, 0.012, chrome, 0, 0.635, -2.292);
  // lower corner intakes with fog lamps
  const fogM = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0x000000, emissiveIntensity: 5.0, toneMapped: false, roughness: 0.1, metalness: 0.2 });
  for (const s of [-1, 1]) {
    box(0.26, 0.09, 0.05, black, s * 0.62, 0.4, -2.15, s * 0.3);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), fogM); f.rotation.x = Math.PI / 2; f.position.set(s * 0.62, 0.4, -2.185); g.add(f);
  }

  // headlights: housing, projector pods, lens, LED daytime strip
  const lens = new THREE.MeshPhysicalMaterial({ color: 0xcfd8e2, transparent: true, opacity: 0.4, roughness: 0.03, metalness: 0, clearcoat: 1, envMap, envMapIntensity: 1.4 });
  const bulb = new THREE.MeshStandardMaterial({ color: 0xfff7e6, emissive: 0x000000, emissiveIntensity: 5.0, toneMapped: false, roughness: 0.2 });
  const drl = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, emissive: 0x6fa8ff, emissiveIntensity: 5.0, toneMapped: false, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const h = new THREE.Group(); h.position.set(s * 0.5, 0.65, -2.215); h.rotation.y = s * 0.28; h.rotation.x = 0.1; g.add(h);
    box(0.4, 0.11, 0.1, black, 0, 0, 0, 0, 0, h);
    for (const px of [-0.085, 0.085]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 6, 14), chrome); ring.position.set(px, 0.012, -0.05); h.add(ring);
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.032, 12), bulb); b.position.set(px, 0.012, -0.052); b.rotation.y = Math.PI; h.add(b);
    }
    box(0.34, 0.014, 0.012, drl, 0, -0.04, -0.054, 0, 0, h);
    box(0.4, 0.106, 0.02, lens, 0, 0, -0.058, 0, 0, h);
  }

  // tail lights: lens, light bar, reverse lamp, boot stripe, exhaust tips
  const tailLens = new THREE.MeshPhysicalMaterial({ color: 0x8c1414, emissive: 0x220000, emissiveIntensity: 5.0, toneMapped: false, roughness: 0.15, clearcoat: 1, envMap, envMapIntensity: 1.0 });
  const tailBar = new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0x330000, emissiveIntensity: 5.0, toneMapped: false, roughness: 0.3 });
  for (const s of [-1, 1]) {
    box(0.42, 0.12, 0.06, tailLens, s * 0.6, 0.9, 2.24, -s * 0.25);
    box(0.3, 0.025, 0.02, tailBar, s * 0.6, 0.92, 2.275, -s * 0.25);
    box(0.08, 0.04, 0.02, bulb, s * 0.43, 0.87, 2.285, -s * 0.25);
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.045, 0.2, 14, 1, true), chrome); ex.rotation.x = Math.PI / 2; ex.position.set(0, 0.4, 2.27); ex.scale.set(1.4, 1, 1.4); if (s > 0) g.add(ex);
    const ex2 = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.1, 10), black); ex2.rotation.x = Math.PI / 2; ex2.position.set(0, 0.4, 2.22); if (s > 0) g.add(ex2);
  }
  box(0.4, 0.02, 0.02, tailBar, 0, 0.93, 2.29);
  const plateTex = canvasTex(256, 64, (c) => {
    c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, 256, 64); c.strokeStyle = '#111'; c.lineWidth = 3; c.strokeRect(3, 3, 250, 58);
    c.fillStyle = '#111'; c.font = 'bold 30px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('YGN 5K-1234', 128, 34);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4 })); plate.position.set(0, 0.7, 2.297); g.add(plate);
  box(0.54, 0.145, 0.02, black, 0, 0.7, 2.285);
  box(0.03, 0.06, 0.2, black, 0, 1.46, 1.0); // roof antenna fin

  // door mirrors with glass face and side repeaters
  const mirrorGlass = std({ color: 0x4a86c8, roughness: 0.03, metalness: 1 }, 1.2);
  const repM = new THREE.MeshStandardMaterial({ color: 0xffa21a, emissive: 0x442200, roughness: 0.3 });
  for (const s of [-1, 1]) {
    box(0.1, 0.1, 0.2, black, s * 0.97, 1.0, -0.55, s * 0.15);
    box(0.012, 0.075, 0.15, mirrorGlass, s * 0.925, 1.0, -0.5, s * 0.15);
    box(0.05, 0.02, 0.02, black, s * 0.9, 0.9, -0.55);
    box(0.04, 0.025, 0.14, carbon, s * 0.895, 0.95, 0.15); box(0.04, 0.025, 0.14, carbon, s * 0.895, 0.95, 0.95);
    box(0.012, 0.03, 0.06, repM, s * 0.887, 0.67, -1.25);
  }

  // wheel arches: dark liners and rubber lip
  const wellGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 24); wellGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const well = new THREE.Mesh(wellGeo, black); well.position.set(sx * 0.895, WHEEL_R, sz * AXLE_Z); g.add(well);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.014, 6, 24, Math.PI), rubber);
    arch.rotation.y = Math.PI / 2; arch.position.set(sx * 0.905, WHEEL_R, sz * AXLE_Z); g.add(arch);
  }

  // wheels: lathe tyre with sidewall bulge, dark twin-spoke alloy with polished lip, brake disc and red caliper
  const R0 = 0.235, hw = WHEEL_W / 2;
  const prof = [[R0, -hw * 0.9], [0.27, -hw], [0.31, -hw], [0.33, -hw * 0.82], [WHEEL_R, -hw * 0.5], [WHEEL_R, hw * 0.5], [0.33, hw * 0.82], [0.31, hw], [0.27, hw], [R0, hw * 0.9]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const tyreGeo = new THREE.LatheGeometry(prof, 24); tyreGeo.rotateZ(Math.PI / 2);
  const tyre = std({ color: 0x151515, roughness: 0.95, metalness: 0 }, 0.2);
  const dishGeo = new THREE.CylinderGeometry(0.238, 0.226, WHEEL_W - 0.03, 24); dishGeo.rotateZ(Math.PI / 2);
  const lipGeo = new THREE.TorusGeometry(0.238, 0.01, 6, 24); lipGeo.rotateY(Math.PI / 2);
  const alloy = std({ color: 0x24262b, roughness: 0.3, metalness: 0.85 }, 1.1);
  const spokeM = std({ color: 0xb4bac3, roughness: 0.22, metalness: 0.95 }, 1.2);
  const gold = std({ color: 0xb08a3a, roughness: 0.25, metalness: 0.9 }, 1.1);
  const discGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.022, 24); discGeo.rotateZ(Math.PI / 2);
  const discM = std({ color: 0x9a9fa6, roughness: 0.35, metalness: 0.9 }, 1);
  const caliperM = std({ color: 0xc8161c, roughness: 0.35, metalness: 0.2 }, 0.8);
  const spokeGeo = new THREE.BoxGeometry(0.03, 0.2, 0.034);
  const spinners: THREE.Group[] = []; const pivots: THREE.Group[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * TRACK, WHEEL_R, sz * AXLE_Z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tyreGeo, tyre), new THREE.Mesh(dishGeo, alloy));
    const lip = new THREE.Mesh(lipGeo, chrome); lip.position.x = sx * (hw - 0.005); spin.add(lip);
    for (let k = 0; k < 5; k++) for (const off of [-0.075, 0.075]) {
      const a = (k / 5) * Math.PI * 2 + off, sp = new THREE.Mesh(spokeGeo, spokeM);
      sp.position.set(sx * (hw - 0.02), Math.cos(a) * 0.125, Math.sin(a) * 0.125); sp.rotation.x = -a; spin.add(sp);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12), gold); cap.rotation.z = Math.PI / 2; cap.position.x = sx * (hw - 0.012); spin.add(cap);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2, n = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 6), chrome);
      n.rotation.z = Math.PI / 2; n.position.set(sx * (hw - 0.008), Math.cos(a) * 0.065, Math.sin(a) * 0.065); spin.add(n);
    }
    const disc = new THREE.Mesh(discGeo, discM); disc.position.x = -sx * 0.04; spin.add(disc);
    pivot.add(spin);
    box(0.07, 0.17, 0.14, caliperM, -sx * 0.025, 0.1, 0.06 * (sz < 0 ? 1 : -1), 0, 0, pivot);
    g.add(pivot); spinners.push(spin); if (sz < 0) pivots.push(pivot);
  }

  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });

  let spinAcc = 0, lastDist = 0;
  return {
    group: g,
    update({ dist, steerAngle, braking, headlights, night }) {
      const d = dist - lastDist; lastDist = dist; spinAcc -= d / WHEEL_R;
      for (const s of spinners) s.rotation.x = spinAcc;
      for (const p of pivots) p.rotation.y = steerAngle;
      tailLens.emissive.setRGB(braking ? 0.9 : headlights && night > 0.3 ? 0.3 : 0.03, 0.01, 0.01);
      tailBar.emissive.setRGB(braking ? 1 : headlights && night > 0.3 ? 0.4 : 0.03, 0.01, 0.01);
      bulb.emissive.setRGB(headlights ? 0.9 : 0, headlights ? 0.88 : 0, headlights ? 0.75 : 0);
      fogM.emissive.setRGB(headlights ? 0.5 : 0, headlights ? 0.47 : 0, headlights ? 0.35 : 0);
      const dk = headlights ? 0.9 : 0.12; drl.emissive.setRGB(0.44 * dk, 0.66 * dk, 1.0 * dk);
    },
    setEnv(t) {
      for (const l of lit) l.m.envMap = t;
      lens.envMap = t; tailLens.envMap = t;
    },
  };
}
