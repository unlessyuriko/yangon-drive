// Usage: node tools/convert-car.mjs "<car>.obj" "<car>.mtl" public/models/civic-mugen.glb
// Needs (install outside the game: npm i @gltf-transform/core meshoptimizer). Mirrors X to right-hand drive, centres at mid-wheelbase, decimates to about 70k triangles.
import fs from 'fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';

const [, , objPath, mtlPath, outPath] = process.argv;
await MeshoptSimplifier.ready;

// ---- materials ----
const mats = {};
{ let cur = null; for (const l of fs.readFileSync(mtlPath, 'utf8').split('\n')) { const p = l.trim().split(/\s+/); if (p[0] === 'newmtl') cur = mats[l.trim().slice(7)] = { kd: [0.5, 0.5, 0.5], d: 1 }; else if (p[0] === 'Kd' && cur) cur.kd = p.slice(1, 4).map(Number); else if (p[0] === 'd' && cur) cur.d = Number(p[1]); } }

// ---- parse OBJ: one primitive per (group, material); mirror X so the driver sits on the right; centre on the mid-wheelbase, ground = 0 ----
const OX = 1.0225, OY = 0.04, OZ = -2.2875;
const V = [], N = [];
const prims = new Map(); // key group|mat -> {group, mat, pos:[], nor:[], idx:[], map: Map}
let grp = 'root', mat = '';
for (const l of fs.readFileSync(objPath, 'utf8').split('\n')) {
  if (l.startsWith('v ')) { const p = l.split(/\s+/); V.push([-(+p[1] - OX), +p[2] + OY, +p[3] - OZ]); }
  else if (l.startsWith('vn ')) { const p = l.split(/\s+/); N.push([-+p[1], +p[2], +p[3]]); }
  else if (l.startsWith('g ') || l.startsWith('o ')) grp = l.slice(2).trim();
  else if (l.startsWith('usemtl')) mat = l.slice(7).trim();
  else if (l.startsWith('f ')) {
    const key = grp + '|' + mat;
    let P = prims.get(key); if (!P) prims.set(key, P = { grp, mat, pos: [], nor: [], idx: [], map: new Map() });
    const f = l.trim().split(/\s+/).slice(1).map((t) => { const [a, , c] = t.split('/'); const vi = +a - 1, ni = c ? +c - 1 : -1; const k = vi + '/' + ni; let id = P.map.get(k); if (id === undefined) { id = P.pos.length / 3; P.map.set(k, id); P.pos.push(...V[vi]); P.nor.push(...(ni >= 0 ? N[ni] : [0, 1, 0])); } return id; });
    for (let i = 1; i < f.length - 1; i++) P.idx.push(f[0], f[i + 1], f[i]);       // reversed winding because X is mirrored
  }
}

// ---- simplify ----
const skip = (g) => /honda_engi/.test(g);
const ratioFor = (P) => {
  const m = P.mat, g = P.grp;
  if (/civic_wheel/.test(g)) return 0.55;
  if (/default#1/.test(g)) return 0.4;
  if (/glass/.test(m)) return 0.3;
  if (/carpaint/.test(m)) return 0.45;
  if (/inerior|interior|plastic|Carpet|MATT/.test(m)) return 0.3;
  return 0.3;
};
const doc = new Document(); const buf = doc.createBuffer(); const scene = doc.createScene('car');
const gm = new Map(); const nodes = new Map();
let tris0 = 0, tris1 = 0;
for (const P of prims.values()) {
  if (skip(P.grp)) continue;
  tris0 += P.idx.length / 3;
  let idx = new Uint32Array(P.idx), pos = new Float32Array(P.pos), nor = new Float32Array(P.nor);
  const target = Math.max(12, Math.floor((idx.length * ratioFor(P)) / 3) * 3);
  if (idx.length > 90) { const [s] = MeshoptSimplifier.simplify(idx, pos, 3, target, 0.02, []); idx = s; }
  // compact vertices
  const remap = new Map(), pp = [], nn = [], ii = [];
  for (const i of idx) { let r = remap.get(i); if (r === undefined) { r = pp.length / 3; remap.set(i, r); pp.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); nn.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); } ii.push(r); }
  if (!ii.length) continue;
  tris1 += ii.length / 3;
  let M = gm.get(P.mat); if (!M) { const d = mats[P.mat] ?? { kd: [0.5, 0.5, 0.5], d: 1 }; M = doc.createMaterial(P.mat || 'default').setBaseColorFactor([...d.kd, d.d]).setMetallicFactor(0).setRoughnessFactor(0.6).setDoubleSided(true); if (d.d < 1 || /glass/.test(P.mat)) M.setAlphaMode('BLEND'); gm.set(P.mat, M); }
  const prim = doc.createPrimitive().setMaterial(M)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pp)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nn)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ii)).setBuffer(buf));
  let nd = nodes.get(P.grp);
  if (!nd) { const mesh = doc.createMesh(P.grp); nd = { mesh, node: doc.createNode(P.grp).setMesh(mesh) }; nodes.set(P.grp, nd); scene.addChild(nd.node); }
  nd.mesh.addPrimitive(prim);
}
fs.writeFileSync(outPath, await new NodeIO().writeBinary(doc));
console.log('triangles', tris0, '->', tris1, 'groups', nodes.size, 'file MB', (fs.statSync(outPath).size / 1048576).toFixed(2));
