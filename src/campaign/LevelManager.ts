import type { CombatSimulation } from "../gameplay/CombatSimulation";
import type { LevelConfig, WaveDefinition } from "./LevelConfig";
import { DifficultyDirector, type ComputedDifficulty } from "./DifficultyDirector";

const SPAWN_ORIGINS = [
  { x: 150, y: 120 },
  { x: 600, y: 90 },
  { x: 1040, y: 140 },
  { x: 100, y: 340 },
  { x: 1100, y: 320 },
  { x: 450, y: 130 },
  { x: 750, y: 130 },
];

export interface LevelCompletionSummary {
  levelId: number;
  score: number;
  coreIntegrity: number;
  accuracy: number;
  duration: number;
  bestCombo: number;
  creditsEarned: number;
  firstClearBonus: number;
  perfectBonus: number;
  isPerfect: boolean;
}

export class LevelManager {
  currentLevel: LevelConfig | null = null;
  currentWaveIndex = 0;
  spawnedInWave = 0;
  spawnTimer = 0.8;
  bossSummonTimer = 0;
  computedDiff: ComputedDifficulty | null = null;
  levelDuration = 0;
  bossSpawned = false;

  startLevel(level: LevelConfig, sim: CombatSimulation) {
    this.currentLevel = level;
    this.currentWaveIndex = 0;
    this.spawnedInWave = 0;
    this.spawnTimer = 0.8;
    this.bossSummonTimer = 0;
    this.levelDuration = 0;
    this.bossSpawned = false;
    this.computedDiff = DifficultyDirector.compute(level);

    // Apply difficulty to simulation
    sim.difficulty = this.computedDiff.enemySpeedScale;

    // Clear previous entities
    sim.clear();

    if (level.isBossLevel && level.bossKind) {
      this.spawnBoss(level.bossKind, sim);
    }
  }

  private spawnBoss(kind: import("../gameplay/gameBalance").EnemyKind, sim: CombatSimulation) {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    sim.enemies.spawn(kind, { x: 600, y: 180 });
  }

  update(dt: number, sim: CombatSimulation): boolean {
    if (!this.currentLevel || !this.computedDiff) return false;
    this.levelDuration += dt;

    // Boss level progression
    if (this.currentLevel.isBossLevel) {
      const boss = sim.enemies.active.find((e) =>
        ["boss", "mars_war_machine", "void_leviathan", "fracture_architect"].includes(e.kind),
      );
      if (!boss && this.bossSpawned) {
        // Boss eliminated! Level complete
        return true;
      }

      // Boss minion summoning in later phases
      if (boss && boss.phase >= 2) {
        this.bossSummonTimer += dt;
        const summonLimit = boss.kind === "fracture_architect" ? 6 : 4;
        if (this.bossSummonTimer > 4.5 && sim.enemies.active.length < summonLimit) {
          this.bossSummonTimer = 0;
          const origin = SPAWN_ORIGINS[Math.floor(Math.random() * SPAWN_ORIGINS.length)];
          const minionKind =
            boss.kind === "fracture_architect"
              ? "null_hunter"
              : boss.kind === "void_leviathan"
                ? "storm_drone"
                : boss.kind === "mars_war_machine"
                  ? "phase_striker"
                  : "scout";
          sim.enemies.spawn(minionKind, origin);
          sim.onEvent({ type: "portal", ...origin });
        }
      }
      return false;
    }

    // Standard wave progression
    const currentWave: WaveDefinition | undefined = this.currentLevel.waves[this.currentWaveIndex];
    if (!currentWave) {
      return sim.enemies.active.length === 0;
    }

    this.spawnTimer -= dt;

    if (
      this.spawnTimer <= 0 &&
      this.spawnedInWave < currentWave.count &&
      sim.enemies.active.length < this.computedDiff.maxConcurrentEnemies
    ) {
      const originIndex = (this.spawnedInWave * 3 + this.currentWaveIndex) % SPAWN_ORIGINS.length;
      const origin = SPAWN_ORIGINS[originIndex];
      const kind = currentWave.types[this.spawnedInWave % currentWave.types.length];
      const speedScale = (currentWave.speedScale ?? 1.0) * this.computedDiff.enemySpeedScale;

      sim.enemies.spawn(kind, origin, speedScale);
      sim.onEvent({ type: "portal", ...origin });

      this.spawnedInWave++;
      this.spawnTimer = currentWave.interval * this.computedDiff.spawnIntervalScale;
    }

    // Wave completed check
    if (this.spawnedInWave >= currentWave.count && sim.enemies.active.length === 0) {
      this.currentWaveIndex++;
      this.spawnedInWave = 0;
      this.spawnTimer = 1.8; // Brief wave respite

      if (this.currentWaveIndex >= this.currentLevel.waves.length) {
        // All waves cleared!
        return true;
      }
    }

    return false;
  }

  get totalWaves(): number {
    return this.currentLevel?.waves.length ?? 1;
  }

  get currentWaveNumber(): number {
    return Math.min(this.totalWaves, this.currentWaveIndex + 1);
  }
}
