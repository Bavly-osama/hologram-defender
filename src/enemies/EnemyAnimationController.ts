import { AnimatedSprite, type Ticker } from "pixi.js";
import type { SpriteSheetManager } from "../assets/SpriteSheetManager";
import type { AssetId, AnimationState } from "../assets/AssetManifest";
export class EnemyAnimationController {
  readonly sprite: AnimatedSprite;
  private current: AnimationState = "MOVE";
  constructor(
    private sheets: SpriteSheetManager,
    private asset: AssetId,
  ) {
    this.sprite = new AnimatedSprite(sheets.frames(asset));
    this.sprite.anchor.set(0.5);
    this.sprite.autoUpdate = false;
    this.sprite.animationSpeed = 0.14;
    this.sprite.play();
  }
  set(state: AnimationState) {
    if (this.current === state) return;
    this.current = state;
    this.sprite.textures = this.sheets.frames(this.asset, state);
    this.sprite.play();
  }
  update(dt: number) {
    this.sprite.update({ deltaTime: dt * 60 } as Ticker);
  }
}
