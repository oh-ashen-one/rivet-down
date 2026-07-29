import { describe, expect, it } from "vitest";
import {
  segmentPointDistanceSquared,
  sweptAabbIntersects,
} from "../src/game/collision";

describe("deterministic swept collision", () => {
  it("detects a fast obstacle crossing between fixed simulation samples", () => {
    const player = { x: 100, y: 100, width: 40, height: 40 };
    const before = { x: 150, y: 108, width: 12, height: 24 };
    const after = { x: 80, y: 108, width: 12, height: 24 };

    expect(sweptAabbIntersects(player, player, before, after)).toBe(true);
  });

  it("does not report parallel near misses", () => {
    const player = { x: 100, y: 100, width: 40, height: 40 };
    const before = { x: 150, y: 160, width: 12, height: 24 };
    const after = { x: 80, y: 160, width: 12, height: 24 };

    expect(sweptAabbIntersects(player, player, before, after)).toBe(false);
  });

  it("computes saw contact continuously along relative motion", () => {
    expect(segmentPointDistanceSquared(-10, 4, 10, 4, 0, 0)).toBe(16);
    expect(segmentPointDistanceSquared(-10, 8, 10, 8, 0, 0)).toBe(64);
  });
});
