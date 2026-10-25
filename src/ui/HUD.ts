/** DOM HUD readouts: speed, gear, view mode and a row of shift lights driven by engine rpm. */
export class HUD {
  private speed = document.getElementById('speed')!;
  private mode = document.getElementById('mode')!;
  private gear = document.getElementById('gear')!;
  private shift = document.getElementById('shift')!;
  private leds: HTMLElement[] = [];
  private last = -1; private lastLit = -1; private lastGear = '';
  private static readonly LO = 3200; private static readonly HI = 6150;

  constructor() {
    // 10 shift lights: 4 green, 3 amber, 3 red
    for (let i = 0; i < 10; i++) { const e = document.createElement('i'); e.className = i < 4 ? 'g' : i < 7 ? 'a' : 'r'; this.shift.appendChild(e); this.leds.push(e); }
  }

  setSpeed(kmh: number) {
    const v = Math.round(kmh);
    if (v === this.last) return;
    this.last = v;
    this.speed.firstChild!.textContent = `${v} `;
  }

  setMode(text: string) { this.mode.textContent = text; }

  /** rpm in revs/min, gear -1 R, 0 N, 1..5 */
  setRpm(rpm: number, gear: number, t: number) {
    const lit = Math.max(0, Math.min(10, Math.floor(((rpm - HUD.LO) / (HUD.HI - HUD.LO)) * 10)));
    if (lit !== this.lastLit) { this.lastLit = lit; this.leds.forEach((e, i) => e.classList.toggle('on', i < lit)); }
    this.shift.classList.toggle('flash', rpm > HUD.HI + 60 && Math.floor(t * 12) % 2 === 0);
    const g = gear < 0 ? 'R' : gear === 0 ? 'N' : 'D' + gear;
    if (g !== this.lastGear) { this.lastGear = g; this.gear.textContent = g; }
  }
}
