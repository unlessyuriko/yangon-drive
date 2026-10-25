import * as THREE from 'three';

/** Procedural HDR-style environment (PMREM-filtered once): a bright sunny sky, or a dark neon night with cyan, magenta and sodium panels. */
export function makeCarEnv(renderer: THREE.WebGLRenderer, night = false): THREE.Texture {
  const sc = new THREE.Scene();
  const geo = new THREE.SphereGeometry(40, 32, 20);
  const p = geo.attributes.position, col: number[] = [];
  const zen = new THREE.Color(night ? 0x04050c : 0x4f8fd6), hor = new THREE.Color(night ? 0x1a0f2e : 0xdcecf6);
  const gnd = new THREE.Color(night ? 0x0b0d14 : 0x8a8f8d), low = new THREE.Color(night ? 0x030308 : 0x4a4e4c), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 40;
    if (y >= 0) c.copy(hor).lerp(zen, Math.pow(y, 0.6)); else c.copy(gnd).lerp(low, Math.min(1, -y * 2.2));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const bright = (w: number, h: number, r: number, g: number, b: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m);
  };
  if (!night) {
    bright(14, 9, 3.2, 3.2, 2.9, 18, 24, -12);   // sun
    bright(26, 5, 2.4, 2.4, 2.2, -26, 12, 8);    // soft strip
    bright(18, 4, 1.8, 1.8, 1.65, 6, 6, 30);
    const dark = new THREE.MeshBasicMaterial({ color: 0x7a828c });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, h = 4 + ((i * 7) % 5) * 2.2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(7, h, 3), dark);
      b.position.set(Math.cos(a) * 30, h / 2 - 1, Math.sin(a) * 30); b.lookAt(0, h / 2 - 1, 0); sc.add(b);
    }
  } else {
    // neon cyan #00f0ff, magenta #ff0055, sodium #ff8800 light panels over a dark skyline
    bright(24, 3, 0, 6, 6.4, -24, 7, 14);
    bright(20, 3, 6.4, 0, 2.1, 22, 8, -16);
    bright(14, 10, 6.4, 2.6, 0, 10, 14, 26);
    bright(10, 2, 0, 5, 5.4, -10, 3, -30);
    bright(10, 2, 5.4, 0, 1.8, 28, 3, 10);
    const dark = new THREE.MeshBasicMaterial({ color: 0x14161f });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, h = 5 + ((i * 7) % 5) * 2.6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(7, h, 3), dark);
      b.position.set(Math.cos(a) * 30, h / 2 - 1, Math.sin(a) * 30); b.lookAt(0, h / 2 - 1, 0); sc.add(b);
    }
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(sc, 0.015);
  pm.dispose(); geo.dispose();
  return rt.texture;
}
