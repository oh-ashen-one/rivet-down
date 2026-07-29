"use client";

import type { GameSettings, LevelDefinition } from "./types";

type ManagedNode = AudioScheduledSourceNode;

export class RhythmConductor {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private decodedTrack: AudioBuffer | null = null;
  private nodes = new Set<ManagedNode>();
  private anchorTime = 0;
  private pausedAt = 0;
  private nextSubdivision = 0;
  private running = false;

  constructor(
    private readonly level: LevelDefinition,
    private settings: GameSettings,
  ) {}

  async preload(): Promise<void> {
    await this.ensureContext();
    if (!this.level.sourceAudio || this.decodedTrack) {
      return;
    }
    try {
      const response = await fetch(this.level.sourceAudio);
      if (!response.ok) {
        return;
      }
      this.decodedTrack = await this.context!.decodeAudioData(
        await response.arrayBuffer(),
      );
    } catch {
      this.decodedTrack = null;
    }
  }

  async start(offsetSeconds = 0, countInBeats = 0): Promise<void> {
    await this.ensureContext();
    await this.context!.resume();
    this.stopNodes();

    const secondsPerBeat = 60 / this.level.bpm;
    const startDelay = 0.075 + countInBeats * secondsPerBeat;
    const audibleStart = this.context!.currentTime + startDelay;
    this.anchorTime = audibleStart - offsetSeconds;
    this.pausedAt = offsetSeconds;
    this.nextSubdivision = Math.max(
      0,
      Math.floor((offsetSeconds * this.level.bpm * 2) / 60),
    );
    this.running = true;

    if (countInBeats > 0) {
      for (let index = 0; index < countInBeats; index += 1) {
        this.scheduleClick(
          this.context!.currentTime + 0.075 + index * secondsPerBeat,
          index === countInBeats - 1,
        );
      }
    }

    if (this.decodedTrack) {
      const source = this.context!.createBufferSource();
      source.buffer = this.decodedTrack;
      source.connect(this.musicGain!);
      source.start(audibleStart, offsetSeconds);
      this.trackNode(source);
    }
  }

  tick(): void {
    if (!this.running || !this.context || this.decodedTrack) {
      return;
    }
    const horizon = this.context.currentTime + 0.4;
    const secondsPerSubdivision = 30 / this.level.bpm;
    while (
      this.anchorTime + this.nextSubdivision * secondsPerSubdivision <
      horizon
    ) {
      const time =
        this.anchorTime + this.nextSubdivision * secondsPerSubdivision;
      if (time >= this.context.currentTime - 0.02) {
        this.scheduleSubdivision(this.nextSubdivision, time);
      }
      this.nextSubdivision += 1;
    }
  }

  positionSeconds(): number {
    if (!this.context) {
      return this.pausedAt;
    }
    if (!this.running) {
      return this.pausedAt;
    }
    const calibrated =
      this.context.currentTime -
      this.anchorTime -
      this.settings.latencyMs / 1000;
    return Math.max(0, calibrated);
  }

  pause(): void {
    if (!this.running) {
      return;
    }
    this.pausedAt = this.positionSeconds();
    this.running = false;
    this.stopNodes();
  }

  async resume(countInBeats = 0): Promise<void> {
    await this.start(this.pausedAt, countInBeats);
  }

  async seek(seconds: number, countInBeats = 0): Promise<void> {
    await this.start(Math.max(0, seconds), countInBeats);
  }

  stop(): void {
    this.pausedAt = 0;
    this.running = false;
    this.stopNodes();
  }

  destroy(): void {
    this.stop();
    void this.context?.close();
    this.context = null;
  }

  updateSettings(settings: GameSettings): void {
    this.settings = settings;
    if (this.musicGain) {
      this.musicGain.gain.value = settings.musicVolume;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = settings.sfxVolume;
    }
  }

  jump(): void {
    this.scheduleSfx(520, 820, 0.075, "square", 0.12);
  }

  orb(): void {
    this.scheduleSfx(680, 1160, 0.12, "sine", 0.18);
  }

  fuse(): void {
    this.scheduleSfx(880, 1540, 0.22, "triangle", 0.2);
  }

  death(): void {
    if (!this.context || !this.sfxGain) {
      return;
    }
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(240, now);
    oscillator.frequency.exponentialRampToValueAtTime(36, now + 0.28);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(now);
    oscillator.stop(now + 0.31);
    this.trackNode(oscillator);
  }

