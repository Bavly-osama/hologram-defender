import { describe, expect, it } from "vitest";
import { PinchRecognizer } from "../src/gestures/PinchRecognizer";
import {
  normalizeHandPoint,
  HandPresenceManager,
} from "../src/tracking/HandState";
import { GameStateManager } from "../src/core/GameStateManager";
import { CombatSimulation } from "../src/gameplay/CombatSimulation";

describe("intentional one-hand controls", () => {
  it("fires once on pinch start and rearms only after release", () => {
    const pinch = new PinchRecognizer();
    expect(pinch.update(0.6)).toBe(false);
    expect(pinch.update(0.19)).toBe(true);
    expect(pinch.update(0.21)).toBe(false);
    expect(pinch.update(0.3)).toBe(false);
    pinch.update(0.6);
    expect(pinch.update(0.18)).toBe(true);
  });
  it("mirrors horizontal coordinates exactly once", () => {
    expect(normalizeHandPoint({ x: 0.2, y: 0.7 })).toEqual({ x: 0.8, y: 0.7 });
  });
  it("holds briefly, fades, then hides lost landmarks", () => {
    const presence = new HandPresenceManager();
    presence.seen(100);
    expect(presence.opacity(200)).toBe(1);
    expect(presence.opacity(350)).toBeCloseTo(0.5);
    expect(presence.opacity(500)).toBe(0);
  });
});
describe("game lifecycle", () => {
  it("pauses and resumes the exact interrupted state", () => {
    const state = new GameStateManager();
    state.set("PLAYING");
    state.pause();
    expect(state.current).toBe("PAUSED");
    state.resume();
    expect(state.current).toBe("PLAYING");
  });
  it("limits shots by energy and regenerates without passing the cap", () => {
    const sim = new CombatSimulation();
    for (let i = 0; i < 20; i++) sim.fire({ x: 100, y: 100 });
    expect(
      sim.projectiles.active.filter((p) => p.team === "player"),
    ).toHaveLength(12);
    expect(sim.energy).toBe(4);
    sim.update(10, { x: 0, y: 0, active: false });
    expect(sim.energy).toBe(100);
  });
  it("shoots and destroys a scout with real projectile collision", () => {
    const sim = new CombatSimulation();
    const enemy = sim.enemies.spawn("scout", { x: 600, y: 200 })!;
    sim.fire({ x: 600, y: 200 });
    for (let i = 0; i < 90; i++)
      sim.update(1 / 60, { x: 0, y: 0, active: false });
    expect(enemy.active).toBe(false);
    expect(sim.score.value).toBeGreaterThan(0);
    expect(sim.score.hits).toBe(1);
  });
  it("intercepts hostile projectiles without damaging the core", () => {
    const sim = new CombatSimulation();
    sim.projectiles.spawn("hostile", 600, 400, 600, 600, 0, 10);
    sim.update(0.01, { x: 600, y: 400, active: true });
    expect(sim.projectiles.active).toHaveLength(0);
    expect(sim.health).toBe(100);
    expect(sim.blocks).toBe(1);
  });
  it("damages the core when an enemy reaches it", () => {
    const sim = new CombatSimulation();
    sim.enemies.spawn("scout", { x: 600, y: 200 })!.depth = 0.9999;
    sim.update(0.1, { x: 0, y: 0, active: false });
    expect(sim.health).toBe(90);
  });
  it("automatically locks onto enemy in reticle and auto-fires from core", () => {
    const sim = new CombatSimulation();
    const scout = sim.enemies.spawn("scout", { x: 600, y: 200 })!;
    expect(sim.lockState).toBe("IDLE");

    // Position shield over enemy
    sim.aim({ x: 600, y: 200 });
    expect(sim.target?.id).toBe(scout.id);
    expect(sim.lockState).toBe("LOCKING");

    // Update for 100ms (< 200ms lockTime) -> still LOCKING, no projectile fired yet
    sim.update(0.1, { x: 600, y: 200, active: false });
    expect(sim.lockState).toBe("LOCKING");
    expect(sim.projectiles.active).toHaveLength(0);

    // Update for another 120ms (total 220ms > 200ms lockTime) -> LOCKED and auto-fires!
    sim.update(0.12, { x: 600, y: 200, active: false });
    expect(sim.lockState).toBe("LOCKED");
    expect(sim.projectiles.active.filter((p) => p.team === "player")).toHaveLength(1);

    // Move reticle far away -> lock breaks immediately, returns to IDLE
    sim.update(0.05, { x: 100, y: 700, active: false });
    expect(sim.lockState).toBe("IDLE");
    expect(sim.target).toBeUndefined();
  });
});
