import * as THREE from 'three';
import { loadCity } from "./city";
import { pushOut } from "./collision";
import { Vehicle } from "./vehicle/CarPhysics";
import { Signals, Approach, lightState } from "./signals";
import { Lesson } from "./lesson";
import { Crossings } from "./crossings";
import { Traffic, Agent } from "./traffic";
import type { OvertakeSite } from "./world/Overtake";
import { Roundabout } from "./roundabout";
import { buildCockpit, EYE } from "./cockpit";
import { buildCarModel, CarModel } from "./vehicle/CarVisuals";
import { loadMugenModel } from "./vehicle/MugenModel";
import { makeCarEnv } from "./reflections";
import { startSound, updateSound, thud, setRainSound } from "./sound";
import { Environment, RainField, Windscreen } from "./environment";
import { Perf } from "./perf";
import { Minimap } from "./ui/Minimap";
import { HUD } from "./ui/HUD";
import { initSettings } from "./ui/Settings";
import { GameRenderer } from "./core/Renderer";
import { Particles } from "./vfx/Particles";

// ---------- Renderer / scene ----------
const phone = matchMedia('(pointer: coarse)').matches;

const scene = new THREE.Scene();
const SKY = 0x9ad1f0;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 80, 360);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.4);
sun.position.set(60, 100, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.25;
scene.add(sun, sun.target);
const SUN_OFFSET = new THREE.Vector3(60, 100, 40);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 600);
const gr = new GameRenderer(scene, camera, phone);
const renderer = gr.gl;
const hud = new HUD();
initSettings();
const particles = new Particles(scene);


