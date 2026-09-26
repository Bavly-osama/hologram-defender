import { WORLD, distance, clamp, type Point } from "../core/Config";
import { settings, saveSettings, type ControlMode } from "../core/Settings";
import { PinchRecognizer } from "../gestures/PinchRecognizer";
import { HandTracker } from "../tracking/HandTracker";
import { HandPresenceManager, normalizeHandPoint, palmCenter } from "../tracking/HandState";
import { HandSmoother } from "../tracking/HandSmoother";
import { GameplayBounds } from "../gameplay/GameplayBounds";

export interface ScreenTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export class InputManager {
  mode: ControlMode = settings.mode;
  point: Point = { x: 600, y: 400 };
  opacity = 1;
  confidence = 0;
  moved = 0;
  landmarks: import("../tracking/HandState").Landmark[] = [];
  readonly tracker = new HandTracker();
  readonly pinch = new PinchRecognizer();
  private presence = new HandPresenceManager();
  /** Palm smoother — follows stable palm center landmarks */
  private palmSmoother = new HandSmoother();
  /** Pointer smoother — follows index fingertip (more precise but noisier) */
  private pointerSmoother = new HandSmoother();
  private queued = false;
  private lastSeen = -Infinity;
  /** Raw last palm position in normalized coords */
  private lastPalmRaw: Point = { x: 0.5, y: 0.5 };

  constructor(
    canvas: HTMLCanvasElement,
    getTransform?: () => ScreenTransform,
  ) {
    const move = (event: PointerEvent) => {
      if (this.mode !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      let point: Point;
      if (getTransform) {
        const t = getTransform();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        point = {
          x: clamp((px - t.offsetX) / t.scaleX, 0, WORLD.width),
          y: clamp((py - t.offsetY) / t.scaleY, 0, WORLD.height),
        };
      } else {
        point = {
          x: ((event.clientX - rect.left) / rect.width) * WORLD.width,
          y: ((event.clientY - rect.top) / rect.height) * WORLD.height,
        };
      }
      this.moved += distance(point, this.point);
      this.point = point;
    };

    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", (event) => {
      move(event);
      if (this.mode === "mouse") {
        this.queued = true;
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {}
      }
    });
    const release = (event: PointerEvent) => {
      try {
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch {}
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    this.tracker.onLandmarks = (landmarks, now, confidence) => {
      this.landmarks = landmarks;
      this.confidence = confidence ?? (landmarks.length ? 0.85 : 0);
      if (!landmarks.length) {
        if (now - this.lastSeen > 600) this.pinch.reset();
        return;
      }

      // ── Use palm center for shield (stable), fingertip for pointer (precise) ──
      const palm = palmCenter(landmarks);
      const tip = normalizeHandPoint(landmarks[8]);

      if (now - this.lastSeen > 600) {
        // Reacquisition — blend in from current smoother position to avoid jumps
        this.palmSmoother.reset(palm);
        this.pointerSmoother.reset(tip);
        this.pinch.reset();
      } else {
        this.palmSmoother.target = palm;
        this.pointerSmoother.target = tip;
      }

      this.lastPalmRaw = palm;
      this.presence.seen(now);
      this.lastSeen = now;

      // Pinch from fingertip (unchanged)
      const ratio =
        distance(landmarks[4], landmarks[8]) /
        Math.max(0.025, distance(landmarks[0], landmarks[9]));
      if (this.pinch.update(ratio)) this.queued = true;
    };
  }

  async setMode(mode: ControlMode) {
    this.mode = mode;
    settings.mode = mode;
    saveSettings();
    this.queued = false;
    this.pinch.reset();
    this.landmarks = [];
    if (mode === "hand") await this.tracker.start();
    else this.tracker.stop();
  }

  update(dt: number, now: number) {
    if (this.mode === "hand") {
      this.tracker.tick(now);
      this.opacity = this.presence.opacity(now);

      let p: Point;

      if (this.presence.presenceState === "PREDICTED" || this.presence.presenceState === "LOST") {
        // During brief loss: use velocity-predicted position from smoother
        const missingFor = (now - this.lastSeen) / 1000;
        p = this.palmSmoother.predict(missingFor);
      } else {
        // Normal tracking: use palm smoother (stable)
        p = this.palmSmoother.update(dt);
      }

      let point: Point;
      const gb = GameplayBounds.get();
      if (gb.isPortrait) {
        // Map across visible mobile gameplay rect so hand movement spans the full visible phone screen
        point = gb.toWorld(p.x, p.y, 30, 25);
      } else {
        point = { x: p.x * WORLD.width, y: p.y * WORLD.height };
      }

      if (this.opacity > 0) this.moved += distance(point, this.point);
      this.point = point;
    } else {
      this.opacity = 1;
    }
  }

  consumeFire() {
    const result = this.queued;
    this.queued = false;
    return result;
  }

  get active() {
    return this.mode === "mouse" || this.opacity > 0;
  }

  get presenceState() {
    return this.presence.presenceState;
  }

  get rawPalm() {
    return this.lastPalmRaw;
  }

  get filteredPalm() {
    return this.palmSmoother.point;
  }

  get targetPalm() {
    return this.palmSmoother.target;
  }

  get handMissingFor() {
    return performance.now() - this.lastSeen;
  }
}
