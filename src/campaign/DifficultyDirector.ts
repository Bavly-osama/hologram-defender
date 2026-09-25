import type { LevelConfig } from "./LevelConfig";

export interface ComputedDifficulty {
  enemySpeedScale: number;
  spawnIntervalScale: number;
  projectileFrequencyScale: number;
  maxConcurrentEnemies: number;
  hpMultiplier: number;
}

export class DifficultyDirector {
  static compute(level: LevelConfig): ComputedDifficulty {
    const rawDiff = level.difficulty;

    // Hard-capped speed scale (never exceeds 1.35x to keep readable dodging and blocking)
    const enemySpeedScale = Math.min(1.35, Math.max(0.9, 0.85 + rawDiff * 0.15));

    // Hard-capped spawn interval scale (interval gets multiplied by this; lower = faster spawns, floor at 0.70x)
    const spawnIntervalScale = Math.max(0.7, 1.25 - rawDiff * 0.18);

    // Hostile fire frequency scale (cap at 1.4x)
    const projectileFrequencyScale = Math.min(1.4, 0.8 + rawDiff * 0.2);

    // Concurrent enemies capped strictly between 15 and 28 to preserve performance on mobile
    const maxConcurrentEnemies = Math.min(
      28,
      Math.max(14, Math.round(12 + rawDiff * 5.5)),
    );

    // HP multiplier scaling gently for heavies/bosses (cap at 1.45x)
    const hpMultiplier = Math.min(1.45, 0.85 + rawDiff * 0.2);

    return {
      enemySpeedScale,
      spawnIntervalScale,
      projectileFrequencyScale,
      maxConcurrentEnemies,
      hpMultiplier,
    };
  }
}
