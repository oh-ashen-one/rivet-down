import { createConstantBeatMap } from "./beat-map";
import type {
  LevelDefinition,
  LevelEvent,
  LevelId,
  LevelPalette,
} from "./types";

type PatternName =
  | "intro"
  | "steps"
  | "teeth"
  | "orbs"
  | "polarity"
  | "thruster"
  | "crusher"
  | "finale";

const palettes: Record<LevelId, LevelPalette> = {
  "cold-start": {
    background: 0x071a22,
    backgroundAlt: 0x0b3440,
    accent: 0x41f0ff,
    accentSoft: 0x167d8f,
    hazard: 0xff496c,
    warning: 0xffd35a,
    foreground: 0xd7fbff,
  },
  "pressure-line": {
    background: 0x1b1208,
    backgroundAlt: 0x3b260d,
    accent: 0xffb52e,
    accentSoft: 0x8f5516,
    hazard: 0xff4d2e,
    warning: 0xffee8f,
    foreground: 0xfff5dc,
  },
  "polarity-shaft": {
    background: 0x120a25,
    backgroundAlt: 0x2e1450,
    accent: 0xc370ff,
    accentSoft: 0x6a2e9e,
    hazard: 0xff3f91,
    warning: 0x7ff8ff,
    foreground: 0xf3e8ff,
  },
  "turbine-blackout": {
    background: 0x170806,
    backgroundAlt: 0x35100c,
    accent: 0xff673d,
    accentSoft: 0x8f2f1e,
    hazard: 0xffd23f,
    warning: 0xff4b31,
    foreground: 0xffe9df,
  },
  "meltdown-zero": {
    background: 0x0c0607,
    backgroundAlt: 0x301015,
    accent: 0xfff4e8,
    accentSoft: 0xc23b46,
    hazard: 0xff2342,
    warning: 0xffd166,
    foreground: 0xffffff,
  },
};

function event(
  id: string,
  type: LevelEvent["type"],
  beat: number,
  options: Omit<LevelEvent, "id" | "type" | "beat"> = {},
): LevelEvent {
  return { id, type, beat, ...options };
}

