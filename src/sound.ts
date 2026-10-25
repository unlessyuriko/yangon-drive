// Engine, road and impact sound with WebAudio (starts after the first user gesture).
let ctx: AudioContext | null = null;
let osc1: OscillatorNode, osc2: OscillatorNode, engineGain: GainNode, engineLP: BiquadFilterNode;
let rainGain: GainNode;
let noiseGain: GainNode, noiseLP: BiquadFilterNode, noiseBuf: AudioBuffer;

export function startSound() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  engineLP = ctx.createBiquadFilter(); engineLP.type = 'lowpass'; engineLP.frequency.value = 500;
  engineGain = ctx.createGain(); engineGain.gain.value = 0;
  osc1 = ctx.createOscillator(); osc1.type = 'sawtooth';
  osc2 = ctx.createOscillator(); osc2.type = 'square';
  osc1.connect(engineLP); osc2.connect(engineLP); engineLP.connect(engineGain); engineGain.connect(master);
  osc1.start(); osc2.start();
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  noiseLP = ctx.createBiquadFilter(); noiseLP.type = 'lowpass'; noiseLP.frequency.value = 400;
  noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
  src.connect(noiseLP); noiseLP.connect(noiseGain); noiseGain.connect(master); src.start();
  const rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
  rainGain = ctx.createGain(); rainGain.gain.value = 0;
  rs.connect(hp); hp.connect(rainGain); rainGain.connect(master); rs.start();
}

export function updateSound(rpm: number, throttle: number, speed: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const f = (rpm / 60) * 2; // 4-cylinder: two firings per revolution
  osc1.frequency.setTargetAtTime(f, t, 0.03);
  osc2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
  engineLP.frequency.setTargetAtTime(350 + rpm * 0.25 + throttle * 500, t, 0.05);
  engineGain.gain.setTargetAtTime(0.05 + throttle * 0.07, t, 0.05);
  noiseLP.frequency.setTargetAtTime(300 + Math.abs(speed) * 25, t, 0.1);
  noiseGain.gain.setTargetAtTime(Math.min(0.12, Math.abs(speed) * 0.006), t, 0.1);
}

export function thud(strength: number) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.min(1, strength), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  s.connect(lp); lp.connect(g); g.connect(ctx.destination); s.start(t, Math.random() * 0.5, 0.4);
}

export function setRainSound(level: number) { if (ctx && rainGain) rainGain.gain.setTargetAtTime(level * 0.09, ctx.currentTime, 0.4); }
