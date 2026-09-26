/**
 * HandSmoother — adaptive exponential smoothing with:
 *   - speed-dependent responsiveness (slow → smoother, fast → responsive)
 *   - dead-zone to suppress micro-jitter
 *   - velocity tracking for prediction during brief tracking loss
 *   - safe reacquisition (no jump when hand returns)
 */
import { mix, type Point } from "../core/Config";

/** Dead zone in normalized coords — movements smaller than this are damped (0.003 is ~1px on camera) */
const DEAD_ZONE = 0.003;

/** How much velocity contributes to prediction (max prediction horizon in seconds) */
const MAX_PREDICT_SECONDS = 0.12;

export class HandSmoother {
  point: Point = { x: 0.5, y: 0.5 };
  target: Point = { x: 0.5, y: 0.5 };

  /** Smoothed velocity (in normalized coords / second) */
  private vx = 0;
  private vy = 0;

  /** Whether the smoother was just reset (prevents jump on reacquisition) */
  private justReset = false;

  reset(point: Point) {
    this.point = { ...point };
    this.target = { ...point };
    // Zero out velocity so no jump after reacquisition
    this.vx = 0;
    this.vy = 0;
    this.justReset = true;
  }

  update(dt: number): Point {
    const dx = this.target.x - this.point.x;
    const dy = this.target.y - this.point.y;
    const dist = Math.hypot(dx, dy);

    // Apply dead zone — dampen camera micro-tremors without sacrificing fine aiming
    const effectiveDist = Math.max(0, dist - DEAD_ZONE);
    const effectiveDx = dist > 0 ? (dx / dist) * effectiveDist : 0;
    const effectiveDy = dist > 0 ? (dy / dist) * effectiveDist : 0;

    // Fast, responsive exponential smoothing:
    //   slow/holding: responsiveness ~22 → 90% in 2 frames, zero micro-jitter
    //   moving: responsiveness up to 90 → near-instant tracking, zero lag
    const responsiveness = 22 + Math.min(68, effectiveDist * 380);
    const alpha = 1 - Math.exp(-responsiveness * dt);

    const newX = this.point.x + effectiveDx * alpha;
    const newY = this.point.y + effectiveDy * alpha;

    // Track smoothed velocity (EMA of positional change per second)
    if (!this.justReset && dt > 0) {
      const velAlpha = 1 - Math.exp(-8 * dt); // velocity EMA, ~8Hz cutoff
      this.vx = mix(this.vx, (newX - this.point.x) / dt, velAlpha);
      this.vy = mix(this.vy, (newY - this.point.y) / dt, velAlpha);
    }
    this.justReset = false;

    this.point.x = newX;
    this.point.y = newY;

    return this.point;
  }

  /**
   * Predict position during brief tracking loss.
   * Returns predicted position, clamped to valid range.
   * @param missingFor seconds since last landmark
   */
  predict(missingFor: number): Point {
    const t = Math.min(missingFor, MAX_PREDICT_SECONDS);
    // Decay velocity during prediction
    const decay = Math.exp(-10 * missingFor);
    return {
      x: Math.max(0, Math.min(1, this.point.x + this.vx * decay * t)),
      y: Math.max(0, Math.min(1, this.point.y + this.vy * decay * t)),
    };
  }
}
