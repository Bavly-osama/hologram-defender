import { WORLD, distance, clamp, type Point } from "../core/Config";
import { settings, saveSettings, type ControlMode } from "../core/Settings";
import { PinchRecognizer } from "../gestures/PinchRecognizer";
import { HandTracker } from "../tracking/HandTracker";
import { HandPresenceManager, normalizeHandPoint } from "../tracking/HandState";
import { HandSmoother } from "../tracking/HandSmoother";
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
  moved = 0;
  landmarks: import("../tracking/HandState").Landmark[] = [];
  readonly tracker = new HandTracker();
  readonly pinch = new PinchRecognizer();
  private presence = new HandPresenceManager();
  private smoother = new HandSmoother();
  private queued = false;
  private lastSeen = -Infinity;
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
    this.tracker.onLandmarks = (landmarks, now) => {
      this.landmarks = landmarks;
      if (!landmarks.length) {
        if (now - this.lastSeen > 350) this.pinch.reset();
        return;
      }
      const point = normalizeHandPoint(landmarks[8]);
      if (now - this.lastSeen > 350) {
        this.smoother.reset(point);
        this.pinch.reset();
      }
      this.smoother.target = point;
      this.presence.seen(now);
      this.lastSeen = now;
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
      const p = this.smoother.update(dt),
        point = { x: p.x * WORLD.width, y: p.y * WORLD.height };
      if (this.opacity > 0) this.moved += distance(point, this.point);
      this.point = point;
    } else this.opacity = 1;
  }
  consumeFire() {
    const result = this.queued;
    this.queued = false;
    return result;
  }
  get active() {
    return this.mode === "mouse" || this.opacity > 0;
  }
  get handMissingFor() {
    return performance.now() - this.lastSeen;
  }
}