function pattern(
  name: PatternName,
  startBeat: number,
  intensity: number,
  prefix: string,
): LevelEvent[] {
  const result: LevelEvent[] = [];
  const push = (
    type: LevelEvent["type"],
    offset: number,
    options: Omit<LevelEvent, "id" | "type" | "beat"> = {},
  ) => {
    result.push(
      event(`${prefix}-${result.length}`, type, startBeat + offset, options),
    );
  };

  if (name === "intro") {
    push("spike", 4);
    push("pad", 6.5);
    push("block", 8.5, { height: 92 });
    // Teach two distinct jumps instead of asking new players to clear a
    // near-overlapping double spike with one frame-perfect press.
    push("spike", 10.5);
    push("spike", 13.25);
    return result;
  }

  if (name === "steps") {
    push("spike", 0);
    push("block", 2, { height: 78 + intensity * 8 });
    push("spike", 4);
    if (intensity > 1) {
      // Later levels may use a compact two-tooth cluster, but it remains a
      // single readable jump rather than an awkward almost-landed retry.
      push("spike", 4.65);
    }
    push("gap", 8, { widthBeats: 1.15 + intensity * 0.08 });
    push("pad", 7.25);
    push("block", 11, { height: Math.min(110 + intensity * 6, 132) });
    push("spike", 12.5);
    if (intensity > 1) {
      push("spike", 13.15);
    }
  }

  if (name === "teeth") {
    for (let index = 0; index < 4 + intensity; index += 1) {
      push(index % 2 === 0 ? "spike" : "ceiling-spike", index * 1.5);
    }
    push("saw", 8.5, { lane: "mid", y: 405 });
    push("gap", 11, { widthBeats: 1 + intensity * 0.1 });
    push("pad", 10.25);
    push("spike", 13);
  }

  if (name === "orbs") {
    push("pad", 0);
    push("orb", 2, { y: 455 });
    push("gap", 2.5, { widthBeats: 2.5 });
    push("orb", 5.2, { y: 345 });
    push("saw", 6.3, { lane: "mid", y: 520 });
    // Runner jump apex safely clears this with visible breathing room.
    push("block", 8.5, { height: 132 });
    push("orb", 10.2, { y: 360 });
    push("gap", 10.5, { widthBeats: 2.2 });
    push("spike", 14);
  }

  if (name === "polarity") {
    push("gate", 0, { gravity: -1, targetMode: "polarity" });
    push("ceiling-spike", 3);
    push("ceiling-spike", 4);
    push("block", 6, { lane: "ceiling", height: 120 });
    push("gate", 8, { gravity: 1, targetMode: "runner" });
    push("spike", 10);
    push("gap", 12, { widthBeats: 1.4 });
    push("pad", 11.1);
    push("spike", 15);
  }

  if (name === "thruster") {
    push("gate", 0, { targetMode: "thruster", gravity: 1 });
    for (let index = 0; index < 7; index += 1) {
      push(index % 2 === 0 ? "block" : "saw", 2 + index * 1.8, {
        lane: index % 3 === 0 ? "ceiling" : "floor",
        y: index % 3 === 0 ? 270 : 525,
        height: 120 + intensity * 8,
      });
    }
    push("gate", 15.25, { targetMode: "runner", gravity: 1 });
  }

  if (name === "crusher") {
    push("block", 0, { lane: "ceiling", height: 220 });
    push("block", 2.2, { lane: "floor", height: 112 });
    push("block", 4.4, { lane: "ceiling", height: 260 });
    push("orb", 5.4, { y: 420 });
    push("gap", 5.8, { widthBeats: 2.4 });
    push("block", 8.5, { lane: "floor", height: 126 });
    push("saw", 11, { lane: "mid", y: 390 });
    push("spike", 13);
    push("spike", 14);
  }

  if (name === "finale") {
    push("spike", 0);
    if (intensity > 1) {
      push("spike", 0.65);
    }
    push("pad", 2);
    push("orb", 3.8, { y: 390 });
    push("gap", 4, { widthBeats: 2.2 });
    push("gate", 6.5, {
      gravity: intensity > 3 ? -1 : 1,
      targetMode: intensity > 3 ? "polarity" : "runner",
    });
    push(intensity > 3 ? "ceiling-spike" : "spike", 9);
    push("saw", 11, { lane: "mid", y: 405 });
    push("gate", 13.5, { gravity: 1, targetMode: "runner" });
  }

  return result;
}

function compileLevel(
  config: Omit<LevelDefinition, "beatMap" | "events" | "checkpoints"> & {
    phrases: PatternName[];
  },
): LevelDefinition {
  const events: LevelEvent[] = [];
  const phraseLength = 16;
  config.phrases.forEach((name, index) => {
    const beat = 8 + index * phraseLength;
    events.push(...pattern(name, beat, config.difficulty, `${config.id}-${index}`));
  });

  const totalBeats = config.bars * 4;
  const fuseBeats = [
    Math.floor(totalBeats * 0.26),
    Math.floor(totalBeats * 0.56),
    Math.floor(totalBeats * 0.84),
  ];
  fuseBeats.forEach((beat, index) => {
    events.push(
      event(`${config.id}-fuse-${index}`, "fuse", beat, {
        fuseIndex: index as 0 | 1 | 2,
        y: index % 2 === 0 ? 470 : 320,
      }),
    );
  });

  const checkpoints = Array.from(
    { length: Math.floor(totalBeats / 64) },
    (_, index) => (index + 1) * 64,
  ).filter((beat) => beat < totalBeats - 16);
  checkpoints.forEach((beat, index) => {
    events.push(
      event(`${config.id}-checkpoint-${index}`, "checkpoint", beat),
    );
  });

  return {
    ...config,
    beatMap: createConstantBeatMap(config.bpm, config.bars),
    events: events.sort((a, b) => a.beat - b.beat),
    checkpoints,
  };
}

