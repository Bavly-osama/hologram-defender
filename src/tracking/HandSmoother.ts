import { distance, mix, type Point } from "../core/Config";
export class HandSmoother {
  point: Point = { x: 0.5, y: 0.5 };
  target: Point = { x: 0.5, y: 0.5 };
  reset(point: Point) {
    this.point = { ...point };
    this.target = { ...point };
  }
  update(dt: number) {
    const responsiveness =
      12 + Math.min(48, distance(this.point, this.target) * 220);
    const alpha = 1 - Math.exp(-responsiveness * dt);
    this.point.x = mix(this.point.x, this.target.x, alpha);
    this.point.y = mix(this.point.y, this.target.y, alpha);
    return this.point;
  }
}
