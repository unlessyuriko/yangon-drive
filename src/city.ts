import * as THREE from 'three';
import { makeAsphaltMaps } from './world/Asphalt';
import { addPolygon, addCircle } from "./collision";
import { buildBusStops } from "./world/BusStops";
import { buildSulePagoda } from "./world/SulePagoda";
import { buildBuildings, BuildingSet } from "./world/Buildings";
import { buildSigns } from "./signs";
import { buildStreetscape } from "./world/Streetscape";
import { Signals } from "./signals";
import { Crossings } from "./crossings";
import { Traffic } from "./traffic";
import { Roundabout } from "./roundabout";
import { buildLandmarks, LANDMARKS } from "./world/Landmarks";
import { pickOvertake, OvertakeSite } from "./world/Overtake";
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Road { w: number; pts: number[]; name: string; en: string; my: string; hw: string; ow: number; br: number }
interface Bld { h: number; pts: number[] }
interface MapData { roads: Road[]; buildings: Bld[] }

export interface City { start: { x: number; z: number; heading: number }; signals: Signals; crossings: Crossings; traffic: Traffic; roundabout: Roundabout; roadMaterial: THREE.MeshStandardMaterial; roads: Road[]; buildings: BuildingSet; overtake: OvertakeSite | null }

const PALETTE = [0xe8d8b8, 0xd9a5a0, 0xb8cfe0, 0xe6e0d0, 0xc9d6b0, 0xf0c987, 0xcdb4db, 0xa9cdb5];

function roadGeometry(roads: Road[]): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [], col: number[] = [], uv: number[] = [], mark: number[] = [];
  const c = new THREE.Color();
  // wider roads sit slightly lower so crossings don't flicker
  for (const r of roads) {
    const n = r.pts.length / 2;
    if (n < 2) continue;
    const y = 0.02 + (1 - Math.min(r.w, 14) / 14) * 0.06 + (r.br ? 0.02 : 0);
    c.set(r.hw === 'service' || r.hw === 'living_street' ? 0x7a7d82 : 0x65686d);
    const edge = c.clone().lerp(new THREE.Color(0x9a8f7c), 0.45), gut = c.clone().multiplyScalar(0.8);
    const inset = Math.min(0.9, r.w * 0.22), cols = [edge, gut, gut, edge], offs = [1, 1 - 2 * inset / r.w, -(1 - 2 * inset / r.w), -1];
    const base = pos.length / 3;
    // lane markings are painted in the road shader: per vertex (lateral metres, distance along, distance to the nearer end, half-width or 0 when unmarked)
    const marked = r.w >= 9 && !r.ow && ['primary', 'secondary', 'tertiary', 'trunk'].includes(r.hw) && !r.br;
    const cum: number[] = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(r.pts[i * 2] - r.pts[i * 2 - 2], r.pts[i * 2 + 1] - r.pts[i * 2 - 1]));
    const total = cum[n - 1];
    for (let i = 0; i < n; i++) {
      const x = r.pts[i * 2], z = r.pts[i * 2 + 1];
      const p = i > 0 ? i - 1 : i, q = i < n - 1 ? i + 1 : i;
      let dx = r.pts[q * 2] - r.pts[p * 2], dz = r.pts[q * 2 + 1] - r.pts[p * 2 + 1];
      const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
      const hw = r.w / 2;
      for (let k = 0; k < 4; k++) {
        const o = offs[k] * hw, px = x - dz * o, pz = z + dx * o;
        pos.push(px, y, pz); uv.push(px * 0.12, pz * 0.12); mark.push(offs[k] * hw, cum[i], Math.min(cum[i], total - cum[i]), marked ? hw : 0); col.push(cols[k].r, cols[k].g, cols[k].b);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < 3; k++) { const a = base + i * 4 + k; idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aMark', new THREE.Float32BufferAttribute(mark, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ribbons may face down depending on direction; force up
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

function buildingGeometry(blds: Bld[]): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  blds.forEach((b, i) => {
    const s = new THREE.Shape();
    for (let k = 0; k < b.pts.length; k += 2) {
      if (k === 0) s.moveTo(b.pts[0], -b.pts[1]); else s.lineTo(b.pts[k], -b.pts[k + 1]);
    }
    let g: THREE.BufferGeometry;
    try { g = new THREE.ExtrudeGeometry(s, { depth: b.h, bevelEnabled: false, curveSegments: 1 }); } catch { return; }
    g.rotateX(-Math.PI / 2);
    g.deleteAttribute('uv');
    c.set(PALETTE[(i * 7 + Math.floor(b.h)) % PALETTE.length]);
    const cols = new Float32Array(g.attributes.position.count * 3);
    for (let v = 0; v < cols.length; v += 3) { cols[v] = c.r; cols[v + 1] = c.g; cols[v + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geos.push(g.index ? g.toNonIndexed() : g);
  });
  return mergeGeometries(geos, false)!;
}

function suleStupa(): THREE.Group {
  const gold = new THREE.MeshLambertMaterial({ color: 0xf2b930 });
  const white = new THREE.MeshLambertMaterial({ color: 0xf1ede2 });
  const g = new THREE.Group();
  // octagonal terraces
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(10, 10.5, 1.2, 8), white); t1.position.y = 0.6;
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.6, 1.2, 8), white); t2.position.y = 1.8;
  const t3 = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.8, 1.4, 8), white); t3.position.y = 3.1;
  g.add(t1, t2, t3);
  // bell-shaped stupa profile (radius, height)
  const prof = [[5.2,3.8],[5,5],[4.4,7],[3.4,10],[2.6,14],[2.3,18],[2.0,22],[1.6,25],[1.5,26.5],[1.9,27.2],[1.3,28],[1.2,29.5],[1.0,31],[0.9,32.5],[0.8,34],[0.5,36]];
  const lathe = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), 24), gold);
  g.add(lathe);
  // hti (umbrella) and finial
  const hti = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.8, 1.4, 12), gold); hti.position.y = 37;
  const hti2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 1.2, 12), gold); hti2.position.y = 38.6;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), gold); tip.position.y = 39.8;
  g.add(hti, hti2, tip);
  // small corner stupas
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.2, 10), gold);
    s.position.set(Math.cos(a) * 7.6, 2.4 + 2.1, Math.sin(a) * 7.6);
    g.add(s);
  }
  return g;
}

