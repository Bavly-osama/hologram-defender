/**
 * CameraPreview — live camera preview box rendered in the bottom-left.
 *
 * Shows:
 *  - Live mirrored camera feed on a <canvas>
 *  - MediaPipe landmark overlay (wrist, palm, finger connections, fingertip dot)
 *  - Compact status line (CAMERA ✓ · MEDIAPIPE ✓ · HAND ✓/SEARCHING · FPS)
 *  - Cyan holographic HUD frame
 *
 * Visibility: hidden when camera is idle/denied. Always shown when CAMERA_STREAM_READY+.
 */

import type { Landmark } from "../tracking/HandState";
import type { CameraBootState } from "../tracking/HandTracker";

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const FINGERTIPS = [4, 8, 12, 16, 20];

interface PreviewSize {
  w: number;
  h: number;
  cornerSize: number;
  fontSize: number;
}

function getPreviewSize(isPortrait: boolean, isMobile: boolean): PreviewSize {
  if (isMobile && isPortrait) return { w: 120, h: 90, cornerSize: 8, fontSize: 9 };
  if (isMobile) return { w: 140, h: 105, cornerSize: 9, fontSize: 9 };
  return { w: 180, h: 130, cornerSize: 12, fontSize: 10 };
}

export class CameraPreview {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private statusEl: HTMLElement;
  private visible = false;
  private _landmarks: Landmark[] = [];
  private _fps = 0;
  private _camOk = false;
  private _mpOk = false;
  private _handFound = false;
  private _rafId = 0;
  private _videoRef: HTMLVideoElement | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "camera-preview-hud";
    this.container.style.cssText = [
      "position:fixed",
      "bottom:44px",
      "left:8px",
      "z-index:8000",
      "display:none",
      "flex-direction:column",
      "gap:3px",
      "user-select:none",
      "pointer-events:none",
    ].join(";");

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "display:block;border-radius:2px;transform:scaleX(-1);";

    this.statusEl = document.createElement("div");
    this.statusEl.style.cssText = [
      "font-family:monospace",
      "letter-spacing:.04em",
      "color:#7deaf4",
      "background:rgba(5,18,28,.82)",
      "padding:2px 5px",
      "border-radius:2px",
      "white-space:nowrap",
    ].join(";");

    this.container.appendChild(this.canvas);
    this.container.appendChild(this.statusEl);
    document.body.appendChild(this.container);

    this.ctx = this.canvas.getContext("2d")!;
    this._resize(false, false);
  }

  /** Attach the video element from HandTracker */
  setVideo(video: HTMLVideoElement | null) {
    this._videoRef = video;
  }

  /** Called when HandTracker state changes */
  setState(state: CameraBootState, trackingFps = 0) {
    this._fps = trackingFps;
    this._camOk = [
      "CAMERA_STREAM_READY",
      "VIDEO_PLAYING",
      "MEDIAPIPE_LOADING",
      "MEDIAPIPE_READY",
      "HAND_SEARCHING",
      "HAND_FOUND",
      "TRACKING",
    ].includes(state);
    this._mpOk = [
      "MEDIAPIPE_READY",
      "HAND_SEARCHING",
      "HAND_FOUND",
      "TRACKING",
    ].includes(state);
    this._handFound = state === "HAND_FOUND" || state === "TRACKING";

    const show = this._camOk;
    if (show !== this.visible) {
      this.visible = show;
      this.container.style.display = show ? "flex" : "none";
      if (show && !this._rafId) this._startLoop();
      if (!show && this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = 0;
      }
    }
    this._updateStatus();
  }

  /** Update landmarks for overlay rendering */
  setLandmarks(landmarks: Landmark[]) {
    this._landmarks = landmarks;
  }

  /** Call on viewport change */
  updateLayout(isPortrait: boolean, isMobile: boolean) {
    this._resize(isPortrait, isMobile);
  }

  private _resize(isPortrait: boolean, isMobile: boolean) {
    const { w, h } = getPreviewSize(isPortrait, isMobile);
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.statusEl.style.fontSize = getPreviewSize(isPortrait, isMobile).fontSize + "px";

    // Reposition bottom offset depending on statusbar height
    const footerH = isMobile ? 40 : 36;
    this.container.style.bottom = footerH + "px";
    this.container.style.left = (isMobile ? 6 : 8) + "px";
  }

  private _startLoop() {
    const loop = () => {
      if (!this.visible) { this._rafId = 0; return; }
      this._draw();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  private _draw() {
    const { canvas, ctx } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "rgba(5,18,28,0.88)";
    ctx.fillRect(0, 0, W, H);

    // Video frame — note canvas is CSS-mirrored via transform:scaleX(-1)
    // so we draw un-mirrored and CSS mirrors it visually
    if (this._videoRef && this._videoRef.readyState >= 2) {
      try {
        ctx.drawImage(this._videoRef, 0, 0, W, H);
      } catch { /* ignore */ }
    }

    // Landmark overlay
    if (this._handFound && this._landmarks.length === 21) {
      // Map MediaPipe 0-1 to canvas pixels (un-mirrored for matching CSS mirror)
      const pts = this._landmarks.map((lm) => ({
        x: lm.x * W,
        y: lm.y * H,
      }));

      // Connections
      ctx.strokeStyle = "rgba(0,220,200,0.7)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
      }
      ctx.stroke();

      // Joints
      ctx.fillStyle = "rgba(100,245,255,0.8)";
      for (const pt of pts) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fingertips
      ctx.fillStyle = "#ffffff";
      for (const idx of FINGERTIPS) {
        ctx.beginPath();
        ctx.arc(pts[idx].x, pts[idx].y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HUD frame — cyan corner brackets
    this._drawFrame(ctx, W, H);
  }

  private _drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const c = 10;
    const alpha = this._handFound ? 0.95 : 0.55;
    ctx.strokeStyle = `rgba(125,234,244,${alpha})`;
    ctx.lineWidth = 1.5;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(0, c); ctx.lineTo(0, 0); ctx.lineTo(c, 0);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(W - c, 0); ctx.lineTo(W, 0); ctx.lineTo(W, c);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(0, H - c); ctx.lineTo(0, H); ctx.lineTo(c, H);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(W - c, H); ctx.lineTo(W, H); ctx.lineTo(W, H - c);
    ctx.stroke();

    // Recording dot
    if (this._camOk) {
      ctx.fillStyle = this._handFound ? "#00ff88" : "#ff6644";
      ctx.beginPath();
      ctx.arc(W - 7, 7, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private _updateStatus() {
    const cam = this._camOk ? "📷✓" : "📷…";
    const mp = this._mpOk ? "AI✓" : "AI…";
    const hand = this._handFound ? "✋" : this._mpOk ? "SEARCHING" : "";
    const fps = this._fps > 0 ? ` ${Math.round(this._fps)}fps` : "";
    this.statusEl.textContent = [cam, mp, hand, fps].filter(Boolean).join(" · ");
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.container.remove();
  }
}
