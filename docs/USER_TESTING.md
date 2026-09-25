# Real-user testing pass

The automated tests validate simulation and browser flows. The following checks need a person, a camera, and representative physical devices. Do not treat an automated five-wave victory as evidence that hand control is comfortable or that mobile FPS is stable.

## First two minutes: hand control and scouts

1. Open the game on localhost or HTTPS and choose hand control.
2. Use one hand in ordinary room lighting. Complete the three-step tutorial.
3. Move physically left, right, up, and down. Confirm the shield follows the perceived direction without a second mirror.
4. Pinch repeatedly, including a two-second hold. Confirm exactly one shot per pinch, and no held-pinch autofire.
5. Sweep slowly over a drone, then move quickly across the arena. Check jitter at rest and lag during fast movement.
6. Play for two minutes using only movement and pinch. Judge target readability, shot feedback, arm fatigue, shield coverage, and spawn pacing.
7. Briefly occlude the hand; confirm pointer hold/fade. Remove it for two seconds; confirm pause without unfair attacks. Return the hand and resume.

Record browser, device, webcam, lighting, dominant hand, approximate distance, observed FPS/tracking FPS, and the first moment controls felt unreliable. Tune recognition thresholds and smoothing before increasing content complexity.

## Combat and progression

- Complete waves 1–4. Confirm the red eye is visible on scouts, orbs feel more urgent, and heavy weak-point shots matter.
- Intercept a heavy or boss projectile, then destroy its source quickly; verify the counter reward.
- Verify Sentinel central-eye phase, three illuminated nodes, and final aggressive phase are understandable without new gestures.
- Let the core fail, review results, replay, and compare the saved personal best.
- Disconnect the API and submit a score. Confirm local results remain and gameplay is unaffected.

## Mobile / accessibility

- Test physical iOS Safari and Android Chrome in landscape; use touch fallback first, then camera mode over HTTPS.
- Test low/high/auto quality at the start and after five minutes of heat buildup. Record rendering and tracking rates separately.
- Rotate during gameplay. Confirm the pointer maps to the new viewport and controls remain reachable.
- Deny camera permission; unplug/stop the camera; hide and return to the tab; test blocked localStorage and unavailable audio.
- Verify button focus and keyboard pause. Gameplay still requires spatial pointing; this release does not offer a keyboard-only aiming mode.

## Expected release limitations

- Procedural enemy and FX artwork is replaceable fallback art; final authored spritesheets and recorded audio are not included.
- API validation and rate limits discourage basic abuse but cannot prove a client-submitted score is legitimate.
- Real hand tracking accuracy and physical mobile performance require the tests above; neither is certified by the automated suite.
