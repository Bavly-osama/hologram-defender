import type { CampaignProgress } from "./CampaignProgress";
import { getLevelConfig, type LevelConfig } from "./LevelConfig";
import { getStageByLevelId, type StageConfig, type StageId } from "./StageConfig";

export interface UnlockCheckResult {
  allowed: boolean;
  reason?: string;
  level?: LevelConfig;
  stage?: StageConfig;
}

export class LevelUnlockService {
  constructor(private readonly progress: CampaignProgress) {}

  canPlayLevel(levelId: number): UnlockCheckResult {
    if (levelId < 1 || levelId > 20) {
      return { allowed: false, reason: `Invalid level ID: ${levelId}. Valid range is 1–20.` };
    }

    const level = getLevelConfig(levelId);
    const stage = getStageByLevelId(levelId);

    if (!this.progress.isStageUnlocked(stage.id)) {
      return {
        allowed: false,
        reason: `Stage ${stage.id} (${stage.name}) is locked. Complete Stage ${stage.id - 1} boss to unlock.`,
        level,
        stage,
      };
    }

    if (!this.progress.isLevelUnlocked(levelId)) {
      return {
        allowed: false,
        reason: `Level ${levelId} is locked. Complete Level ${levelId - 1} (${getLevelConfig(levelId - 1).name}) first.`,
        level,
        stage,
      };
    }

    return { allowed: true, level, stage };
  }

  canAccessStage(stageId: StageId): boolean {
    return this.progress.isStageUnlocked(stageId);
  }

  getNextPlayableLevel(): number {
    return Math.min(20, this.progress.data.highestUnlockedLevel);
  }
}
