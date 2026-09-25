import { expect, test } from "@playwright/test";

test("pilot opens orbital armory, browses tabs, inspects metrics, and returns to game", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  // 1. Check wallet pill on masthead
  const wallet = page.locator("#hud-wallet");
  await expect(wallet).toBeVisible();
  await expect(page.locator("#wallet-credits")).toHaveText("0");

  // 2. Open Armory from home screen
  const armoryBtn = page.locator("#armory-home");
  await expect(armoryBtn).toBeVisible();
  await armoryBtn.click();

  // 3. Shop Modal displayed
  const shopModal = page.locator(".shop-modal");
  await expect(shopModal).toBeVisible();
  await expect(page.locator("#shop-title")).toContainText("ORBITAL ARMORY");
  await expect(page.locator("#shop-credits-val")).toHaveText("0");

  // 4. Tab switching
  await page.click('button[data-tab="shields"]');
  await expect(page.locator(".shop-card-title").first()).toContainText("STANDARD SHIELD");

  await page.click('button[data-tab="upgrades"]');
  await expect(page.locator(".shop-card-title").first()).toContainText("CORE ARMOR");

  await page.click('button[data-tab="skins"]');
  await expect(page.locator(".shop-card-title").first()).toContainText("CLASSIC CYAN");

  // Screenshot of armory modal
  await page.screenshot({ path: "test-results/armory-modal.png" });

  // 5. Close shop
  await page.click("#shop-close-btn");
  await expect(shopModal).not.toBeVisible();

  // 6. Masthead Armory button test
  await page.click("#armory-btn");
  await expect(shopModal).toBeVisible();
  await page.click("#shop-return-btn");
  await expect(shopModal).not.toBeVisible();

  expect(errors).toEqual([]);
});