const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0xb9c9a0 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------- Car ----------
const car = new THREE.Group();
scene.add(car);
const envDay = makeCarEnv(renderer, false), envNight = makeCarEnv(renderer, true);
scene.environment = envDay; scene.environmentIntensity = 0.55;
let envIsNight = false;
let carModel: CarModel = buildCarModel(envDay);   // procedural stand-in until the Mugen RR model has loaded
car.add(carModel.group);
let odo = 0;
let traffic: Traffic | null = null, roundabout: Roundabout | null = null;
let prevYield: number | undefined, yieldCrossed = false, exitChecked = false, exitReached = false;
let cityBuildings: { setNight(n: number): void } | null = null;
let signals: Signals | null = null, crossings: Crossings | null = null, lesson: Lesson | null = null;
let lessonApp: Approach | null = null, lessonCross: ReturnType<Crossings['pickLesson']> = null;
let crossedFlag = false, freeDrive = false;
// lesson 5 scene: a stopped bus on a straight road and oncoming taxis
let ovSite: OvertakeSite | null = null, ovAgents: { bus: Agent; taxis: Agent[] } | null = null;
let ovT = 0, ovNext = [5, 25], ovLeft = false, ovSignalled = false;
const OV_BUS_S = 78, OV_BUS_HALF = 5.5;
const ovLane = () => ovSite!.w / 4;
function ovClear() { if (ovAgents) { traffic?.releaseScripted(); ovAgents = null; } }
function stepOvertake(dt: number) {
  if (!ovSite || !ovAgents) return;
  const S = ovSite, rx = -S.fz, rz = S.fx;
  ovT += dt;
  const b = ovAgents.bus; b.active = true; b.v = 0; b.h = Math.atan2(S.fx, S.fz);
  const bl = S.w / 2 - 1.6; b.x = S.x + S.fx * OV_BUS_S + rx * bl; b.z = S.z + S.fz * OV_BUS_S + rz * bl;
  ovAgents.taxis.forEach((a, i) => {
    a.h = Math.atan2(-S.fx, -S.fz);
    if (!a.active) { if (ovT > ovNext[i]) { a.active = true; a.v = 9; a.x = S.x + S.fx * (S.len - 8) - rx * ovLane(); a.z = S.z + S.fz * (S.len - 8) - rz * ovLane(); } return; }
    a.v = 9; a.x -= S.fx * 9 * dt; a.z -= S.fz * 9 * dt;
    if ((a.x - S.x) * S.fx + (a.z - S.z) * S.fz < -40) { a.active = false; a.x = a.z = 1e5; ovNext[i] = ovT + 38; }
  });
}
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 14, 8), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, depthWrite: false }));
beam.visible = false; scene.add(beam);
function spawnLesson(id = 1) {
  freeDrive = false; ovClear();
  veh.speed = 0; veh.rpm = 850; veh.gear = 1; veh.steerAngle = 0;
  crossedFlag = false;
  if (crossings) for (const k of crossings.list) { k.active = false; k.mesh.visible = false; }
  env.night = env.rain = id === 4; env.headlights = env.wipers = false; refreshEnv();
  prevYield = undefined; yieldCrossed = false; exitChecked = false; exitReached = false;
  if (id === 5 && ovSite && traffic) {
    const S = ovSite;
    ovAgents = traffic.claimScripted(); ovT = 0; ovNext = [5, 25]; ovLeft = false; ovSignalled = false;
    ovAgents.taxis.forEach((a) => { a.active = false; a.x = a.z = 1e5; });
    car.position.set(S.x + S.fx * 8 - S.fz * ovLane(), 0, S.z + S.fz * 8 + S.fx * ovLane());
    car.rotation.y = Math.atan2(-S.fx, -S.fz);
    beam.position.set(S.x + S.fx * OV_BUS_S - S.fz * (S.w / 2 - 1.6), 9, S.z + S.fz * OV_BUS_S + S.fx * (S.w / 2 - 1.6));
    stepOvertake(0);
  } else if (id === 3 && roundabout?.ok && roundabout.spawn) {
    const a = roundabout.spawn;
    car.position.set(a.x, 0, a.z); car.rotation.y = a.heading;
    beam.position.set(roundabout.yieldLine!.x, 7, roundabout.yieldLine!.z);
  } else if (id === 2 && lessonCross) {
    const a = lessonCross.spawn;
    car.position.set(a.x, 0, a.z); car.rotation.y = a.heading;
    beam.position.set(lessonCross.c.x, 7, lessonCross.c.y);
  } else if (lessonApp) {
    id = id === 4 ? 4 : 1;
    const a = lessonApp.arcStart;
    car.position.set(a.x, 0, a.z); car.rotation.y = a.heading;
    beam.position.set(lessonApp.s.x, 7, lessonApp.s.y);
  } else return;
  beam.visible = true;
  lesson?.reset(id);
}
const minimap = new Minimap();
// one-way carriageway segments (ax, az, bx, bz, half-width) for the wrong-way check; traffic on a one-way road runs from the first point to the last
const owSegs: number[][] = []; let wrongT = 0, wrongCool = 0, wrongNow = false, owCheck = 0;
loadCity(scene).then((c) => {
  minimap.build(c.roads, [{ x: c.roundabout.cx, z: c.roundabout.cz, label: 'Sule Pagoda' }]);
  env.roadMat = c.roadMaterial; env.buildLamps(c.roads);
  for (const r of c.roads) if (r.ow) for (let i = 0; i < r.pts.length / 2 - 1; i++) owSegs.push([r.pts[i * 2], r.pts[i * 2 + 1], r.pts[i * 2 + 2], r.pts[i * 2 + 3], r.w / 2]);
  ovSite = c.overtake; cityBuildings = c.buildings; signals = c.signals; crossings = c.crossings; traffic = c.traffic; roundabout = c.roundabout;
  lessonApp = signals.pickLessonApproach();
  lessonCross = crossings.pickLesson();
  lesson = new Lesson(spawnLesson, () => { beam.visible = false; freeDrive = true; ovClear(); });
  if (lessonApp) spawnLesson(1); else { car.position.set(c.start.x, 0, c.start.z); car.rotation.y = c.start.heading; }
});

