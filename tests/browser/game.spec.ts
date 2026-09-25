import { expect, test } from "@playwright/test";
test("mouse pilot completes training, fires in combat, pauses and resumes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play with mouse" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/launch-desktop.png" });
  await page.getByRole("button", { name: "Play with mouse" }).click();
  await page.mouse.move(500, 350);
  await page.mouse.move(850, 350);
  await expect(page.locator("#tutorial-title")).toHaveText("AIM AT THE TARGET");
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Missing canvas");
  const at = (x: number, y: number) => ({
    x: canvas.x + (x / 1200) * canvas.width,
    y: canvas.y + (y / 750) * canvas.height,
  });
  const target = at(600, 260);
  await page.mouse.move(target.x, target.y);
  await expect(page.locator("#tutorial-title")).toHaveText(
    "BLOCK THE ATTACK",
    { timeout: 10000 },
  );
  const block = at(750, 420);
  await page.mouse.move(block.x, block.y);
  await expect(page.locator("#app")).toHaveAttribute("data-state", "PLAYING", {
    timeout: 15000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/combat-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Resume defense" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume defense" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-state", "PLAYING");
  expect(errors).toEqual([]);
});
