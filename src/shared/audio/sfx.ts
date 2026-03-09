/**
 * SFX engine using Web Audio API — zero dependencies.
 * All sounds are procedurally generated. No files needed.
 */

type SFXName = 'click' | 'cardClick' | 'question' | 'answerYes' | 'answerNo' | 'tileFlip' | 'tilesCascade' | 'riskIt' | 'win' | 'lose' | 'wrongGuess' | 'heartbeat';

class SFXEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private clickBuffer: AudioBuffer | null = null;
  private cardClickBuffer: AudioBuffer | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Eagerly load the MP3 files so they are ready when clicked.
      // AudioContext is created in 'suspended' state if no user gesture yet, 
      // but decoding still works fine.
      this.loadFiles();
    }
  }

  private async loadFiles() {
    try {
      const ctx = this.getCtx();
      const [clickRes, cardRes] = await Promise.all([
        fetch('/spinopel-ceramic-tile-411505.mp3').then((r) => r.arrayBuffer()),
        fetch('/1v1andAIcardsound.mp3').then((r) => r.arrayBuffer()),
      ]);
      this.clickBuffer = await ctx.decodeAudioData(clickRes);
      this.cardClickBuffer = await ctx.decodeAudioData(cardRes);
    } catch (e) {
      console.warn('SFXEngine: Failed to load MP3s', e);
    }
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(opts: {
    frequency: number;
    type?: OscillatorType;
    duration: number;
    volume?: number;
    attack?: number;
    decay?: number;
    freqEnd?: number;
    delay?: number;
  }) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const { frequency, type = 'sine', duration, volume = 0.3, attack = 0.01, decay = 0.1, freqEnd, delay = 0 } = opts;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = type;
      const startTime = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(frequency, startTime);
      if (freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
      }

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - decay);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch {
      // Silently fail if audio context not available
    }
  }

  private playNoise(opts: { duration: number; volume?: number; filter?: number }) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const { duration, volume = 0.1, filter = 800 } = opts;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const biquad = ctx.createBiquadFilter();
      biquad.type = 'bandpass';
      biquad.frequency.value = filter;
      biquad.Q.value = 0.5;

      const gain = ctx.createGain();
      source.connect(biquad);
      biquad.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      source.start();
      source.stop(ctx.currentTime + duration);
    } catch {
      // Silently fail
    }
  }

  private playBuffer(buffer: AudioBuffer | null, volume: number, rate = 1.0) {
    if (this.muted || !buffer) return;
    try {
      const ctx = this.getCtx();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch { }
  }

  click() {
    // Lighter, higher-pitched, softer click
    this.playBuffer(this.clickBuffer, 0.4, 1.35);
  }

  heavyClick() {
    // Original heavy/powerful ceramic clack
    this.playBuffer(this.clickBuffer, 0.6, 1.0);
  }

  cardClick() {
    this.playBuffer(this.cardClickBuffer, 0.8);
  }

  question() {
    // Rising chime
    this.playTone({ frequency: 440, type: 'sine', duration: 0.2, volume: 0.25, freqEnd: 660 });
    this.playTone({ frequency: 660, type: 'sine', duration: 0.2, volume: 0.2, freqEnd: 880, delay: 0.18 });
  }

  answerYes() {
    // Ascending major triad: C → E → G
    this.playTone({ frequency: 523, duration: 0.18, volume: 0.3 });
    this.playTone({ frequency: 659, duration: 0.18, volume: 0.3, delay: 0.15 });
    this.playTone({ frequency: 784, duration: 0.25, volume: 0.35, delay: 0.3 });
  }

  answerNo() {
    // Descending: G → E → C
    this.playTone({ frequency: 784, duration: 0.18, volume: 0.3 });
    this.playTone({ frequency: 659, duration: 0.18, volume: 0.25, delay: 0.15 });
    this.playTone({ frequency: 523, duration: 0.22, volume: 0.2, delay: 0.3, type: 'triangle' });
  }

  tileFlip() {
    // Ceramic tile clack — short noise burst + low thud, like a tile hitting a table
    this.playTone({ frequency: 1200, type: 'square', duration: 0.03, volume: 0.06, freqEnd: 200, attack: 0.001, decay: 0.025 });
    this.playTone({ frequency: 180, type: 'triangle', duration: 0.1, volume: 0.1, freqEnd: 60, attack: 0.005, decay: 0.08, delay: 0.02 });
  }

  /**
   * Rapid cascade of tile clacks — like dominoes falling in sequence.
   * More tiles = more clacks + deeper finish.
   */
  tilesCascade(count: number) {
    if (this.muted) return;
    const noteCount = Math.min(Math.max(2, Math.ceil(count / 8)), 8);
    const totalDur = Math.min(0.6, noteCount * 0.06);
    for (let i = 0; i < noteCount; i++) {
      const freq = 1400 - (i * (800 / noteCount));
      // Quick clack
      this.playTone({
        frequency: freq,
        type: 'square',
        duration: 0.025,
        volume: 0.04 + Math.min(count * 0.001, 0.04),
        attack: 0.001,
        decay: 0.02,
        freqEnd: freq * 0.3,
        delay: i * (totalDur / noteCount),
      });
    }
    // Final thud — tile pile settling
    this.playTone({
      frequency: 120,
      type: 'triangle',
      duration: 0.2,
      volume: 0.12,
      freqEnd: 40,
      attack: 0.01,
      decay: 0.15,
      delay: totalDur,
    });
  }

  riskIt() {
    // Dramatic rising tension tone
    this.playTone({ frequency: 220, type: 'sawtooth', duration: 0.4, volume: 0.25, freqEnd: 880, attack: 0.02, decay: 0.05 });
    this.playTone({ frequency: 330, type: 'sine', duration: 0.4, volume: 0.15, freqEnd: 1100, attack: 0.02, delay: 0.05 });
  }

  win() {
    // Victory fanfare
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      this.playTone({ frequency: freq, duration: 0.22, volume: 0.4, delay: i * 0.15 });
    });
    this.playTone({ frequency: 1047, duration: 0.6, volume: 0.5, delay: notes.length * 0.15 });
  }

  wrongGuess() {
    // Womp womp descending
    this.playTone({ frequency: 400, type: 'sawtooth', duration: 0.35, volume: 0.3, freqEnd: 200 });
    this.playTone({ frequency: 300, type: 'sawtooth', duration: 0.4, volume: 0.25, freqEnd: 150, delay: 0.3 });
  }

  heartbeat() {
    // Lub-dub — two quick low thumps like a real heartbeat
    this.playTone({ frequency: 60, type: 'sine', duration: 0.12, volume: 0.2, freqEnd: 30, attack: 0.005, decay: 0.1 });
    this.playTone({ frequency: 50, type: 'sine', duration: 0.1, volume: 0.15, freqEnd: 25, attack: 0.005, decay: 0.08, delay: 0.15 });
  }

  lose() {
    // Sad descending — game over feeling
    this.playTone({ frequency: 440, type: 'triangle', duration: 0.4, volume: 0.3, freqEnd: 220 });
    this.playTone({ frequency: 330, type: 'triangle', duration: 0.5, volume: 0.25, freqEnd: 165, delay: 0.35 });
    this.playTone({ frequency: 220, type: 'sine', duration: 0.6, volume: 0.2, freqEnd: 110, delay: 0.75 });
  }

  play(name: SFXName) {
    if (name === 'tilesCascade') {
      this.tilesCascade(1);
    } else {
      this[name]?.();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }
}

// Singleton
export const sfx = new SFXEngine();
