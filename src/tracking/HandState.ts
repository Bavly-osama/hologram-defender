import { clamp, type Point } from "../core/Config";

export interface Landmark extends Point {
  z: number;
}

/**
 * normalizeHandPoint — converts MediaPipe normalized coords to game coords.
 * MediaPipe: x=0 is right edge of the mirrored image, so we flip x.
 */
export const normalizeHandPoint = (point: Point): Point => ({
  x: clamp(1 - point.x),
  y: clamp(point.y),
});

/**
 * Compute a stable palm center from landmarks:
 * 70% MCPs (knuckles: 5, 9, 13, 17) + 30% wrist (0).
 * Balances palm geometry for direct, natural kinematic feel.
 */
export function palmCenter(landmarks: Landmark[]): Point {
  if (landmarks.length < 18) return normalizeHandPoint(landmarks[0] ?? { x: 0.5, y: 0.5, z: 0 });
  const mcpX = (landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 4;
  const mcpY = (landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 4;
  const wrist = landmarks[0];
  const px = mcpX * 0.70 + wrist.x * 0.30;
  const py = mcpY * 0.70 + wrist.y * 0.30;
  return normalizeHandPoint({ x: px, y: py });
}

// ── Hand presence states ────────────────────────────────────────────────────
export type HandPresenceState = "VISIBLE" | "WEAK" | "PREDICTED" | "LOST";

/** Grace periods (ms) */
const RETAIN_MS   = 180;   // hand fully visible for this long after last detection
const WEAK_MS     = 350;   // fade window: RETAIN → WEAK
const PREDICT_MS  = 600;   // prediction window: WEAK → PREDICTED
// > PREDICT_MS → LOST

export class HandPresenceManager {
  lastSeen = -Infinity;
  presenceState: HandPresenceState = "LOST";

  seen(time: number) {
    this.lastSeen = time;
  }

  /**
   * Returns 0–1 opacity for the shield.
   * Shield NEVER blinks — only fades smoothly over the grace windows.
   */
  opacity(time: number): number {
    const missing = time - this.lastSeen;

    if (missing <= RETAIN_MS) {
      this.presenceState = "VISIBLE";
      return 1.0;
    }
    if (missing <= WEAK_MS) {
      this.presenceState = "WEAK";
      return 1.0; // still fully visible, just marked WEAK
    }
    if (missing <= PREDICT_MS) {
      this.presenceState = "PREDICTED";
      // Smooth fade from 1 → 0.45 over the prediction window
      const t = (missing - WEAK_MS) / (PREDICT_MS - WEAK_MS);
      return 1.0 - t * 0.55;
    }

    // LOST — fade from 0.45 → 0 over next 200ms
    this.presenceState = "LOST";
    const afterPredict = missing - PREDICT_MS;
    return Math.max(0, 0.45 - afterPredict / 200);
  }

  /** Returns whether the shield should still be shown (not fully gone) */
  isPresent(time: number): boolean {
    return this.opacity(time) > 0;
  }
}
