import * as THREE from 'three';

/** YBS (Yangon Bus Service) city bus built in code. Local +z = forward, +x = right (passenger doors are on the right, kerb side).
 *  Modern variant: yellow low-floor Yutong with black wraparound glass, silver grille, roof A/C pod.
 *  Classic variant: magenta body with red/yellow destination strip. Route numbers 1-100 shown in Burmese + Latin digits. */

const MM_DIGITS = '၀၁၂၃၄၅၆၇၈၉';
export const mmNum = (n: number) => String(n).split('').map((d) => MM_DIGITS[+d]).join('');
const FONT_MM = '"Padauk","Noto Sans Myanmar","Myanmar Text","Myanmar Sangam MN",sans-serif';
const STOPS = ['ဆူးလေ', 'ရွှေတိဂုံ', 'လှိုင်သာယာ', 'ဗဟန်း', 'ဒဂုံ', 'မရမ်းကုန်း', 'သင်္ကန်းကျွန်း', 'ကမာရွတ်', 'ဗိုလ်တထောင်', 'အင်းစိန်', 'မင်္ဂလာဒုံ', 'တာမွေ', 'ပုဇွန်တောင်', 'လသာ', 'ဒလ', 'ဟံသာဝတီ'];

const std = (color: number, rough = 0.45, metal = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const M = {
  yellow: std(0xf1b20c, 0.38, 0.15), pink: std(0xc2307a, 0.4, 0.15), black: std(0x121418, 0.6), rubber: std(0x0d0d0e, 0.9, 0),
  glass: new THREE.MeshStandardMaterial({ color: 0x18222c, roughness: 0.08, metalness: 0.7 }),
  silver: std(0xbfc2c8, 0.3, 0.8), dark: std(0x2a2d33, 0.5, 0.3), lamp: new THREE.MeshStandardMaterial({ color: 0xe8ecef, emissive: 0x222222, roughness: 0.2 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xff9a1a, emissive: 0xaa4a00, emissiveIntensity: 0.6 }), red: std(0xc41818, 0.4),
};
const boxG = (() => { const m = new Map<string, THREE.BoxGeometry>(); return (w: number, h: number, d: number) => { const k = `${w}|${h}|${d}`; let g = m.get(k); if (!g) { g = new THREE.BoxGeometry(w, h, d); m.set(k, g); } return g; }; })();
const wheelG = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 20); wheelG.rotateZ(Math.PI / 2);
const hubG = new THREE.CylinderGeometry(0.28, 0.28, 0.32, 14); hubG.rotateZ(Math.PI / 2);

