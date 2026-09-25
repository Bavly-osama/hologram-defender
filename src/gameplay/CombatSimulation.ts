import { distance, WORLD, type Point } from "../core/Config";
import { EnemyManager, type Enemy } from "../enemies/EnemyManager";
import { balance, isBossKind } from "./gameBalance";
import { ProjectileManager } from "./ProjectileManager";
import { ScoreSystem } from "./ScoreSystem";
import { segmentCircle } from "./CollisionSystem";
import { EventBus } from "../core/EventBus";
import { ECONOMY_CONFIG } from "../economy/economyConfig";
import type { ComputedPlayerStats } from "../economy/PlayerStatsCalculator";

export interface CombatEvent extends Point {
  type: "shot" | "hit" | "kill" | "block" | "damage" | "portal" | "phase" | "credit";

  value?: number;
  kind?: string;
  counter?: boolean;
}

export type LockState = "IDLE" | "LOCKING" | "LOCKED";

export interface Shield extends Point {
  active: boolean;
}

export class CombatSimulation {
  readonly enemies = new EnemyManager();
  readonly projectiles = new ProjectileManager();
  readonly score = new ScoreSystem();
  stats?: ComputedPlayerStats;

  health: number;
  energy: number;
  time = 0;
  blocks = 0;
  difficulty = 1;
  target: Enemy | undefined;
  lockState: LockState = "IDLE";
  lockProgress = 0;
  autoFireEnabled = true;

  creditsEarnedInRun = 0;
  enemiesKilledInRun = 0;
  damageTakenInWave = 0;

  private lockTimer = 0;
  private autoFireTimer = 0;
  onEvent: (event: CombatEvent) => void = () => {};

  constructor(stats?: ComputedPlayerStats) {
    this.stats = stats;
    this.health = stats ? stats.maxHealth : balance.health;
    this.energy = stats ? stats.maxEnergy : balance.energy;
  }

  setStats(stats: ComputedPlayerStats) {
    this.stats = stats;
    this.health = Math.min(this.health, stats.maxHealth);
    this.energy = Math.min(this.energy, stats.maxEnergy);
  }

  resetWaveStats() {
    this.damageTakenInWave = 0;
  }

  aim(point: Point) {
    const assist = this.stats ? this.stats.assistRadius : balance.assistRadius;
    if (
      this.target?.active &&
      !this.target.phased &&
      distance(point, this.enemies.weakPoint(this.target)) <
        assist * 2.0 + this.target.radius * this.target.scale
    )
      return this.target;

    const previous = this.target;
    this.target = this.enemies.active
      .filter(
        (e) =>
          !e.phased &&
          distance(point, this.enemies.weakPoint(e)) <
            assist + e.radius * e.scale,
      )
      .sort((a, b) => distance(point, a) - distance(point, b))[0];

    if (this.target !== previous) {
      this.lockTimer = 0;
      this.lockProgress = 0;
      this.lockState = this.target ? "LOCKING" : "IDLE";
    }

    return this.target;
  }

  fire(point: Point) {
    const cost = this.stats ? this.stats.energyCost : balance.shotCost;
    if (this.energy < cost) return false;
    const target = this.aim(point);
    const aim = target ? this.enemies.weakPoint(target) : point;
    const speed = this.stats ? this.stats.projectileSpeed : balance.projectileSpeed;
    const damage = this.stats ? this.stats.damage : 1;
    const penetration = this.stats ? this.stats.penetration : 1;

    const shot = this.projectiles.spawn(
      "player",
      WORLD.core.x,
      WORLD.core.y - 25,
      aim.x,
      aim.y,
      speed,
      damage,
      -1,
      penetration,
    );
    if (!shot) return false;
    shot.targetId = target?.id ?? -1;
    shot.weakAim = Boolean(
      target &&
      distance(point, aim) <
        (isBossKind(target.kind) ? 42 : target.radius * target.scale * 0.75 + 8),
    );
    this.energy -= cost;
    this.score.shots++;
    this.onEvent({ type: "shot", ...point });
    return true;
  }