let mugenLoaded = false;
const shell = [carModel.group];
loadMugenModel(envIsNight ? envNight : envDay).then((m) => {
  car.remove(carModel.group); car.add(m.group); shell[0] = m.group; carModel = m; mugenLoaded = true;
  // the model's own interior replaces the drawn cockpit: it stays visible in first person, only the live gauges and the rear-view mirror are added to it
  const parts = cockpit.adopt({ gauge: { pos: new THREE.Vector3(0.38, 0.93, -0.6), rotX: -0.8, size: 0.2 }, mirror: { pos: new THREE.Vector3(0, 1.22, -0.455), rot: new THREE.Euler(0.1, 0, 0), w: 0.2, h: 0.06 } });
  (window as unknown as { __cp: unknown }).__cp = parts;
  m.group.visible = true;
}).catch((e) => console.warn('Mugen RR model not loaded, keeping the procedural car', e));
const cockpit = buildCockpit();
car.add(cockpit.group);
const veh = new Vehicle();
const env = new Environment(scene, hemi, sun, car);
const rainField = new RainField(scene, matchMedia('(pointer: coarse)').matches ? 700 : 1400);
const windscreen = new Windscreen();
let noLightsCool = 0;
const $e = (id: string) => document.getElementById(id)!;
function refreshEnv() {
  $e('bNight').classList.toggle('on', env.night); $e('bRain').classList.toggle('on', env.rain);
  $e('bLights').classList.toggle('on', env.headlights); $e('bWipers').classList.toggle('on', env.wipers);
  $e('env').textContent = [env.night ? '🌙 Night' : '', env.rain ? '🌧 Rain' : '', env.headlights ? '💡 Lights' : '', env.wipers ? '🧹 Wipers' : ''].filter(Boolean).join(' · ');
}
const tog = (k: 'night' | 'rain' | 'headlights' | 'wipers') => { env[k] = !env[k]; refreshEnv(); };
$e('bNight').addEventListener('pointerdown', (e) => { e.stopPropagation(); tog('night'); });
$e('bRain').addEventListener('pointerdown', (e) => { e.stopPropagation(); tog('rain'); });
$e('bLights').addEventListener('pointerdown', (e) => { e.stopPropagation(); tog('headlights'); });
$e('bWipers').addEventListener('pointerdown', (e) => { e.stopPropagation(); tog('wipers'); });

// ---------- Input ----------
const keys = new Set<string>();
let steerTouch = 0, gasTouch = false, brakeTouch = false;
let view: 'first' | 'third' = 'first';
let indL = false, indR = false;
let dragYaw = 0, dragPitch = 0, dragging = false;

addEventListener('keydown', (e) => {
  startSound();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyC') toggleView();
  if (e.code === 'KeyN') tog('night');
  if (e.code === 'KeyR') tog('rain');
  if (e.code === 'KeyH') tog('headlights');
  if (e.code === 'KeyV') tog('wipers');
  if (e.code === 'KeyZ') { indL = !indL; indR = false; }
  if (e.code === 'KeyX') { indR = !indR; indL = false; }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) keys.clear(); });
addEventListener('pointerdown', () => startSound());

function toggleView() {
  view = view === 'first' ? 'third' : 'first';
  cockpit.group.visible = view === 'first';
  shell.forEach((m) => (m.visible = view === 'third' || mugenLoaded));
  hud.setMode(view === 'first' ? 'First person' : 'Third person');
}
toggleView(); toggleView();

if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
const $ = (id: string) => document.getElementById(id)!;
const hold = (el: HTMLElement, on: (v: boolean) => void) => {
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); on(true); });
  const off = () => on(false);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
};
hold($('gas'), (v) => (gasTouch = v));
hold($('brake'), (v) => (brakeTouch = v));
$('cam').addEventListener('pointerdown', toggleView);
$('indL').addEventListener('pointerdown', () => { indL = !indL; indR = false; });
$('indR').addEventListener('pointerdown', () => { indR = !indR; indL = false; });

{
  const zone = $('wheelzone'), knob = $('knob');
  const move = (e: PointerEvent) => {
    const r = zone.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * 2 - 1;
    steerTouch = Math.max(-1, Math.min(1, t * 1.25));
    knob.style.left = `${75 + steerTouch * 60}px`;
  };
  zone.addEventListener('pointerdown', (e) => { zone.setPointerCapture(e.pointerId); move(e); });
  zone.addEventListener('pointermove', (e) => { if (zone.hasPointerCapture(e.pointerId)) move(e); });
  const end = () => { steerTouch = 0; knob.style.left = '75px'; };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}

// drag on the view to look around (springs back on release)
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  dragYaw = Math.max(-2.2, Math.min(2.2, dragYaw + e.movementX * 0.006));
  dragPitch = Math.max(-0.5, Math.min(0.5, dragPitch + e.movementY * 0.004));
});
const endDrag = () => (dragging = false);
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);

