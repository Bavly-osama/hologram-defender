import type { CombatSimulation } from "../gameplay/CombatSimulation";
import type { WalletSystem } from "../economy/WalletSystem";
import { CampaignProgress, type CampaignProgressData } from "./CampaignProgress";
import { LevelUnlockService } from "./LevelUnlockService";
import { StageManager } from "./StageManager";
import { LevelManager, type LevelCompletionSummary } from "./LevelManager";
import { getLevelConfig, type LevelConfig } from "./LevelConfig";
import { getStageByLevelId, type StageConfig } from "./StageConfig";

export class CampaignManager {
  readonly progress: CampaignProgress;
  readonly unlockService: LevelUnlockService;
  readonly stageManager: StageManager;
  readonly levelManager: LevelManager;

  currentLevelId = 1;

  constructor(
    initialProgress?: Partial<CampaignProgressData>,
    onProgressSave?: () => void,
  ) {
    this.progress = new CampaignProgress(initialProgress, onProgressSave);
    this.unlockService = new LevelUnlockService(this.progress);
    this.stageManager = new StageManager(this.progress.data.highestUnlockedStage);
    this.levelManager = new LevelManager();
    this.currentLevelId = this.unlockService.getNextPlayableLevel();
  }

  selectLevel(levelId: number): boolean {
    const check = this.unlockService.canPlayLevel(levelId);
    if (!check.allowed) return false;

    this.currentLevelId = levelId;
    this.stageManager.setStageForLevel(levelId);
    return true;
  }

  startLevel(levelId: number, sim: CombatSimulation): boolean {
    if (!this.selectLevel(levelId)) return false;

    const config = getLevelConfig(levelId);
    this.levelManager.startLevel(config, sim);
    return true;
  }

  update(dt: number, sim: CombatSimulation): boolean {
    return this.levelManager.update(dt, sim);
  }

  completeLevel(
    sim: CombatSimulation,
    wallet: WalletSystem,
  ): LevelCompletionSummary {
    const level = this.levelManager.currentLevel ?? getLevelConfig(this.currentLevelId);
    const duration = Math.round(this.levelManager.levelDuration);
    const score = sim.score.value;
    const coreIntegrity = Math.ceil(sim.health);
    const accuracy = sim.score.accuracy;
    const bestCombo = sim.score.bestCombo;

    const recordResult = this.progress.recordLevelResult(level.id, {
      score,
      coreIntegrity,
      accuracy,
      duration,
    });

    // Reward payout (preventing duplicate first clear bonus)
    const baseReward = level.rewards.credits;
    const firstClearBonus = recordResult.isFirstClear ? level.rewards.firstClearBonus : 0;
    const perfectBonus = recordResult.isNewPerfect ? 150 : 0;
    const totalCredits = baseReward + firstClearBonus + perfectBonus;

    wallet.add(
      totalCredits,
      `Level ${level.id} (${level.name}) Clear Reward`,
    );

    return {
      levelId: level.id,
      score,
      coreIntegrity,
      accuracy,
      duration,
      bestCombo,
      creditsEarned: baseReward,
      firstClearBonus,
      perfectBonus,
      isPerfect: recordResult.isNewPerfect || this.progress.isLevelPerfect(level.id),
    };
  }

  isStageCompleted(levelId: number): boolean {
    return this.stageManager.isStageFinalLevel(levelId);
  }

  get currentLevelConfig(): LevelConfig {
    return getLevelConfig(this.currentLevelId);
  }

  get currentStageConfig(): StageConfig {
    return getStageByLevelId(this.currentLevelId);
  }
}
