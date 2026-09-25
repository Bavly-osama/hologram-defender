import { expect, test } from "@playwright/test";
interface Snapshot {
  state: string;
  wave: number;
  health: number;
  score: number;
  time: number;
  enemies: {
    id: number;
    kind: string;
    x: number;
    y: number;
    hp: number;
    phase: number;
    weak: { x: number; y: number };
  }[];
  projectiles: { team: string; x: number; y: number }[];
}
test("plays all five waves through Sentinel victory with real mouse input", async ({
  page,
}) => {
  test.setTimeout(600000);
  await page.setViewportSize({ width: 960, height: 600 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "hd.settings",
      JSON.stringify({
        tutorial: true,
        sound: false,
        mode: "mouse",
        quality: "low",
      }),
    ),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Play with mouse" }).click();
  const canvas = (await page.locator("canvas").boundingBox())!;
  const move = async (x: number, y: number, fire: boolean) => {
    const px = canvas.x + (x / 1200) * canvas.width,
      py = canvas.y + (y / 750) * canvas.height;
    if (fire) await page.mouse.click(px, py);
    else await page.mouse.move(px, py);
  };
  const snapshots: {
    wave: number;
    time: number;
    health: number;
    score: number;
  }[] = [];
  const phases = new Set<number>();
  let lastShot = 0;
  for (let i = 0; i < 2000; i++) {
    const s = await page.evaluate<Snapshot>(
      "window.__defenderDebug.snapshot()",
    );
    if (s.wave > (snapshots.at(-1)?.wave ?? 0)) {
      snapshots.push({
        wave: s.wave,
        time: s.time,
        health: s.health,
        score: s.score,
      });
      console.log("WAVE", s.wave, "TIME", s.time, "HEALTH", s.health);
      await page.screenshot({ path: `test-results/wave-${s.wave}.png` });
    }
    const boss = s.enemies.find((e) => e.kind === "boss");
    if (boss) phases.add(boss.phase);
    if (s.state === "VICTORY" || s.state === "RESULTS") break;
    expect(s.state, `core integrity ${s.health}, wave ${s.wave}`).not.toBe(
      "GAME_OVER",
    );
    const danger = s.projectiles.find(
      (p) => p.team === "hostile" && Math.hypot(p.x - 600, p.y - 585) < 180,
    );
    const enemy = s.enemies.find((e) => e.kind !== "boss") ?? boss;
    if (danger) await move(danger.x, danger.y, false);
    else if (enemy) {
      const shoot = Date.now() - lastShot > 460;
      await move(enemy.weak.x, enemy.weak.y, shoot);
      if (shoot) lastShot = Date.now();
    }
    await page.waitForTimeout(120);
  }
  await expect(page.getByText("You held the line.")).toBeVisible({
    timeout: 15000,
  });
  expect([...phases].sort()).toEqual([1, 2, 3]);
  expect(snapshots).toHaveLength(5);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/victory.png" });
  await test.info().attach("run-metrics", {
    body: JSON.stringify(snapshots, null, 2),
    contentType: "application/json",
  });
  await page.getByLabel("PILOT CALLSIGN").fill("Test Pilot");
  await page.route("**/api/scores", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.getByRole("button", { name: "Save score" }).click();
  await expect(page.locator("#save-status")).toHaveText(
    "Leaderboard offline. Your result is safe on this device.",
  );
  await page.unroute("**/api/scores");
  await page.getByRole("button", { name: "Save score" }).click();
  await expect(page.locator("#save-status")).toHaveText("Flight record saved.");
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(page.locator("#scores")).toContainText("Test Pilot");
});
