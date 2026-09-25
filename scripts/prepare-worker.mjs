import { build } from "esbuild";
await build({
  entryPoints: ["src/tracking/tracking.worker.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  outfile: "public/tracking/hand-worker.js",
});
console.log("Classic MediaPipe worker built.");
