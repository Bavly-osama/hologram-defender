import { settings } from "../core/Settings";
export class PerformanceManager {
  readonly mobile = matchMedia("(pointer: coarse)").matches;
  low =
    settings.quality === "low" ||
    (settings.quality === "auto" && (navigator.hardwareConcurrency ?? 4) <= 4);
  fps = 60;
  private slowTime = 0;
  private stableTime = 0;
  get profile() {
    return `${this.mobile ? "MOBILE" : "DESKTOP"}_${this.low ? "LOW" : "HIGH"}`;
  }
  get resolution() {
    return this.low ? 1 : Math.min(devicePixelRatio, this.mobile ? 1.25 : 1.5);
  }
  get particleLimit() {
    return this.low ? 60 : this.mobile ? 140 : 260;
  }
  update(dt: number) {
    this.fps += (1 / Math.max(0.001, dt) - this.fps) * 0.025;
    if (settings.quality !== "auto") return false;
    if (this.fps < (this.mobile ? 26 : 42)) {
      this.slowTime += dt;
      this.stableTime = 0;
    } else {
      this.slowTime = 0;
      this.stableTime += dt;
    }
    if (this.slowTime > 4 && !this.low) {
      this.low = true;
      this.slowTime = 0;
      return true;
    }
    if (this.stableTime > 30 && this.low && this.fps > 57) {
      this.low = false;
      this.stableTime = 0;
      return true;
    }
    return false;
  }
}
