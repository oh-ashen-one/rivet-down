import type { BeatMap } from "./types";

export function createConstantBeatMap(
  bpm: number,
  bars: number,
  downbeatOffsetSeconds = 0,
): BeatMap {
  const beatCount = bars * 4;
  const secondsPerBeat = 60 / bpm;
  const beatTimestamps = Array.from(
    { length: beatCount + 1 },
    (_, index) => downbeatOffsetSeconds + index * secondsPerBeat,
  );

  return {
    bpm,
    beatsPerBar: 4,
    downbeatOffsetSeconds,
    durationSeconds: beatTimestamps[beatTimestamps.length - 1],
    beatTimestamps,
  };
}

export function beatToSeconds(map: BeatMap, beat: number): number {
  if (beat <= 0) {
    const firstStep = map.beatTimestamps[1] - map.beatTimestamps[0];
    return map.beatTimestamps[0] + beat * firstStep;
  }

  const maximumBeat = map.beatTimestamps.length - 1;
  if (beat >= maximumBeat) {
    const lastStep =
      map.beatTimestamps[maximumBeat] -
      map.beatTimestamps[maximumBeat - 1];
    return (
      map.beatTimestamps[maximumBeat] + (beat - maximumBeat) * lastStep
    );
  }

  const lowerBeat = Math.floor(beat);
  const fraction = beat - lowerBeat;
  const start = map.beatTimestamps[lowerBeat];
  const end = map.beatTimestamps[lowerBeat + 1];
  return start + (end - start) * fraction;
}

export function secondsToBeat(map: BeatMap, seconds: number): number {
  const timestamps = map.beatTimestamps;
  if (seconds <= timestamps[0]) {
    const firstStep = timestamps[1] - timestamps[0];
    return (seconds - timestamps[0]) / firstStep;
  }

  const maximumBeat = timestamps.length - 1;
  if (seconds >= timestamps[maximumBeat]) {
    const lastStep =
      timestamps[maximumBeat] - timestamps[maximumBeat - 1];
    return maximumBeat + (seconds - timestamps[maximumBeat]) / lastStep;
  }

  let low = 0;
  let high = maximumBeat;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (timestamps[middle] <= seconds) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return low + (seconds - timestamps[low]) / (timestamps[high] - timestamps[low]);
}

export function barBeatLabel(beat: number): string {
  const bar = Math.floor(beat / 4) + 1;
  const beatInBar = Math.floor(beat % 4) + 1;
  return `${bar}:${beatInBar}`;
}
