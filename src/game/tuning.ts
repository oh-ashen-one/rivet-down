export const FLOOR_Y = 665;
export const PLAYER_SIZE = 54;
export const PIXELS_PER_BEAT = 152;
export const GRAVITY = 2750;
export const JUMP_IMPULSE = 930;
export const BLOCK_WIDTH = 72;

export const MIN_RUNNER_BLOCK_CLEARANCE_PIXELS = 40;
export const PAD_JUMP_MULTIPLIER = 1.16;
export const MIN_PAD_LANDING_REACTION_SECONDS = 0.18;

export function jumpFlightBeats(bpm: number, impulseMultiplier = 1): number {
  const flightSeconds = (2 * JUMP_IMPULSE * impulseMultiplier) / GRAVITY;
  return (flightSeconds * bpm) / 60;
}

export function jumpApexBeats(bpm: number): number {
  return ((JUMP_IMPULSE / GRAVITY) * bpm) / 60;
}

export function runnerBlockClearancePixels(
  bpm: number,
  blockHeight: number,
  blockWidth = BLOCK_WIDTH,
): number {
  const collisionHalf = PLAYER_SIZE * 0.39;
  const horizontalSpeed = (PIXELS_PER_BEAT * bpm) / 60;
  const overlapHalfDuration = (blockWidth / 2 + collisionHalf) / horizontalSpeed;
  const apexTime = JUMP_IMPULSE / GRAVITY;
  const edgeTime = Math.max(0, apexTime - overlapHalfDuration);
  const riseAtOverlapEdge =
    JUMP_IMPULSE * edgeTime - (GRAVITY * edgeTime * edgeTime) / 2;
  const playerBottomAtEdge =
    FLOOR_Y - PLAYER_SIZE / 2 + collisionHalf - riseAtOverlapEdge;
  const blockTop = FLOOR_Y - blockHeight;

  return blockTop - playerBottomAtEdge;
}
