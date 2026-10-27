import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeOnRoad } from './RoadClear';

interface R { w: number; pts: number[]; hw: string; br: number; ow: number }
interface B { pts: number[] }

/** Pavements with kerbs along the roads, street trees and clusters of parked motorbikes on the pavement.
 *  Everything stays off carriageways (other roads' mouths are skipped), out of buildings and clear of signal, crossing and stop positions. */
export function buildStreetscape(roads: R[], blds: B[], avoid: [number, number][], centre: [number, number] = [0, 0]): THREE.Group {
  const g = new THREE.Group();
  const onRoad = makeOnRoad(roads);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // buildings grid for point-in-footprint tests
  const CELL = 30, bgrid = new Map<string, number[]>();
  blds.forEach((b, id) => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < b.pts.length; i += 2) { x0 = Math.min(x0, b.pts[i]); x1 = Math.max(x1, b.pts[i]); z0 = Math.min(z0, b.pts[i + 1]); z1 = Math.max(z1, b.pts[i + 1]); }
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) { const k = gx + ',' + gz; (bgrid.get(k) ?? bgrid.set(k, []).get(k)!).push(id); }
  });
  const inBuilding = (x: number, z: number, pad = 0) => {
    for (const id of bgrid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) ?? []) {
      const p = blds[id].pts; let inside = false;
      for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      if (inside) return true;
      if (pad > 0) for (let i = 0; i < p.length; i += 2) if (Math.hypot(p[i] - x, p[i + 1] - z) < pad) return true;
    }
    return false;
  };
  const nearAvoid = (x: number, z: number, d: number) => avoid.some((a) => Math.abs(a[0] - x) < d && Math.abs(a[1] - z) < d && Math.hypot(a[0] - x, a[1] - z) < d);

  // ---- pavements ----
  const PW = 1.9, TOP = 0.15, BASE = 0.03;
  const chunks = new Map<string, { pos: number[]; col: number[] }>();
  const slabCol = new THREE.Color(0xb9b4a8), kerbCol = new THREE.Color(0xd0ccc0);
  const sites: { x: number; z: number; fx: number; fz: number; side: number; hw: number }[] = [];
  for (const r of roads) {
    if (r.br || r.w < 5 || (r.hw as string) === 'rb' || (r as unknown as { rb?: number }).rb) continue;
    const n = r.pts.length / 2, hw = r.w / 2;
    const key = `${Math.floor(r.pts[0] / 300)},${Math.floor(r.pts[1] / 300)}`;
    let ch = chunks.get(key); if (!ch) { ch = { pos: [], col: [] }; chunks.set(key, ch); }
    for (let i = 0; i < n - 1; i++) {
      const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], bz = r.pts[i * 2 + 3];
      const L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
      const fx = (bx - ax) / L, fz = (bz - az) / L, steps = Math.max(1, Math.round(L / 4));
      for (let side = -1; side <= 1; side += 2) {
        const rx = -fz * side, rz = fx * side;                       // outward normal of this side
        for (let s = 0; s < steps; s++) {
          const t0 = (s / steps) * L, t1 = ((s + 1) / steps) * L;
          const x0 = ax + fx * t0, z0 = az + fz * t0, x1 = ax + fx * t1, z1 = az + fz * t1;
          const m = hw + PW / 2;
          const pts: [number, number][] = [[x0 + rx * m, z0 + rz * m], [x1 + rx * m, z1 + rz * m], [(x0 + x1) / 2 + rx * m, (z0 + z1) / 2 + rz * m]];
          if (pts.some((p) => onRoad(p[0], p[1], 0.2) || inBuilding(p[0], p[1]))) continue;
          const ix0 = x0 + rx * hw, iz0 = z0 + rz * hw, ix1 = x1 + rx * hw, iz1 = z1 + rz * hw, ox0 = x0 + rx * (hw + PW), oz0 = z0 + rz * (hw + PW), ox1 = x1 + rx * (hw + PW), oz1 = z1 + rz * (hw + PW);
          const P = ch.pos, C = ch.col;
          const tri = (a: number[], b: number[], c: number[], col: THREE.Color) => { P.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) C.push(col.r, col.g, col.b); };
          // top slab (normals are forced up in the material via flat shading off, so wind it upward)
          tri([ix0, TOP, iz0], [ix1, TOP, iz1], [ox1, TOP, oz1], slabCol); tri([ix0, TOP, iz0], [ox1, TOP, oz1], [ox0, TOP, oz0], slabCol);
          // kerb face toward the road
          tri([ix0, BASE, iz0], [ix1, BASE, iz1], [ix1, TOP, iz1], kerbCol); tri([ix0, BASE, iz0], [ix1, TOP, iz1], [ix0, TOP, iz0], kerbCol);
          if (s % 2 === 0 && L > 8) sites.push({ x: (x0 + x1) / 2 + rx * (hw + PW / 2), z: (z0 + z1) / 2 + rz * (hw + PW / 2), fx, fz, side, hw });
        }
      }
    }
  }
  const slabMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  for (const ch of chunks.values()) {
    if (!ch.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(ch.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(ch.col, 3));
    geo.computeVertexNormals();
    const na = geo.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < na.count; i += 3) { const ny = na.getY(i); if (Math.abs(ny) < 0.5) continue; for (let k = 0; k < 3; k++) na.setXYZ(i + k, 0, 1, 0); }
    const m = new THREE.Mesh(geo, slabMat); m.receiveShadow = true; g.add(m);
  }

  // ---- trees: trunk plus two or three leaf blobs, instanced ----
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6).translate(0, 1.6, 0);
  const paint = (geo: THREE.BufferGeometry, c: number) => { const col = new THREE.Color(c), a = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = col.r; a[i + 1] = col.g; a[i + 2] = col.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo.toNonIndexed(); };
  const blob = (r: number, x: number, y: number, z: number) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
  const treeGeo = mergeGeometries([paint(trunk, 0x6a5238), paint(blob(2.2, 0, 5, 0), 0xffffff), paint(blob(1.6, 1.3, 4.1, 0.5), 0xffffff), paint(blob(1.5, -1.2, 4.4, -0.6), 0xffffff)].map((x) => { x.deleteAttribute('uv'); return x.index ? x.toNonIndexed() : x; }))!;
  // leaves are white in vertex colour so the instance colour tints them; the trunk stays brown because instance colour multiplies it by a green-ish tone
  const trees: THREE.Matrix4[] = [], treeCols: THREE.Color[] = [];
  const bikes: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const GREENS = [0x3f7a38, 0x4d8a3a, 0x356b3a, 0x5a8f3c, 0x2f6b45], BIKE = [0xc0282c, 0x1c3b9c, 0x222428, 0xe8e4d8, 0x2f7d4f, 0x8a8f94, 0xe5b524];
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const s of sites) {
    if (inBuilding(s.x, s.z, 0) || nearAvoid(s.x, s.z, 7)) continue;
    // tree on the kerb edge of the pavement
    if (trees.length < 3000 && rnd() < 0.24) {
      const ox = s.x + (-s.fz * s.side) * -0.5, oz = s.z + (s.fx * s.side) * -0.5;
      if (!onRoad(ox, oz, -0.4) && !inBuilding(ox, oz, 0) && !nearAvoid(ox, oz, 9)) {
        const sc = 0.6 + rnd() * 0.4;
        trees.push(new THREE.Matrix4().compose(new THREE.Vector3(ox, 0, oz), q.setFromAxisAngle(up, rnd() * 6.28), new THREE.Vector3(sc, sc * (0.85 + rnd() * 0.3), sc)));
        treeCols.push(new THREE.Color(GREENS[Math.floor(rnd() * GREENS.length)]));
      }
    }
    // parked motorbikes against the building side, 2-4 in a row
    if (bikes.length < 2600 && rnd() < (Math.hypot(s.x - centre[0], s.z - centre[1]) < 650 ? 0.015 : 0.22)) {
      const n = 2 + Math.floor(rnd() * 3), bx = s.x + (-s.fz * s.side) * 0.35, bz = s.z + (s.fx * s.side) * 0.35;
      for (let k = 0; k < n; k++) {
        const px = bx + s.fx * (k - n / 2) * 0.9, pz = bz + s.fz * (k - n / 2) * 0.9;
        if (onRoad(px, pz, -0.3) || inBuilding(px, pz, 0) || nearAvoid(px, pz, 6)) continue;
        const yaw = Math.atan2(s.fx, s.fz) + (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.25;
        bikes.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(px, 0.15, pz), q.setFromAxisAngle(up, yaw), new THREE.Vector3(1, 1, 1)), c: new THREE.Color(BIKE[Math.floor(rnd() * BIKE.length)]) });
      }
    }
  }
  if (trees.length) {
    const im = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), trees.length);
    trees.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, treeCols[i]); });
    im.castShadow = true; im.frustumCulled = false; g.add(im);
  }
  // motorbike: wheels, frame, tank/seat, handlebar, headlight, mirror. Body is white vertex colour so each instance's colour tints it.
  const part = (geo: THREE.BufferGeometry, c: number) => { geo.deleteAttribute('uv'); return paint(geo, c); };
  const wheel = (z: number) => part(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 12).rotateZ(Math.PI / 2).translate(0, 0.29, z), 0x1a1a1c);
  const bikeGeo = mergeGeometries([
    wheel(0.65), wheel(-0.65),
    part(new THREE.BoxGeometry(0.22, 0.34, 1.0).translate(0, 0.52, 0), 0xffffff),
    part(new THREE.BoxGeometry(0.26, 0.1, 0.5).translate(0, 0.78, -0.2), 0x202022),
    part(new THREE.BoxGeometry(0.3, 0.22, 0.34).translate(0, 0.72, 0.3), 0xffffff),
    part(new THREE.BoxGeometry(0.62, 0.05, 0.05).translate(0, 0.98, 0.58), 0x2a2a2c),
    part(new THREE.BoxGeometry(0.18, 0.16, 0.12).translate(0, 0.86, 0.66), 0xf4efd6),
    part(new THREE.BoxGeometry(0.08, 0.5, 0.08).translate(0, 0.66, 0.62), 0x8a8f94),
  ])!;
  if (bikes.length) {
    const im = new THREE.InstancedMesh(bikeGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), bikes.length);
    bikes.forEach((b, i) => { im.setMatrixAt(i, b.m); im.setColorAt(i, b.c); });
    im.castShadow = true; im.frustumCulled = false; g.add(im);
  }
  (window as unknown as { __street: unknown }).__street = { trees: trees.length, bikes: bikes.length, pavementChunks: chunks.size };
  return g;
}