export const levels: LevelDefinition[] = [
  compileLevel({
    id: "cold-start",
    number: 1,
    title: "Cold Start",
    subtitle: "ASSEMBLY DECK 01",
    bpm: 192,
    audioPlaybackRate: 1.5,
    bars: 64,
    difficulty: 1,
    mechanicLabel: "JUMP / LAUNCH",
    description: "Wake the line. Trust the pulse. Do not trust the floor.",
    palette: palettes["cold-start"],
    sourceAudio: "/audio/cold-start.mp3",
    phrases: [
      "intro",
      "steps",
      "teeth",
      "steps",
      "intro",
      "teeth",
      "steps",
      "finale",
      "steps",
      "teeth",
      "finale",
      "steps",
      "teeth",
      "finale",
      "steps",
    ],
  }),
  compileLevel({
    id: "pressure-line",
    number: 2,
    title: "Pressure Line",
    subtitle: "HYDRAULIC DECK 07",
    bpm: 210,
    audioPlaybackRate: 1.5,
    bars: 72,
    difficulty: 2,
    mechanicLabel: "JUMP / ORB",
    description: "Hit the pressure orbs on the beat before the line hits you.",
    palette: palettes["pressure-line"],
    sourceAudio: "/audio/pressure-line.mp3",
    phrases: [
      "intro",
      "orbs",
      "steps",
      "crusher",
      "orbs",
      "teeth",
      "crusher",
      "orbs",
      "steps",
      "crusher",
      "orbs",
      "finale",
      "crusher",
      "orbs",
      "teeth",
      "finale",
      "crusher",
    ],
  }),
  compileLevel({
    id: "polarity-shaft",
    number: 3,
    title: "Polarity Shaft",
    subtitle: "MAGNETIC DESCENT 12",
    bpm: 228,
    audioPlaybackRate: 1.5,
    bars: 80,
    difficulty: 3,
    mechanicLabel: "JUMP / INVERT",
    description: "The ceiling is another floor until the field changes its mind.",
    palette: palettes["polarity-shaft"],
    sourceAudio: "/audio/polarity-shaft.mp3",
    phrases: [
      "intro",
      "polarity",
      "teeth",
      "orbs",
      "polarity",
      "crusher",
      "polarity",
      "steps",
      "orbs",
      "polarity",
      "crusher",
      "teeth",
      "polarity",
      "orbs",
      "finale",
      "polarity",
      "crusher",
      "finale",
      "polarity",
    ],
  }),
  compileLevel({
    id: "turbine-blackout",
    number: 4,
    title: "Turbine Blackout",
    subtitle: "AIR CORE 19",
    bpm: 252,
    audioPlaybackRate: 1.5,
    bars: 88,
    difficulty: 4,
    mechanicLabel: "HOLD / RELEASE",
    description: "Feather the thruster through a machine that wants you shredded.",
    palette: palettes["turbine-blackout"],
    sourceAudio: "/audio/turbine-blackout.mp3",
    phrases: [
      "intro",
      "thruster",
      "crusher",
      "polarity",
      "thruster",
      "teeth",
      "orbs",
      "thruster",
      "crusher",
      "polarity",
      "thruster",
      "finale",
      "crusher",
      "thruster",
      "orbs",
      "polarity",
      "thruster",
      "crusher",
      "finale",
      "thruster",
      "teeth",
    ],
  }),
  compileLevel({
    id: "meltdown-zero",
    number: 5,
    title: "Meltdown Zero",
    subtitle: "REACTOR TERMINUS",
    bpm: 270,
    audioPlaybackRate: 1.5,
    bars: 96,
    difficulty: 5,
    mechanicLabel: "EVERYTHING / NOW",
    description: "Every lesson returns faster, hotter, and less forgiving.",
    palette: palettes["meltdown-zero"],
    sourceAudio: "/audio/meltdown-zero.mp3",
    phrases: [
      "intro",
      "steps",
      "orbs",
      "polarity",
      "thruster",
      "crusher",
      "teeth",
      "orbs",
      "polarity",
      "thruster",
      "finale",
      "crusher",
      "polarity",
      "orbs",
      "thruster",
      "teeth",
      "finale",
      "crusher",
      "thruster",
      "polarity",
      "orbs",
      "finale",
      "crusher",
    ],
  }),
];

export function getLevel(id: LevelId): LevelDefinition {
  const level = levels.find((candidate) => candidate.id === id);
  if (!level) {
    throw new Error(`Unknown level: ${id}`);
  }
  return level;
}
