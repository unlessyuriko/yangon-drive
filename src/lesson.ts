// Lessons with a bilingual on-screen instructor and a score.
export interface DriveState {
  kmh: number; speed: number; t: number; dt: number; indicator: boolean;
  distToLine: number;       // metres to the lesson target line (positive = still before it)
  lightAhead: 'red' | 'yellow' | 'green';
  crossedLegally: boolean;  // crossed the lesson line (lesson 1)
  stoppedAtRed: boolean;
  pedOnRoad: boolean;       // lesson 2: a pedestrian is on the carriageway
  passedCrossing: boolean;  // lesson 2: car front is past the crossing
  crossedYield: boolean;    // lesson 3: crossed the give-way line
  reachedExit: boolean;     // lesson 3: reached the target exit arm
  lightsOn: boolean; wipersOn: boolean; limit: number;
  busDist: number;          // lesson 5: metres from the car front to the tail of the stopped bus
  oncoming: number;         // lesson 5: metres to the nearest oncoming vehicle ahead (999 = none)
  passedBus: boolean; backInLane: boolean;
}

interface Step { en: string; my: string; done(s: DriveState, ctx: Ctx): boolean }
interface Ctx { hold: number }

export const SPEED_LIMIT = 40;

import { tr, onLang } from './ui/Settings';

