import { describe, expect, it, beforeEach } from "vitest";
import { WalletSystem } from "../src/economy/WalletSystem";
import { PlayerInventory } from "../src/economy/PlayerInventory";
import { PlayerStatsCalculator } from "../src/economy/PlayerStatsCalculator";
import { StorageService } from "../src/economy/StorageService";
import {
  ECONOMY_CONFIG,
  getWeaponDef,
  getShieldDef,
  getUpgradeDef,
} from "../src/economy/economyConfig";
import { CombatSimulation } from "../src/gameplay/CombatSimulation";
import { balance } from "../src/gameplay/gameBalance";

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

describe("Credits, Progression, and Economy System", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe("WalletSystem", () => {
    it("initializes with starting credits and prevents negative balance", () => {
      const wallet = new WalletSystem(100);
      expect(wallet.credits).toBe(100);
      expect(wallet.balance).toBe(100);
      expect(wallet.canAfford(150)).toBe(false);
      expect(wallet.spend(150, "Overspend test")).toBe(false);
      expect(wallet.balance).toBe(100);
    });

    it("adds credits and formats balance properly", () => {
      const wallet = new WalletSystem(50);
      expect(wallet.add(200, "Wave bonus")).toBe(true);
      expect(wallet.balance).toBe(250);
      expect(wallet.totalEarned).toBe(250);
      expect(wallet.formatted).toContain("250");
    });

    it("spends credits atomically", () => {
      const wallet = new WalletSystem(500);
      const success = wallet.spend(300, "Weapon purchase");
      expect(success).toBe(true);
      expect(wallet.balance).toBe(200);
    });
  });

  describe("PlayerInventory", () => {
    it("starts with default equipment", () => {
      const inventory = new PlayerInventory();
      expect(inventory.activeWeapon).toBe("pulse_cannon");
      expect(inventory.activeShield).toBe("standard_shield");
      expect(inventory.activeSkin).toBe("classic_cyan");
      expect(inventory.ownedWeapons).toContain("pulse_cannon");
      expect(inventory.ownedShields).toContain("standard_shield");
      expect(inventory.ownedSkins).toContain("classic_cyan");
    });

    it("allows purchasing and equipping new weapons", () => {
      const inventory = new PlayerInventory();
      inventory.wallet.add(1000, "Test funds");

      const rapidDef = getWeaponDef("rapid_pulse");
      const initialBalance = inventory.wallet.balance;

      const res = inventory.buyWeapon("rapid_pulse");
      expect(res.success).toBe(true);
      expect(inventory.ownedWeapons).toContain("rapid_pulse");
      expect(inventory.activeWeapon).toBe("rapid_pulse");
      expect(inventory.wallet.balance).toBe(initialBalance - rapidDef.price);

      // Re-buying owned weapon should fail
      const res2 = inventory.buyWeapon("rapid_pulse");
      expect(res2.success).toBe(false);
    });

    it("allows upgrading stats up to max level cap", () => {
      const inventory = new PlayerInventory();
      inventory.wallet.add(5000, "Upgrade budget");

      const def = getUpgradeDef("core_armor")!;
      for (let lvl = 1; lvl <= def.maxLevel; lvl++) {
        const res = inventory.purchaseUpgrade("core_armor");
        expect(res.success).toBe(true);
        expect(inventory.getUpgradeLevel("core_armor")).toBe(lvl);
      }

      // Beyond max level should fail
      const resMax = inventory.purchaseUpgrade("core_armor");
      expect(resMax.success).toBe(false);
    });

    it("handles skin purchases and equips cosmetically", () => {
      const inventory = new PlayerInventory();
      inventory.wallet.add(1000, "Skin funds");

      const res = inventory.buySkin("solar_gold");
      expect(res.success).toBe(true);
      expect(inventory.activeSkin).toBe("solar_gold");
      expect(inventory.ownedSkins).toContain("solar_gold");

      expect(inventory.equipSkin("classic_cyan")).toBe(true);
      expect(inventory.activeSkin).toBe("classic_cyan");
    });
  });

  describe("PlayerStatsCalculator", () => {
    it("computes stats for default setup", () => {
      const inventory = new PlayerInventory();
      const stats = PlayerStatsCalculator.compute(inventory);

      expect(stats.maxHealth).toBe(100);
      expect(stats.damage).toBe(getWeaponDef("pulse_cannon").baseDamage);
      expect(stats.fireRate).toBe(getWeaponDef("pulse_cannon").fireRate);
      expect(stats.penetration).toBe(1);
    });

    it("applies upgrades and enforces safety hard caps", () => {
      const inventory = new PlayerInventory();
      inventory.wallet.add(10000, "Max upgrade test");

      // Upgrade armor
      inventory.purchaseUpgrade("core_armor");
      inventory.purchaseUpgrade("core_armor");

      const stats = PlayerStatsCalculator.compute(inventory);
      expect(stats.maxHealth).toBe(130); // 100 + 2 * 15
      expect(stats.damageReduction).toBeLessThanOrEqual(0.5); // hard cap
    });

    it("reflects equipped shield modifiers", () => {
      const inventory = new PlayerInventory();
      inventory.wallet.add(2000, "Shield funds");
      inventory.buyShield("wide_deflector");

      const stats = PlayerStatsCalculator.compute(inventory);
      const wideDef = getShieldDef("wide_deflector");
      expect(stats.shieldRadius).toBe(Math.round(balance.shieldRadius * wideDef.radiusMultiplier));

      inventory.buyShield("reactive_shield");
      const reactiveStats = PlayerStatsCalculator.compute(inventory);
      expect(reactiveStats.reactiveEnergyRefund).toBe(getShieldDef("reactive_shield").reactiveEnergyRefund);
    });
  });

  describe("StorageService and Persistence", () => {
    it("saves and reloads player profiles", () => {
      const profile = StorageService.createDefaultProfile();
      profile.credits = 888;
      profile.equippedWeaponId = "piercing_beam";
      profile.ownedWeapons.push("piercing_beam");
      StorageService.save(profile);

      const loaded = StorageService.load();
      expect(loaded.credits).toBe(888);
      expect(loaded.equippedWeaponId).toBe("piercing_beam");
      expect(loaded.ownedWeapons).toContain("piercing_beam");
    });

    it("handles corrupted save data gracefully", () => {
      mockLocalStorage.setItem(StorageService.STORAGE_KEY, "{invalid json");
      const recovered = StorageService.load();
      expect(recovered.version).toBe(1);
      expect(recovered.credits).toBe(0);
      expect(recovered.equippedWeaponId).toBe("pulse_cannon");
    });
  });

  describe("Combat Integration with Stats", () => {
    it("grants credit rewards when an enemy is killed in CombatSimulation", () => {
      const stats = PlayerStatsCalculator.compute(new PlayerInventory());
      const sim = new CombatSimulation(stats);
      const enemy = sim.enemies.spawn("scout", { x: 300, y: 300 })!;

      const initialCredits = sim.creditsEarnedInRun;
      sim.kill(enemy);

      expect(sim.creditsEarnedInRun).toBe(initialCredits + ECONOMY_CONFIG.enemyRewards.scout);
      expect(sim.enemiesKilledInRun).toBe(1);
    });

    it("pierces multiple enemies when weapon has penetration > 1", () => {
      const inventory = new PlayerInventory();
      inventory.wallet.add(2000, "Piercing funds");
      inventory.buyWeapon("piercing_beam");
      const stats = PlayerStatsCalculator.compute(inventory);
      expect(stats.penetration).toBe(3);

      const sim = new CombatSimulation(stats);
      sim.energy = 100;

      // Spawn scout in line of fire
      sim.enemies.spawn("scout", { x: 600, y: 300 });

      sim.fire({ x: 600, y: 100 });
      const p = sim.projectiles.pool.find((proj) => proj.active && proj.team === "player");
      expect(p).toBeDefined();
      expect(p!.penetration).toBe(3);
      expect(p!.hitsRemaining).toBe(3);
    });

    it("absorbs energy when reactive shield blocks incoming fire", () => {
      const inventory = new PlayerInventory();
      inventory.wallet.add(2000, "Reactive funds");
      inventory.buyShield("reactive_shield");
      const stats = PlayerStatsCalculator.compute(inventory);

      const sim = new CombatSimulation(stats);
      sim.energy = 50;

      // Spawn hostile projectile traveling towards shield
      sim.projectiles.spawn("hostile", 600, 400, 600, 600, 0, 10);

      // Shield active at (600, 400)
      sim.update(0.01, { x: 600, y: 400, active: true });
      expect(sim.blocks).toBe(1);
      expect(sim.energy).toBeCloseTo(50 + stats.reactiveEnergyRefund, 0);
    });
  });
});
