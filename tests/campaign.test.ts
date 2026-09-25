import { describe, it, expect, beforeEach } from "vitest";
import { LEVELS_CONFIG, getLevelConfig } from "../src/campaign/LevelConfig";
import { STAGES_CONFIG, STAGES, getStageByLevelId } from "../src/campaign/StageConfig";
import { CampaignProgress } from "../src/campaign/CampaignProgress";
import { LevelUnlockService } from "../src/campaign/LevelUnlockService";
import { DifficultyDirector } from "../src/campaign/DifficultyDirector";
import { CampaignManager } from "../src/campaign/CampaignManager";
import { PlayerInventory } from "../src/economy/PlayerInventory";

// Mock localStorage for Vitest Node environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};
// @ts-ignore
globalThis.window = { localStorage: mockLocalStorage } as any;
// @ts-ignore
globalThis.localStorage = mockLocalStorage as any;

describe("20-Level Cinematic Campaign System", () => {
  describe("Level & Stage Configurations", () => {
    it("configures exactly 20 levels and 4 stages", () => {
      expect(Object.keys(LEVELS_CONFIG).length).toBe(20);
      expect(STAGES.length).toBe(4);
      expect(Object.keys(STAGES_CONFIG).length).toBe(4);
    });

    it("maps 5 levels to each stage correctly", () => {
      for (let levelId = 1; levelId <= 20; levelId++) {
        const config = getLevelConfig(levelId);
        expect(config).toBeDefined();
        expect(config.id).toBe(levelId);

        const stage = getStageByLevelId(levelId);
        expect(stage).toBeDefined();

        if (levelId <= 5) {
          expect(stage.id).toBe(1);
          expect(stage.name).toBe("EARTH DEFENSE GRID");
        } else if (levelId <= 10) {
          expect(stage.id).toBe(2);
          expect(stage.name).toBe("MARS RED FRONTIER");
        } else if (levelId <= 15) {
          expect(stage.id).toBe(3);
          expect(stage.name).toBe("NEPTUNE VOID");
        } else {
          expect(stage.id).toBe(4);
          expect(stage.name).toBe("THE FRACTURE");
        }
      }
    });

    it("has boss levels at the end of each stage (levels 5, 10, 15, 20)", () => {
      const bossLevels = [5, 10, 15, 20];
      for (const lvl of bossLevels) {
        const config = getLevelConfig(lvl);
        expect(config.isBossLevel).toBe(true);
        expect(config.bossKind).toBeTruthy();
      }

      // Non-boss levels
      for (let lvl = 1; lvl <= 20; lvl++) {
        if (!bossLevels.includes(lvl)) {
          expect(getLevelConfig(lvl).isBossLevel).toBe(false);
          expect(getLevelConfig(lvl).bossKind).toBeNull();
        }
      }
    });

    it("has valid tactical scanner cards for all enemies and stage bosses", () => {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const config = getLevelConfig(lvl);
        if (config.introScannerEnemy) {
          expect(config.introScannerEnemy.name).toBeTruthy();
          expect(config.introScannerEnemy.classTag).toBeTruthy();
          expect(config.introScannerEnemy.ability).toBeTruthy();
          expect(config.introScannerEnemy.threatRating).toBeDefined();
        }
      }
    });
  });

  describe("Unlock & Progression Validation", () => {
    let progress: CampaignProgress;
    let unlockService: LevelUnlockService;

    beforeEach(() => {
      progress = new CampaignProgress();
      unlockService = new LevelUnlockService(progress);
    });

    it("starts with Level 1 and Stage 1 unlocked, and all others locked", () => {
      expect(unlockService.canPlayLevel(1).allowed).toBe(true);
      expect(unlockService.canAccessStage(1)).toBe(true);

      expect(unlockService.canPlayLevel(2).allowed).toBe(false);
      expect(unlockService.canAccessStage(2)).toBe(false);
      expect(unlockService.canAccessStage(3)).toBe(false);
      expect(unlockService.canAccessStage(4)).toBe(false);
    });

    it("sequentially unlocks level 2 only when level 1 is completed", () => {
      expect(unlockService.canPlayLevel(2).allowed).toBe(false);

      progress.recordLevelResult(1, {
        score: 1000,
        coreIntegrity: 100,
        accuracy: 0.85,
        duration: 25,
      });

      expect(progress.isLevelCompleted(1)).toBe(true);
      expect(progress.isLevelPerfect(1)).toBe(true);
      expect(unlockService.canPlayLevel(2).allowed).toBe(true);
      expect(unlockService.canPlayLevel(3).allowed).toBe(false);
    });

    it("unlocks Stage 2 and Level 6 upon completing Level 5 (Stage 1 Boss)", () => {
      for (let lvl = 1; lvl <= 4; lvl++) {
        progress.recordLevelResult(lvl, {
          score: 1200,
          coreIntegrity: 70,
          accuracy: 0.65,
          duration: 30,
        });
      }

      expect(unlockService.canAccessStage(2)).toBe(false);
      expect(unlockService.canPlayLevel(6).allowed).toBe(false);

      // Complete Level 5 boss
      progress.recordLevelResult(5, {
        score: 3000,
        coreIntegrity: 100,
        accuracy: 0.88,
        duration: 45,
      });

      expect(progress.isLevelCompleted(5)).toBe(true);
      expect(unlockService.canAccessStage(2)).toBe(true);
      expect(unlockService.canPlayLevel(6).allowed).toBe(true);
      expect(unlockService.canPlayLevel(7).allowed).toBe(false);
    });

    it("detects full campaign completion when all 20 levels are completed", () => {
      expect(progress.isCampaignComplete()).toBe(false);

      for (let lvl = 1; lvl <= 20; lvl++) {
        progress.recordLevelResult(lvl, {
          score: 2000,
          coreIntegrity: 100,
          accuracy: 0.9,
          duration: 30,
        });
      }

      expect(progress.completedLevelCount).toBe(20);
      expect(progress.perfectLevelCount).toBe(20);
      expect(progress.isCampaignComplete()).toBe(true);
    });
  });

  describe("Credit Economy & First-Clear Rewards", () => {
    let inventory: PlayerInventory;
    let campaign: CampaignManager;

    beforeEach(() => {
      mockLocalStorage.clear();
      inventory = new PlayerInventory();
      campaign = new CampaignManager(
        inventory.campaignProgress,
        () => inventory.saveCampaignProgress(campaign.progress.data),
      );
    });

    it("awards first-clear bonus credits on initial clear only", () => {
      const initialCredits = inventory.wallet.credits;
      const lvlConfig = getLevelConfig(1);
      const firstClearBonus = lvlConfig.rewards.firstClearBonus;
      const baseClearCredits = lvlConfig.rewards.credits;

      // First clear
      const isFirst = !campaign.progress.isLevelCompleted(1);
      expect(isFirst).toBe(true);

      const creditsEarned1 = baseClearCredits + (isFirst ? firstClearBonus : 0);
      inventory.wallet.add(creditsEarned1, "level_clear");
      campaign.progress.recordLevelResult(1, {
        score: 1500,
        coreIntegrity: 80,
        accuracy: 0.65,
        duration: 30,
      });
      inventory.saveCampaignProgress(campaign.progress.data);

      expect(inventory.wallet.credits).toBe(initialCredits + baseClearCredits + firstClearBonus);

      // Replay level 1
      const isFirstReplay = !campaign.progress.isLevelCompleted(1);
      expect(isFirstReplay).toBe(false);

      const creditsEarned2 = baseClearCredits + (isFirstReplay ? firstClearBonus : 0);
      inventory.wallet.add(creditsEarned2, "level_clear");

      // Replaying awards only standard base credits, NOT duplicate first-clear bonus
      expect(creditsEarned2).toBe(baseClearCredits);
      expect(inventory.wallet.credits).toBe(
        initialCredits + baseClearCredits + firstClearBonus + baseClearCredits,
      );
    });

    it("awards perfect defense tracking when core integrity >= 95% and accuracy >= 70%", () => {
      const result = campaign.progress.recordLevelResult(2, {
        score: 2500,
        coreIntegrity: 100,
        accuracy: 0.85,
        duration: 20,
      });

      expect(result.isNewPerfect).toBe(true);
      expect(campaign.progress.isLevelPerfect(2)).toBe(true);
    });
  });

  describe("DifficultyDirector", () => {
    it("scales enemy speed deterministically by level threat and caps within bounds", () => {
      const l1 = DifficultyDirector.compute(getLevelConfig(1));
      const l10 = DifficultyDirector.compute(getLevelConfig(10));
      const l20 = DifficultyDirector.compute(getLevelConfig(20));

      expect(l1.enemySpeedScale).toBeLessThan(l10.enemySpeedScale);
      expect(l10.enemySpeedScale).toBeLessThanOrEqual(l20.enemySpeedScale);

      // Never exceeds hard cap of 1.35x
      expect(l20.enemySpeedScale).toBeLessThanOrEqual(1.35);
      expect(l1.enemySpeedScale).toBeGreaterThanOrEqual(0.9);
    });

    it("scales spawn interval safely without dropping below minimum hard floor", () => {
      const l1 = DifficultyDirector.compute(getLevelConfig(1));
      const l20 = DifficultyDirector.compute(getLevelConfig(20));

      expect(l20.spawnIntervalScale).toBeLessThan(l1.spawnIntervalScale);
      // Hard floor is 0.70
      expect(l20.spawnIntervalScale).toBeGreaterThanOrEqual(0.7);
    });
  });
});
