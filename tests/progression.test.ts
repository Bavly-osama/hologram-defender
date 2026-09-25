import { describe, expect, it } from "vitest";
import { CombatSimulation } from "../src/gameplay/CombatSimulation";
import { WaveManager } from "../src/gameplay/WaveManager";
import { segmentCircle } from "../src/gameplay/CollisionSystem";
import { ScoreSystem } from "../src/gameplay/ScoreSystem";
describe("progression and collision boundaries", () => {
  it("detects fast projectiles crossing a small target between frames", () => {
    expect(
      segmentCircle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 3),
    ).toBe(true);
    expect(
      segmentCircle({ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 50, y: 0 }, 3),
    ).toBe(false);
  });
  it("ends each regular wave only after its final enemy is gone", () => {
    for (let wave = 1; wave <= 4; wave++) {
      const sim = new CombatSimulation(),
        waves = new WaveManager();
      waves.start(wave, sim);
      let completed = false;
      for (let frame = 0; frame < 5000 && !completed; frame++) {
        completed = waves.update(0.05, sim);
        if (completed) expect(sim.enemies.active).toHaveLength(0);
        sim.enemies.clear();
      }
      expect(completed).toBe(true);
      expect(waves.spawned).toBeGreaterThan(5);
    }
  });
  it("requires all three armor nodes before the final Sentinel phase", () => {
    const sim = new CombatSimulation();
    const boss = sim.enemies.spawn("boss", { x: 600, y: 180 })!;
    const shoot = () => {
      sim.energy = 100;
      sim.fire(sim.enemies.weakPoint(boss));
      for (let frame = 0; frame < 70; frame++)
        sim.update(1 / 60, { x: 600, y: 500, active: true });
    };
    for (let shot = 0; shot < 25 && boss.phase === 1; shot++) shoot();
    expect(boss.phase).toBe(2);
    const hp = boss.hp;
    sim.fire({ x: boss.x + 60, y: boss.y + 10 });
    for (let frame = 0; frame < 50; frame++)
      sim.update(1 / 60, { x: 600, y: 500, active: true });
    expect(boss.hp).toBe(hp);
    for (let shot = 0; shot < 20 && boss.phase === 2; shot++) shoot();
    expect(boss.phase).toBe(3);
    expect(boss.weakIndex).toBe(3);
    for (let shot = 0; shot < 60 && boss.active; shot++) shoot();
    expect(boss.active).toBe(false);
    expect(sim.score.value).toBeGreaterThanOrEqual(5000);
  });
  it("caps combo, expires it, and resets on a miss", () => {
    const score = new ScoreSystem();
    for (let i = 0; i < 10; i++) score.hit(i * 0.1);
    expect(score.combo).toBe(4);
    score.update(10);
    expect(score.combo).toBe(0);
    score.hit(11);
    score.miss();
    expect(score.combo).toBe(0);
    expect(score.bestCombo).toBe(4);
  });
});