const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export class YbsBus {
  group = new THREE.Group();
  private board = document.createElement('canvas'); private strip = document.createElement('canvas');
  private boardT: THREE.CanvasTexture; private stripT: THREE.CanvasTexture;
  private body: THREE.Mesh[] = [];
  private plateM: THREE.MeshBasicMaterial; private plateC = document.createElement('canvas'); private plateT: THREE.CanvasTexture;
  pink = false; route = 1;

  constructor() {
    this.board.width = 1024; this.board.height = 128; this.strip.width = 1024; this.strip.height = 64; this.plateC.width = 256; this.plateC.height = 80;
    this.boardT = new THREE.CanvasTexture(this.board); this.stripT = new THREE.CanvasTexture(this.strip); this.plateT = new THREE.CanvasTexture(this.plateC);
    for (const t of [this.boardT, this.stripT, this.plateT]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
    this.plateM = new THREE.MeshBasicMaterial({ map: this.plateT });
    const g = this.group;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, body = false) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); if (body) this.body.push(m); return m;
    };
    const B = (w: number, h: number, d: number) => boxG(w, h, d);
    const paint = M.yellow;
    this.paintM = paint.clone(); this.paintM.name = 'paint';
    const P = this.paintM;
    // ---- shell
    add(B(2.5, 1.0, 10.5), P, 0, 0.95, 0);                      // lower body
    add(B(2.52, 1.02, 10.3), M.glass, 0, 1.96, 0);              // side glass band
    for (let z = -4.6; z <= 4.7; z += 1.55) add(B(2.54, 1.02, 0.1), P, 0, 1.96, z); // pillars
    add(B(2.5, 0.5, 10.5), P, 0, 2.72, 0);                      // roof edge
    add(B(2.0, 0.22, 5.4), P, 0, 3.08, -1.6);                   // A/C pod
    add(B(2.2, 0.16, 2.0), P, 0, 2.99, 3.6);                    // sloped front cap
    // ---- front face
    add(B(2.46, 1.38, 0.05), M.black, 0, 1.92, 5.24);           // windshield surround
    const ws = add(B(2.3, 1.2, 0.04), M.glass, 0, 1.92, 5.28); ws.rotation.x = -0.05;
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.3), new THREE.MeshBasicMaterial({ map: this.boardT })); bd.position.set(0, 2.72, 5.27); g.add(bd);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.16), new THREE.MeshBasicMaterial({ map: this.stripT })); sp.position.set(0, 1.28, 5.3); g.add(sp);
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), new THREE.MeshBasicMaterial({ color: 0xe03030 })); sticker.position.set(-0.9, 2.52, 5.3); g.add(sticker);
    add(B(1.7, 0.48, 0.06), M.silver, 0, 0.92, 5.27);           // grille
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16).rotateX(Math.PI / 2), M.dark, 0, 0.95, 5.31);
    add(B(2.46, 0.2, 0.16), M.silver, 0, 0.5, 5.28);            // bumper
    for (const s of [-1, 1]) {
      add(B(0.5, 0.24, 0.1), M.black, s * 0.98, 0.96, 5.26);     // headlamp housing
      add(B(0.36, 0.14, 0.05), M.lamp, s * 0.98, 0.96, 5.32);
      add(B(0.16, 0.12, 0.05), M.amber, s * 1.12, 0.78, 5.3);
    }
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.17), this.plateM); plate.position.set(0, 0.5, 5.37); g.add(plate);
    // ---- rear
    add(B(2.4, 0.9, 0.05), M.glass, 0, 1.95, -5.27);
    add(B(2.4, 0.12, 0.2), M.black, 0, 0.55, -5.3);
    for (const s of [-1, 1]) add(B(0.3, 0.22, 0.06), M.red, s * 1.0, 0.95, -5.28);
    const plateR = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.17), this.plateM); plateR.position.set(0, 0.62, -5.34); plateR.rotation.y = Math.PI; g.add(plateR);
    // ---- doors (right side): front + middle
    for (const z of [3.1, -0.35]) {
      add(B(0.06, 1.9, 1.15), M.black, 1.26, 1.45, z);
      add(B(0.08, 1.7, 0.45), M.glass, 1.29, 1.5, z - 0.28);
      add(B(0.08, 1.7, 0.45), M.glass, 1.29, 1.5, z + 0.28);
      add(B(0.07, 0.06, 1.2), P, 1.28, 2.4, z);
    }
    // ---- mirrors
    for (const s of [-1, 1]) {
      add(B(0.5, 0.05, 0.05), M.black, s * 1.45, 2.3, 4.95);
      add(B(0.09, 0.5, 0.22), M.black, s * 1.7, 2.2, 4.95);
      add(B(0.02, 0.44, 0.18), M.silver, s * 1.65, 2.2, 4.97);
    }
    // ---- wheels
    for (const [z, tw] of [[3.7, 1], [-2.8, 1]] as [number, number][]) {
      for (const s of [-1, 1]) {
        add(wheelG, M.rubber, s * 1.12, 0.5, z); add(hubG, M.silver, s * 1.12, 0.5, z);
        add(B(0.06, 0.9, 1.25), M.black, s * 1.24, 0.82, z);       // arch shadow
      }
    }
    // ---- side route number (right side, above the front door)
    const side = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.2), new THREE.MeshBasicMaterial({ map: this.boardT })); side.position.set(1.28, 2.62, 2.2); side.rotation.y = Math.PI / 2; g.add(side);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.setRoute(1, false);
  }
  paintM: THREE.MeshStandardMaterial;

  setRoute(n: number, pink: boolean) {
    this.route = n; this.pink = pink;
    this.paintM.color.setHex(pink ? 0xc2307a : 0xf1b20c);
    // destination board
    let c = this.board.getContext('2d')!;
    const edge = pink ? '#d4202c' : '#1c3b9c';
    c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, 1024, 128);
    c.fillStyle = edge; c.fillRect(0, 0, 190, 128); c.fillRect(834, 0, 190, 128);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 84px ${FONT_MM}`; c.fillText(mmNum(n), 95, 66);
    c.font = '700 92px "Rajdhani","Arial",sans-serif'; c.fillText(String(n), 929, 66);
    c.fillStyle = pink ? '#169a8a' : '#1c3b9c'; c.font = '700 96px "Rajdhani","Arial",sans-serif';
    (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '14px'; c.fillText('YBS', 512, 68);
    (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    this.boardT.needsUpdate = true;
    // route strip with 3 stops
    c = this.strip.getContext('2d')!;
    const pick = (): string[] => { const a = [...STOPS]; const o: string[] = []; for (let i = 0; i < 3; i++) o.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]); return o; };
    c.fillStyle = pink ? '#d4202c' : '#1c3b9c'; c.fillRect(0, 0, 1024, 64);
    c.fillStyle = pink ? '#ffe45a' : '#fff'; c.font = `600 36px ${FONT_MM}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(pick().join('  •  '), 512, 34);
    this.stripT.needsUpdate = true;
    // number plate (red, Yangon)
    c = this.plateC.getContext('2d')!;
    c.fillStyle = '#d8231c'; c.fillRect(0, 0, 256, 80); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(5, 5, 246, 70);
    c.fillStyle = '#fff'; c.font = '700 46px "Rajdhani","Arial",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${1 + Math.floor(Math.random() * 9)}${'LHKB'[Math.floor(Math.random() * 4)]}-${1000 + Math.floor(Math.random() * 8999)}`, 128, 44);
    this.plateT.needsUpdate = true;
  }
}
