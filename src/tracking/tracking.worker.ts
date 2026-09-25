import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
let tracker: HandLandmarker | undefined;
self.onmessage = async (
  event: MessageEvent<{
    type: "init" | "frame";
    bitmap?: ImageBitmap;
    time: number;
  }>,
) => {
  try {
    if (event.data.type === "init") {
      const vision = await FilesetResolver.forVisionTasks("/tracking/wasm");
      tracker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/tracking/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      self.postMessage({ type: "ready" });
    } else if (tracker && event.data.bitmap) {
      const result = tracker.detectForVideo(event.data.bitmap, event.data.time);
      self.postMessage({
        type: "result",
        landmarks: result.landmarks[0] ?? [],
      });
    }
  } catch (error) {
    console.error("Hand tracking worker failed", error);
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Tracking failed",
    });
  } finally {
    event.data.bitmap?.close();
  }
};
