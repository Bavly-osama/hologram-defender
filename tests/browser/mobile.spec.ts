import { expect, test } from "@playwright/test";
test("landscape touch controls and portrait recommendation remain usable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 667, height: 375 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play with mouse" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-landscape.png" });
  await page.getByRole("button", { name: "Play with mouse" }).tap();
  await page.touchscreen.tap(300, 180);
  await page.touchscreen.tap(500, 180);
  await expect(page.locator("#tutorial-title")).toHaveText("AIM AT THE TARGET");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#rotate")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile-portrait.png" });
  await context.close();
});
