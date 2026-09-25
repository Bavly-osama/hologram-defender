import { WORLD, mix, type Point } from "../core/Config";
import { balance, isBossKind, type EnemyKind } from "../gameplay/gameBalance";

export interface Enemy extends Point {
  id: number;
  active: boolean;
  dying: boolean;
  dyingTime: number;
  kind: EnemyKind;
  origin: Point;
  depth: number;
  hp: number;
  maxHp: number;
  age: number;
  attackTime: number;
  hitTime: number;
  shieldCooldown: number;
  scale: number;
  radius: number;
  phase: number;
  weakIndex: number;
  weakHits: number;
  counterTime: number;
  phased?: boolean;
}

export class EnemyManager {
  readonly pool: Enemy[] = Array.from({ length: 60 }, (_, id) => ({
    id,
    active: false,
    dying: false,
    dyingTime: 0,
    kind: "scout" as EnemyKind,
    x: 0,
    y: 0,
    origin: { x: 0, y: 0 },
    depth: 0,
    hp: 1,
    maxHp: 1,
    age: 0,
    attackTime: 0,
    hitTime: 0,
    shieldCooldown: 0,
    scale: 0.3,
    radius: 20,
    phase: 1,
    weakIndex: 0,
    weakHits: 0,
    counterTime: -Infinity,
    phased: false,
  }));

  get active() {
    return this.pool.filter((e) => e.active);
  }

  /** Enemies that should still be rendered (active + briefly dying) */
  get visible() {
    return this.pool.filter((e) => e.active || (e.dying && e.dyingTime > 0));
  }

  spawn(kind: EnemyKind, origin: Point, speedScale = 1) {
    const enemy = this.pool.find((e) => !e.active && !e.dying);
    if (!enemy) return undefined;
    const config = balance.enemies[kind];
    const isBoss = isBossKind(kind);
    Object.assign(enemy, {
      active: true,
      dying: false,
      dyingTime: 0,
      kind,
      x: origin.x,
      y: origin.y,
      origin: { ...origin },
      depth: 0,
      hp: config.hp,
      maxHp: config.hp,
      age: 0,
      attackTime: 2.5 / speedScale,
      hitTime: 0,
      shieldCooldown: 0,
      scale: isBoss ? 1 : 0.4,
      radius: config.radius,
      phase: 1,
      weakIndex: 0,
      weakHits: 0,
      counterTime: -Infinity,
      phased: false,
    });
    return enemy;
  }

  startDying(e: Enemy) {
    e.active = false;
    e.dying = true;
    e.dyingTime = isBossKind(e.kind) ? 1.5 : 0.35;
  }

  update(dt: number, difficulty: number) {
    for (const e of this.pool) {
      // Tick dying-animation countdown
      if (e.dying) {
        e.dyingTime -= dt;
        if (e.dyingTime <= 0) e.dying = false;
        continue;
      }
      if (!e.active) continue;
      e.age += dt;
      e.attackTime -= dt;
      e.hitTime = Math.max(0, e.hitTime - dt);
      e.shieldCooldown = Math.max(0, e.shieldCooldown - dt);

      // Phase Striker stealth phase cycling (phased for 1.2s every 3.5s)
      if (e.kind === "phase_striker") {
        const cycle = e.age % 3.5;
        e.phased = cycle >= 2.0 && cycle <= 3.2;
      } else {
        e.phased = false;
      }

      // Boss movement patterns
      if (isBossKind(e.kind)) {
        if (e.kind === "boss") {
          e.x = 600 + Math.sin(e.age * 0.45) * 225;
          e.y = 180 + Math.sin(e.age * 0.8) * 25;
        } else if (e.kind === "mars_war_machine") {
          e.x = 600 + Math.sin(e.age * 0.35) * 250;
          e.y = 175 + Math.abs(Math.sin(e.age * 1.4)) * 20;
        } else if (e.kind === "void_leviathan") {
          e.x = 600 + Math.cos(e.age * 0.5) * 270;
          e.y = 185 + Math.sin(e.age * 1.1) * 40;
        } else if (e.kind === "fracture_architect") {
          e.x = 600 + Math.sin(e.age * 0.6) * 190;
          e.y = 180 + Math.cos(e.age * 0.85) * 30;
        }
        continue;
      }

      // Standard / Special enemy pathing
      const rush = e.kind === "orb" ? (e.age < 0.8 ? 0.15 : 2.8) : 1;
      const speedMult = e.kind === "null_hunter" ? 1.3 : 1;
      e.depth += dt * balance.enemies[e.kind].speed * difficulty * rush * speedMult;
      const t = Math.pow(Math.min(1, e.depth), 1.4);

      // Unique lateral sway
      let lateral = Math.sin(e.age * 1.8 + e.id) * 12 * (1 - t);
      if (e.kind === "storm_drone") {
        lateral = Math.sin(e.age * 5.5 + e.id) * 32 * (1 - t);
      } else if (e.kind === "phase_striker") {
        lateral = Math.sin(e.age * 3.0 + e.id) * 24 * (1 - t);
      } else if (e.kind === "mars_rover") {
        lateral = Math.sin(e.age * 2.4 + e.id) * 22 * (1 - t);
      } else if (e.kind === "magma_walker") {
        lateral = Math.sin(e.age * 1.2 + e.id) * 8 * (1 - t);
      } else if (e.kind === "abyss_ray") {
        lateral = Math.sin(e.age * 2.0 + e.id) * 38 * (1 - t);
      } else if (e.kind === "mimic_drone") {
        lateral = Math.sin(e.age * 8.5 + e.id) * 16 * (1 - t);
      } else if (e.kind === "entropy_core") {
        lateral = Math.sin(e.age * 6.0 + e.id) * 7 * (1 - t);
      } else if (e.kind === "splitter_mini") {
        lateral = Math.sin(e.age * 4.0 + e.id) * 18 * (1 - t);
      }

      e.x = mix(e.origin.x, WORLD.core.x, t) + lateral;
      e.y = mix(e.origin.y, WORLD.core.y, t);
      e.scale = 0.4 + 0.7 * t;
    }
  }

  weakPoint(e: Enemy): Point {
    if (isBossKind(e.kind) && e.phase === 2) {
      const a = -Math.PI / 2 + (e.weakIndex * Math.PI * 2) / 3;
      const offset = e.kind === "void_leviathan" ? 80 : 68;
      return { x: e.x + Math.cos(a) * offset, y: e.y + Math.sin(a) * offset };
    }
    return { x: e.x, y: e.y };
  }

  clear() {
    for (const e of this.pool) {
      e.active = false;
      e.dying = false;
      e.dyingTime = 0;
      e.phased = false;
    }
  }
}

