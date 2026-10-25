import * as THREE from 'three';

// Right-hand-drive interior in the style of a Civic Type R (FD2): two-tier instrument panel
// (digital speedometer on the upper deck, big tachometer in front of the driver), 3-spoke wheel, bucket seats.
// Driver on +X, car faces -Z. Original geometry, no manufacturer logos.
export const EYE = new THREE.Vector3(0.38, 1.13, 0.22);

export interface Cockpit {
  group: THREE.Group;
  update(o: { kmh: number; rpm: number; gear: number; steerAngle: number; indicatorL: boolean; indicatorR: boolean; t: number; night?: number }): void;
  renderMirror(renderer: THREE.WebGLRenderer, scene: THREE.Scene, car: THREE.Object3D): void;
}

export function buildCockpit(): Cockpit {
  const g = new THREE.Group();
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const ph = (c: number, shin = 40, spec = 0x333333) => new THREE.MeshPhongMaterial({ color: c, shininess: shin, specular: spec });
  const plastic = ph(0x35373d, 30, 0x3a3a3a), plasticLight = ph(0x44464c, 30, 0x555555), leather = ph(0x17181b, 35, 0x3a3a3a), blackPl = ph(0x1b1c20, 25, 0x2a2a2a);
  // fine leather/soft-touch grain so large dark surfaces are not flat
  const grainCv = document.createElement('canvas'); grainCv.width = grainCv.height = 64;
  { const c = grainCv.getContext('2d')!; const d = c.createImageData(64, 64); for (let i = 0; i < d.data.length; i += 4) { const v = 200 + Math.random() * 55; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); }
  const grain = new THREE.CanvasTexture(grainCv); grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(4, 4); grain.colorSpace = THREE.SRGBColorSpace;
  for (const m of [plastic, plasticLight, leather, blackPl]) m.map = grain;
  const red = lam(0xc4161c), cloth = ph(0x26272d, 12, 0x333333), headliner = lam(0xa9aaa8), white = ph(0xf4f4f1, 90, 0x777777);
  cloth.map = grain;
  const metal = ph(0xb8bcc4, 100, 0xffffff);

  const weaveCv = document.createElement('canvas'); weaveCv.width = weaveCv.height = 32;
  { const c = weaveCv.getContext('2d')!; c.fillStyle = '#14161a'; c.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) { c.fillStyle = ((x + y) / 8) % 2 ? '#30343a' : '#0b0c0e'; c.fillRect(x, y, 8, 4); c.fillStyle = ((x + y) / 8) % 2 ? '#0b0c0e' : '#30343a'; c.fillRect(x, y + 4, 8, 4); } }
  const weaveTex = new THREE.CanvasTexture(weaveCv); weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping; weaveTex.repeat.set(10, 3); weaveTex.colorSpace = THREE.SRGBColorSpace;
  const carbonM = ph(0xffffff, 60, 0x666666); carbonM.map = weaveTex;
  const silver = ph(0x9ea3ab, 90, 0xffffff);

  const mk0 = (w: number, h: number) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return { c: cv.getContext('2d')!, t }; };
  const add = <T extends THREE.Object3D>(o: T): T => { g.add(o); return o; };
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return add(o);
  };
  const cyl = (r0: number, r1: number, h: number, m: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 14), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); return add(o);
  };
  const rod = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w: number, m: THREE.Material) => {
    const L = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), len = L.length();
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), m);
    o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), L.normalize()); return add(o);
  };

  // ---- dashboard: side profile extruded across the car
  {
    const s = new THREE.Shape();
    s.moveTo(-1.0, 0.7); s.lineTo(-0.99, 0.94); s.lineTo(-0.85, 0.945); s.lineTo(-0.66, 0.9);
    s.lineTo(-0.5, 0.865); s.lineTo(-0.4, 0.855); s.quadraticCurveTo(-0.3, 0.85, -0.3, 0.78); s.lineTo(-0.32, 0.62); s.lineTo(-0.6, 0.45); s.lineTo(-1.0, 0.45); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.66, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 });
    geo.rotateY(-Math.PI / 2); geo.translate(0.83, 0, 0);
    add(new THREE.Mesh(geo, plastic));
  }
  // upper deck hood over the digital speedometer, binnacle visor over the tachometer
  box(0.36, 0.1, 0.16, plastic, 0.02, 1.0, -0.86, -0.3);          // upper deck housing
  box(0.26, 0.22, 0.06, plastic, EYE.x, 0.97, -0.57, -0.3);       // tachometer housing
  // carbon-look trim across the passenger side of the dash, speaker tweeters on the dash corners
  box(0.95, 0.008, 0.14, carbonM, -0.38, 0.889, -0.58, 0.21);
  box(0.95, 0.012, 0.012, silver, -0.38, 0.884, -0.5, 0.21);
  for (const x of [-0.7, 0.7]) { cyl(0.045, 0.045, 0.014, silver, x, 0.952, -0.86); cyl(0.034, 0.034, 0.016, blackPl, x, 0.955, -0.86); }
  // raised pod with the screen, facing the driver
  box(0.34, 0.15, 0.1, blackPl, -0.02, 0.9, -0.5, -0.1);
  box(0.3, 0.012, 0.012, silver, -0.02, 0.98, -0.45);
  const scr = mk0(256, 128);
  { const c = scr.c; const g2 = c.createLinearGradient(0, 0, 256, 128); g2.addColorStop(0, '#0d2a4a'); g2.addColorStop(1, '#06121f'); c.fillStyle = g2; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#cfe8ff'; c.font = 'bold 44px sans-serif'; c.textAlign = 'left'; c.fillText('12:30', 14, 56);
    c.font = '18px sans-serif'; c.fillStyle = '#7fb6e6'; c.fillText('Yangon  28°C', 16, 84);
    c.fillStyle = '#2f8f5b'; c.fillRect(150, 18, 94, 40); c.fillStyle = '#ffffff'; c.font = 'bold 16px sans-serif'; c.fillText('MAP', 174, 44);
    c.fillStyle = '#1f3d5c'; c.fillRect(14, 98, 228, 18); c.fillStyle = '#4aa3ff'; c.fillRect(14, 98, 120, 18); scr.t.needsUpdate = true; }
  const scrMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.12), new THREE.MeshBasicMaterial({ map: scr.t })); scrMesh.position.set(-0.02, 0.9, -0.449); scrMesh.rotation.x = -0.1; add(scrMesh);
  // audio unit, round vents and climate knobs on the face of the centre stack (driver side, z = -0.3)
  box(0.36, 0.1, 0.03, silver, -0.02, 0.71, -0.295);
  box(0.3, 0.035, 0.012, ph(0x0a1018, 80, 0x335577), -0.02, 0.735, -0.282);
  for (const x of [-0.12, -0.04, 0.04, 0.12]) cyl(0.014, 0.014, 0.012, blackPl, x, 0.685, -0.282, Math.PI / 2);
  { // full-width honeycomb mesh vent strip with a hazard button in the middle
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 16; const c = cv.getContext('2d')!;
    c.fillStyle = '#07080a'; c.fillRect(0, 0, 256, 16); c.strokeStyle = '#7b808c'; c.lineWidth = 1.2;
    for (let y = 0; y < 18; y += 5) for (let x = (y / 5) % 2 ? 3 : 0; x < 260; x += 6) { c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.05), new THREE.MeshBasicMaterial({ map: t }));
    strip.position.set(0.0, 0.775, -0.287); strip.rotation.y = Math.PI; strip.scale.x = -1; add(strip);
    box(0.04, 0.035, 0.012, red, -0.02, 0.775, -0.283);
    box(1.37, 0.007, 0.01, silver, 0, 0.803, -0.287); box(1.37, 0.007, 0.01, silver, 0, 0.747, -0.287);
  }
  box(0.34, 0.07, 0.03, blackPl, -0.02, 0.62, -0.31);
  for (const x of [-0.11, 0, 0.11]) cyl(0.024, 0.024, 0.02, silver, x, 0.625, -0.292, Math.PI / 2);
  // centre console, short gear stick with a red knob in a dark boot, handbrake
  box(0.3, 0.22, 0.95, plastic, 0.0, 0.55, 0.15);
  box(0.22, 0.04, 0.4, plastic, 0.0, 0.67, 0.28);
  box(0.2, 0.012, 0.36, carbonM, 0.0, 0.692, 0.28);
  box(0.24, 0.012, 0.34, carbonM, 0, 0.668, -0.02);
  cyl(0.034, 0.05, 0.05, blackPl, 0.0, 0.69, -0.1);
  cyl(0.011, 0.011, 0.13, metal, 0.0, 0.76, -0.1);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 12), ph(0x15161a, 40, 0x555555))).position.set(0, 0.84, -0.1);
  { const st = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.002, 4, 18), red); st.rotation.x = Math.PI / 2; st.position.set(0, 0.84, -0.1); add(st); }
  cyl(0.032, 0.032, 0.008, silver, 0, 0.808, -0.1);
  box(0.035, 0.035, 0.22, metal, 0.12, 0.7, 0.32, -0.45);

  // ---- windscreen frame, roof lining
  for (const s of [-1, 1]) {
    rod(s * 0.78, 0.94, -0.98, s * 0.69, 1.41, -0.14, 0.085, plastic);
    rod(s * 0.8, 0.95, 0.36, s * 0.72, 1.41, 0.36, 0.1, plastic);
    rod(s * 0.69, 1.31, 1.34, s * 0.76, 1.03, 1.68, 0.12, plastic);
  }
  box(1.4, 0.06, 0.1, plastic, 0, 1.4, -0.12);
  box(1.5, 0.035, 1.9, headliner, 0, 1.425, 0.78);
  box(0.14, 0.02, 0.08, ph(0xe8e4d8), 0, 1.4, 0.2);
  for (const s of [-1, 1]) box(0.34, 0.012, 0.18, headliner, s * 0.38, 1.385, -0.07);
  // tint strip along the top of the windscreen
  {
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64;
    const c = cv.getContext('2d')!; const gr = c.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(10,30,40,0.65)'); gr.addColorStop(1, 'rgba(10,30,40,0)'); c.fillStyle = gr; c.fillRect(0, 0, 4, 64);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.13), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    const base = new THREE.Vector3(0, 0.96, -0.98), top = new THREE.Vector3(0, 1.4, -0.14);
    strip.position.copy(base.clone().lerp(top, 0.93)).add(new THREE.Vector3(0, -0.01, 0.01));
    strip.rotation.x = Math.PI / 2 - Math.atan2(top.y - base.y, top.z - base.z);
    strip.renderOrder = 3; add(strip);
  }
  // cowl, wipers, hood (rises toward the windscreen)
  box(1.6, 0.04, 0.18, plastic, 0, 0.95, -0.99);
  box(0.6, 0.012, 0.025, ph(0x0b0b0c), 0.45, 0.975, -1.0, 0, -0.08);
  box(0.6, 0.012, 0.025, ph(0x0b0b0c), -0.1, 0.975, -1.0, 0, 0.08);
  box(1.5, 0.03, 1.2, white, 0, 0.9, -1.6, -0.0955);
  box(0.5, 0.014, 1.0, white, 0, 0.92, -1.55, -0.0955);

  // ---- floor carpet, sills, firewall and rear wall so there is no see-through
  const carpet = ph(0x121316, 10, 0x111111); carpet.map = grain;
  const matRed = ph(0x9b101a, 10, 0x220000); matRed.map = grain;
  box(1.62, 0.04, 2.7, carpet, 0, 0.3, 0.45);
  box(0.5, 0.006, 0.62, matRed, EYE.x, 0.323, -0.1); box(0.5, 0.006, 0.62, matRed, -0.38, 0.323, -0.1);
  for (const s of [-1, 1]) box(0.07, 0.34, 2.7, blackPl, s * 0.86, 0.42, 0.45);
  box(1.7, 0.7, 0.05, blackPl, 0, 0.62, -0.99);
  box(1.7, 0.75, 0.05, blackPl, 0, 0.75, 1.78);

  // ---- doors, side mirrors
  for (const s of [-1, 1]) {
    box(0.07, 0.42, 1.95, blackPl, s * 0.85, 0.74, 0.0);
    box(0.012, 0.15, 1.1, cloth, s * 0.812, 0.78, 0.1);
    box(0.014, 0.05, 1.5, carbonM, s * 0.81, 0.9, 0.0);
    box(0.016, 0.012, 1.6, red, s * 0.805, 0.935, 0.0);
    box(0.1, 0.05, 1.95, plasticLight, s * 0.83, 0.96, 0.0);
    box(0.12, 0.06, 0.5, plasticLight, s * 0.79, 0.74, 0.05);
    box(0.04, 0.03, 0.16, metal, s * 0.8, 0.9, 0.18);
    box(0.12, 0.12, 0.22, white, s * 0.98, 1.0, -0.62, 0, s * 0.15);
    box(0.02, 0.09, 0.16, ph(0x6b7c88, 120, 0xffffff), s * 0.915, 1.0, -0.62, 0, s * 0.15);
    box(0.06, 0.03, 0.12, white, s * 0.88, 0.96, -0.78);
  }

  // ---- seats with red bolsters, rear bench
  const seat = (x: number) => {
    box(0.5, 0.12, 0.52, cloth, x, 0.52, 0.45);
    box(0.1, 0.1, 0.5, blackPl, x - 0.2, 0.58, 0.45); box(0.1, 0.1, 0.5, blackPl, x + 0.2, 0.58, 0.45);
    box(0.5, 0.58, 0.12, cloth, x, 0.9, 0.73, 0.14);
    box(0.08, 0.5, 0.15, blackPl, x - 0.22, 0.9, 0.71, 0.14); box(0.08, 0.5, 0.15, blackPl, x + 0.22, 0.9, 0.71, 0.14);
    box(0.28, 0.24, 0.1, cloth, x, 1.3, 0.8, 0.1);
    for (const d of [-0.17, 0.17]) box(0.008, 0.52, 0.012, red, x + d, 0.9, 0.664, 0.14);
    for (const d of [-0.06, 0.06]) box(0.06, 0.04, 0.012, blackPl, x + d, 1.3, 0.748, 0.1);
    box(0.012, 0.012, 0.5, red, x - 0.2, 0.645, 0.45); box(0.012, 0.012, 0.5, red, x + 0.2, 0.645, 0.45);
  };
  seat(EYE.x); seat(-0.38);
  box(1.4, 0.14, 0.5, cloth, 0, 0.55, 1.2); box(1.4, 0.55, 0.12, cloth, 0, 0.88, 1.52, 0.16);
  for (const x of [-0.4, 0, 0.4]) box(0.22, 0.2, 0.08, cloth, x, 1.25, 1.55, 0.16);
  box(1.4, 0.04, 0.22, plastic, 0, 1.0, 1.72);

  // ---- steering wheel: flat-bottom D-shape, thick leather rim, suede side grips, red 12 o'clock mark, 3 spokes with buttons
  const column = new THREE.Group();
  column.position.set(EYE.x, 0.84, -0.32); column.rotation.x = -0.42;
  const wheel = new THREE.Group();
  {
    const R = 0.16, r = 0.116, yc = -0.86 * R, t1 = Math.asin(yc / R);
    const outer = new THREE.Shape();
    outer.absarc(0, 0, R, t1, Math.PI - t1, false); outer.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, r, 0, Math.PI * 2, true); outer.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(outer, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 3, curveSegments: 28 });
    geo.translate(0, 0, -0.015);
    wheel.add(new THREE.Mesh(geo, leather));
    const mid = (R + r) / 2, suede = ph(0x2b2c30, 8, 0x111111); suede.map = grain;
    for (const s of [-1, 1]) { const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.11, 0.05), suede); g2.position.set(s * mid, 0.0, 0); wheel.add(g2); }
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.05), red); mark.position.set(0, mid, 0); wheel.add(mark);
    // spokes: two sloping side spokes and a short bottom spoke, joined to a rounded airbag pad
    for (const s of [-1, 1]) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.034, 0.03), leather); sp.position.set(s * 0.09, -0.012, 0); sp.rotation.z = s * -0.16; wheel.add(sp);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.056, 0.012), ph(0x2a2c31, 20, 0x555555)); pad.position.set(s * 0.1, -0.006, 0.02); wheel.add(pad);
      for (let i = 0; i < 3; i++) { const bt = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.006), ph(0x8a8e96, 40, 0xffffff)); bt.position.set(s * 0.1 + (i - 1) * 0.013, 0.006, 0.028); wheel.add(bt); }
    }
    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.062, 0.03), leather); bot.position.set(0, -0.092, 0); wheel.add(bot);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.05, 20), leather); hub.rotation.x = Math.PI / 2; hub.position.z = 0.012; wheel.add(hub);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 20), silver); ring.position.z = 0.04; wheel.add(ring);
    const emb = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 20), ph(0xc4161c, 60, 0xff8888)); emb.rotation.x = Math.PI / 2; emb.position.z = 0.04; wheel.add(emb);
  }
  wheel.scale.setScalar(0.88); column.add(wheel); add(column);
  cyl(0.045, 0.06, 0.2, plastic, EYE.x, 0.7, -0.42, -1.0);

  // ---- instruments drawn on canvases
  const mk = (w: number, h: number) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return { c: cv.getContext('2d')!, t }; };
  const tach = mk(256, 256), digi = mk(256, 96);
  const tachMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: tach.t }));
  tachMesh.position.set(EYE.x, 0.985, -0.535); tachMesh.rotation.x = -0.3; add(tachMesh);
  const digiMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.11), new THREE.MeshBasicMaterial({ map: digi.t }));
  digiMesh.position.set(0.02, 1.06, -0.8); digiMesh.rotation.x = -0.5; add(digiMesh);
  let lastDraw = -1;

  const drawTach = (rpm: number, gear: number, indL: boolean, indR: boolean, blink: boolean) => {
    const c = tach.c, cx = 128, cy = 128, r = 108;
    c.fillStyle = '#0a0b0e'; c.fillRect(0, 0, 256, 256);
    c.beginPath(); c.arc(cx, cy, 120, 0, 7); c.fillStyle = '#14161b'; c.fill();
    const a0 = Math.PI * 0.75, span = Math.PI * 1.5, max = 9;
    c.strokeStyle = '#e03030'; c.lineWidth = 8; c.beginPath(); c.arc(cx, cy, r - 4, a0 + (7.9 / max) * span, a0 + span); c.stroke();
    c.fillStyle = '#e8ecf2'; c.strokeStyle = '#e8ecf2'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 20px sans-serif';
    for (let i = 0; i <= max; i++) {
      const a = a0 + (i / max) * span, cs = Math.cos(a), sn = Math.sin(a);
      c.lineWidth = 3; c.beginPath(); c.moveTo(cx + cs * (r - 4), cy + sn * (r - 4)); c.lineTo(cx + cs * (r - 20), cy + sn * (r - 20)); c.stroke();
      c.fillText(String(i), cx + cs * (r - 36), cy + sn * (r - 36));
      if (i < max) { const am = a + span / max / 2; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx + Math.cos(am) * (r - 4), cy + Math.sin(am) * (r - 4)); c.lineTo(cx + Math.cos(am) * (r - 12), cy + Math.sin(am) * (r - 12)); c.stroke(); }
    }
    c.font = '13px sans-serif'; c.fillStyle = '#9aa3b2'; c.fillText('x1000 r/min', cx, cy + 46);
    c.font = 'bold 30px sans-serif'; c.fillStyle = '#5ee08a'; c.fillText(gear < 0 ? 'R' : gear === 0 ? 'N' : `D${gear}`, cx, cy + 14);
    c.font = 'bold 28px sans-serif'; if (blink && indL) c.fillText('◀', cx - 52, cy - 52); if (blink && indR) c.fillText('▶', cx + 52, cy - 52);
    const a = a0 + Math.min(1, rpm / 1000 / max) * span;
    c.strokeStyle = '#ff3a2a'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14); c.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); c.stroke();
    c.beginPath(); c.arc(cx, cy, 9, 0, 7); c.fillStyle = '#222'; c.fill(); c.strokeStyle = '#ff3a2a'; c.lineWidth = 2; c.stroke();
    tach.t.needsUpdate = true;
  };
  const drawDigi = (kmh: number) => {
    const c = digi.c; c.fillStyle = '#05080c'; c.fillRect(0, 0, 256, 96);
    c.strokeStyle = '#27424f'; c.lineWidth = 3; c.strokeRect(3, 3, 250, 90);
    c.textAlign = 'right'; c.textBaseline = 'middle'; c.font = 'bold 72px monospace'; c.fillStyle = '#7fe8ff'; c.shadowColor = '#37c8ff'; c.shadowBlur = 10;
    c.fillText(String(Math.round(kmh)).padStart(3, ' '), 188, 50); c.shadowBlur = 0;
    c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#9ad8ea'; c.fillText('km/h', 196, 62);
    digi.t.needsUpdate = true;
  };

  // ---- rear-view mirror shows the scene behind the car
  const small = matchMedia('(pointer: coarse)').matches;
  const rt = new THREE.WebGLRenderTarget(small ? 160 : 256, small ? 40 : 64);
  const rear = new THREE.PerspectiveCamera(40, 4, 0.3, 140);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.055), new THREE.MeshBasicMaterial({ map: rt.texture, side: THREE.DoubleSide }));
  mirror.scale.x = -1; mirror.position.set(0.02, 1.27, -0.36); mirror.rotation.set(0.1, 0.1, 0);
  add(mirror);
  box(0.24, 0.075, 0.02, plastic, 0.02, 1.27, -0.375, 0.1, 0.1, 0);
  box(0.03, 0.05, 0.03, plastic, 0.02, 1.33, -0.35);
  let mirrorTick = 0;

  const dome = new THREE.PointLight(0xfff0d8, 0, 4.5); dome.position.set(0, 1.25, 0.1); g.add(dome);

  return {
    group: g,
    update({ kmh, rpm, gear, steerAngle, indicatorL, indicatorR, t, night = 0 }) {
      wheel.rotation.z = -steerAngle * 5.5;
      dome.intensity = 1.1 + night * 0.7;
      if (t - lastDraw < 0.05) return;
      lastDraw = t;
      drawTach(rpm, gear, indicatorL, indicatorR, Math.floor(t * 2.5) % 2 === 0);
      drawDigi(kmh);
    },
    renderMirror(renderer, scene, car) {
      if (!g.visible || (mirrorTick++ % (small ? 3 : 2))) return;
      rear.position.copy(car.localToWorld(new THREE.Vector3(0.0, 1.35, 1.2)));
      rear.quaternion.copy(car.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
      g.visible = false;
      renderer.setRenderTarget(rt); renderer.render(scene, rear); renderer.setRenderTarget(null);
      g.visible = true;
    },
  };
}
