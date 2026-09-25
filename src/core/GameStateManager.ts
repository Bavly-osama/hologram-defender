export type GameState =
  | "BOOT"
  | "LOADING"
  | "CAMERA_PERMISSION"
  | "CAMERA_READY"
  | "MAIN_MENU"
  | "CAMPAIGN_MAP"
  | "STAGE_INTRO"
  | "LEVEL_INTRO"
  | "TUTORIAL"
  | "COUNTDOWN"
  | "PLAYING"
  | "WAVE_COMPLETE"
  | "LEVEL_COMPLETE"
  | "LEVEL_FAILED"
  | "RESULTS"
  | "SHOP"
  | "BOSS_WARNING"
  | "BOSS"
  | "STAGE_COMPLETE"
  | "TRAVEL_CINEMATIC"
  | "NEXT_STAGE_INTRO"
  | "CAMPAIGN_COMPLETE"
  | "PAUSED"
  | "GAME_OVER"
  | "VICTORY";
export class GameStateManager {
  current: GameState = "BOOT";
  private previous: GameState = "PLAYING";
  elapsed = 0;
  onChange: (state: GameState) => void = () => {};
  set(state: GameState) {
    this.current = state;
    this.elapsed = 0;
    this.onChange(state);
  }
  get combat() {
    return this.current === "PLAYING" || this.current === "BOSS";
  }
  get interactive() {
    return this.combat || this.current === "TUTORIAL";
  }
  pause() {
    if (
      [
        "TUTORIAL",
        "COUNTDOWN",
        "PLAYING",
        "BOSS",
        "WAVE_COMPLETE",
        "BOSS_WARNING",
        "LEVEL_INTRO",
      ].includes(this.current)
    ) {
      this.previous = this.current;
      this.set("PAUSED");
    }
  }
  resume() {
    if (this.current === "PAUSED") this.set(this.previous);
  }
}
