/**
 * Web Audio API Sound Synthesizer for Real-Time Dashboard Notifications.
 * Generates crisp, pleasant harmonic chimes with zero external file dependencies or latency.
 */

class SoundNotifier {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.isMuted = localStorage.getItem("silverpoint_sound_muted") === "true";
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("silverpoint_sound_muted", String(muted));
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Harmonious 3-tone ascending chime for new incoming orders (E5 -> A5 -> C#6).
   */
  public playNewOrder() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.playTone(ctx, 659.25, now, 0.16, "sine", 0.18);
      this.playTone(ctx, 880.0, now + 0.12, 0.22, "sine", 0.22);
      this.playTone(ctx, 1108.73, now + 0.24, 0.38, "sine", 0.18);
    } catch {
      // Audio safety fallback
    }
  }

  /**
   * Pleasant 2-tone chime for status transitions & workstation activity (G5 -> C6).
   */
  public playStatusChange() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.playTone(ctx, 783.99, now, 0.15, "triangle", 0.18);
      this.playTone(ctx, 1046.5, now + 0.12, 0.28, "triangle", 0.2);
    } catch {
      // Audio safety fallback
    }
  }

  /**
   * Urgent dual-tone alert chime for SLA warnings or defect/damage reports (A4 -> C#5).
   */
  public playAlert() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      this.playTone(ctx, 440.0, now, 0.18, "sawtooth", 0.12);
      this.playTone(ctx, 554.37, now + 0.14, 0.26, "sawtooth", 0.12);
    } catch {
      // Audio safety fallback
    }
  }

  /**
   * Quick test chime to let user verify audio settings.
   */
  public testSound() {
    const prevMute = this.isMuted;
    this.isMuted = false;
    this.playNewOrder();
    this.isMuted = prevMute;
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.15
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch {
      // Audio safety fallback
    }
  }
}

export const soundNotifier = new SoundNotifier();
