import { type Landmark } from "./HandState";
export type CameraState = "REQUEST" | "LOADING" | "READY" | "DENIED" | "ERROR";
interface WorkerReply {
  type: "ready" | "result" | "error";
  landmarks?: Landmark[];
  message?: string;
}
export class HandTracker {
  state: CameraState = "REQUEST";
  readonly video = document.createElement("video");
  private worker?: Worker;
  private stream?: MediaStream;
  private busy = false;
  private lastFrame = -1;
  private lastInference = 0;
  private generation = 0;
  private frameCount = 0;
  private inferenceCount = 0;
  private meterTime = 0;
  cameraFps = 0;
  trackingFps = 0;
  lastResult = 0;
  interval = 50;
  onLandmarks: (landmarks: Landmark[], time: number) => void = () => {};
  onState: (state: CameraState, message: string) => void = () => {};
  private change(state: CameraState, message: string) {
    this.state = state;
    this.onState(state, message);
  }
  async start() {
    this.stop();
    const generation = this.generation;
    this.change("REQUEST", "Allow camera access to activate hand control");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera requires localhost or HTTPS");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      this.change(
        "LOADING",
        "Loading hand recognition · camera stays on this device",
      );
      // MediaPipe's WASM glue uses importScripts; it needs a classic bundled worker.
      this.worker = new Worker("/tracking/hand-worker.js");
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () =>
            reject(new Error("Hand model loading timed out. Try mouse mode.")),
          30000,
        );
        this.worker!.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Hand tracking worker could not start"));
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
            if (this.state === "READY")
              this.change(
                "ERROR",
                "Tracking interrupted. Switch to mouse or retry.",
              );
          }
          if (event.data.type === "result") {
            this.busy = false;
            this.lastResult = performance.now();
            this.inferenceCount++;
            this.onLandmarks(event.data.landmarks ?? [], this.lastResult);
          }
        };
        this.worker!.postMessage({ type: "init" });
      });
      if (generation !== this.generation) return;
      this.stream
        .getVideoTracks()[0]
        .addEventListener("ended", () =>
          this.change("ERROR", "Camera stopped. Switch to mouse or reconnect."),
        );
      this.lastResult = performance.now();
      this.change("READY", "Camera ready · show one hand");
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      const denied =
        error instanceof DOMException && error.name === "NotAllowedError";
      this.change(
        denied ? "DENIED" : "ERROR",
        denied
          ? "Camera unavailable · mouse control enabled"
          : error instanceof Error
            ? error.message
            : "Camera unavailable · use mouse control",
      );
    }
  }
  tick(now: number) {
    if (this.state !== "READY" || !this.worker || this.video.readyState < 2)
      return;
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
    }
    if (
      this.busy ||
      now - this.lastInference < this.interval ||
      document.hidden
    )
      return;
    this.busy = true;
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
    this.busy = false;
    this.lastFrame = -1;
  }
}