// ---------- Driving ----------
let steerKey = 0; // keyboard steering wheel position, eased like hands on a wheel
let smokeT = 0;
function step(dt: number) {
  const k = (c: string) => keys.has(c);
  const gas = k('KeyW') || k('ArrowUp') || gasTouch;
  const back = k('KeyS') || k('ArrowDown');
  const brake = k('Space') || brakeTouch;
  const steerIn = (k('KeyA') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0);
  steerKey += (steerIn - steerKey) * Math.min(1, (steerIn === 0 ? 4 : 2.5) * dt);
  const steer = Math.max(-1, Math.min(1, steerKey + steerTouch));

  const reverse = back && veh.speed < 0.5;
  veh.step(dt, {
    throttle: gas || reverse ? 1 : 0,
    brake: brake || (back && !reverse) ? 1 : 0,
    reverse,
    steer,
  });

  car.rotation.y += veh.yawRate * dt;
  car.translateZ(-veh.speed * dt);
  odo += veh.speed * dt;
  // collisions: two circles along the car body
  let hit = false, hx = 0, hz = 0, hnx = 0, hnz = 0;
  for (const lz of [-1.3, 1.3]) {
    const p = car.localToWorld(new THREE.Vector3(0, 0, lz));
    const [dx, dz] = pushOut(p.x, p.z, 1.0);
    if (dx || dz) { car.position.x += dx; car.position.z += dz; hit = true; const l = Math.hypot(dx, dz) || 1; hx = p.x - dx / l; hz = p.z - dz / l; hnx = dx / l; hnz = dz / l; }
    if (traffic) {
      const q = car.localToWorld(new THREE.Vector3(0, 0, lz));
      const [tx, tz] = traffic.pushPlayer(q.x, q.z, 1.0);
      if (tx || tz) { car.position.x += tx; car.position.z += tz; hit = true; }
    }
  }
  if (lesson?.id === 5 && !freeDrive) stepOvertake(dt);
  traffic?.update(dt, clock, car.position.x, car.position.z, car.rotation.y, veh.speed);
  // tyre smoke: hard braking from speed, or sliding sideways
  smokeT -= dt;
  if (smokeT <= 0 && ((veh.brakeIn > 0.75 && Math.abs(veh.speed) > 14) || (Math.abs(veh.latAccel) > 7 && Math.abs(veh.speed) > 8))) {
    smokeT = 0.05;
    for (const sx of [-0.83, 0.83]) { const w = car.localToWorld(new THREE.Vector3(sx, 0.12, 1.35)); particles.emitSmoke(w.x, w.y, w.z, -Math.sin(car.rotation.y) * veh.speed, -Math.cos(car.rotation.y) * veh.speed); }
  }
  let crash = false;
  if (hit) {
    if (Math.abs(veh.speed) > 3) { thud(Math.min(1, Math.abs(veh.speed) / 15)); crash = true; if (hnx || hnz) particles.emitSparks(hx, 0.6, hz, hnx, hnz, Math.min(10, 3 + Math.abs(veh.speed) * 0.4)); }
    smokeT = 0;
    veh.speed *= Math.exp(-8 * dt);
  }

  // traffic rules
  let redRun = false, giveWay = false, hitPed = false;
  const front = car.localToWorld(new THREE.Vector3(0, 0, -2.1));
  if (signals) {
    for (const e of signals.check(front.x, front.z, clock, veh.speed > 0.5)) {
      if (e.state === 'red') redRun = true;
      if (e.approach === lessonApp) crossedFlag = true;
    }
  }
  const lid = lesson?.id ?? 1;
  if (crossings) {
    if (lesson && !lesson.finished && !freeDrive && lid === 2 && lessonCross) {
      const dd = (lessonCross.c.x - front.x) * lessonCross.dir.x + (lessonCross.c.y - front.z) * lessonCross.dir.y;
      if (dd < 40 && dd > 0) crossings.forceScripted();
    }
    const ev = crossings.update(dt, front.x, front.z, veh.speed);
    giveWay = ev.giveWay; hitPed = ev.hit;
  }
  let giveWayRound = false, noExitSignal = false, rbDist = 0;
  if (roundabout?.ok && lesson && !freeDrive && lesson.id === 3 && !lesson.finished) {
    const y = roundabout.yieldLine!;
    const d = (y.x - front.x) * y.fx + (y.z - front.z) * y.fz;
    const lat = (front.x - y.x) * y.rx + (front.z - y.z) * y.rz;
    rbDist = d;
    if (prevYield !== undefined && prevYield > 0 && d <= 0 && Math.abs(lat) < y.half + 3 && veh.speed > 0.3) {
      yieldCrossed = true;
      const e = roundabout.entry!;
      if (traffic && traffic.agents.some((a) => a.active && a.v > 1 && Math.hypot(a.x - e.jx, a.z - e.jz) < 30 &&
          Math.abs(Math.hypot(a.x - roundabout!.cx, a.z - roundabout!.cz) - roundabout!.radius) < 14)) giveWayRound = true;
    }
    prevYield = d;
    const xj = roundabout.exitJunction!, xt = roundabout.exitTarget!;
    if (yieldCrossed && !exitChecked && Math.hypot(front.x - xj.x, front.z - xj.z) < 22) { exitChecked = true; if (!indR) noExitSignal = true; }
    if (yieldCrossed && Math.hypot(front.x - xt.x, front.z - xt.z) < 14) exitReached = true;
    // marker: give-way line first, then the exit
    const tgt = yieldCrossed ? xt : y;
    beam.position.set(tgt.x, 7, (tgt as { z: number }).z);
    if (yieldCrossed) rbDist = Math.hypot(front.x - xt.x, front.z - xt.z);
  }
  // driving against a one-way road: car on a one-way segment, heading the opposite way, moving, for 2 s
  owCheck -= dt;
  if (owCheck <= 0) {
    owCheck = 0.2; let against = false;
    const fx = -Math.sin(car.rotation.y), fz = -Math.cos(car.rotation.y);
    if (veh.speed > 2.5) for (const g of owSegs) {
      const ex = g[2] - g[0], ez = g[3] - g[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((car.position.x - g[0]) * ex + (car.position.z - g[1]) * ez) / L2));
      if (Math.hypot(g[0] + ex * t - car.position.x, g[1] + ez * t - car.position.z) < g[4] - 0.3 && (fx * ex + fz * ez) / Math.sqrt(L2) < -0.6) { against = true; break; }
    }
    wrongT = against ? wrongT + 0.2 : 0;
  }
  wrongCool -= dt; wrongNow = false;
  if (wrongT > 2 && wrongCool <= 0) { wrongNow = true; wrongCool = 12; }
  noLightsCool -= dt;
  let noLightsNow = false;
  if (lesson?.id === 4 && env.nightT > 0.7 && !env.headlights && lesson.step >= 1 && Math.abs(veh.speed) > 2 && noLightsCool <= 0) { noLightsNow = true; noLightsCool = 10; }
  const ov = { st: { busDist: 99, oncoming: 999, passedBus: false, backInLane: false }, unsafe: false, noSig: false };
  if (lid === 5 && ovSite && ovAgents && lesson && !freeDrive && !lesson.finished) {
    const S = ovSite, rx = -S.fz, rz = S.fx;
    const s = (front.x - S.x) * S.fx + (front.z - S.z) * S.fz, lat = (front.x - S.x) * rx + (front.z - S.z) * rz;
    const rear = OV_BUS_S - OV_BUS_HALF, off = lat < ovLane() - 1.3;
    let near = 999;
    for (const a of ovAgents.taxis) if (a.active) { const as = (a.x - S.x) * S.fx + (a.z - S.z) * S.fz; if (as > s - 6) near = Math.min(near, as - s); }
    ov.st = { busDist: rear - s, oncoming: near, passedBus: s > OV_BUS_S + OV_BUS_HALF + 5, backInLane: Math.abs(lat - ovLane()) < 1.3 };
    if (off && !ovLeft && s < OV_BUS_S + OV_BUS_HALF) {
      ovLeft = true;
      if (near < 60 && near > -6) ov.unsafe = true;
      if (!indL) ov.noSig = true;
    }
    if (!off && s > OV_BUS_S + 20) ovLeft = false;
    beam.visible = !ov.st.passedBus;
  }
  if (lesson && signals && !freeDrive) {
    let dist = 0, light: 'red' | 'yellow' | 'green' = 'green', passed = false, ped = false;
    if (lid === 3) { dist = rbDist; }
    else if ((lid === 1 || lid === 4) && lessonApp) {
      dist = (lessonApp.s.x - front.x) * lessonApp.f.x + (lessonApp.s.y - front.z) * lessonApp.f.y;
      light = lightState(lessonApp.cluster, lessonApp.phase, clock);
    } else if (lid === 2 && lessonCross && crossings) {
      dist = (lessonCross.c.x - front.x) * lessonCross.dir.x + (lessonCross.c.y - front.z) * lessonCross.dir.y;
      ped = crossings.pedOnRoad(lessonCross);
      passed = dist < -3 && !ped;
    }
    lesson.update({ kmh: Math.abs(veh.speed) * 3.6, speed: veh.speed, t: clock, dt, indicator: indL || indR, distToLine: dist, lightAhead: light, crossedLegally: crossedFlag, stoppedAtRed: false, pedOnRoad: ped, passedCrossing: passed, crossedYield: yieldCrossed, reachedExit: exitReached, lightsOn: env.headlights, wipersOn: env.wipers, limit: lid === 4 ? 30 : 40, ...ov.st },
      { redRun, crash, giveWay, hitPed, giveWayRound, noExitSignal, noLights: noLightsNow, unsafePass: ov.unsafe, noPassSignal: ov.noSig, wrongWay: wrongNow });
    if (lesson.finished) beam.visible = false;
  }
}

