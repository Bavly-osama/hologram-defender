import { type Landmark } from "./HandState";
import { CameraPreview } from "../rendering/CameraPreview";

// ── 12 deterministic camera boot states ─────────────────────────────────────
export type CameraBootState =
  | "CAMERA_IDLE"          // not started
  | "CAMERA_REQUESTING"    // getUserMedia pending
  | "CAMERA_STREAM_READY"  // stream acquired, video not yet playing
  | "VIDEO_PLAYING"        // video.play() resolved
  | "MEDIAPIPE_LOADING"    // Worker started, waiting for "ready"
  | "MEDIAPIPE_READY"      // Worker "ready" received
  | "HAND_SEARCHING"       // tracking, no hand detected
  | "HAND_FOUND"           // hand present, about to emit landmarks
  | "TRACKING"             // steady tracking (hand continuously present)
  | "CAMERA_DENIED"        // user denied permission
  | "CAMERA_ERROR"         // non-permission error
  | "TRACKING_ERROR";      // error after tracking was working

/** Legacy alias for backwards-compat with callers using 4-state enum */
export type CameraState = "REQUEST" | "LOADING" | "READY" | "DENIED" | "ERROR";

function toLegacyState(s: CameraBootState): CameraState {
  if (s === "CAMERA_IDLE" || s === "CAMERA_REQUESTING") return "REQUEST";
  if (
    s === "CAMERA_STREAM_READY" ||
    s === "VIDEO_PLAYING" ||
    s === "MEDIAPIPE_LOADING"
  )
    return "LOADING";
  if (
    s === "MEDIAPIPE_READY" ||
    s === "HAND_SEARCHING" ||
    s === "HAND_FOUND" ||
    s === "TRACKING"
  )
    return "READY";
  if (s === "CAMERA_DENIED") return "DENIED";
  return "ERROR";
}

interface WorkerReply {
  type: "ready" | "result" | "error";
  landmarks?: Landmark[];
  confidence?: number;
  message?: string;
}

/** How long (ms) to retain hand data after last detection before fading */
const HAND_RETAIN_MS = 200;
/** How long (ms) after retain period before moving to HAND_SEARCHING */
const HAND_FADE_MS = 250;

export class HandTracker {
  /** Full 12-state boot state (exported for CameraPreview) */
  bootState: CameraBootState = "CAMERA_IDLE";

  /** Legacy 5-state for Game.ts / HUD (backwards compat) */
  get state(): CameraState {
    return toLegacyState(this.bootState);
  }

  readonly video = document.createElement("video");
  readonly preview = new CameraPreview();

  private worker?: Worker;
  private stream?: MediaStream;
  private busy = false;
  private lastFrame = -1;
  private lastInference = 0;
  private generation = 0;
  private frameCount = 0;
  private inferenceCount = 0;
  private meterTime = 0;
  private lastHandTime = -Infinity;
  private hasNewFrame = true;

  cameraFps = 0;
  trackingFps = 0;
  confidence = 0;
  lastResult = 0;
  interval = 50;

  onLandmarks: (landmarks: Landmark[], time: number, confidence?: number) => void = () => {};
  /** Called with both legacy CameraState AND a human-readable message */
  onState: (state: CameraState, message: string) => void = () => {};
  /** Called with the full 12-state name */
  onBootState: (state: CameraBootState, message: string) => void = () => {};

  private _change(state: CameraBootState, message: string) {
    this.bootState = state;
    this.preview.setState(state, this.trackingFps);
    this.onBootState(state, message);
    this.onState(toLegacyState(state), message);
  }

