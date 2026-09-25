import { expect, test } from "@playwright/test";
test("production build renders and starts tracking under secure headers", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.grantPermissions(["camera"], {
    origin: "http://localhost:3001",
  });
  const response = await page.goto("http://localhost:3001");
  expect(response?.headers()["content-security-policy"]).toContain(
    "script-src 'self' 'wasm-unsafe-eval'",
  );
  await expect(
    page.getByRole("button", { name: "Play with mouse" }),
  ).toBeVisible();
  expect(await page.evaluate("typeof window.__defenderDebug")).toBe(
    "undefined",
  );
  await page.getByRole("button", { name: "Activate hand control" }).click();
  await expect(page.locator("#camera-status")).toContainText(
    /CAMERA READY|HAND TRACKED/,
    { timeout: 45000 },
  );
  await expect(page.locator("#app")).toHaveAttribute("data-state", "PAUSED", {
    timeout: 15000,
  });
  expect(errors).toEqual([]);
});
