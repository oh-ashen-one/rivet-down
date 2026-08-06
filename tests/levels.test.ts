import { describe, expect, it } from "vitest";
import { levels } from "../src/game/levels";

describe("RIVET//DOWN campaign", () => {
  it("contains five increasingly demanding levels", () => {
    expect(levels).toHaveLength(5);
    expect(levels.map((level) => level.number)).toEqual([1, 2, 3, 4, 5]);
    expect(levels.map((level) => level.bpm)).toEqual([192, 210, 228, 252, 270]);
    expect(levels.map((level) => level.audioPlaybackRate)).toEqual([
      1.5,
      1.5,
      1.5,
      1.5,
      1.5,
    ]);
    expect(levels.map((level) => level.bars)).toEqual([64, 72, 80, 88, 96]);
    expect(levels.map((level) => level.difficulty)).toEqual([1, 2, 3, 4, 5]);
  });

  it.each(levels)("$title has deterministic, bounded event data", (level) => {
    const totalBeats = level.bars * 4;
    const ids = level.events.map((entry) => entry.id);
    const fuses = level.events.filter((entry) => entry.type === "fuse");

    expect(new Set(ids).size).toBe(ids.length);
    expect(level.events.every((entry) => entry.beat >= 0)).toBe(true);
    expect(level.events.every((entry) => entry.beat < totalBeats)).toBe(true);
    expect(level.events).toEqual(
      [...level.events].sort((left, right) => left.beat - right.beat),
    );
    expect(fuses).toHaveLength(3);
    expect(fuses.map((entry) => entry.fuseIndex).sort()).toEqual([0, 1, 2]);
    expect(level.beatMap.beatTimestamps).toHaveLength(totalBeats + 1);
    expect(level.beatMap.durationSeconds).toBeCloseTo(
      (totalBeats * 60) / level.bpm,
      10,
    );
    expect(level.sourceAudio).toBe(`/audio/${level.id}.mp3`);
  });

  it("only introduces advanced forms in their intended campaign order", () => {
    const modesByLevel = levels.map((level) =>
      new Set(
        level.events
          .filter((entry) => entry.type === "gate")
          .map((entry) => entry.targetMode),
      ),
    );

    expect(modesByLevel[0].has("polarity")).toBe(false);
    expect(modesByLevel[0].has("thruster")).toBe(false);
    expect(modesByLevel[1].has("thruster")).toBe(false);
    expect(modesByLevel[2].has("polarity")).toBe(true);
    expect(modesByLevel[3].has("thruster")).toBe(true);
    expect(modesByLevel[4].has("polarity")).toBe(true);
    expect(modesByLevel[4].has("thruster")).toBe(true);
  });

  it("gives Cold Start real recovery space between every floor spike", () => {
    const coldStart = levels[0];
    const floorSpikeBeats = coldStart.events
      .filter((entry) => entry.type === "spike")
      .map((entry) => entry.beat);
    const recoveryWindows = floorSpikeBeats
      .slice(1)
      .map((beat, index) => beat - floorSpikeBeats[index]);

    expect(Math.min(...recoveryWindows)).toBeGreaterThanOrEqual(2.7);
    expect(floorSpikeBeats.slice(0, 3)).toEqual([12, 18.5, 21.25]);
  });

  it.each(levels)("$title keeps runner floor blocks within jump height", (level) => {
    let mode: "runner" | "polarity" | "thruster" = "runner";
    const unsafeBlocks: typeof level.events = [];

    for (const entry of level.events) {
      if (entry.type === "gate" && entry.targetMode) {
        mode = entry.targetMode;
      }
      if (
        entry.type === "block" &&
        (entry.lane ?? "floor") === "floor" &&
        mode === "runner" &&
        (entry.height ?? 96) > 132
      ) {
        unsafeBlocks.push(entry);
      }
    }

    expect(unsafeBlocks).toEqual([]);
  });

  it.each(levels)("$title gives every runner gap a nearby launch assist", (level) => {
    const assists = level.events.filter(
      (entry) => entry.type === "pad" || entry.type === "orb",
    );
    const gaps = level.events.filter((entry) => entry.type === "gap");

    expect(gaps.every((gap) => (gap.widthBeats ?? 1) <= 2.5)).toBe(true);
    expect(
      gaps.every((gap) =>
        assists.some(
          (assist) => assist.beat <= gap.beat && assist.beat >= gap.beat - 2.1,
        ),
      ),
    ).toBe(true);
  });
});
