// Web Audio 合成音效（无需外部素材）
export class Sfx {
  constructor() { this.ctx = null; }

  // 需在用户手势中调用一次以解锁音频
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // 基础音符：freq 起始频率，可滑向 slideTo
  tone(freq, dur, { type = 'sine', vol = 0.2, slideTo = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  jump()  { this.tone(280, 0.22, { type: 'square', vol: 0.08, slideTo: 620 }); }
  slide() { this.tone(500, 0.18, { type: 'sawtooth', vol: 0.05, slideTo: 140 }); }
  coin()  { this.tone(920, 0.08, { type: 'sine', vol: 0.15 });
            this.tone(1380, 0.14, { type: 'sine', vol: 0.15, delay: 0.07 }); }
  powerup() { this.tone(440, 0.1, { type: 'triangle', vol: 0.15 });
              this.tone(660, 0.1, { type: 'triangle', vol: 0.15, delay: 0.08 });
              this.tone(880, 0.16, { type: 'triangle', vol: 0.15, delay: 0.16 }); }
  shield()  { this.tone(300, 0.3, { type: 'sawtooth', vol: 0.18, slideTo: 80 }); }
  crash() {
    this.tone(160, 0.5, { type: 'sawtooth', vol: 0.22, slideTo: 40 });
    this.tone(90, 0.6, { type: 'square', vol: 0.15, slideTo: 30 });
  }
}
