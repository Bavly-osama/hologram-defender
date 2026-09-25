import { mkdir, cp, writeFile } from "node:fs/promises";
await mkdir("public/tracking/wasm", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/tracking/wasm", {
  recursive: true,
});
const response = await fetch(
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
);
if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
await writeFile(
  "public/tracking/hand_landmarker.task",
  Buffer.from(await response.arrayBuffer()),
);
console.log(
  "MediaPipe WASM and hand model prepared for local, private inference.",
);
