export interface Point {
  x: number;
  y: number;
}
export const WORLD = {
  width: 1200,
  height: 750,
  core: { x: 600, y: 585 },
} as const;
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
