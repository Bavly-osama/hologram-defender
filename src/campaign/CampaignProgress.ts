import type { StageId } from "./StageConfig";

export interface LevelProgressRecord {
  completed: boolean;
  perfect: boolean;
  bestScore: number;
  bestCoreIntegrity: number;
  bestAccuracy: number;
  firstClearedAt: number;
}

export interface CampaignProgressData {
  highestUnlockedLevel: number;
  highestUnlockedStage: StageId;
  completedLevels: Record<number, LevelProgressRecord>;
  seenCinematics: string[];
  campaignCompleted: boolean;
  totalCampaignTime: number;
}

export const DEFAULT_CAMPAIGN_PROGRESS: CampaignProgressData = {
  highestUnlockedLevel: 1,
  highestUnlockedStage: 1,
  completedLevels: {},
  seenCinematics: [],
  campaignCompleted: false,
  totalCampaignTime: 0,
};

export class CampaignProgress {
  data: CampaignProgressData;
  private onSaveCallback?: () => void;

  constructor(initialData?: Partial<CampaignProgressData>, onSave?: () => void) {
    this.data = {
      highestUnlockedLevel: initialData?.highestUnlockedLevel ?? 1,
      highestUnlockedStage: (initialData?.highestUnlockedStage ?? 1) as StageId,
      completedLevels: initialData?.completedLevels ? { ...initialData.completedLevels } : {},
      seenCinematics: initialData?.seenCinematics ? [...initialData.seenCinematics] : [],
      campaignCompleted: initialData?.campaignCompleted ?? false,
      totalCampaignTime: initialData?.totalCampaignTime ?? 0,
    };
    this.onSaveCallback = onSave;
  }

  isLevelUnlocked(levelId: number): boolean {
    if (levelId === 1) return true;
    if (levelId < 1 || levelId > 20) return false;
    return levelId <= this.data.highestUnlockedLevel;
  }

  isStageUnlocked(stageId: StageId): boolean {
    if (stageId === 1) return true;
    return stageId <= this.data.highestUnlockedStage;
  }

  isLevelCompleted(levelId: number): boolean {
    return Boolean(this.data.completedLevels[levelId]?.completed);
  }

  isLevelPerfect(levelId: number): boolean {
    return Boolean(this.data.completedLevels[levelId]?.perfect);
  }

  get completedLevelCount(): number {
    return Object.values(this.data.completedLevels).filter((l) => l.completed).length;
  }

  get perfectLevelCount(): number {
    return Object.values(this.data.completedLevels).filter((l) => l.perfect).length;
  }

  get totalScore(): number {
    return Object.values(this.data.completedLevels).reduce((acc, l) => acc + l.bestScore, 0);
  }

  isCampaignComplete(): boolean {
    return this.data.campaignCompleted || this.isLevelCompleted(20);
  }

  getLevelResult(levelId: number): LevelProgressRecord | undefined {
    return this.data.completedLevels[levelId];
  }

  hasSeenCinematic(cinematicId: string): boolean {
    return this.data.seenCinematics.includes(cinematicId);
  }

  markCinematicSeen(cinematicId: string) {
    if (!this.hasSeenCinematic(cinematicId)) {
      this.data.seenCinematics.push(cinematicId);
      this.save();
    }
  }

  recordLevelResult(
    levelId: number,
    result: { score: number; coreIntegrity: number; accuracy: number; duration: number },
  ): {
    isFirstClear: boolean;
    isNewPerfect: boolean;
    nextLevelUnlocked: number | null;
    nextStageUnlocked: StageId | null;
  } {
    const existing = this.data.completedLevels[levelId];
    const isFirstClear = !existing?.completed;

    // Perfect condition: core integrity >= 95% AND accuracy >= 70%
    const isPerfect = result.coreIntegrity >= 95 && result.accuracy >= 0.7;
    const isNewPerfect = isPerfect && !existing?.perfect;

    this.data.completedLevels[levelId] = {
      completed: true,
      perfect: existing?.perfect || isPerfect,
      bestScore: Math.max(existing?.bestScore ?? 0, result.score),
      bestCoreIntegrity: Math.max(existing?.bestCoreIntegrity ?? 0, result.coreIntegrity),
      bestAccuracy: Math.max(existing?.bestAccuracy ?? 0, result.accuracy),
      firstClearedAt: existing?.firstClearedAt ?? Date.now(),
    };

    this.data.totalCampaignTime += Math.max(1, result.duration);

    let nextLevelUnlocked: number | null = null;
    let nextStageUnlocked: StageId | null = null;

    if (levelId < 20) {
      const nextLevel = levelId + 1;
      if (nextLevel > this.data.highestUnlockedLevel) {
        this.data.highestUnlockedLevel = nextLevel;
        nextLevelUnlocked = nextLevel;
      }
    } else if (levelId === 20) {
      this.data.campaignCompleted = true;
    }

    // Check Stage Unlocks (5 -> Stage 2, 10 -> Stage 3, 15 -> Stage 4)
    if (levelId === 5 && this.data.highestUnlockedStage < 2) {
      this.data.highestUnlockedStage = 2;
      nextStageUnlocked = 2;
    } else if (levelId === 10 && this.data.highestUnlockedStage < 3) {
      this.data.highestUnlockedStage = 3;
      nextStageUnlocked = 3;
    } else if (levelId === 15 && this.data.highestUnlockedStage < 4) {
      this.data.highestUnlockedStage = 4;
      nextStageUnlocked = 4;
    }

    this.save();

    return {
      isFirstClear,
      isNewPerfect,
      nextLevelUnlocked,
      nextStageUnlocked,
    };
  }

  resetCampaign() {
    this.data = {
      highestUnlockedLevel: 1,
      highestUnlockedStage: 1,
      completedLevels: {},
      seenCinematics: [],
      campaignCompleted: false,
      totalCampaignTime: 0,
    };
    this.save();
  }

  private save() {
    this.onSaveCallback?.();
  }
}