export async function loadCity(scene: THREE.Scene): Promise<City> {
  const data: MapData = await (await fetch(`${import.meta.env.BASE_URL}map/sule.json`)).json();

  const { map, roughnessMap, normalMap } = makeAsphaltMaps();
  const roadMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0.05, map, roughnessMap, normalMap, normalScale: new THREE.Vector2(0.8, 0.8) });
  roadMaterial.onBeforeCompile = (sh) => {
    sh.vertexShader = `attribute vec4 aMark;
varying vec4 vMark;
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vMark = aMark;`);
    sh.fragmentShader = `varying vec4 vMark;
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (vMark.w > 0.0) {
        float lat = vMark.x, al = vMark.y, hwm = vMark.w;
        float aa = fwidth(lat) + 0.01, ab = fwidth(al) + 0.01;
        float cen = 1.0 - smoothstep(0.09 - aa, 0.09 + aa, abs(lat));
        float dash = smoothstep(0.0, ab, mod(al, 9.0)) * (1.0 - smoothstep(3.0 - ab, 3.0, mod(al, 9.0)));
        float endFade = smoothstep(4.0, 5.0, vMark.z);
        float edge = (1.0 - smoothstep(0.07 - aa, 0.07 + aa, abs(abs(lat) - (hwm - 0.55)))) * smoothstep(2.5, 3.5, vMark.z);
        float m = max(cen * dash * endFade, edge);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.8, 0.64), m * 0.92);
      }`);
  };
  // split into 300 m chunks so the GPU can skip whatever is off-screen
  const CH = 300;
  const chunk = <T,>(items: T[], pos: (t: T) => [number, number]) => {
    const m = new Map<string, T[]>();
    for (const it of items) { const [x, z] = pos(it); const k = `${Math.floor(x / CH)},${Math.floor(z / CH)}`; (m.get(k) ?? m.set(k, []).get(k)!).push(it); }
    return [...m.values()];
  };
  for (const part of chunk(data.roads, (r) => [r.pts[Math.floor(r.pts.length / 4) * 2], r.pts[Math.floor(r.pts.length / 4) * 2 + 1]]))
    { const m = new THREE.Mesh(roadGeometry(part), roadMaterial); m.receiveShadow = true; scene.add(m); }
  const centre = (() => { const rb = data.roads.filter((r) => (r as any).rb); let sx = 0, sz = 0, n = 0; for (const r of rb) for (let i = 0; i < r.pts.length; i += 2) { sx += r.pts[i]; sz += r.pts[i + 1]; n++; } return n ? [sx / n, sz / n] : [0, 0]; })();
  data.buildings = data.buildings.filter((b) => { let x = 0, z = 0; const n = b.pts.length / 2; for (let i = 0; i < b.pts.length; i += 2) { x += b.pts[i]; z += b.pts[i + 1]; } return Math.hypot(x / n - centre[0], z / n - centre[1]) > 46; });
  // the hand-built landmarks replace the generic OSM footprints they stand on
  data.buildings = data.buildings.filter((b) => !LANDMARKS.some((l) => { const inside = (x: number, z: number) => Math.abs(x - l.cx) < l.w / 2 + 2 && Math.abs(z - l.cz) < l.d / 2 + 2; let cx = 0, cz = 0; const n = b.pts.length / 2; for (let i = 0; i < b.pts.length; i += 2) { if (inside(b.pts[i], b.pts[i + 1])) return true; cx += b.pts[i]; cz += b.pts[i + 1]; } return inside(cx / n, cz / n); }));
  scene.add(buildLandmarks());
  const buildingSet = buildBuildings(scene, data.buildings, centre as [number, number]);

  for (const bl of data.buildings) addPolygon(bl.pts);
  for (const l of LANDMARKS) { const hx = l.w / 2, hz = l.d / 2; addPolygon([l.cx - hx, l.cz - hz, l.cx + hx, l.cz - hz, l.cx + hx, l.cz + hz, l.cx - hx, l.cz + hz]); }
  const roundabout = new Roundabout(data.roads);
  scene.add(roundabout.group);
  const stupa = buildSulePagoda(Math.max(20, roundabout.radius - 8.5));
  stupa.position.set(roundabout.cx, 0, roundabout.cz);
  scene.add(stupa);
  scene.add(buildSigns(data.roads));
  addCircle(roundabout.cx, roundabout.cz, Math.max(20, roundabout.radius - 8.5) - 1);

  // Start on Sule Pagoda Road, ~120 m from the pagoda, pointing along the road
  const cents = data.buildings.map((b) => [b.pts[0], b.pts[1]]);
  let best: { x: number; z: number; heading: number } | null = null, bestD = Infinity;
  for (const r of data.roads) {
    if (r.w < 9) continue;
    for (let i = 0; i < r.pts.length / 2 - 1; i++) {
      const ax = r.pts[i * 2], az = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], bz = r.pts[i * 2 + 3];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const o = Math.hypot(mx, mz);
      if (o < 80 || o > 300 || Math.hypot(bx - ax, bz - az) < 25) continue;
      let near = 0;
      for (const c of cents) if (Math.abs(c[0] - mx) < 30 && Math.abs(c[1] - mz) < 30) near++;
      const d = -near;
      if (d < bestD) {
        bestD = d;
        // forward is -Z in the car; heading = atan2(-dx, -dz)
        const dx = bx - ax, dz = bz - az;
        best = { x: mx, z: mz, heading: Math.atan2(-dx, -dz) };
      }
    }
  }
  const centres: [number, number][] = await (await fetch(`${import.meta.env.BASE_URL}map/signals.json`)).json();
  const signals = new Signals(centres, data.roads);
  scene.add(signals.group);
  const cpts: [number, number][] = await (await fetch(`${import.meta.env.BASE_URL}map/crossings.json`)).json();
  const crossings = new Crossings(cpts, data.roads);
  scene.add(crossings.group);
  scene.add(buildBusStops(data.roads, [...centres, ...cpts]));
  scene.add(buildStreetscape(data.roads as never, data.buildings, [...centres, ...cpts, [roundabout.cx, roundabout.cz]], centre as [number, number]));
  const phone = matchMedia("(pointer: coarse)").matches;
  const traffic = new Traffic(data.roads, signals, crossings, phone ? 14 : 26, phone ? 3 : 6, phone ? 3 : 6);
  scene.add(traffic.group);
  return { start: best ?? { x: 0, z: 60, heading: 0 }, signals, crossings, traffic, roundabout, roadMaterial, roads: data.roads, buildings: buildingSet, overtake: pickOvertake(data.roads, [...centres, ...cpts, [roundabout.cx, roundabout.cz]]) };
}
