import { expect, test } from "@playwright/test";
test("camera denial falls back to a playable mouse tutorial", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Activate hand control" }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-state", "TUTORIAL");
  await expect(page.locator("#camera-status")).toHaveText(
    "MOUSE CONTROL ENABLED",
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
  await page.addInitScript(() => {
    let previous = "";
    const observer = new MutationObserver(() => {
      const notice = document.getElementById("notice");
      if (
        notice &&
        !notice.hidden &&
        notice.textContent &&
        notice.textContent !== previous
      ) {
        previous = notice.textContent;
        console.log("CAMERA NOTICE", notice.textContent);
      }
    });
    document.addEventListener("DOMContentLoaded", () =>
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      }),
    );
  });
  await context.grantPermissions(["camera"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Activate hand control" }).click();
  await expect(page.locator("#camera-status")).toContainText(
    /CAMERA READY|HAND TRACKED/,
    { timeout: 45000 },
  );
  await page.keyboard.press("Backquote");
  await expect(page.locator("#debug")).toContainText(/TRACK:?\s+[1-9]/, {
    timeout: 15000,
  });
});
