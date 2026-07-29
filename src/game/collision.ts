export interface CollisionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sweptBounds(start: CollisionRect, end: CollisionRect): CollisionRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x + start.width, end.x + end.width);
  const bottom = Math.max(start.y + start.height, end.y + end.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function sweptAabbIntersects(
  playerStart: CollisionRect,
  playerEnd: CollisionRect,
  obstacleStart: CollisionRect,
  obstacleEnd: CollisionRect,
): boolean {
  const player = sweptBounds(playerStart, playerEnd);
  const obstacle = sweptBounds(obstacleStart, obstacleEnd);
  return (
    player.x + player.width > obstacle.x &&
    player.x < obstacle.x + obstacle.width &&
    player.y + player.height > obstacle.y &&
    player.y < obstacle.y + obstacle.height
  );
}

export function segmentPointDistanceSquared(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pointX: number,
  pointY: number,
): number {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) {
    const x = pointX - startX;
    const y = pointY - startY;
    return x * x + y * y;
  }
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((pointX - startX) * deltaX + (pointY - startY) * deltaY) /
        lengthSquared,
    ),
  );
  const nearestX = startX + projection * deltaX;
  const nearestY = startY + projection * deltaY;
  const x = pointX - nearestX;
  const y = pointY - nearestY;
  return x * x + y * y;
}
