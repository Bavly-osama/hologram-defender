import { clamp, type Point } from "../core/Config";
export interface Landmark extends Point {
  z: number;
}
export const normalizeHandPoint = (point: Point): Point => ({
  x: clamp(1 - point.x),
  y: clamp(point.y),
});
export class HandPresenceManager {
  lastSeen = -Infinity;
  seen(time: number) {
    this.lastSeen = time;
  }
  opacity(time: number) {
    return clamp(1 - (time - this.lastSeen - 150) / 200);
  }
}
