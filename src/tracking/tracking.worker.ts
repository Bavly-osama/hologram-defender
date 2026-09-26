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
      let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
      try {
        vision = await FilesetResolver.forVisionTasks("/tracking/wasm");
      } catch (wasmErr) {
        console.warn("[Worker] Local WASM failed, falling back to CDN", wasmErr);
        vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm",
        );
      }

      async function createTracker(modelPath: string) {
        try {
          console.log("[Worker] Attempting GPU delegate with", modelPath);
          return await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.50,
            minTrackingConfidence: 0.40,
          });
        } catch (gpuErr) {
          console.warn("[Worker] GPU delegate failed, falling back to CPU", gpuErr);
          return await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.50,
            minTrackingConfidence: 0.40,
          });
        }
      }

      try {
        tracker = await createTracker("/tracking/hand_landmarker.task");
      } catch (modelErr) {
        console.warn("[Worker] Local model failed, falling back to CDN", modelErr);
        tracker = await createTracker(
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        );
      }

      self.postMessage({ type: "ready" });
    } else if (tracker && event.data.bitmap) {
      const result = tracker.detectForVideo(event.data.bitmap, event.data.time);
      const score = result.handedness?.[0]?.[0]?.score ?? (result.landmarks[0]?.length ? 0.8 : 0);
      self.postMessage({
        type: "result",
        landmarks: result.landmarks[0] ?? [],
        confidence: score,
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
