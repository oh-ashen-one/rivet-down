export type LevelId =
  | "cold-start"
  | "pressure-line"
  | "polarity-shaft"
  | "turbine-blackout"
  | "meltdown-zero";

export type MechanicMode = "runner" | "polarity" | "thruster";

export type EventType =
  | "spike"
  | "ceiling-spike"
  | "block"
  | "gap"
  | "pad"
  | "orb"
  | "gate"
  | "saw"
  | "fuse"
  | "checkpoint"
  | "speed";

export interface BeatMap {
  bpm: number;
  beatsPerBar: 4;
  downbeatOffsetSeconds: number;
  durationSeconds: number;
  beatTimestamps: number[];
}

export interface LevelEvent {
  id: string;
  type: EventType;
  beat: number;
  lane?: "floor" | "ceiling" | "mid";
  widthBeats?: number;
  height?: number;
  y?: number;
  targetMode?: MechanicMode;
  gravity?: 1 | -1;
  value?: number;
  fuseIndex?: 0 | 1 | 2;
}

export interface LevelPalette {
  background: number;
  backgroundAlt: number;
  accent: number;
  accentSoft: number;
  hazard: number;
  warning: number;
  foreground: number;
}

export interface LevelDefinition {
  id: LevelId;
  number: number;
  title: string;
  subtitle: string;
  bpm: number;
  bars: number;
  difficulty: number;
  mechanicLabel: string;
  description: string;
  palette: LevelPalette;
  beatMap: BeatMap;
  events: LevelEvent[];
  checkpoints: number[];
  sourceAudio: string | null;
}

export interface InputReplay {
  version: 1;
  levelId: LevelId;
  bpm: number;
  actions: Array<{
    beat: number;
    kind: "press" | "release";
  }>;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  latencyMs: number;
  reducedFlash: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  actionKey: string;
}

export interface GameSave {
  version: 1;
  unlockedLevel: number;
  completed: Partial<Record<LevelId, boolean>>;
  bestAttempts: Partial<Record<LevelId, number>>;
  fuses: Partial<Record<LevelId, number[]>>;
  paletteIndex: number;
}

export interface RuntimeSnapshot {
  phase: "countdown" | "playing" | "dead" | "complete" | "paused";
  beat: number;
  progress: number;
  attempts: number;
  fuses: number[];
  checkpointBeat: number;
  message?: string;
}
