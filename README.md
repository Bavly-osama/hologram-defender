# Hologram Defender

A playable, five-wave spatial arcade defense game. Move one hand to aim and shield; pinch thumb and index finger once to fire. Mouse and touch modes use the same combat systems.

## Run locally

Requires Node.js **22.13 or newer** (Node 24 recommended). SQLite uses Node's built-in `node:sqlite` module; no database service or native SQLite addon is required.

```sh
npm install
npm run prepare:tracking
npm run dev
```

Open **http://localhost:5173**. The API runs on port **3001** and Vite proxies `/api` to it. Tracking assets are included in this workspace; `prepare:tracking` refreshes the pinned MediaPipe WASM files and Google's hand model. The initial asset preparation needs internet; inference and gameplay do not send camera frames anywhere.

```sh
npm run build
npm start
```

The production server serves the built game and API at **http://localhost:3001**. For a remote device, use HTTPS: browsers do not allow camera capture on ordinary LAN HTTP URLs. Mouse/touch play works without a camera. `HOST`, `PORT`, `DATABASE_PATH`, and `TRUST_PROXY` are environment settings; see `.env.example`.

## Controls

| Action               | Hand                         | Mouse / touch              |
| -------------------- | ---------------------------- | -------------------------- |
| Move shield and aim  | Move your index finger       | Move pointer / drag        |
| Energy pulse         | Pinch once; release to rearm | Click / tap                |
| Pause                | Pause button                 | Escape, P, or pause button |
| Select a menu button | Aim over it and pinch        | Click / tap                |

The first run teaches movement, a shot, and an interception. Settings, tutorial completion, the last result, and personal best are saved locally. Sound, input mode, and quality can be changed in the bottom bar. Backquote toggles the developer HUD **only in development**.

If a hand is briefly lost, the pointer holds for 150 ms, fades until 350 ms, and the game pauses after sustained loss. Tab hiding pauses the game. Bring the hand back and resume, or switch to mouse.

## Gameplay

- Five waves: scouts, kamikaze orbs, armored heavies, mixed pressure, then Sentinel.
- Shield intercepts projectiles and small enemies; heavies are damaged and knocked back.
- Heavy center hits deal bonus damage. Target assist keeps a nearby target through small tracking jitter.
- Sentinel has three phases: central eye, three sequential armor nodes, then an aggressive exposed core with reinforcements.
- Shots cost 8 energy; 19 energy regenerates per second. Hits build a timed combo up to ×4. Misses reset it.
- Recovery between waves restores energy. Results include accuracy and integrity bonuses.
- Leaderboard failure never blocks a run. Results remain on the device and can be retried.

## Architecture

`src/core/Game.ts` coordinates explicit states and systems. Simulation is independent of Pixi and browser APIs, so meaningful combat and input tests run without WebGL.

| Directory                                    | Responsibility                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/core`                                   | State lifecycle, orchestration, shared coordinates, persistence                            |
| `src/tracking`, `src/gestures`, `src/input`  | Local MediaPipe worker, adaptive smoothing, presence, pinch hysteresis, pointer input      |
| `src/gameplay`, `src/enemies`                | Pooled combat entities, swept collision, scoring, waves, boss phases, animation controller |
| `src/rendering`, `src/effects`, `src/assets` | Explicit Pixi layers, core/shield visuals, generated atlases, pooled particles/FX          |
| `src/ui`, `src/audio`, `src/performance`     | DOM HUD/screens, synthesized sound events, capped/adaptive quality                         |
| `server/src`                                 | Fastify endpoints, validated score service, replaceable repository abstraction             |

Tune gameplay in `src/gameplay/gameBalance.ts`. Simulation coordinates are 1200 × 750, mapped to the viewport. Hand x is mirrored exactly once in `normalizeHandPoint`.

MediaPipe's WASM loader uses `importScripts`, so `prepare:worker` bundles a **classic worker**, rather than a module worker. Both `dev` and `build` run this preparation automatically. Model/WASM paths are same-origin under `public/tracking`.

## Art and sound

The included visual assets are original procedural fallback art, baked into small Pixi spritesheets at startup. Enemies use `AnimatedSprite` through `EnemyAnimationController`; animation updates use delta time. Particles, bursts, score labels, and projectiles are pooled.

To use final art, set an `atlas` URL in `src/assets/AssetManifest.ts`. Supply a TexturePacker-compatible JSON atlas with PNG or WebP and `SPAWN`, `MOVE`, `ATTACK`, `HIT`, and `DEATH` animation names. Missing atlas loading falls back to generated art. The current fallback uses shared animation frames for some states, with hit tint and pooled death effects; authored final animation can replace it without changing AI.

Sound effects are original synthesized Web Audio cues. `AudioManager` owns named events and safely degrades to silence if audio is unavailable. Google Fonts enhance typography; system fallbacks remain functional if font delivery is unavailable.

## Leaderboard API

`POST /api/scores`

```json
{
  "playerName": "Pilot 07",
  "score": 4200,
  "wave": 3,
  "coreIntegrity": 80,
  "accuracy": 0.75,
  "duration": 95
}
```

`GET /api/leaderboard?limit=10` returns `{ "scores": [...] }`, sorted by score. Limits are 1–50. Names allow 1–20 ASCII letters, numbers, spaces, underscores, periods, and hyphens, beginning with a letter or digit. Inputs reject additional fields, invalid bounds, and implausible duration/score combinations. Submission rate is 10/minute/IP, payload size is 2 KB, and SQL uses parameters.

SQLite stores data at `data/leaderboard.sqlite`. `ScoreRepository` separates storage from the service and can be implemented with PostgreSQL later. Scores are client-reported with basic abuse checks, **not authoritative anti-cheat**. Enable `TRUST_PROXY` only behind a trusted proxy.

## Verification

```sh
npm test
npm run build
npm run test:browser
```

Install Playwright's Chromium if needed: `npx playwright install chromium`.

Browser tests use real pointer/touch input to complete training, pause/resume, and play all five waves through all three Sentinel phases. A read-only development snapshot helps the automated pilot locate enemies; it does not change game state and is not exposed in production. Other checks cover camera denial and actual MediaPipe model/worker initialization using a synthetic camera feed. A full run takes several minutes. Screenshots are written to `test-results/`.

**Real-user testing remains essential:** synthetic camera frames cannot validate physical hand comfort, lighting tolerance, mirroring perception, or pinch reliability across different hands and webcams. Mobile browser emulation cannot certify physical-device FPS or thermal behavior. See `docs/USER_TESTING.md` for the next test pass.

## Upstream references

- [PixiJS application lifecycle](https://pixijs.com/8.x/guides/components/application)
- [MediaPipe Hand Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- The MediaPipe runtime comes from `@mediapipe/tasks-vision` 0.10.32; the model is Google's published float16 hand-landmarker model. See upstream licensing before redistributing third-party assets in a commercial bundle.
