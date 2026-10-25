import * as THREE from 'three';

/** Yangon taxi built in code: local +z = forward. Silver/white/black wagon or sedan with a yellow side stripe, a yellow TAXI roof sign and red number plates. */

const std = (color: number, rough = 0.4, metal = 0.2) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const M = {
  yellow: std(0xf2b807, 0.45, 0.05), black: std(0x121418, 0.6, 0), glass: new THREE.MeshStandardMaterial({ color: 0x1a232c, roughness: 0.08, metalness: 0.7 }),
  rubber: std(0x0d0d0e, 0.9, 0), silver: std(0xc4c7cc, 0.3, 0.8), lamp: new THREE.MeshStandardMaterial({ color: 0xe8ecef, emissive: 0x222222, roughness: 0.2 }),
  red: std(0xc41818, 0.4, 0), amber: std(0xff9a1a, 0.4, 0),
};
const VARIANTS = [{ body: 0xc4c8cd, wagon: true }, { body: 0xf3f3f1, wagon: false }, { body: 0x16171b, wagon: true }, { body: 0xb9bcc2, wagon: false }];
const boxes = new Map<string, THREE.BoxGeometry>();
const B = (w: number, h: number, d: number) => { const k = `${w}|${h}|${d}`; let g = boxes.get(k); if (!g) { g = new THREE.BoxGeometry(w, h, d); boxes.set(k, g); } return g; };
const wheelG = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16); wheelG.rotateZ(Math.PI / 2);
const hubG = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 10); hubG.rotateZ(Math.PI / 2);

let signTex: THREE.CanvasTexture | null = null;
function taxiSign(): THREE.CanvasTexture {
  if (signTex) return signTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d')!;
  x.fillStyle = '#f2b807'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#111'; x.font = '700 70px "Rajdhani","Arial Black",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '6px'; x.fillText('TAXI', 128, 52);
  signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace; return signTex;
}
let sideTex: THREE.CanvasTexture | null = null;
function sideLabel(): THREE.CanvasTexture {
  if (sideTex) return sideTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d')!;
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(3, 3, 250, 58);
  x.fillStyle = '#111'; x.font = '700 30px "Rajdhani","Arial",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CITY TAXI', 128, 24);
  x.font = '600 20px "Rajdhani","Arial",sans-serif'; x.fillText('YGN-35 / 0453', 128, 47);
  sideTex = new THREE.CanvasTexture(c); sideTex.colorSpace = THREE.SRGBColorSpace; return sideTex;
}

export class Taxi {
  group = new THREE.Group();
  private paint = std(0xc4c8cd, 0.3, 0.35);
  private plateC = document.createElement('canvas'); private plateT: THREE.CanvasTexture;

  constructor() {
    this.plateC.width = 256; this.plateC.height = 80; this.plateT = new THREE.CanvasTexture(this.plateC); this.plateT.colorSpace = THREE.SRGBColorSpace;
    const g = this.group, P = this.paint;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    // ---- body
    add(B(1.76, 0.6, 4.4), P, 0, 0.62, 0);                       // lower body
    const hood = add(B(1.66, 0.12, 1.25), P, 0, 0.98, 1.55); hood.rotation.x = 0.1;
    add(B(1.7, 0.42, 0.1), P, 0, 0.78, 2.19);                    // front nose
    add(B(1.7, 0.1, 1.1), P, 0, 1.0, -1.7);                      // boot / tail deck
    add(B(1.62, 0.52, 2.55), M.glass, 0, 1.28, -0.12);           // glass greenhouse
    for (const z of [-1.35, 0.0, 1.0]) add(B(1.66, 0.54, 0.07), P, 0, 1.28, z);   // pillars
    add(B(1.6, 0.06, 2.6), P, 0, 1.56, -0.1);                    // roof
    // ---- yellow side stripes (both sides, running the full length)
    for (const s of [-1, 1]) {
      add(B(0.02, 0.2, 4.36), M.yellow, s * 0.885, 0.75, 0);
      add(B(0.02, 0.1, 1.1), M.yellow, s * 0.885, 0.63, -1.7);
    }
    // ---- roof sign (TAXI)
    const sign = add(B(0.52, 0.15, 0.22), M.yellow, 0, 1.68, 0.0);
    const mat = new THREE.MeshBasicMaterial({ map: taxiSign() });
    for (const [z, ry] of [[0.112, 0], [-0.112, Math.PI]] as [number, number][]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.13), mat); p.position.set(0, 1.68, z); p.rotation.y = ry; g.add(p); }
    sign.castShadow = true;
    // ---- door label on the side
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: sideLabel() })); lab.position.set(0.9, 0.9, 0.35); lab.rotation.y = Math.PI / 2; g.add(lab);
    // ---- bumpers, lamps, plates
    add(B(1.74, 0.16, 0.14), M.black, 0, 0.42, 2.25); add(B(1.74, 0.16, 0.14), M.black, 0, 0.42, -2.25);
    add(B(0.8, 0.12, 0.04), M.silver, 0, 0.62, 2.23);            // grille
    for (const s of [-1, 1]) {
      add(B(0.4, 0.15, 0.06), M.lamp, s * 0.62, 0.74, 2.21);
      add(B(0.3, 0.14, 0.06), M.red, s * 0.68, 0.86, -2.21);
      add(B(0.1, 0.08, 0.04), M.amber, s * 0.84, 0.64, 2.2);
      // mirrors
      add(B(0.22, 0.12, 0.08), P, s * 1.0, 1.1, 0.82);
      // wheels
      for (const z of [1.37, -1.37]) { add(wheelG, M.rubber, s * 0.78, 0.32, z); add(hubG, M.silver, s * 0.78, 0.32, z); }
    }
    const pm = new THREE.MeshBasicMaterial({ map: this.plateT });
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), pm); pf.position.set(0, 0.48, 2.33); g.add(pf);
    const pr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), pm); pr.position.set(0, 0.62, -2.33); pr.rotation.y = Math.PI; g.add(pr);
    this.setVariant(0);
  }

  setVariant(v: number) {
    const o = VARIANTS[v % VARIANTS.length]; this.paint.color.setHex(o.body);
    const c = this.plateC.getContext('2d')!;
    c.fillStyle = '#d8231c'; c.fillRect(0, 0, 256, 80); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(5, 5, 246, 70);
    c.fillStyle = '#fff'; c.font = '700 46px "Rajdhani","Arial",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${1 + Math.floor(Math.random() * 9)}${'FHKGE'[Math.floor(Math.random() * 5)]}-${1000 + Math.floor(Math.random() * 8999)}`, 128, 44);
    this.plateT.needsUpdate = true;
  }
}
