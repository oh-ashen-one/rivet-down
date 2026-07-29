import { describe, expect, it } from "vitest";
import {
  barBeatLabel,
  beatToSeconds,
  createConstantBeatMap,
  secondsToBeat,
} from "../src/game/beat-map";
import type { BeatMap } from "../src/game/types";

describe("BeatMap interpolation", () => {
  it("builds an exact 4/4 constant-tempo timeline", () => {
    const map = createConstantBeatMap(128, 64);

    expect(map.beatTimestamps).toHaveLength(257);
    expect(map.durationSeconds).toBeCloseTo(120, 10);
    expect(beatToSeconds(map, 128)).toBeCloseTo(60, 10);
    expect(secondsToBeat(map, 60)).toBeCloseTo(128, 10);
  });

  it("round-trips fractional beats on a warped timeline", () => {
    const map: BeatMap = {
      bpm: 120,
      beatsPerBar: 4,
      downbeatOffsetSeconds: 0.03,
      durationSeconds: 2.12,
      beatTimestamps: [0.03, 0.51, 1.04, 1.58, 2.12],
    };

    for (const beat of [-0.25, 0, 0.5, 1.75, 3.2, 4, 4.5]) {
      expect(secondsToBeat(map, beatToSeconds(map, beat))).toBeCloseTo(beat, 10);
    }
  });

  it("formats musical positions as one-indexed bar and beat labels", () => {
    expect(barBeatLabel(0)).toBe("1:1");
    expect(barBeatLabel(3.9)).toBe("1:4");
    expect(barBeatLabel(4)).toBe("2:1");
  });
});
