// Процедурный звук на WebAudio: ветер, низкий гул, шаги, удары. Без файлов.
export class Audio {
  constructor() { this.ctx = null; }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);

    // шумовой буфер
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    this.noise = buf;

    // ветер
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
    const wg = c.createGain(); wg.gain.value = 0.0;
    src.connect(bp).connect(wg).connect(this.master); src.start();
    wg.gain.linearRampToValueAtTime(0.5, c.currentTime + 4);
    this.wind = { bp, wg };

    // гул
    const dg = c.createGain(); dg.gain.value = 0; dg.connect(this.master);
    for (const f of [41, 41.6, 61.8]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(dg); o.start();
    }
    dg.gain.linearRampToValueAtTime(0.05, c.currentTime + 6);
    this.drone = dg;
  }

  update(t, tension = 0) {
    if (!this.ctx) return;
    const n = Math.sin(t * 0.13) * 0.5 + Math.sin(t * 0.37 + 1) * 0.3 + Math.sin(t * 0.9) * 0.2;
    this.wind.bp.frequency.value = 300 + n * 180;
    this.wind.wg.gain.value = 0.38 + n * 0.18;
    this.drone.gain.value = 0.04 + tension * 0.1;
  }

  hit(freq = 120, dur = 0.12, vol = 0.25) {
    if (!this.ctx) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); const t = c.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 2, dur + 0.05);
  }
  step() { this.hit(500 + Math.random() * 300, 0.07, 0.12); }
  land() { this.hit(260, 0.16, 0.35); }
  thud() { this.hit(90, 0.6, 0.9); }
  creak() {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    const t = c.currentTime;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(45, t + 0.8);
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 1);
  }
  // удар счёта: низкий деревянный стук с эхом
  knock(vol = 1, last = false) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    for (const [dl, k] of [[0, 1], [0.32, 0.35], [0.7, 0.12]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(last ? 52 : 64, t + dl); o.frequency.exponentialRampToValueAtTime(34, t + dl + 0.5);
      g.gain.setValueAtTime(0.0001, t + dl); g.gain.exponentialRampToValueAtTime(0.6 * vol * k, t + dl + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dl + (last ? 1.2 : 0.6));
      o.connect(g).connect(this.master); o.start(t + dl); o.stop(t + dl + 1.3);
    }
    this.hit(180, 0.25, 0.4 * vol);
  }
  // взгляд великана: низкий нарастающий гул
  gaze(vol = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    for (const f of [38, 57, 76.5]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.94, t + 2.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13 * vol, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 3);
    }
  }
  snap() { this.hit(1800, 0.08, 0.7); this.hit(150, 0.5, 0.8); }
}
