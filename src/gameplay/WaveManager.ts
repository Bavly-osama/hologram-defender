import { balance } from "./gameBalance";
import type { CombatSimulation } from "./CombatSimulation";
const origins = [
  { x: 150, y: 120 },
  { x: 600, y: 90 },
  { x: 1040, y: 140 },
  { x: 100, y: 340 },
  { x: 1100, y: 320 },
  { x: 450, y: 130 },
];
export class WaveManager {
  wave = 1;
  spawned = 0;
  timer = 1;
  bossSummon = 0;
  start(wave: number, sim: CombatSimulation) {
    this.wave = wave;
    this.spawned = 0;
    this.timer = 0.8;
    this.bossSummon = 0;
    sim.difficulty = 1 + (wave - 1) * 0.07;
    if (wave === 5) sim.enemies.spawn("boss", { x: 600, y: 180 });
  }
  update(dt: number, sim: CombatSimulation) {
    if (this.wave === 5) {
      const boss = sim.enemies.active.find((e) => e.kind === "boss");
      if (!boss) return true;
      if (boss.phase === 3) {
        this.bossSummon += dt;
        if (this.bossSummon > 5 && sim.enemies.active.length < 8) {
          this.bossSummon = 0;
          const origin = origins[this.spawned++ % origins.length];
          sim.enemies.spawn("scout", origin);
          sim.onEvent({ type: "portal", ...origin });
        }
      }
      return false;
    }
    const wave = balance.waves[this.wave - 1];
    this.timer -= dt;
    if (
      this.timer <= 0 &&
      this.spawned < wave.count &&
      sim.enemies.active.length < 25
    ) {
      const origin = origins[(this.spawned * 5 + this.wave) % origins.length];
      sim.enemies.spawn(wave.types[this.spawned % wave.types.length], origin);
      sim.onEvent({ type: "portal", ...origin });
      this.spawned++;
      this.timer = wave.interval;
    }
    return this.spawned === wave.count && sim.enemies.active.length === 0;
  }
}
