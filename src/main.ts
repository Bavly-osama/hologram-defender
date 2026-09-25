// Pixi's CSP-compatible uniform/shader synchronization avoids runtime eval.
import "pixi.js/unsafe-eval";
import "./style.css";
import { Game } from "./core/Game";
const root = document.querySelector<HTMLElement>("#app")!;
const game = new Game(root);
if (import.meta.env.DEV)
  Object.defineProperty(window, "__defenderDebug", {
    value: { snapshot: () => game.debugSnapshot() },
  });
game.init().catch((error) => {
  console.error(error);
  root.replaceChildren();
  const message = document.createElement("div");
  message.className = "modal";
  const title = document.createElement("h2");
  title.textContent = "Defense system could not initialize";
  const detail = document.createElement("p");
  detail.textContent =
    "This game needs a browser with WebGL enabled. Try reloading or opening a recent Chrome, Edge, Firefox, or Safari browser.";
  const reload = document.createElement("button");
  reload.className = "primary";
  reload.textContent = "Retry initialization";
  reload.onclick = () => location.reload();
  message.append(title, detail, reload);
  root.append(message);
});
