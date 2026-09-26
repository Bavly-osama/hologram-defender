import { balance } from "./gameBalance";
import type { CombatSimulation } from "./CombatSimulation";
import { MobileSpawnMapper } from "./MobileSpawnMapper";

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
    if (wave === 5) sim.enemies.spawn("boss", MobileSpawnMapper.getBossOrigin());
  }
  update(dt: number, sim: CombatSimulation) {
    if (this.wave === 5) {
      const boss = sim.enemies.active.find((e) => e.kind === "boss");
      if (!boss) return true;
      if (boss.phase === 3) {
        this.bossSummon += dt;
        if (this.bossSummon > 5 && sim.enemies.active.length < 8) {
          this.bossSummon = 0;
          const origin = MobileSpawnMapper.getOrigin(this.spawned++);
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
      const origin = MobileSpawnMapper.getOrigin((this.spawned * 5 + this.wave));
      sim.enemies.spawn(wave.types[this.spawned % wave.types.length], origin);
      sim.onEvent({ type: "portal", ...origin });
      this.spawned++;
      this.timer = wave.interval;
    }
    return this.spawned === wave.count && sim.enemies.active.length === 0;
  }
}
