import type { CombatSimulation } from "./CombatSimulation";
import type { InputManager } from "../input/InputManager";

export class TutorialController {
  step = 0;
  private movementStart = 0;
  private initialShots = 0;
  private initialBlocks = 0;
  private time = 0;

  start(sim: CombatSimulation, input: InputManager) {
    this.step = 0;
    this.time = 0;
    this.movementStart = input.moved;
    this.initialShots = sim.score.hits;
    this.initialBlocks = sim.blocks;
    sim.autoFireEnabled = false;
  }

  update(dt: number, sim: CombatSimulation, input: InputManager): boolean {
    this.time += dt;

    // STEP 0: "MOVE YOUR HAND"
    if (
      this.step === 0 &&
      input.moved - this.movementStart > 120 &&
      input.active
    ) {
      this.step = 1;
      this.time = 0;
      sim.enemies.spawn("scout", { x: 600, y: 260 });
      sim.autoFireEnabled = false;
    }

    // STEP 1: "AIM AT THE TARGET"
    if (this.step === 1) {
      const target = sim.enemies.active[0];
      if (target) {
        target.depth = 0;
        target.origin.x = 600;
        target.x = 600;
        target.y = 260;
        target.age = 0;
      }
      // When target is locked, advance to auto-fire step
      if (sim.lockState === "LOCKED" && this.time > 0.4) {
        this.step = 2;
        this.time = 0;
        this.initialShots = sim.score.hits;
        sim.autoFireEnabled = true;
      }
    }

    // STEP 2: "AUTO FIRE ACTIVE"
    if (this.step === 2) {
      sim.autoFireEnabled = true;
      const target = sim.enemies.active[0];
      if (target) {
        target.depth = 0;
        target.origin.x = 600;
        target.x = 600;
        target.y = 260;
      }
      if (sim.score.hits > this.initialShots || (!target && this.time > 0.2)) {
        this.step = 3;
        this.time = 0;
        sim.clear();
        this.launch(sim);
      }
    }

    // STEP 3: "MOVE YOUR SHIELD TO BLOCK"
    if (this.step === 3) {
      sim.autoFireEnabled = true;
      if (sim.blocks > this.initialBlocks) return true;
      if (!sim.projectiles.active.length) {
        sim.health = 100;
        this.launch(sim);
      }
    }

    return false;
  }

  private launch(sim: CombatSimulation) {
    sim.projectiles.spawn("hostile", 900, 260, 600, 585, 130, 0);
  }
}