// ---------- Camera ----------
const tmp = new THREE.Vector3();
let pitchS = 0, rollS = 0, bob = 0, lookS = 0;
const arm = new THREE.Vector3(0, 1.9, 7.6);
let camFov = 55;
// debug orbit camera around the car: __game.orbit(azimuthDeg, elevationDeg, distance); __game.orbit(null) to release
let orbitCam: { az: number; el: number; d: number } | null = null;
// debug cabin camera (car-local position and target): __game.cabin([x,y,z],[x,y,z],fov); __game.cabin(null) to release
let cabinCam: { p: THREE.Vector3; t: THREE.Vector3; fov: number } | null = null;
function updateCamera(dt: number) {
  if (cabinCam) {
    camera.position.copy(car.localToWorld(tmp.copy(cabinCam.p)));
    camera.lookAt(car.localToWorld(new THREE.Vector3().copy(cabinCam.t)));
    camera.fov = cabinCam.fov; camera.updateProjectionMatrix(); return;
  }
  if (orbitCam) {
    const a = car.rotation.y + (orbitCam.az * Math.PI) / 180, e = (orbitCam.el * Math.PI) / 180;
    camera.position.set(car.position.x - Math.sin(a) * Math.cos(e) * orbitCam.d, 0.7 + Math.sin(e) * orbitCam.d, car.position.z - Math.cos(a) * Math.cos(e) * orbitCam.d);
    camera.lookAt(car.position.x, 0.75, car.position.z); carModel.group.visible = true; return;
  }
  const look = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
  if (!dragging) { dragYaw *= Math.exp(-6 * dt); dragPitch *= Math.exp(-6 * dt); }
  lookS += (look * 1.5 + dragYaw - lookS) * Math.min(1, 10 * dt);

  if (view === 'first') {
    // nose dips when braking, squats when accelerating, leans in corners, road shake
    pitchS += (-veh.accel * 0.006 - pitchS) * Math.min(1, 5 * dt);
    rollS += (veh.latAccel * 0.0035 - rollS) * Math.min(1, 5 * dt);
    bob += dt * Math.abs(veh.speed) * 1.6;
    const shake = Math.min(1, Math.abs(veh.speed) / 15) * 0.0025;
    const sh = Math.sin(bob * 3.1) * shake + Math.sin(bob * 7.3) * shake * 0.5;
    camera.position.copy(car.localToWorld(tmp.copy(EYE)));
    camera.position.y += sh;
    camera.rotation.set(-0.04 + pitchS + dragPitch + sh * 2, car.rotation.y + lookS, rollS, 'YXZ');
    camera.fov = 78;
  } else {
    // spring-arm chase camera: the arm (in car space) lags on acceleration and swings outward in corners / slides
    const sp = Math.abs(veh.speed), s01 = Math.min(1, sp / 38);
    const swing = Math.max(-2.6, Math.min(2.6, veh.yawRate * sp * 0.1));
    const back = 7.4 + Math.max(-1.2, Math.min(2.0, -veh.accel * 0.22)) + s01 * 1.2;
    arm.lerp(tmp.set(swing, 1.9 + s01 * 0.35, back), 1 - Math.exp(-4.5 * dt));
    camera.position.copy(car.localToWorld(tmp.copy(arm)));
    camera.lookAt(car.localToWorld(tmp.set(arm.x * -0.35, 1.0, -4)));
    camFov += ((55 + 23 * s01) - camFov) * (1 - Math.exp(-3 * dt));
    camera.fov = camFov;
  }
  camera.updateProjectionMatrix();
}

