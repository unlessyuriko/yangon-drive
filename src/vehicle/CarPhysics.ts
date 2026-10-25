// Vehicle model: engine torque curve, automatic gearbox, brakes, speed-sensitive steering, grip limit.
// Units: metres, seconds, kg, N.
export interface Controls { throttle: number; brake: number; reverse: boolean; steer: number } // steer -1 (right) .. 1 (left)

const MASS = 1250, R_WHEEL = 0.3, FINAL = 3.9, WHEELBASE = 2.7;
const GEARS = [0, 3.6, 2.2, 1.5, 1.1, 0.85]; // index = gear; 0 unused
const REV_RATIO = 3.4;
const IDLE = 850, REDLINE = 6400;
const MAX_STEER_ANGLE = 0.6; // rad at the wheels, standstill
const MAX_LAT_ACCEL = 7.5;   // m/s^2 before the tyres let go

export class Vehicle {
  speed = 0;        // m/s signed along heading (negative = reverse)
  rpm = IDLE;
  gear = 1;         // 1..5, -1 = reverse, 0 = neutral (standing)
  steerAngle = 0;   // current road-wheel angle (rad), + = left
  yawRate = 0;      // rad/s, + = turning left
  accel = 0;        // longitudinal m/s^2 (for body pitch)
  latAccel = 0;     // lateral m/s^2 (for body roll)
  throttle = 0; brakeIn = 0;
  wet = 0;          // 0 dry .. 1 heavy rain: less grip
  private shiftCooldown = 0;

  private torque(rpm: number): number {
    const x = (rpm - 3800) / 3200;
    return Math.max(25, 125 * (1 - 0.55 * x * x));
  }

  step(dt: number, c: Controls) {
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
      const up = 3600 + this.throttle * 2400, down = 1700;
      if (this.rpm > up && this.gear < 5) { this.gear++; this.shiftCooldown = 0.6; }
      else if (this.rpm < down && this.gear > 1) { this.gear--; this.shiftCooldown = 0.6; }
    }
    const ratio = (this.gear < 0 ? REV_RATIO : GEARS[Math.max(1, this.gear)]) * FINAL;
    const wheelRpm = (Math.abs(v) / R_WHEEL) * (60 / (2 * Math.PI));
    const targetRpm = Math.max(IDLE, wheelRpm * ratio);
    this.rpm += (Math.min(REDLINE, targetRpm + this.throttle * 250) - this.rpm) * Math.min(1, 10 * dt);

    // forces along the driving direction (+ = forward)
    let f = 0;
    const dir = this.gear < 0 ? -1 : 1;
    const drive = this.rpm >= REDLINE - 20 ? 0 : this.throttle * this.torque(this.rpm) * ratio / R_WHEEL;
    f += dir * drive;
    // engine braking off throttle
    if (this.throttle < 0.05 && Math.abs(v) > 2.2) f -= Math.sign(v) * (60 + 0.35 * ratio * 12);
    // drag + rolling resistance
    f -= Math.sign(v) * (0.38 * v * v + 160);
    // brakes (hold the car still at v ~ 0)
    const brakeF = this.brakeIn * 9500 * (1 - 0.32 * this.wet);
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
    const range = MAX_STEER_ANGLE / (1 + Math.abs(this.speed) * 0.09);
    const target = c.steer * range;
    const rate = 1.6 * dt; // rad/s of road-wheel angle
    const d = target - this.steerAngle;
    this.steerAngle += Math.max(-rate, Math.min(rate, d)) * (Math.abs(d) > 0.001 ? 1 : 0);
    if (Math.abs(d) < rate) this.steerAngle = target;

    let yaw = (this.speed / WHEELBASE) * Math.tan(this.steerAngle);
    const limit = (MAX_LAT_ACCEL * (1 - 0.38 * this.wet)) / Math.max(1, Math.abs(this.speed));
    if (Math.abs(yaw) > limit) yaw = Math.sign(yaw) * limit; // understeer: tyres at their limit
    this.yawRate = yaw;
    this.latAccel = yaw * this.speed;
  }
}