  async start() {
    this.stop();
    const generation = this.generation;
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    // ── STATE 1: CAMERA_REQUESTING ───────────────────────────────────────────
    this._change("CAMERA_REQUESTING", "Allow camera access to activate hand control");

    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera requires HTTPS or localhost");

      // Mobile-optimized constraints: 480x360 on mobile (lighter, faster), 640x480 on desktop
      const idealW = isTouch ? 480 : 640;
      const idealH = isTouch ? 360 : 480;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: idealW, max: idealW },
            height: { ideal: idealH, max: idealH },
            frameRate: { ideal: 24, max: 30 },
          },
          audio: false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 320, max: 480 },
              height: { ideal: 240, max: 360 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.stream = stream;

      // ── STATE 2: CAMERA_STREAM_READY ─────────────────────────────────────
      this._change("CAMERA_STREAM_READY", "Camera stream ready · starting video");

      // Set up video element for mobile compatibility
      const vid = this.video;
      vid.setAttribute("playsinline", "true");
      vid.setAttribute("webkit-playsinline", "true");
      vid.setAttribute("muted", "true");
      vid.setAttribute("autoplay", "true");
      vid.muted = true;
      vid.playsInline = true;
      vid.autoplay = true;
      // Invisible but in DOM (required for mobile play)
      vid.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0.001;pointer-events:none;left:-9999px;top:-9999px;z-index:-1;";
      if (!vid.parentElement && document.body) document.body.appendChild(vid);

      vid.srcObject = stream;

      // Feed video to CameraPreview
      this.preview.setVideo(vid);

      // Play with a 5s race-timeout (mobile can be slow)
      await Promise.race([
        vid.play(),
        new Promise<void>((_, rej) =>
          setTimeout(() => rej(new Error("Video playback timeout")), 5000),
        ),
      ]).catch(() => {
        // Play rejection is non-fatal on some browsers; continue
      });

      // Hook requestVideoFrameCallback if available to synchronize frame capture
      if ("requestVideoFrameCallback" in vid) {
        const onFrame = () => {
          if (generation === this.generation && this.stream) {
            this.hasNewFrame = true;
            (vid as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(onFrame);
          }
        };
        (vid as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(onFrame);
      }

      // ── STATE 3: VIDEO_PLAYING ───────────────────────────────────────────
      this._change("VIDEO_PLAYING", "Video playing · loading hand AI");

      // ── STATE 4: MEDIAPIPE_LOADING ───────────────────────────────────────
      this._change(
        "MEDIAPIPE_LOADING",
        "Loading hand recognition AI · Camera stays private",
      );

      this.worker = new Worker("/tracking/hand-worker.js");

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () =>
            reject(
              new Error(
                isTouch
                  ? "Hand tracking timed out · Touch control enabled"
                  : "Hand model loading timed out · Try mouse mode",
              ),
            ),
          15000,
        );

        this.worker!.onerror = () => {
          clearTimeout(timeout);
          reject(
            new Error(
              isTouch
                ? "Hand tracking worker failed · Touch control enabled"
                : "Hand tracking worker failed",
            ),
          );
        };

        this.worker!.onmessage = (event: MessageEvent<WorkerReply>) => {
          if (event.data.type === "ready") {
            clearTimeout(timeout);
            resolve();
          }
          if (event.data.type === "error") {
            clearTimeout(timeout);
            reject(new Error(event.data.message));
            this.busy = false;
            if (
              this.bootState === "TRACKING" ||
              this.bootState === "HAND_FOUND" ||
              this.bootState === "HAND_SEARCHING"
            ) {
              this._change(
                "TRACKING_ERROR",
                isTouch
                  ? "Tracking interrupted · Switch to touch or retry"
                  : "Tracking interrupted · Switch to mouse or retry",
              );
            }
          }
          if (event.data.type === "result") {
            this.busy = false;
            this.lastResult = performance.now();
            this.inferenceCount++;
            const landmarks = event.data.landmarks ?? [];
            this.confidence = event.data.confidence ?? (landmarks.length > 0 ? 0.85 : 0);

            if (landmarks.length > 0) {
              this.lastHandTime = this.lastResult;
              // Move to HAND_FOUND / TRACKING
              if (
                this.bootState !== "HAND_FOUND" &&
                this.bootState !== "TRACKING"
              ) {
                this._change("HAND_FOUND", "Hand detected · tracking active");
              } else if (this.bootState === "HAND_FOUND") {
                this._change("TRACKING", "Tracking · steady");
              }
            } else {
              // No landmarks — decide state by how long hand has been missing
              const missing = this.lastResult - this.lastHandTime;
              if (missing < HAND_RETAIN_MS) {
                // Still within retain window — keep current state
              } else if (missing < HAND_RETAIN_MS + HAND_FADE_MS) {
                // Fade window
                if (this.bootState === "TRACKING" || this.bootState === "HAND_FOUND") {
                  this._change("HAND_SEARCHING", "Hand not visible · show your palm");
                }
              } else {
                if (this.bootState !== "HAND_SEARCHING") {
                  this._change("HAND_SEARCHING", "Hand not visible · show your palm");
                }
              }
            }

            this.onLandmarks(landmarks, this.lastResult, this.confidence);
          }
        };

        this.worker!.postMessage({ type: "init" });
      });

      if (generation !== this.generation) return;

      this.stream
        .getVideoTracks()[0]
        ?.addEventListener("ended", () => {
          this._change(
            "CAMERA_ERROR",
            isTouch
              ? "Camera stopped · Switched to touch controls"
              : "Camera stopped · Switch to mouse or reconnect",
          );
        });

      this.lastResult = performance.now();
      this.lastHandTime = -Infinity;

      // ── STATE 5: MEDIAPIPE_READY / HAND_SEARCHING ───────────────────────
      this._change("MEDIAPIPE_READY", "AI ready · show one hand to the camera");
      // Immediately transition to searching
      this._change("HAND_SEARCHING", "Hand not visible · show your palm");
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      const isDenied =
        error instanceof DOMException && error.name === "NotAllowedError";
      this._change(
        isDenied ? "CAMERA_DENIED" : "CAMERA_ERROR",
        isDenied
          ? isTouch
            ? "Camera denied · Touch control active"
            : "Camera unavailable · Mouse control enabled"
          : error instanceof Error
            ? error.message
            : isTouch
              ? "Hand tracking unavailable · Touch control active"
              : "Camera unavailable · Use mouse control",
      );
    }
  }

  tick(now: number) {
    const ls = this.bootState;
    if (
      ls !== "MEDIAPIPE_READY" &&
      ls !== "HAND_SEARCHING" &&
      ls !== "HAND_FOUND" &&
      ls !== "TRACKING"
    )
      return;

    if (!this.worker || this.video.readyState < 2 || this.video.videoWidth === 0)
      return;

    // If requestVideoFrameCallback is supported, only run inference on fresh camera frames
    if ("requestVideoFrameCallback" in this.video && !this.hasNewFrame) {
      return;
    }

    if (this.video.currentTime !== this.lastFrame) {
      this.frameCount++;
      this.lastFrame = this.video.currentTime;
    }

    if (now - this.meterTime > 1000) {
      const seconds = (now - this.meterTime) / 1000;
      this.cameraFps = this.frameCount / seconds;
      this.trackingFps = this.inferenceCount / seconds;
      this.frameCount = 0;
      this.inferenceCount = 0;
      this.meterTime = now;
      // Update preview FPS display
      this.preview.setState(this.bootState, this.trackingFps);
    }

    if (this.busy || now - this.lastInference < this.interval || document.hidden)
      return;

    this.busy = true;
    this.hasNewFrame = false;
    this.lastInference = now;
    const worker = this.worker;

    createImageBitmap(this.video)
      .then((bitmap) => {
        if (worker === this.worker)
          worker.postMessage({ type: "frame", bitmap, time: now }, [bitmap]);
        else bitmap.close();
      })
      .catch(() => {
        this.busy = false;
      });
  }

  stop() {
    this.generation++;
    this.worker?.terminate();
    this.worker = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.video.srcObject = null;
    this.preview.setVideo(null);
    if (this.video.parentElement) this.video.remove();
    this.busy = false;
    this.lastFrame = -1;
    if (this.bootState !== "CAMERA_IDLE") {
      this._change("CAMERA_IDLE", "Camera stopped");
    }
  }
}