  update(dt: number, shield: Shield) {
    const maxEnergy = this.stats ? this.stats.maxEnergy : balance.energy;
    const regen = this.stats ? this.stats.energyRegen : balance.energyRegen;
    const lockTime = this.stats ? this.stats.lockTime : balance.lockTime;
    const fireInterval = this.stats ? this.stats.fireInterval : balance.autoFireInterval;
    const shieldRadius = this.stats ? this.stats.shieldRadius : balance.shieldRadius;

    this.time += dt;
    this.energy = Math.min(maxEnergy, this.energy + dt * regen);
    this.score.update(this.time);
    this.enemies.update(dt, this.difficulty);

    // Verify target remains within the targeting zone of the shield
    if (this.target?.active && !this.target.phased) {
      const assist = this.stats ? this.stats.assistRadius : balance.assistRadius;
      const maxReach = assist * 2.0 + this.target.radius * this.target.scale;
      if (distance(shield, this.enemies.weakPoint(this.target)) > maxReach) {
        this.aim(shield);
      }
    } else if (this.target?.phased) {
      this.target = undefined;
      this.lockState = "IDLE";
      this.lockProgress = 0;
      this.lockTimer = 0;
    }

    // Auto-fire target lock progression
    if (this.target && this.target.active && !this.target.phased) {
      if (this.lockState === "LOCKING") {
        this.lockTimer += dt;
        this.lockProgress = Math.min(1, this.lockTimer / lockTime);
        if (this.lockTimer >= lockTime) {
          this.lockState = "LOCKED";
          this.lockProgress = 1;
          this.autoFireTimer = 0;
        }
      }
      if (this.lockState === "LOCKED" && this.autoFireEnabled) {
        this.autoFireTimer -= dt;
        if (this.autoFireTimer <= 0) {
          this.autoFireTimer = fireInterval;
          const weak = this.enemies.weakPoint(this.target);
          this.fire(weak);
        }
      }
    } else {
      this.target = undefined;
      this.lockState = "IDLE";
      this.lockProgress = 0;
      this.lockTimer = 0;
    }
    for (const p of this.projectiles.pool) {
      if (!p.active || p.team !== "player" || !p.weakAim) continue;
      const locked = this.enemies.pool[p.targetId];
      if (!locked?.active || locked.phased) {
        p.weakAim = false;
        continue;
      }
      const point = this.enemies.weakPoint(locked),
        angle = Math.atan2(point.y - p.y, point.x - p.x);
      p.vx = Math.cos(angle) * (this.stats ? this.stats.projectileSpeed : balance.projectileSpeed);
      p.vy = Math.sin(angle) * (this.stats ? this.stats.projectileSpeed : balance.projectileSpeed);
    }
    this.projectiles.update(dt, () => this.score.miss());
    for (const e of this.enemies.pool) {
      if (!e.active) continue;
      if (!isBossKind(e.kind) && e.depth >= 1) {
        this.enemies.startDying(e);
        this.damage(balance.enemies[e.kind].damage);
        continue;
      }
      if (
        e.active &&
        e.attackTime <= 0 &&
        (e.kind === "heavy" || isBossKind(e.kind) || e.kind === "storm_drone")
      ) {
        const isBoss = isBossKind(e.kind);
        if (e.kind === "storm_drone") {
          e.attackTime = 3.2;
          this.projectiles.spawn("hostile", e.x, e.y + 10, WORLD.core.x, WORLD.core.y, 145, 6, e.id);
        } else if (e.kind === "mars_war_machine") {
          e.attackTime = e.phase === 3 ? 0.8 : 1.6;
          this.projectiles.spawn("hostile", e.x - 28, e.y + 20, WORLD.core.x - 15, WORLD.core.y, 180, 10, e.id);
          this.projectiles.spawn("hostile", e.x + 28, e.y + 20, WORLD.core.x + 15, WORLD.core.y, 180, 10, e.id);
        } else if (e.kind === "void_leviathan") {
          e.attackTime = e.phase === 3 ? 0.7 : 1.4;
          this.projectiles.spawn("hostile", e.x, e.y + 25, WORLD.core.x, WORLD.core.y, 190, 9, e.id);
          this.projectiles.spawn("hostile", e.x + (Math.random() - 0.5) * 40, e.y + 20, WORLD.core.x + (Math.random() - 0.5) * 60, WORLD.core.y, 170, 7, e.id);
        } else if (e.kind === "fracture_architect") {
          e.attackTime = e.phase === 3 ? 0.55 : 1.1;
          this.projectiles.spawn("hostile", e.x, e.y + 30, WORLD.core.x, WORLD.core.y, 210, 12, e.id);
        } else {
          // boss (Sentinel) or heavy
          e.attackTime = isBoss ? (e.phase === 3 ? 0.65 : 1.5) : 3.5;
          this.projectiles.spawn(
            "hostile",
            e.x,
            e.y + 18,
            WORLD.core.x,
            WORLD.core.y,
            isBoss ? (e.phase === 3 ? 220 : 160) : 130,
            isBoss ? 8 : 7,
            e.id,
          );
        }
      }
    }
    for (const p of this.projectiles.pool) {
      if (!p.active) continue;
      const previous = { x: p.previousX, y: p.previousY };
      if (p.team === "hostile") {
        if (
          shield.active &&
          segmentCircle(previous, p, shield, shieldRadius)
        ) {
          p.active = false;
          this.blocks++;
          const source = this.enemies.pool[p.source];
          if (source?.active) source.counterTime = this.time;
          if (this.stats && this.stats.reactiveEnergyRefund > 0) {
            this.energy = Math.min(maxEnergy, this.energy + this.stats.reactiveEnergyRefund);
          }
          this.onEvent({ type: "block", x: p.x, y: p.y });
        } else if (segmentCircle(previous, p, WORLD.core, 50)) {
          p.active = false;
          const reduction = this.stats ? this.stats.damageReduction : 0;
          this.damage(p.damage * (1 - reduction));
        }
        continue;
      }
      for (const e of this.enemies.pool) {
        if (!e.active || e.phased) continue;
        const isBoss = isBossKind(e.kind);
        const weak = this.enemies.weakPoint(e);
        const weakHit = segmentCircle(
          previous,
          p,
          weak,
          isBoss ? (e.kind === "void_leviathan" ? 32 : 26) : Math.max(12, e.radius * e.scale * 0.65),
        );
        if (
          !weakHit &&
          ((p.weakAim && p.targetId === e.id) ||
            (isBoss && e.phase === 2))
        )
          continue;
        if (!weakHit && !segmentCircle(previous, p, e, e.radius * e.scale + 6))
          continue;

        if (p.penetration > 1 && p.hitsRemaining > 1) {
          p.hitsRemaining--;
        } else {
          p.active = false;
        }

        e.hitTime = 0.15;
        this.score.hit(this.time);
        if (isBoss && e.phase === 2) {
          if (weakHit) {
            e.weakHits++;
            if (e.weakHits >= 3) {
              e.weakHits = 0;
              e.weakIndex++;
              if (e.weakIndex >= 3) {
                e.phase = 3;
                this.onEvent({ type: "phase", ...e });
              }
            }
          }
        } else {
          const dmg = p.damage;
          e.hp -=
            e.kind === "heavy"
              ? weakHit
                ? dmg * 1.5
                : dmg * 0.5
              : isBoss && !weakHit && e.phase !== 3
                ? dmg * 0.25
                : dmg;
        }
        this.onEvent({ type: "hit", x: p.x, y: p.y });
        if (isBoss && e.phase === 1 && e.hp <= e.maxHp * 0.65) {
          e.phase = 2;
          this.onEvent({ type: "phase", ...e });
        }
        if (e.hp <= 0) this.kill(e);
        break;
      }
    }
  }

