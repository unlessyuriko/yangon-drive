import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** YBS (Yangon Bus Service) city bus built in code, ~10.5 m low-floor Yutong style. Local +z = forward, +x = driver side (left, left-hand drive),
 *  -x = kerb side with the passenger doors (front and middle). Origin on the ground at the centre of the body.
 *  Three liveries: yellow, blue, purple. Route numbers are shown in Burmese and Latin digits and are generated per colour.
 *  All fixed geometry is merged once per material and shared by every bus; paint, lamps and the printed boards are per bus. */

const MM_DIGITS = '၀၁၂၃၄၅၆၇၈၉';
export const mmNum = (n: number) => String(n).split('').map((d) => MM_DIGITS[+d]).join('');
const FONT_MM = '"Padauk","Noto Sans Myanmar","Myanmar Text","Myanmar Sangam MN",sans-serif';
const STOPS = ['ဆူးလေ', 'ရွှေတိဂုံ', 'လှိုင်သာယာ', 'ဗဟန်း', 'ဒဂုံ', 'မရမ်းကုန်း', 'သင်္ကန်းကျွန်း', 'ကမာရွတ်', 'ဗိုလ်တထောင်', 'အင်းစိန်', 'မင်္ဂလာဒုံ', 'တာမွေ', 'ပုဇွန်တောင်', 'လသာ', 'ဒလ', 'ဟံသာဝတီ'];

export type BusColour = 0 | 1 | 2;
export const BUS_LIVERY = [
  { name: 'Yellow', paint: 0xf1b20c, band: '#1c3b9c', text: '#ffffff', accent: '#1c3b9c', routes: [1, 40] },
  { name: 'Blue', paint: 0x1f5fbf, band: '#f1b20c', text: '#16213a', accent: '#f1b20c', routes: [41, 70] },
  { name: 'Purple', paint: 0x6b3aa8, band: '#f4d44a', text: '#2a1a46', accent: '#f4d44a', routes: [71, 100] },
] as const;
/** a route number in the colour's own range */
export const routeFor = (c: BusColour, r = Math.random()) => { const [a, b] = BUS_LIVERY[c].routes; return a + Math.floor(r * (b - a + 1)); };

const LEN = 5.25, HW = 1.25;           // half length, half width
const WHEEL_R = 0.5, WHEEL_Z = [3.55, -2.55];
export const BUS_FRONT_Z = LEN, BUS_REAR_Z = -LEN;

// ---------------------------------------------------------------- shared geometry
type Key = 'paint' | 'black' | 'glass' | 'screen' | 'silver' | 'dark' | 'grey' | 'trim' | 'pole' | 'seat' | 'floor' | 'lining' | 'rubber' | 'blue' | 'ceil'
  | 'lampF' | 'lampR' | 'amberL' | 'amberR' | 'rev' | 'light';
