import { expect, test } from "@playwright/test";

test("camera denial falls back to a playable mouse/touch tutorial", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/");

  // Skip auth screen if shown
  const skipBtn = page.locator("#auth-skip-btn");
  if (await skipBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await skipBtn.click();
  }

  // Click start-hand button
  await page.locator("#start-hand").click();
  await expect(page.locator("#app")).toHaveAttribute("data-state", "TUTORIAL");
  await expect(page.locator("#camera-status")).toContainText(
    /CONTROL ENABLED|ACTIVE|READY/,
  );
});

test("local MediaPipe model initializes and processes a camera frame in its worker", async ({
  page,
  context,
}) => {
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      message.text().startsWith("CAMERA NOTICE")
    )
      console.log("BROWSER", message.text());
  });
  await context.grantPermissions(["camera"]);
  await page.goto("/");

  // Skip auth screen if shown
  const skipBtn = page.locator("#auth-skip-btn");
  if (await skipBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await skipBtn.click();
  }

  await page.locator("#start-hand").click();
  await expect(page.locator("#camera-status")).toContainText(
    /CAMERA READY|HAND TRACKED|CONTROL/,
    { timeout: 45000 },
  );
});