  damage(amount: number) {
    this.health = Math.max(0, this.health - amount);
    this.damageTakenInWave += amount;
    this.onEvent({ type: "damage", ...WORLD.core });
  }

  kill(e: Enemy) {
    this.enemies.startDying(e);

    // Splitter splits into 2 mini drones upon destruction
    if (e.kind === "splitter") {
      const m1 = this.enemies.spawn("splitter_mini", {
        x: Math.max(80, e.x - 24),
        y: Math.max(60, e.y - 8),
      });
      const m2 = this.enemies.spawn("splitter_mini", {
        x: Math.min(WORLD.width - 80, e.x + 24),
        y: Math.max(60, e.y - 8),
      });
      if (m1) m1.depth = e.depth;
      if (m2) m2.depth = e.depth;
    }

    const isCounter = this.time - e.counterTime < 2;
    const points =
      this.score.kill(balance.enemies[e.kind].score) +
      (isCounter ? 100 : 0);
    if (isCounter) this.score.value += 100;

    const reward = ECONOMY_CONFIG.enemyRewards[e.kind] ?? 10;
    this.creditsEarnedInRun += reward;
    this.enemiesKilledInRun++;

    this.onEvent({
      type: "kill",
      x: e.x,
      y: e.y,
      value: points,
      kind: e.kind,
      counter: isCounter,
    });

    this.onEvent({
      type: "credit",
      x: e.x,
      y: e.y,
      value: reward,
    });

    EventBus.get().emit("ENEMY_DESTROYED", {
      kind: e.kind,
      x: e.x,
      y: e.y,
      credits: reward,
    });
  }

  clear() {
    this.projectiles.clear();
    this.enemies.clear();
  }
}
