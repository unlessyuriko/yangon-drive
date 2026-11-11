import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CarModel } from './CarVisuals';

/** The Honda Civic Mugen RR (FD2) from public/models/civic-mugen.glb (about 70k triangles, phones) or civic-mugen-hq.glb (every triangle of the supplied model, desktops), made from the supplied OBJ by the converter in tools/: mirrored to right-hand drive, decimated,
 *  origin on the ground at mid-wheelbase, car facing -Z. Materials are replaced by name with the game's physical paint, glass, chrome and tyre materials;
 *  the four wheels are re-pivoted so they spin and the front pair steers; brake and head lamps follow the car state. */
export function loadMugenModel(envMap?: THREE.Texture, onProgress?: (p: number) => void, hq = false): Promise<CarModel> {
  const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL;
  return new Promise((resolve, reject) => new GLTFLoader().load(base + (hq ? 'models/civic-mugen-hq.glb' : 'models/civic-mugen.glb'), (gltf) => {
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
      else if (/rubber|^Material#[14]$/i.test(n)) m = mk(new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 0.95, metalness: 0 }), 0.2);
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

    // side mirrors: the model's mirror glass (material mirror1, one on each side of the car) is replaced by a plane that shows the road behind, drawn into a small render target
    const sideMirrors: { cam: THREE.PerspectiveCamera; rt: THREE.WebGLRenderTarget; plane: THREE.Mesh }[] = [];
    const mirrorAt: THREE.Vector3[] = [];
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      const me = o as THREE.Mesh; if (!me.isMesh) return;
      const names = (Array.isArray(me.material) ? me.material : [me.material]).map((m) => m.name);
      if (!names.includes('mirror1')) return;
      const b = new THREE.Box3().setFromObject(me), c = b.getCenter(new THREE.Vector3());
      if (Math.abs(c.x) < 0.5) { me.visible = false; return; }   // the rear-view mirror: the cockpit draws its own glass in the same place
      // face the glass back and in toward the driver, like the model's own mirror
      const n = new THREE.Vector3(c.x > 0 ? -0.5 : 0.5, 0, 0.87).normalize();
      me.visible = false;
      const rt = new THREE.WebGLRenderTarget(160, 104);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13), new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xd2d8dc, side: THREE.DoubleSide }));   // tinted down a little: a render target skips the tone mapping the screen gets
      plane.scale.x = -1;                                    // a mirror image
      plane.position.copy(c).addScaledVector(n, 0.004); plane.lookAt(c.clone().add(n));
      root.add(plane); mirrorAt.push(c);
      sideMirrors.push({ cam: new THREE.PerspectiveCamera(40, 160 / 104, 0.3, 140), rt, plane });
    });
    const rearAt = new THREE.Vector3(0, 1.22, -0.451);       // the rear-view mirror, drawn by the cockpit
    // the glass has a second, cream-coloured layer (material *4) in front of it: hide it too or it covers the mirror
    root.traverse((o) => {
      const me = o as THREE.Mesh; if (!me.isMesh || !(Array.isArray(me.material) ? me.material : [me.material]).some((m) => m.name === '*4')) return;
      const c = new THREE.Box3().setFromObject(me).getCenter(new THREE.Vector3());
      if (mirrorAt.some((p) => p.distanceTo(c) < 0.08) || rearAt.distanceTo(c) < 0.15) me.visible = false;
    });
    let mirrorTick = 0;
    const mp = new THREE.Vector3(), md = new THREE.Vector3();
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
      renderMirrors(renderer, scene, every = 3) {
        if (mirrorTick++ % every) return;
        const cur = renderer.getRenderTarget();
        for (const s of sideMirrors) {
          // the camera sits at the glass and looks back, turned a little outward like a driver's view in the mirror
          s.plane.getWorldPosition(mp);
          md.set(Math.sign(s.plane.position.x) * 0.2, -0.05, 1).transformDirection(root.matrixWorld);
          s.cam.position.copy(mp); s.cam.lookAt(mp.x + md.x * 10, mp.y + md.y * 10, mp.z + md.z * 10);
          s.plane.visible = false;
          renderer.setRenderTarget(s.rt); renderer.render(scene, s.cam);
          s.plane.visible = true;
        }
        renderer.setRenderTarget(cur);
      },
    });
  }, (e) => onProgress?.(e.total ? e.loaded / e.total : 0), reject));
}
