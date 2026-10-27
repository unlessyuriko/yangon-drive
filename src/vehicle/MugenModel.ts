import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CarModel } from './CarVisuals';

/** The Honda Civic Mugen RR (FD2) from public/models/civic-mugen.glb, made from the supplied OBJ by the converter in tools/: mirrored to right-hand drive, decimated,
 *  origin on the ground at mid-wheelbase, car facing -Z. Materials are replaced by name with the game's physical paint, glass, chrome and tyre materials;
 *  the four wheels are re-pivoted so they spin and the front pair steers; brake and head lamps follow the car state. */
export function loadMugenModel(envMap?: THREE.Texture, onProgress?: (p: number) => void): Promise<CarModel> {
  const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL;
  return new Promise((resolve, reject) => new GLTFLoader().load(base + 'models/civic-mugen.glb', (gltf) => {
    const root = gltf.scene, lit: { m: THREE.MeshStandardMaterial; k: number }[] = [];
    const mk = <T extends THREE.MeshStandardMaterial>(m: T, k = 1) => { m.envMap = envMap ?? null; m.envMapIntensity = k; lit.push({ m, k }); return m; };
    const cache = new Map<string, THREE.Material>();
    let tailLens: THREE.MeshStandardMaterial[] = [], headLens: THREE.MeshStandardMaterial[] = [], amber: THREE.MeshStandardMaterial[] = [];
    const convert = (src: THREE.MeshStandardMaterial): THREE.Material => {
      const n = src.name, hit = cache.get(n); if (hit) return hit;
      let m: THREE.MeshStandardMaterial;
      if (/carpaint/i.test(n)) m = mk(new THREE.MeshPhysicalMaterial({ color: src.color, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }), 1.0);
      else if (/glass_red/i.test(n)) { m = mk(new THREE.MeshStandardMaterial({ color: 0x8a0a10, roughness: 0.12, metalness: 0.1, emissive: 0x000000 }), 1); tailLens.push(m); }
      else if (/glass_orange/i.test(n)) { m = mk(new THREE.MeshStandardMaterial({ color: 0xc86a10, roughness: 0.12, metalness: 0.1 }), 1); amber.push(m); }
      else if (/Translucent_Glass/i.test(n)) { m = mk(new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55, emissive: 0x000000 }), 1.2); headLens.push(m); }
      else if (/glass/i.test(n)) m = mk(new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.38, depthWrite: false }), 1.6);
      else if (/chrome/i.test(n)) m = mk(new THREE.MeshStandardMaterial({ color: 0xe5e8ec, roughness: 0.08, metalness: 1 }), 1.3);
      else if (/rubber/i.test(n)) m = mk(new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 0.95, metalness: 0 }), 0.2);
      else if (/mirror/i.test(n)) m = mk(new THREE.MeshStandardMaterial({ color: 0xc8ced4, roughness: 0.03, metalness: 1 }), 1.4);
      else m = mk(new THREE.MeshStandardMaterial({ color: src.color, roughness: 0.65, metalness: 0.15 }), 0.6);
      m.name = n; m.side = THREE.DoubleSide; cache.set(n, m); return m;
    };
    root.traverse((o) => { const me = o as THREE.Mesh; if (!me.isMesh) return; me.material = Array.isArray(me.material) ? me.material.map((x) => convert(x as THREE.MeshStandardMaterial)) : convert(me.material as THREE.MeshStandardMaterial); me.castShadow = true; });

    // wheels: tyre + rim meshes of each corner go under a pivot at the wheel centre, geometry re-centred on it
    const parts: THREE.Mesh[] = []; root.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh && /^C-default#1|civic_wheel/.test(me.name)) parts.push(me); });
    const corners = new Map<string, { pivot: THREE.Group; spin: THREE.Group; front: boolean }>();
    for (const me of parts) {
      const b = new THREE.Box3().setFromObject(me), c = b.getCenter(new THREE.Vector3());
      const key = (c.x > 0 ? 'R' : 'L') + (c.z < 0 ? 'F' : 'B');
      let w = corners.get(key);
      if (!w) {
        const pivot = new THREE.Group(), spin = new THREE.Group(); pivot.add(spin);
        w = { pivot, spin, front: c.z < 0 }; corners.set(key, w); root.add(pivot);
      }
      // the tyre is the larger part: it fixes the wheel centre
      if (/default#1/.test(me.name)) w.pivot.position.copy(c);
      w.spin.add(me);
    }
    for (const w of corners.values()) for (const me of [...w.spin.children] as THREE.Mesh[]) { me.geometry.translate(-w.pivot.position.x, -w.pivot.position.y, -w.pivot.position.z); me.position.set(0, 0, 0); }

    (window as unknown as { __mugen: unknown }).__mugen = root;
    // steering wheel: pivot at the wheel centre; the wheel plane is tilted about 25 degrees, so it turns about that axis
    const sw = root.getObjectByName('G-Object006'), swPivot = new THREE.Group(), swAxis = new THREE.Vector3(0, Math.sin(0.44), Math.cos(0.44));
    if (sw) { const c = new THREE.Box3().setFromObject(sw).getCenter(new THREE.Vector3()); swPivot.position.copy(c); root.add(swPivot); swPivot.add(sw); sw.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) me.geometry.translate(-c.x, -c.y, -c.z); }); }
    const WHEEL_R = 0.32; let spinAcc = 0, lastDist = 0;
    return resolve({
      group: root,
      update({ dist, steerAngle, braking, headlights, night }) {
        const d = dist - lastDist; lastDist = dist; spinAcc -= d / WHEEL_R;
        for (const w of corners.values()) { w.spin.rotation.x = spinAcc; if (w.front) w.pivot.rotation.y = steerAngle; }
        swPivot.quaternion.setFromAxisAngle(swAxis, -steerAngle * 5.5);
        const tl = braking ? 0.9 : headlights && night > 0.3 ? 0.3 : 0.03;
        for (const m of tailLens) m.emissive.setRGB(tl, 0.01, 0.01);
        const hl = headlights ? 0.9 : 0; for (const m of headLens) m.emissive.setRGB(hl, hl * 0.97, hl * 0.82);
      },
      setEnv(t) { for (const l of lit) l.m.envMap = t; },
    });
  }, (e) => onProgress?.(e.total ? e.loaded / e.total : 0), reject));
}
