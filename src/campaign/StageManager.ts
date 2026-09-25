import {
  STAGES_CONFIG,
  getStageByLevelId,
  type StageConfig,
  type StageId,
} from "./StageConfig";

export class StageManager {
  currentStage: StageConfig;

  constructor(initialStageId: StageId = 1) {
    this.currentStage = STAGES_CONFIG[initialStageId];
  }

  setStageForLevel(levelId: number): { changed: boolean; stage: StageConfig } {
    const nextStage = getStageByLevelId(levelId);
    const changed = nextStage.id !== this.currentStage.id;
    this.currentStage = nextStage;
    return { changed, stage: this.currentStage };
  }

  isStageFinalLevel(levelId: number): boolean {
    return [5, 10, 15, 20].includes(levelId);
  }

  getNextStageId(): StageId | null {
    if (this.currentStage.id < 4) {
      return (this.currentStage.id + 1) as StageId;
    }
    return null;
  }
}