const LESSONS: { title: { en: string; my: string }; steps: Step[] }[] = [
  {
    title: { en: 'Basics and traffic lights', my: 'အခြေခံနှင့် မီးပွိုင့်' },
    steps: [
      { en: 'Press Drive (W) gently and pull away. Reach 20 km/h.', my: 'Drive (W) ကို ဖြည်းဖြည်းနှင်းပြီး ကားကို စတင်မောင်းပါ။ ၂၀ km/h အထိ မြှင့်ပါ။', done: (s) => s.kmh >= 20 },
      { en: 'Hold 20–40 km/h for 6 seconds. Stay under the limit.', my: '၂၀–၄၀ km/h ကြား ၆ စက္ကန့် ထိန်းမောင်းပါ။ အမြန်နှုန်းကန့်သတ်ချက်ကို မကျော်ပါနှင့်။', done: (s, c) => (s.kmh >= 20 && s.kmh <= SPEED_LIMIT ? (c.hold += s.dt) : (c.hold = 0), c.hold >= 6) },
      { en: 'Switch on an indicator: Z for left, X for right.', my: 'မီးပြ ဖွင့်ပါ — ဘယ်ဘက် Z၊ ညာဘက် X။', done: (s) => s.indicator },
      { en: 'Drive on to the traffic lights ahead. Obey the light, and stop behind the white line if it is red.', my: 'ရှေ့က မီးပွိုင့်သို့ ဆက်မောင်းပါ။ မီးနီဆိုလျှင် အဖြူရောင်မျဉ်းအနောက်တွင် ရပ်ပါ။', done: (s) => s.crossedLegally },
    ],
  },
  {
    title: { en: 'Zebra crossings', my: 'မြင်းကျားကူး' },
    steps: [
      { en: 'Drive towards the zebra crossing ahead (yellow marker). Slow below 30 km/h as you get close.', my: 'ရှေ့က မြင်းကျားကူးကို (အဝါရောင် အမှတ်အသား) ဆီ မောင်းပါ။ နီးလာလျှင် ၃၀ km/h အောက် နှေးပါ။', done: (s) => s.distToLine < 45 && s.kmh < 30 },
      { en: 'A pedestrian is crossing! Stop before the crossing and give way.', my: 'ပြည်သူ လမ်းဖြတ်ကူးနေသည်! မြင်းကျားကူးမတိုင်မီ ရပ်ပြီး ဦးစားပေးပါ။', done: (s) => s.passedCrossing || (s.pedOnRoad && s.kmh < 1 && s.distToLine > 1 && s.distToLine < 25) },
      { en: 'Wait until the pedestrian has fully crossed, then drive on over the crossing.', my: 'လမ်းဖြတ်ကူးသူ ကူးပြီးသည်အထိ စောင့်ပါ။ ပြီးမှ ဆက်မောင်းပါ။', done: (s) => s.passedCrossing },
    ],
  },
  {
    title: { en: 'Sule roundabout', my: 'ဆူးလေ ရပ်ဝိုင်း' },
    steps: [
      { en: 'Drive to the Sule roundabout. Slow below 25 km/h as you reach the white give-way line.', my: 'ဆူးလေအဝိုင်းသို့ မောင်းပါ။ အဖြူရောင် ဦးစားပေးမျဉ်းသို့ ရောက်လျှင် ၂၅ km/h အောက် နှေးပါ။', done: (s) => s.distToLine < 25 && s.kmh < 25 },
      { en: 'Give way to vehicles already on the roundabout (they come from your left). Enter only when it is clear.', my: 'အဝိုင်းထဲရှိ ယာဉ်များ (ဘယ်ဘက်မှလာသည်) ကို ဦးစားပေးပါ။ လမ်းလွတ်မှသာ ဝင်ပါ။', done: (s) => s.crossedYield },
      { en: 'Keep to the right around the island (anticlockwise). Take the 2nd exit and signal right (X) before you leave.', my: 'ကျွန်းပတ်လည်ကို ညာဘက်ကပ်၍ (နာရီလက်တံ ပြောင်းပြန်) မောင်းပါ။ ဒုတိယထွက်ပေါက်မှ ထွက်ပါ၊ မထွက်မီ ညာမီးပြ (X) ဖွင့်ပါ။', done: (s) => s.reachedExit },
    ],
  },
  {
    title: { en: 'Night and rain', my: 'ညနှင့် မိုး' },
    steps: [
      { en: 'It is dark and raining. Turn on your headlights (H).', my: 'မှောင်ပြီး မိုးရွာနေသည်။ ရှေ့မီး (H) ဖွင့်ပါ။', done: (s) => s.lightsOn },
      { en: 'Turn on the wipers (V).', my: 'မိုးရေသုတ်တံ (V) ဖွင့်ပါ။', done: (s) => s.wipersOn },
      { en: 'Drive on to the traffic lights. Stay under 30 km/h and brake early, the road is slippery. Stop at the line if it is red.', my: 'မီးပွိုင့်သို့ ဆက်မောင်းပါ။ ၃၀ km/h အောက်ထားပြီး စောစောဘရိတ်အုပ်ပါ၊ လမ်းချော်သည်။ မီးနီဆိုလျှင် မျဉ်းအနောက်တွင် ရပ်ပါ။', done: (s) => s.crossedLegally },
    ],
  },
  {
    title: { en: 'Overtaking a stopped bus', my: 'ရပ်ထားသော ဘတ်စ်ကားကို ကျော်တက်ခြင်း' },
    steps: [
      { en: 'A YBS bus is stopped ahead. Ease off and slow below 20 km/h as you come up behind it.', my: 'ရှေ့တွင် YBS ဘတ်စ်ကား ရပ်နေသည်။ နောက်မှ ချဉ်းကပ်လာလျှင် ၂၀ km/h အောက် နှေးပါ။', done: (s) => s.busDist < 30 && s.busDist > 2 && s.kmh < 20 },
      { en: 'Look for oncoming traffic (Q / E). You will pull out to the LEFT, so signal left (Z).', my: 'ဆန့်ကျင်ဘက်မှ လာသော ယာဉ်ကို ကြည့်ပါ (Q / E)။ ဘယ်ဘက်သို့ ထွက်ကျော်ရမည် — ဘယ်မီးပြ (Z) ဖွင့်ပါ။', done: (s) => s.indicator },
      { en: 'Pull out only when the oncoming lane is clear, pass the bus with a wide gap, then keep going.', my: 'ဆန့်ကျင်ဘက်လမ်း လွတ်မှသာ ထွက်ပါ။ ဘတ်စ်ကားနှင့် အကွာအဝေးထား၍ ကျော်ပါ။', done: (s) => s.passedBus },
      { en: 'Signal and move back into your own lane. Stay under 40 km/h.', my: 'မီးပြ၍ ကိုယ့်လမ်းသို့ ပြန်ဝင်ပါ။ ၄၀ km/h အောက်ထားပါ။', done: (s, c) => (s.passedBus && s.backInLane ? (c.hold += s.dt) : (c.hold = 0), c.hold >= 1.5) },
    ],
  },
];
export const LESSON_COUNT = LESSONS.length;

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export class Lesson {
  id = 1; step = 0; score = 100; finished = false;
  violations: { en: string; my: string; pts: number }[] = [];
  private ctx: Ctx = { hold: 0 };
  private toastTimer = 0;
  private lastSpeedFine = -99; private lastCrash = -99;
  private lastToast: { en: string; my: string; pts: number } | null = null;
  private extra = '';
  private el = {
    panel: document.getElementById('lesson')!, text: document.getElementById('l-text')!, badge: document.getElementById('l-badge')!,
    title: document.getElementById('l-title')!, count: document.getElementById('l-count')!, fill: document.getElementById('l-fill')!, ext: document.getElementById('l-extra')!,
    score: document.getElementById('score')!, toast: document.getElementById('toast')!,
    result: document.getElementById('result')!, rtext: document.getElementById('r-text')!, next: document.getElementById('r-next')!,
  };

  constructor(private onRestart: (id: number) => void, private onFree: () => void) {
    document.getElementById('r-retry')!.onclick = () => { this.el.result.style.display = 'none'; this.onRestart(this.id); };
    document.getElementById('r-next')!.onclick = () => { this.el.result.style.display = 'none'; this.onRestart(this.id + 1); };
    document.getElementById('r-free')!.onclick = () => { this.el.result.style.display = 'none'; this.el.panel.style.display = 'none'; this.onFree(); };
    onLang(() => { this.show(); if (this.finished) this.renderResult(); if (this.lastToast) this.renderToast(); });
  }

  reset(id = this.id) {
    this.id = id; this.step = 0; this.score = 100; this.finished = false; this.violations = []; this.extra = '';
    this.ctx = { hold: 0 };
    this.el.panel.style.display = 'block';
    this.show();
  }

  private get steps() { return LESSONS[this.id - 1].steps; }

  private show() {
    const s = this.steps[Math.min(this.step, this.steps.length - 1)], t = LESSONS[this.id - 1].title;
    this.el.text.textContent = tr(s.en, s.my);
    this.el.badge.textContent = tr('LESSON ' + this.id, 'သင်ခန်းစာ ' + this.id);
    this.el.title.textContent = tr(t.en, t.my);
    this.el.count.textContent = `${this.step + 1}/${this.steps.length}`;
    this.el.fill.style.width = `${(this.step / this.steps.length) * 100}%`;
    this.el.ext.textContent = this.extra; this.el.ext.style.display = this.extra ? 'block' : 'none';
    this.el.score.textContent = `${this.score}`;
  }

  private renderToast() {
    const f = this.lastToast!;
    this.el.toast.innerHTML = `<b>−${f.pts}</b> ${tr(f.en, f.my)}`;
  }

  fine(en: string, my: string, pts: number) {
    if (this.finished) return;
    this.score = Math.max(0, this.score - pts);
    this.violations.push({ en, my, pts });
    this.el.score.textContent = `${this.score}`;
    this.lastToast = { en, my, pts }; this.renderToast();
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.el.toast.style.opacity = '0'), 3000);
  }

  update(s: DriveState, events: { redRun: boolean; crash: boolean; giveWay: boolean; hitPed: boolean; giveWayRound?: boolean; noExitSignal?: boolean; noLights?: boolean; unsafePass?: boolean; noPassSignal?: boolean; wrongWay?: boolean }) {
    if (this.finished) return;
    if (events.redRun) this.fine('You ran a red light!', 'မီးနီကို ကျော်ဖြတ်မိသည်!', 20);
    if (events.giveWay) this.fine('You did not give way to a pedestrian.', 'လမ်းဖြတ်ကူးသူကို ဦးစားမပေးပါ။', 20);
    if (events.giveWayRound) this.fine('You did not give way on the roundabout.', 'အဝိုင်းထဲတွင် ဦးစားမပေးပါ။', 20);
    if (events.noExitSignal) this.fine('You did not signal before leaving the roundabout.', 'အဝိုင်းမှ မထွက်မီ မီးပြမဖွင့်ပါ။', 10);
    if (events.noLights) this.fine('Headlights off in the dark.', 'မှောင်ချိန်တွင် ရှေ့မီးမဖွင့်ပါ။', 10);
    if (events.unsafePass) this.fine('You overtook with a car coming towards you!', 'ဆန့်ကျင်ဘက်မှ ကားလာနေစဉ် ကျော်တက်မိသည်!', 25);
    if (events.noPassSignal) this.fine('You pulled out without signalling.', 'မီးမပြဘဲ ထွက်ကျော်မိသည်။', 10);
    if (events.wrongWay) this.fine('You are driving the wrong way on a one-way road!', 'တစ်လမ်းသွားလမ်းတွင် ပြောင်းပြန်မောင်းနေသည်!', 25);
    if (events.hitPed) this.fine('You hit a pedestrian!', 'လမ်းဖြတ်ကူးသူကို တိုက်မိသည်!', 40);
    if (events.crash && s.t - this.lastCrash > 2.5) { this.lastCrash = s.t; this.fine('You crashed.', 'တိုက်မိသည်။', 10); }
    const lim = s.limit;
    if (s.kmh > lim + 8 && s.t - this.lastSpeedFine > 8) { this.lastSpeedFine = s.t; this.fine(`Too fast (limit ${lim} km/h).`, `အမြန်နှုန်း ကျော်မောင်းသည် (${lim} km/h)။`, 5); }

    if (this.steps[this.step].done(s, this.ctx)) {
      this.step++; this.ctx = { hold: 0 }; this.extra = '';
      if (this.step >= this.steps.length) return this.finish();
      this.show();
    }
    // live distance / signal readout on the target steps
    let extra = '';
    const last = this.step === this.steps.length - 1;
    if ((this.id === 1 || this.id === 4) && last) extra = `${Math.max(0, Math.round(s.distToLine))} m  ${s.lightAhead === 'red' ? '🔴' : s.lightAhead === 'yellow' ? '🟡' : '🟢'}`;
    else if (this.id === 5) extra = this.step === 0 ? `${Math.max(0, Math.round(s.busDist))} m` : s.oncoming < 120 && !s.passedBus ? `⚠ ${Math.round(s.oncoming)} m` : '';
    else if (this.id === 2 || this.id === 3) extra = `${Math.max(0, Math.round(s.distToLine))} m`;
    if (extra !== this.extra) { this.extra = extra; this.el.ext.textContent = extra; this.el.ext.style.display = extra ? 'block' : 'none'; }
  }

  private best = 0;
  private renderResult() {
    const pass = this.score >= 70;
    const list = this.violations.map((v) => `−${v.pts} ${tr(v.en, v.my)}`).join('<br>') || tr('No mistakes!', 'အမှားမရှိပါ!');
    this.el.rtext.innerHTML = `<h2>${pass ? tr(`Lesson ${this.id} passed ✅`, `သင်ခန်းစာ ${this.id} အောင်မြင်ပါသည် ✅`) : tr('Try again', 'ထပ်ကြိုးစားပါ')}</h2>` +
      `<p style="font-size:34px;margin:6px 0"><b>${this.score}</b> / 100</p><p style="font-size:13px;opacity:.85">${list}</p><p style="font-size:12px;opacity:.7">${tr('Best', 'အကောင်းဆုံး')}: ${this.best}</p>`;
    this.el.next.style.display = pass && this.id < LESSONS.length ? 'inline-block' : 'none';
  }

  private finish() {
    this.finished = true;
    const bestKey = `yd.lesson${this.id}`;
    this.best = Math.max(this.score, Number(safeGet(bestKey) ?? 0));
    safeSet(bestKey, String(this.best));
    this.el.panel.style.display = 'none';
    this.renderResult();
    this.el.result.style.display = 'flex';
  }
}
