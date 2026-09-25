import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  permissions: ["camera"],
  viewport: { width: 1200, height: 750 },
});
const page = await context.newPage();
page.on("console", (message) =>
  console.log(message.type(), message.text().slice(0, 700)),
);
page.on("pageerror", (error) => console.log("PAGE ERROR", error.message));
await page.goto(process.argv[2] ?? "http://localhost:5173");
await page.getByRole("button", { name: "Activate hand control" }).click();
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const state = await page.locator("#camera-status").innerText();
  console.log(state, await page.locator("#notice").textContent());
  if (/MOUSE CONTROL ENABLED/.test(state)) {
    process.exitCode = 1;
    break;
  }
  if (/HAND TRACKED|CAMERA READY/.test(state)) {
    await page.waitForTimeout(2500);
    break;
  }
}
await browser.close();
