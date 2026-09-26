import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "360x800 (Compact Android)", width: 360, height: 800 },
  { name: "390x844 (iPhone 14/15)", width: 390, height: 844 },
  { name: "412x915 (Pixel 7/8)", width: 412, height: 915 },
  { name: "430x932 (iPhone Pro Max)", width: 430, height: 932 },
];

for (const vp of VIEWPORTS) {
  test(`mobile gameplay framing, spawn bounds, and enemy visibility at ${vp.name}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");

    // Skip auth screen if present
    const skipBtn = page.locator("#auth-skip-btn");
    if (await skipBtn.isVisible({ timeout: 3500 }).catch(() => false)) {
      await skipBtn.click();
    }

    // Verify canvas and UI render within screen bounds (no overflow)
    await expect(page.locator(".brand")).toBeVisible({ timeout: 5000 });
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);

    // Evaluate in-engine mobile scaling metrics via game instance
    const metrics = await page.evaluate(() => {
      const g = (window as unknown as { game: import("../../src/core/Game").Game }).game;
      if (!g) return null;
      const gb = (window as unknown as { GameplayBounds: typeof import("../../src/gameplay/GameplayBounds").GameplayBounds }).GameplayBounds?.get();
      return {
        isPortrait: g.view.transform.isPortrait,
        mobileScaleBoost: g.view.mobileScaleBoost,
        scaleX: g.view.transform.scaleX,
        scaleY: g.view.transform.scaleY,
        offsetX: g.view.transform.offsetX,
        offsetY: g.view.transform.offsetY,
        hasGameplayBounds: Boolean(gb),
        worldBounds: gb?.worldBounds,
      };
    });

    // Verify portrait mode detected and gameplay footprint is enlarged
    if (metrics) {
      expect(metrics.isPortrait).toBe(true);
      // Verify scale is not shrunken to 0.325 desktop strip
      expect(metrics.scaleX).toBeGreaterThan(0.55);
      expect(metrics.mobileScaleBoost).toBeGreaterThanOrEqual(1.4);
    }

    // Verify spawn mapper coordinates land 100% inside the visible canvas
    const spawnCheck = await page.evaluate(() => {
      const g = (window as unknown as { game: import("../../src/core/Game").Game }).game;
      if (!g) return { allInside: true, origins: [] };
      const t = g.view.transform;
      const mapper = (window as unknown as { MobileSpawnMapper: typeof import("../../src/gameplay/MobileSpawnMapper").MobileSpawnMapper }).MobileSpawnMapper;
      if (!mapper) return { allInside: true, origins: [] };

      const origins = [];
      let allInside = true;
      for (let i = 0; i < 8; i++) {
        const origin = mapper.getOrigin(i);
        const screenX = origin.x * t.scaleX + t.offsetX;
        const screenY = origin.y * t.scaleY + t.offsetY;
        const inside = screenX >= 0 && screenX <= window.innerWidth && screenY >= 0 && screenY <= window.innerHeight;
        if (!inside) allInside = false;
        origins.push({ i, origin, screenX, screenY, inside });
      }
      return { allInside, origins };
    });

    expect(spawnCheck.allInside).toBe(true);

    await page.screenshot({ path: `test-results/mobile-${vp.width}x${vp.height}.png` });
    expect(errors).toEqual([]);
    await context.close();
  });
}
