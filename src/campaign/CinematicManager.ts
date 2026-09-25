import { Container } from "pixi.js";
import type { StageConfig } from "./StageConfig";
import type { CampaignProgress } from "./CampaignProgress";
import { TravelSequence } from "./TravelSequence";

export class CinematicManager {
  private activeSequence: TravelSequence | null = null;

  constructor(
    private readonly cinematicLayer: Container,
    private readonly progress: CampaignProgress,
  ) {}

  get isPlaying(): boolean {
    return this.activeSequence !== null;
  }

  playTravel(
    fromStage: StageConfig,
    toStage: StageConfig,
    isFinalVictory = false,
    onComplete: () => void,
  ) {
    if (this.activeSequence) {
      this.activeSequence.skip();
    }

    const cinematicId = isFinalVictory ? "campaign_complete" : `travel_${fromStage.id}_${toStage.id}`;

    this.activeSequence = new TravelSequence({
      fromStage,
      toStage,
      isFinalVictory,
      onComplete: () => {
        this.progress.markCinematicSeen(cinematicId);
        this.activeSequence = null;
        onComplete();
      },
    });

    this.cinematicLayer.addChild(this.activeSequence.container);
  }

  skip() {
    if (this.activeSequence) {
      this.activeSequence.skip();
    }
  }

  update(dt: number) {
    if (this.activeSequence) {
      this.activeSequence.update(dt);
    }
  }
}