// ---------- Loop ----------
let last = performance.now(), clock = 0;
// ---------- Performance: adaptive quality ----------
const perf = new Perf(renderer);
renderer.info.autoReset = false;
const forced = /[?&]q=(\d)/.exec(location.search);
let quality = forced ? Number(forced[1]) : phone ? 1 : 0; // 0 best .. 3 lowest
const BASE_DPR = Math.min(window.devicePixelRatio, 1.5);
const DPR_STEP = [1, 0.8, 0.62, 0.5];
function applyQuality() {
  gr.setPixelRatio(Math.max(0.5, BASE_DPR * DPR_STEP[quality]));
  gr.setSize(innerWidth, innerHeight);
  gr.fx = quality === 0 || (!phone && quality === 1);   // bloom / aberration / vignette
  shadowsOn = gr.fx;
  useMirror = quality === 0 || (!phone && quality === 1);
  rainField.setDensity(quality >= 2 ? 0.5 : 1);
}
let useMirror = true, shadowsOn = true;
perf.onSlow = () => { if (!forced && quality < 3) { quality++; applyQuality(); } };
perf.onFast = () => { if (!forced && quality > (phone ? 1 : 0)) { quality--; applyQuality(); } };
applyQuality();

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  perf.frame(now - last);
  last = now; clock += dt;
  renderer.info.reset();
  perf.time('step', () => step(dt));
  perf.time('misc', () => {
    signals?.update(clock);
    updateCamera(dt);
    cockpit.update({ kmh: Math.abs(veh.speed) * 3.6, rpm: veh.rpm, gear: veh.gear, steerAngle: veh.steerAngle, indicatorL: indL, indicatorR: indR, t: clock, night: env.nightT });
    minimap.update(car.position.x, car.position.z, car.rotation.y, traffic?.agents, beam.visible ? beam.position : null);
    env.update(dt);
    particles.update(dt);
    const nightEnv = env.nightT > 0.5;
    if (nightEnv !== envIsNight) { envIsNight = nightEnv; scene.environment = nightEnv ? envNight : envDay; carModel.setEnv(nightEnv ? envNight : envDay); }
    scene.environmentIntensity = 0.55 + 0.45 * env.nightT;
    sun.castShadow = shadowsOn && env.nightT < 0.7;
    sun.target.position.copy(car.position); sun.position.copy(car.position).add(SUN_OFFSET);
    carModel.update({ dist: odo, steerAngle: veh.steerAngle, braking: veh.brakeIn > 0.2, headlights: env.headlights, night: env.nightT });
    veh.wet = env.wet;
    traffic?.setNight(env.nightT > 0.4);
    cityBuildings?.setNight(env.nightT);
    setRainSound(env.rainT);
    updateSound(veh.rpm, veh.throttle, veh.speed);
    hud.setSpeed(Math.abs(veh.speed) * 3.6);
    hud.setRpm(veh.rpm, veh.gear, clock);
  });
  perf.time('rain', () => {
    rainField.update(dt, camera.position, env.rainT);
    windscreen.update(dt, view === 'first', env.rainT, env.wipers, Math.abs(veh.speed));
  });
  if (view === 'first' && useMirror) perf.time('mirror', () => { if (mugenLoaded) shell[0].visible = false; cockpit.renderMirror(renderer, scene, car); if (mugenLoaded) shell[0].visible = true; });
  perf.time('render', () => gr.render(dt, scene, camera, Math.min(1, Math.abs(veh.speed) / 38), veh.brakeIn > 0.7 ? Math.min(1, Math.abs(veh.speed) / 25) : 0));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  gr.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// Debug handle for testing
(window as any).__game = { get crossings() { return crossings; }, gr, scene, car, camera, veh, spawnLesson, get rb() { return roundabout; }, env, perf, setQuality(q: number) { quality = q; applyQuality(); }, get traffic() { return traffic; }, cabin: (p: number[] | null, t: number[] = [0, 0.8, -0.5], fov = 75) => { cabinCam = p ? { p: new THREE.Vector3(...p), t: new THREE.Vector3(...t), fov } : null; }, orbit: (az: number | null, el = 10, d = 5) => { orbitCam = az === null ? null : { az, el, d }; }, setView: (v: 'first' | 'third') => { if (view !== v) toggleView(); } };

// Offline support (production builds only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
