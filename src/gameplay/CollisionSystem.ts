import type { Point } from "../core/Config";
export function segmentCircle(
  a: Point,
  b: Point,
  center: Point,
  radius: number,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((center.x - a.x) * dx + (center.y - a.y) * dy) /
        (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(a.x + dx * t - center.x, a.y + dy * t - center.y) <= radius;
}