const bucket = new Map<Key, THREE.BufferGeometry[]>();
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(1, 1, 1);
function put(k: Key, g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const ng = g.index ? g.toNonIndexed() : g;
  for (const n of Object.keys(ng.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') ng.deleteAttribute(n);
  tmpE.set(rx, ry, rz, 'YXZ'); tmpQ.setFromEuler(tmpE); tmpM.compose(tmpV.set(x, y, z), tmpQ, tmpS); ng.applyMatrix4(tmpM);
  if (!bucket.has(k)) bucket.set(k, []); bucket.get(k)!.push(ng);
}
const box = (k: Key, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => put(k, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
const rbox = (k: Key, w: number, h: number, d: number, r: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => put(k, new RoundedBoxGeometry(w, h, d, 3, r), x, y, z, rx, ry, rz);
/** cylinder along an axis */
const cyl = (k: Key, r0: number, r1: number, len: number, axis: 'x' | 'y' | 'z', x: number, y: number, z: number, seg = 10) => {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  put(k, g, x, y, z);
};

const DOORS = [{ z: 3.05, w: 1.1 }, { z: -0.55, w: 1.2 }];   // kerb side (-x)
const FLOOR = 0.74;

function buildStatic() {
  const bw = HW, L = LEN;
  // ---- main shell: lower body, rounded roof slab, skirt
  rbox('paint', 2 * bw, 2.5, 2 * L, 0.16, 0, 1.55, 0);                  // y 0.30 .. 2.80
  rbox('paint', 2 * bw - 0.06, 0.34, 2 * L - 0.12, 0.17, 0, 2.86, 0);   // roof cap
  box('dark', 2 * bw - 0.02, 0.22, 2 * L - 0.1, 0, 0.28, 0);            // lower skirt / sill
  box('rubber', 2 * bw + 0.02, 0.05, 2 * L + 0.04, 0, 0.42, 0);         // rub strip
  // livery stripe along the waist
  for (const s of [-1, 1]) box('blue', 0.02, 0.1, 2 * L - 0.3, s * (bw + 0.004), 0.68, 0);
  // ---- side glass band with pillars (both sides, doors cut out on the kerb side)
  const pillars = [-4.7, -3.95, -3.2, -2.45, -1.7, 0.1, 0.9, 1.7, 2.45, 4.15, 4.8];
  for (const s of [-1, 1]) {
    const gx = s * (bw + 0.006);
    // window strip in separate panes with frames
    const spans: [number, number][] = s > 0 ? [[-4.95, 4.95]] : [[-4.95, -1.2], [0.1, 2.5], [3.6, 4.95]];
    for (const [a, b] of spans) {
      box('glass', 0.02, 1.15, b - a, gx, 1.78, (a + b) / 2);
      box('black', 0.03, 0.05, b - a, gx, 2.38, (a + b) / 2); box('black', 0.03, 0.05, b - a, gx, 1.18, (a + b) / 2);
      // mid rail (sliding window track)
      box('black', 0.025, 0.03, b - a, gx + s * 0.004, 1.86, (a + b) / 2);
    }
    for (const z of pillars) {
      if (s < 0 && ((z > -1.2 && z < 0.1) || (z > 2.5 && z < 3.6))) continue;
      box('black', 0.035, 1.22, 0.07, gx + s * 0.002, 1.78, z);
    }
    // hinged top vents
    for (const z of [-4.3, -2.9, -1.4, 1.3, 3.0, 4.4]) { if (s < 0 && z > -1.2 && z < 3.6) continue; box('silver', 0.026, 0.05, 0.28, gx + s * 0.006, 2.1, z); }
  }
  // ---- doors on the kerb side: folding glass leaves, frames, handrails, steps
  for (const d of DOORS) {
    const dx = -(bw + 0.012);
    for (const o of [-1, 1]) box('black', 0.045, 2.0, 0.05, dx, 1.46, d.z + o * (d.w / 2 + 0.02));
    for (const y of [0.5, 2.46]) box('black', 0.045, 0.06, d.w + 0.08, dx, y, d.z);
    for (const o of [-1, 1]) box('glass', 0.03, 1.9, d.w / 2 - 0.04, dx - 0.01, 1.48, d.z + o * (d.w / 4 + 0.01));
    box('black', 0.045, 1.9, 0.03, dx - 0.012, 1.48, d.z);               // door seam
    box('paint', 0.04, 0.1, d.w + 0.14, dx + 0.01, 2.5, d.z);           // header
    box('silver', 0.03, 0.04, d.w - 0.1, dx - 0.012, 0.98, d.z);
    for (const o of [-1, 1]) cyl('pole', 0.025, 0.025, 1.45, 'y', -1.0, FLOOR + 0.8, d.z + o * (d.w / 2 + 0.04), 8);   // handrails
    // steps
    box('floor', 0.5, 0.08, d.w, -0.95, 0.46, d.z); box('floor', 0.4, 0.08, d.w, -1.0, 0.2 + 0.58, d.z);
    box('lampR', 0.02, 0.04, d.w - 0.3, -(bw - 0.12), 0.7, d.z);
  }
  // ---- front face
  const fz = L + 0.004;
  for (const y of [1.27, 2.56]) box('black', 2.3, 0.07, 0.06, 0, y, fz - 0.01, -0.07);          // windscreen frame
  for (const s of [-1, 1]) box('black', 0.07, 1.36, 0.06, s * 1.17, 1.92, fz - 0.01, -0.07);
  for (const s of [-1, 1]) box('screen', 1.07, 1.24, 0.03, s * 0.58, 1.92, fz + 0.01, -0.07);
  box('black', 0.07, 1.3, 0.07, 0, 1.92, fz + 0.04, -0.07);                 // centre pillar
  rbox('paint', 2.3, 0.42, 0.09, 0.04, 0, 2.7, fz);                           // above-windscreen band (destination board sits here)
  box('black', 2.1, 0.32, 0.03, 0, 2.7, fz + 0.045);
  rbox('paint', 2.44, 0.62, 0.1, 0.05, 0, 1.0, fz + 0.01);                    // lower front panel
  box('dark', 1.9, 0.34, 0.06, 0, 0.88, fz + 0.07);                           // grille
  for (let i = 0; i < 7; i++) box('silver', 1.86, 0.016, 0.03, 0, 0.74 + i * 0.05, fz + 0.1);
  cyl('silver', 0.12, 0.12, 0.035, 'z', 0, 1.2, fz + 0.075, 18); cyl('blue', 0.085, 0.085, 0.038, 'z', 0, 1.2, fz + 0.078, 18);
  rbox('black', 2.48, 0.22, 0.2, 0.06, 0, 0.48, fz + 0.08);                   // bumper
  box('silver', 2.3, 0.025, 0.04, 0, 0.56, fz + 0.18);
  for (const s of [-1, 1]) {
    rbox('black', 0.62, 0.3, 0.1, 0.05, s * 0.86, 0.98, fz + 0.1);            // headlamp housings
    rbox('lampF', 0.5, 0.18, 0.06, 0.04, s * 0.86, 0.99, fz + 0.15);
    rbox('amberL', 0.2, 0.09, 0.05, 0.03, s * 1.1, 0.78, fz + 0.14);          // indicators (merged by side below)
    cyl('lampF', 0.06, 0.06, 0.04, 'z', s * 0.83, 0.55, fz + 0.2, 12);        // fog lamps
    box('black', 0.14, 0.1, 0.05, s * 0.5, 0.35, fz + 0.14);
  }
  // ---- rear face
  const rz = -L - 0.004;
  rbox('paint', 2.44, 0.8, 0.1, 0.05, 0, 0.9, rz - 0.01);
  box('black', 2.3, 0.95, 0.05, 0, 1.95, rz, 0.03); box('glass', 2.18, 0.82, 0.04, 0, 1.97, rz - 0.03, 0.03);
  rbox('black', 2.48, 0.2, 0.18, 0.05, 0, 0.46, rz - 0.07);
  box('dark', 1.2, 0.5, 0.04, 0, 0.98, rz - 0.07);                              // engine grille
  for (let i = 0; i < 9; i++) box('black', 1.16, 0.012, 0.03, 0, 0.76 + i * 0.05, rz - 0.095);
  for (const s of [-1, 1]) {
    box('black', 0.26, 0.9, 0.08, s * 1.07, 1.3, rz - 0.08);
    rbox('lampR', 0.2, 0.44, 0.05, 0.03, s * 1.07, 1.35, rz - 0.12);
    box('amberR', 0.18, 0.16, 0.05, s * 1.07, 1.0, rz - 0.12);
    box('rev', 0.14, 0.12, 0.04, s * 0.84, 0.6, rz - 0.15);
  }
  box('lampR', 0.9, 0.05, 0.04, 0, 2.62, rz - 0.04);                            // high-mount brake lamp
  // ---- roof: A/C pod, vents, rails
  rbox('grey', 2.0, 0.26, 5.2, 0.1, 0, 3.13, -1.6);
  for (let i = 0; i < 6; i++) { box('dark', 1.4, 0.02, 0.5, 0, 3.27, -3.5 + i * 0.64 + 0.2); }
  rbox('grey', 1.5, 0.12, 0.9, 0.05, 0, 3.05, 3.0);
  for (const s of [-1, 1]) box('trim', 0.03, 0.12, 9.6, s * 1.18, 3.01, -0.2);
  // ---- side mirrors
  for (const s of [-1, 1]) {
    box('black', 0.5, 0.04, 0.04, s * 1.5, 2.22, 4.88); box('black', 0.04, 0.5, 0.04, s * 1.7, 2.0, 4.88);
    rbox('black', 0.08, 0.5, 0.26, 0.02, s * 1.72, 2.02, 4.9); box('silver', 0.012, 0.44, 0.22, s * 1.76, 2.02, 4.9);
    rbox('black', 0.07, 0.2, 0.2, 0.02, s * 1.68, 1.64, 4.9); box('silver', 0.012, 0.16, 0.16, s * 1.715, 1.64, 4.9);
  }
  // ---- wheel arches and mudguards
  for (const s of [-1, 1]) for (const z of WHEEL_Z) {
    const h = new THREE.CylinderGeometry(0.64, 0.64, 0.03, 20, 1, false, -Math.PI / 2, Math.PI); h.rotateZ(Math.PI / 2);
    put('black', h, s * (bw + 0.012), 0.5, z);
    box('paint', 0.05, 0.05, 1.4, s * (bw + 0.018), 1.16, z);
    box('rubber', 0.04, 0.34, 0.03, s * (bw - 0.1), 0.2, z - 0.7);
  }
  // ---- interior (seen through the glass and from the driver's seat)
  box('floor', 2 * bw - 0.1, 0.06, 2 * L - 0.3, 0, FLOOR - 0.03, 0);
  box('lining', 0.04, 0.5, 2 * L - 0.4, bw - 0.08, FLOOR + 0.25, 0); box('lining', 0.04, 0.5, 2 * L - 0.4, -(bw - 0.08), FLOOR + 0.25, 0);
  box('ceil', 2 * bw - 0.2, 0.04, 2 * L - 0.4, 0, 2.6, 0);
  box('lining', 2 * bw - 0.2, 1.9, 0.04, 0, FLOOR + 0.9, -(L - 0.22)); box('lining', 2 * bw - 0.2, 0.55, 0.04, 0, FLOOR + 0.3, L - 0.3);
  for (const x of [-0.5, 0.5]) box('light', 0.18, 0.03, 9.0, x, 2.575, -0.2);
  const seatRow = (x: number, z: number, w: number) => {
    rbox('seat', w, 0.1, 0.44, 0.03, x, FLOOR + 0.5, z);
    rbox('seat', w, 0.52, 0.09, 0.03, x, FLOOR + 0.84, z - 0.22);
    box('dark', w - 0.08, 0.34, 0.3, x, FLOOR + 0.25, z);
  };
  for (const z of [1.65, 0.95, 0.25, -0.45, -1.15, -1.85, -2.55, -3.25, -3.95]) seatRow(0.76, z, 0.78);
  for (const z of [1.7, 0.9, -1.95, -2.7, -3.45]) seatRow(-0.78, z, 0.6);
  seatRow(0, -4.55, 1.9);
  // driver cab: seat, dashboard, windscreen lining
  rbox('seat', 0.55, 0.12, 0.5, 0.04, 0.62, FLOOR + 0.55, 3.65); rbox('seat', 0.5, 0.7, 0.1, 0.04, 0.62, FLOOR + 1.0, 3.42);
  box('dark', 0.15, 0.4, 0.3, 0.62, FLOOR + 0.28, 3.65);
  rbox('black', 2.2, 0.3, 0.7, 0.05, 0, 1.28, 4.82);                              // dashboard top
  rbox('black', 0.8, 0.1, 0.22, 0.04, 0.62, 1.48, 4.86);                         // instrument hood
  rbox('dark', 0.6, 0.5, 0.5, 0.04, -0.15, 1.1, 4.72);                            // centre console
  cyl('black', 0.05, 0.05, 0.6, 'y', 0.62, 1.2, 4.35, 8);                          // steering column
  box('lining', 0.04, 0.9, 0.7, 0.32, FLOOR + 0.45, 3.6);                         // driver's cab partition
  box('glass', 0.02, 0.5, 0.5, 0.31, 1.45, 3.4);
  // handrails: vertical poles by the seats, longitudinal roof rail
  for (const z of [1.3, -0.1, -1.5, -2.9, -4.2]) cyl('pole', 0.022, 0.022, 1.8, 'y', 0.35, FLOOR + 0.95, z, 8);
  for (const z of [1.3, -0.1, -1.5, -2.9, -4.2]) cyl('pole', 0.022, 0.022, 1.8, 'y', -0.35, FLOOR + 0.95, z, 8);
  cyl('pole', 0.022, 0.022, 9.0, 'z', 0.35, 2.5, -0.2, 8); cyl('pole', 0.022, 0.022, 9.0, 'z', -0.35, 2.5, -0.2, 8);
  for (let i = 0; i < 18; i++) { const z = 2.6 - i * 0.5; cyl('light', 0.012, 0.012, 0.1, 'y', 0.35, 2.43, z, 5); cyl('light', 0.012, 0.012, 0.1, 'y', -0.35, 2.43, z, 5); }
}

// wheel: tyre (lathe) + rim, axis along x; shared geometry
let TYRE: THREE.BufferGeometry, RIM: THREE.BufferGeometry;
function buildWheel() {
  const prof: THREE.Vector2[] = [];
  const R = WHEEL_R, W = 0.15;
  const pts: [number, number][] = [[0.28, -W], [R - 0.06, -W], [R - 0.015, -W + 0.03], [R, -W + 0.07], [R, W - 0.07], [R - 0.015, W - 0.03], [R - 0.06, W], [0.28, W]];
  for (const [r, y] of pts) prof.push(new THREE.Vector2(r, y));
  TYRE = new THREE.LatheGeometry(prof, 24); TYRE.rotateZ(Math.PI / 2);
  const parts: THREE.BufferGeometry[] = [];
  const disc = new THREE.CylinderGeometry(0.29, 0.29, 0.06, 20); disc.rotateZ(Math.PI / 2); disc.translate(0.1, 0, 0);
  const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12); hub.rotateZ(Math.PI / 2); hub.translate(0.12, 0, 0);
  for (const g of [disc, hub]) parts.push(g.toNonIndexed());
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const n = new THREE.CylinderGeometry(0.014, 0.014, 0.05, 6); n.rotateZ(Math.PI / 2); n.translate(0.15, Math.cos(a) * 0.16, Math.sin(a) * 0.16); parts.push(n.toNonIndexed()); }
  for (const g of parts) for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
  RIM = mergeGeometries(parts)!;
}

const std = (color: number, rough = 0.45, metal = 0.1, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const SHARED: Partial<Record<Key, THREE.Material>> = {
  black: std(0x101216, 0.6),
  silver: std(0xc4c7cc, 0.28, 0.85), dark: std(0x2a2d33, 0.55, 0.3), grey: std(0xcfd2d6, 0.5, 0.2), trim: std(0x16181c, 0.6),
  pole: std(0xe8b010, 0.4, 0.4), seat: std(0x2c4a8c, 0.8, 0), floor: std(0x5a5e66, 0.9), lining: std(0xb8b4a6, 0.9), rubber: std(0x0b0b0c, 0.95, 0),
  blue: std(0x1c3b9c, 0.5, 0.1), ceil: std(0xd8d6cc, 0.9),
};
let SHARED_GEO: Map<Key, THREE.BufferGeometry> | null = null;
function ensureShared() {
  if (SHARED_GEO) return SHARED_GEO;
  buildStatic(); buildWheel();
  SHARED_GEO = new Map();
  for (const [k, list] of bucket) SHARED_GEO.set(k, mergeGeometries(list)!);
  bucket.clear();
  return SHARED_GEO;
}

const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const setLetter = (c: CanvasRenderingContext2D, px: string) => { (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = px; };

export interface BusState { braking: boolean; headlights: boolean; night: number; indL: boolean; indR: boolean; t: number; reverse?: boolean }

export class YbsBus {
  group = new THREE.Group();
  colour: BusColour = 0; route = 1;
  paintM: THREE.MeshStandardMaterial;
  private board = document.createElement('canvas'); private strip = document.createElement('canvas'); private side = document.createElement('canvas'); private plateC = document.createElement('canvas'); private clusterC = document.createElement('canvas');
  private boardT: THREE.CanvasTexture; private stripT: THREE.CanvasTexture; private sideT: THREE.CanvasTexture; private plateT: THREE.CanvasTexture; private clusterT: THREE.CanvasTexture;
  private glassM = std(0x0f1b26, 0.06, 0.75, { transparent: true, opacity: 0.62, depthWrite: false }); private screenM = std(0x16222b, 0.05, 0.6, { transparent: true, opacity: 0.88, depthWrite: false });
  private lampF: THREE.MeshStandardMaterial; private lampR: THREE.MeshStandardMaterial; private amberL: THREE.MeshStandardMaterial; private amberR: THREE.MeshStandardMaterial; private rev: THREE.MeshStandardMaterial; private light: THREE.MeshStandardMaterial;
  private wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private swPivot = new THREE.Group(); private swSpin = new THREE.Group();
  private lastDist = 0; private lastKmh = -1;

  constructor() {
    const geos = ensureShared();
    this.board.width = 1024; this.board.height = 128; this.strip.width = 1024; this.strip.height = 64; this.side.width = 1024; this.side.height = 160; this.plateC.width = 256; this.plateC.height = 80; this.clusterC.width = 256; this.clusterC.height = 128;
    this.boardT = new THREE.CanvasTexture(this.board); this.stripT = new THREE.CanvasTexture(this.strip); this.sideT = new THREE.CanvasTexture(this.side); this.plateT = new THREE.CanvasTexture(this.plateC); this.clusterT = new THREE.CanvasTexture(this.clusterC);
    for (const t of [this.boardT, this.stripT, this.sideT, this.plateT, this.clusterT]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    this.paintM = std(BUS_LIVERY[0].paint, 0.36, 0.2, { }); this.paintM.name = 'paint';
    const lamp = (c: number, e: number) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0, roughness: 0.2, metalness: 0.1 });
    this.lampF = lamp(0xeef0f2, 0xfff2cc); this.lampR = lamp(0x7a0c10, 0xff1a14); this.amberL = lamp(0xc86a10, 0xff9a1a); this.amberR = lamp(0xc86a10, 0xff9a1a); this.rev = lamp(0xd8d8d8, 0xffffff);
    this.light = new THREE.MeshStandardMaterial({ color: 0xe8ecef, emissive: 0xfff4d0, emissiveIntensity: 0.15 });
    const mats: Partial<Record<Key, THREE.Material>> = { ...SHARED, glass: this.glassM, screen: this.screenM, paint: this.paintM, lampF: this.lampF, lampR: this.lampR, amberL: this.amberL, amberR: this.amberR, rev: this.rev, light: this.light };
    const g = this.group;
    for (const [k, geo] of geos) { const m = new THREE.Mesh(geo, mats[k]!); m.castShadow = k === 'paint' || k === 'dark'; g.add(m); }
    // wheels: tyres + rims, front pair steers
    const tyreM = std(0x131313, 0.95, 0), rimM = std(0xc9ccd1, 0.3, 0.9);
    for (const z of WHEEL_Z) for (const s of [-1, 1]) {
      const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.position.set(s * (HW - 0.12), WHEEL_R, z); pivot.add(spin);
      const t = new THREE.Mesh(TYRE, tyreM), r = new THREE.Mesh(RIM, rimM); if (s < 0) r.rotation.y = Math.PI; t.castShadow = true;
      // the rim dish points outward, so the kerb-side wheels are turned round
      spin.add(t, r); g.add(pivot); this.wheels.push({ pivot, spin, front: z > 0 });
    }
    // printed boards
    const plane = (w: number, h: number, map: THREE.Texture, x: number, y: number, z: number, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
    plane(2.1, 0.262, this.boardT, 0, 2.7, LEN + 0.064);
    plane(0.9, 0.11, this.boardT, 0.9, 2.6, -LEN - 0.145, Math.PI);
    plane(1.4, 0.2, this.boardT, -(HW + 0.03), 2.64, 3.05, -Math.PI / 2);                         // route number above the front door (kerb side)
    plane(1.4, 0.2, this.boardT, HW + 0.03, 2.64, 3.05, Math.PI / 2);
    plane(0.55, 0.17, this.plateT, 0, 0.5, LEN + 0.185); plane(0.55, 0.17, this.plateT, 0, 0.55, -LEN - 0.17, Math.PI);
    for (const s of [-1, 1]) { plane(2.2, 0.344, this.sideT, s * (HW + 0.012), 0.98, -4.05, s * Math.PI / 2); }
    // steering wheel: large, flat; spins about its own axis
    const swM = std(0x15161a, 0.6, 0.1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.021, 8, 28), swM); ring.castShadow = false;
    const spokes = new THREE.Group();
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), swM); const a = (i / 3) * Math.PI * 2 + Math.PI / 2; sp.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0); sp.rotation.z = a; spokes.add(sp); }
    const hubM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14).rotateX(Math.PI / 2), swM);
    this.swSpin.add(ring, spokes, hubM); this.swPivot.add(this.swSpin);
    this.swPivot.position.set(0.62, 1.42, 4.28); this.swPivot.rotation.x = -1.9; g.add(this.swPivot);
    // instrument cluster facing the driver
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: this.clusterT })); cl.position.set(0.62, 1.545, 4.725); cl.rotation.set(-0.9, Math.PI, 0); g.add(cl);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false; });
    this.setLivery(0, routeFor(0), false);
  }

  /** seen from the driver's seat the glass is nearly clear (the body shell is single-sided, so its walls vanish from inside) */
  setInside(inside: boolean) { this.glassM.opacity = inside ? 0.28 : 0.62; this.screenM.opacity = inside ? 0.1 : 0.88; }

  /** wheel roll for the distance driven, front pair steered by `steer` (rad, + = left) */
  roll(dist: number, steer: number) {
    const d = dist - this.lastDist; this.lastDist = dist;
    for (const w of this.wheels) { w.spin.rotation.x += d / WHEEL_R; if (w.front) w.pivot.rotation.y = steer; }
    this.swSpin.rotation.z = steer * 7;
  }

  /** lamps, brake lights, indicators and the dash cluster; call once per frame for a bus that is being watched closely */
  update(s: BusState, kmh = 0, rpm = 0) {
    const night = s.night;
    this.lampF.emissiveIntensity = s.headlights ? 1.4 : night > 0.5 ? 0.15 : 0;
    this.lampR.emissiveIntensity = s.braking ? 1.8 : s.headlights ? 0.5 : 0.04;
    const blink = Math.sin(s.t * 9) > 0 ? 1.6 : 0.05;
    this.amberL.emissiveIntensity = s.indL ? blink : 0.04; this.amberR.emissiveIntensity = s.indR ? blink : 0.04;
    this.rev.emissiveIntensity = s.reverse ? 1.2 : 0;
    this.light.emissiveIntensity = 0.15 + night * 1.3;
    const k = Math.round(kmh);
    if (k !== this.lastKmh) { this.lastKmh = k; this.drawCluster(k, rpm, s); }
  }
  private drawCluster(kmh: number, rpm: number, s: BusState) {
    const c = this.clusterC.getContext('2d')!;
    c.fillStyle = '#05080c'; c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#2a8cf0'; c.lineWidth = 3; c.strokeRect(3, 3, 250, 122);
    c.fillStyle = '#e8f4ff'; c.font = '700 64px "Rajdhani","Arial",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(kmh), 100, 62);
    c.font = '600 20px "Rajdhani","Arial",sans-serif'; c.fillStyle = '#7fb4e8'; c.fillText('km/h', 100, 102);
    c.fillStyle = '#1a2230'; c.fillRect(176, 14, 18, 100);
    const f = Math.min(1, rpm / 2600); c.fillStyle = f > 0.85 ? '#ff4a3a' : '#38d070'; c.fillRect(176, 114 - 100 * f, 18, 100 * f);
    c.fillStyle = s.indL ? '#38d070' : '#1d2a22'; c.beginPath(); c.moveTo(216, 30); c.lineTo(240, 18); c.lineTo(240, 42); c.fill();
    c.fillStyle = s.indR ? '#38d070' : '#1d2a22'; c.beginPath(); c.moveTo(216, 96); c.lineTo(240, 84); c.lineTo(240, 108); c.fill();
    this.clusterT.needsUpdate = true;
  }

  /** colour 0 yellow, 1 blue, 2 purple; `route` printed on the boards (Burmese and Latin digits) */
  setLivery(colour: BusColour, route: number, randomise = true) {
    this.colour = colour; this.route = route;
    const L = BUS_LIVERY[colour];
    this.paintM.color.setHex(L.paint);
    // destination board
    let c = this.board.getContext('2d')!;
    c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, 1024, 128);
    c.fillStyle = L.band; c.fillRect(0, 0, 190, 128); c.fillRect(834, 0, 190, 128);
    c.fillStyle = L.text; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 84px ${FONT_MM}`; c.fillText(mmNum(route), 95, 66);
    c.font = '700 92px "Rajdhani","Arial",sans-serif'; c.fillText(String(route), 929, 66);
    c.fillStyle = L.accent === '#f1b20c' || L.accent === '#f4d44a' ? '#1c3b9c' : L.accent; c.font = '700 96px "Rajdhani","Arial",sans-serif';
    setLetter(c, '14px'); c.fillText('YBS', 512, 68); setLetter(c, '0px');
    this.boardT.needsUpdate = true;
    // route strip (3 stops)
    c = this.strip.getContext('2d')!;
    const a = [...STOPS], o: string[] = []; for (let i = 0; i < 3; i++) o.push(a.splice(Math.floor((randomise ? Math.random() : i / 3) * a.length), 1)[0]);
    c.fillStyle = L.band; c.fillRect(0, 0, 1024, 64); c.fillStyle = L.text; c.font = `600 36px ${FONT_MM}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.join('  •  '), 512, 34);
    this.stripT.needsUpdate = true;
    // side livery: logo, name, route
    c = this.side.getContext('2d')!;
    c.clearRect(0, 0, 1024, 160);
    const edge = L.band;
    c.fillStyle = edge; rr(c, 0, 10, 1024, 140, 26); c.fill();
    c.fillStyle = '#fff'; rr(c, 14, 22, 130, 116, 18); c.fill();
    c.fillStyle = L.text === '#ffffff' ? '#1c3b9c' : L.text; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 74px ${FONT_MM}`; c.fillText(mmNum(route), 79, 84);
    c.fillStyle = L.text; c.textAlign = 'left'; c.font = '700 70px "Rajdhani","Arial",sans-serif'; setLetter(c, '10px'); c.fillText('YBS', 172, 60); setLetter(c, '0px');
    c.font = `600 40px ${FONT_MM}`; c.fillText('ရန်ကုန်ဘတ်စ်ကားလိုင်း', 172, 116);
    c.textAlign = 'right'; c.font = '700 96px "Rajdhani","Arial",sans-serif'; c.fillText(String(route), 1000, 86);
    this.sideT.needsUpdate = true;
    // number plate (red, Yangon)
    c = this.plateC.getContext('2d')!;
    c.fillStyle = '#d8231c'; c.fillRect(0, 0, 256, 80); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(5, 5, 246, 70);
    c.fillStyle = '#fff'; c.font = '700 46px "Rajdhani","Arial",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${1 + Math.floor(Math.random() * 9)}${'LHKB'[Math.floor(Math.random() * 4)]}-${1000 + Math.floor(Math.random() * 8999)}`, 128, 44);
    this.plateT.needsUpdate = true;
  }
  /** a random colour with its own route range */
  randomise() { const c = (Math.floor(Math.random() * 3)) as BusColour; this.setLivery(c, routeFor(c)); }
}
