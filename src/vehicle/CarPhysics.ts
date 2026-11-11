// Vehicle model: engine torque curve, automatic gearbox, brakes, speed-sensitive steering, grip limit.
// Units: metres, seconds, kg, N.
export interface Controls { throttle: number; brake: number; reverse: boolean; steer: number } // steer -1 (right) .. 1 (left)

/** everything that makes a vehicle feel like itself: mass, gearing, engine, brakes, steering */
export interface VehicleSpec {
  mass: number; wheelR: number; final: number; wheelbase: number; gears: number[]; revRatio: number;
  idle: number; redline: number; peakTorque: number;
  maxSteer: number; steerRate: number; steerFade: number; maxLat: number;
  brake: number; drag: number; roll: number;
}
export const CAR_SPEC: VehicleSpec = { mass: 1250, wheelR: 0.3, final: 3.9, wheelbase: 2.7, gears: [0, 3.6, 2.2, 1.5, 1.1, 0.85], revRatio: 3.4, idle: 850, redline: 6400, peakTorque: 125, maxSteer: 0.6, steerRate: 1.6, steerFade: 0.09, maxLat: 7.5, brake: 9500, drag: 0.38, roll: 160 };
/** 10.5 m low-floor city bus: heavy, diesel, slow to turn, long brake travel */
export const BUS_SPEC: VehicleSpec = { mass: 11500, wheelR: 0.5, final: 6.4, wheelbase: 6.1, gears: [0, 4.0, 2.4, 1.5, 1.0, 0.76], revRatio: 3.6, idle: 650, redline: 2500, peakTorque: 480, maxSteer: 0.5, steerRate: 0.85, steerFade: 0.05, maxLat: 3.6, brake: 62000, drag: 1.5, roll: 1300 };

export class Vehicle {
  speed = 0;        // m/s signed along heading (negative = reverse)
  rpm = 850;
  gear = 1;         // 1..5, -1 = reverse, 0 = neutral (standing)
  steerAngle = 0;   // current road-wheel angle (rad), + = left
  yawRate = 0;      // rad/s, + = turning left
  accel = 0;        // longitudinal m/s^2 (for body pitch)
  latAccel = 0;     // lateral m/s^2 (for body roll)
  throttle = 0; brakeIn = 0;
  wet = 0;          // 0 dry .. 1 heavy rain: less grip
  private shiftCooldown = 0;
  spec: VehicleSpec = CAR_SPEC;
  setSpec(p: VehicleSpec) { this.spec = p; this.speed = 0; this.rpm = p.idle; this.gear = 1; this.steerAngle = 0; this.throttle = this.brakeIn = 0; }

  private torque(rpm: number): number {
    const p = this.spec, x = (rpm - 0.594 * p.redline) / (0.5 * p.redline);
    return Math.max(0.2 * p.peakTorque, p.peakTorque * (1 - 0.55 * x * x));
  }

  step(dt: number, c: Controls) {
    const p = this.spec, MASS = p.mass, R_WHEEL = p.wheelR, FINAL = p.final, WHEELBASE = p.wheelbase, GEARS = p.gears, REV_RATIO = p.revRatio, IDLE = p.idle, REDLINE = p.redline;
    // pedals are smoothed so keyboard taps feel like feet, not switches
    this.throttle += (c.throttle - this.throttle) * Math.min(1, 7 * dt);
    this.brakeIn += (c.brake - this.brakeIn) * Math.min(1, 9 * dt);

    const v = this.speed;
    const goingBack = c.reverse && v < 0.5;
    if (goingBack) this.gear = -1;
    else if (this.gear < 1) this.gear = 1;

    // automatic gearbox
    this.shiftCooldown -= dt;
    if (this.gear > 0 && this.shiftCooldown <= 0) {
      const up = REDLINE * (0.5625 + 0.375 * this.throttle), down = REDLINE * 0.27;
      if (this.rpm > up && this.gear < 5) { this.gear++; this.shiftCooldown = 0.6; }
      else if (this.rpm < down && this.gear > 1) { this.gear--; this.shiftCooldown = 0.6; }
    }
    const ratio = (this.gear < 0 ? REV_RATIO : GEARS[Math.max(1, this.gear)]) * FINAL;
    const wheelRpm = (Math.abs(v) / R_WHEEL) * (60 / (2 * Math.PI));
    const targetRpm = Math.max(IDLE, wheelRpm * ratio);
    this.rpm += (Math.min(REDLINE, targetRpm + this.throttle * REDLINE * 0.04) - this.rpm) * Math.min(1, 10 * dt);

    // forces along the driving direction (+ = forward)
    let f = 0;
    const dir = this.gear < 0 ? -1 : 1;
    const drive = this.rpm >= REDLINE - 20 ? 0 : this.throttle * this.torque(this.rpm) * ratio / R_WHEEL;
    f += dir * drive;
    // engine braking off throttle
    if (this.throttle < 0.05 && Math.abs(v) > 2.2) f -= Math.sign(v) * (60 + 0.35 * ratio * 12) * (MASS / 1250);
    // drag + rolling resistance
    f -= Math.sign(v) * (p.drag * v * v + p.roll);
    // brakes (hold the car still at v ~ 0)
    const brakeF = this.brakeIn * p.brake * (1 - 0.32 * this.wet);
    const stop = Math.abs(v) < 0.15 && Math.abs(f) < brakeF;
    const coast = this.throttle < 0.05 && Math.abs(v) < 0.25;   // no pedal, nearly stopped: stay put
    if (stop || coast) { this.speed = 0; this.accel = 0; }
    else {
      const total = f - Math.sign(v || 1) * brakeF * (Math.abs(v) < 0.15 ? 0 : 1);
      this.accel = total / MASS;
      const prev = this.speed;
      this.speed += this.accel * dt;
      // brakes must not push the car backwards
      if (this.brakeIn > 0.05 && prev !== 0 && Math.sign(prev) !== Math.sign(this.speed)) this.speed = 0;
    }

    // steering: wheel angle moves at a limited rate, range shrinks with speed
    const range = p.maxSteer / (1 + Math.abs(this.speed) * p.steerFade);
    const target = c.steer * range;
    const rate = p.steerRate * dt; // rad/s of road-wheel angle
    const d = target - this.steerAngle;
    this.steerAngle += Math.max(-rate, Math.min(rate, d)) * (Math.abs(d) > 0.001 ? 1 : 0);
    if (Math.abs(d) < rate) this.steerAngle = target;

    let yaw = (this.speed / WHEELBASE) * Math.tan(this.steerAngle);
    const limit = (p.maxLat * (1 - 0.38 * this.wet)) / Math.max(1, Math.abs(this.speed));
    if (Math.abs(yaw) > limit) yaw = Math.sign(yaw) * limit; // understeer: tyres at their limit
    this.yawRate = yaw;
    this.latAccel = yaw * this.speed;
  }
}
