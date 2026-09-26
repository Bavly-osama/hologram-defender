import { expect, test } from "@playwright/test";

test("mobile responsive layout, portrait adaptation, and touch controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Typical modern mobile portrait
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  await page.goto("/");

  // Skip auth screen if shown
  const skipBtn = page.locator("#auth-skip-btn");
  if (await skipBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await skipBtn.click();
  }

  // Verify responsive home screen rendered without horizontal overflow
  await expect(page.locator(".brand")).toBeVisible();
  const fitsWidth = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsWidth).toBe(true);

  // Take mobile portrait screenshot
  await page.screenshot({ path: "test-results/mobile-portrait-home.png" });

  // Start campaign in touch mode
  const playTouchBtn = page.locator("#start-mouse");
  await expect(playTouchBtn).toBeVisible();
  await playTouchBtn.tap();

  // Test touch interaction on canvas
  await page.touchscreen.tap(195, 420);
  await page.touchscreen.tap(220, 380);

  // Switch to landscape orientation and verify adaptation
  await page.setViewportSize({ width: 844, height: 390 });
  const fitsLandscape = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsLandscape).toBe(true);

  await page.screenshot({ path: "test-results/mobile-landscape.png" });
  await context.close();
});
