import { Container } from "pixi.js";
export const layerNames = [
  "BACKGROUND",
  "DISTANT_PARTICLES",
  "PORTALS",
  "FAR_ENEMIES",
  "MID_ENEMIES",
  "CORE",
  "NEAR_ENEMIES",
  "SHIELD",
  "PROJECTILES",
  "EXPLOSIONS",
  "HAND_POINTER",
  "CINEMATICS",
  "HUD",
] as const;
export type LayerName = (typeof layerNames)[number];
export class LayerManager {
  readonly root = new Container();
  readonly layers = Object.fromEntries(
    layerNames.map((name) => {
      const container = new Container();
      container.label = name;
      this.root.addChild(container);
      return [name, container];
    }),
  ) as Record<LayerName, Container>;
}