  private async ensureContext(): Promise<void> {
    if (this.context) {
      return;
    }
    this.context = new AudioContext({ latencyHint: "interactive" });
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.masterGain.gain.value = 0.82;
    this.musicGain.gain.value = this.settings.musicVolume;
    this.sfxGain.gain.value = this.settings.sfxVolume;
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

    this.noiseBuffer = this.context.createBuffer(
      1,
      this.context.sampleRate * 0.2,
      this.context.sampleRate,
    );
    const channel = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
  }

  private scheduleSubdivision(index: number, time: number): void {
    const beat = Math.floor(index / 2);
    const half = index % 2;

    if (half === 0) {
      this.scheduleKick(time, beat % 4 === 0 ? 1 : 0.72);
      this.scheduleBass(time, beat);
      if (beat % 4 === 1 || beat % 4 === 3) {
        this.scheduleSnare(time);
      }
      if (beat % 8 === 0 || (this.level.difficulty >= 4 && beat % 8 === 4)) {
        this.scheduleMotif(time, beat);
      }
    }

    if (half === 1 || this.level.difficulty >= 3) {
      this.scheduleHat(time, half === 0 ? 0.035 : 0.065);
    }
  }

  private scheduleKick(time: number, strength: number): void {
    if (!this.context || !this.musicGain) {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(135, time);
    oscillator.frequency.exponentialRampToValueAtTime(44, time + 0.1);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.21 * strength, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    oscillator.connect(gain).connect(this.musicGain);
    oscillator.start(time);
    oscillator.stop(time + 0.14);
    this.trackNode(oscillator);
  }

  private scheduleSnare(time: number): void {
    if (!this.context || !this.musicGain || !this.noiseBuffer) {
      return;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = 1250;
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    source.connect(filter).connect(gain).connect(this.musicGain);
    source.start(time);
    source.stop(time + 0.12);
    this.trackNode(source);
  }

  private scheduleHat(time: number, volume: number): void {
    if (!this.context || !this.musicGain || !this.noiseBuffer) {
      return;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.value = 6200;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
    source.connect(filter).connect(gain).connect(this.musicGain);
    source.start(time);
    source.stop(time + 0.05);
    this.trackNode(source);
  }

  private scheduleBass(time: number, beat: number): void {
    if (!this.context || !this.musicGain) {
      return;
    }
    const roots = [55, 55, 65.41, 49, 55, 73.42, 65.41, 49];
    const root = roots[beat % roots.length];
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = this.level.difficulty >= 3 ? "sawtooth" : "square";
    oscillator.frequency.value = root;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260 + this.level.difficulty * 90, time);
    filter.frequency.exponentialRampToValueAtTime(120, time + 0.25);
    gain.gain.setValueAtTime(0.075, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    oscillator.connect(filter).connect(gain).connect(this.musicGain);
    oscillator.start(time);
    oscillator.stop(time + 0.3);
    this.trackNode(oscillator);
  }

  private scheduleMotif(time: number, phraseBeat: number): void {
    if (!this.context || !this.musicGain) {
      return;
    }
    const notes = [523.25, 392, 466.16, 622.25];
    const secondsPerBeat = 60 / this.level.bpm;
    notes.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const noteTime = time + index * secondsPerBeat * 0.5;
      oscillator.type = this.level.difficulty >= 4 ? "sawtooth" : "triangle";
      oscillator.frequency.value =
        phraseBeat % 16 === 0 ? frequency : frequency * 0.5;
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.045, noteTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        noteTime + secondsPerBeat * 0.42,
      );
      oscillator.connect(gain).connect(this.musicGain!);
      oscillator.start(noteTime);
      oscillator.stop(noteTime + secondsPerBeat * 0.45);
      this.trackNode(oscillator);
    });
  }

  private scheduleClick(time: number, high: boolean): void {
    if (!this.context || !this.sfxGain) {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = high ? 1080 : 720;
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(time);
    oscillator.stop(time + 0.06);
    this.trackNode(oscillator);
  }

  private scheduleSfx(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this.context || !this.sfxGain) {
      return;
    }
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      endFrequency,
      now + duration,
    );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.sfxGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    this.trackNode(oscillator);
  }

  private trackNode<T extends ManagedNode>(node: T): T {
    this.nodes.add(node);
    node.addEventListener("ended", () => this.nodes.delete(node), {
      once: true,
    });
    return node;
  }

  private stopNodes(): void {
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        // The browser may already have stopped this one-shot node.
      }
    }
    this.nodes.clear();
  }
}
