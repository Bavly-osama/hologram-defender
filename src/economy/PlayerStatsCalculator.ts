import { balance } from "../gameplay/gameBalance";
import {
  getWeaponDef,
  getShieldDef,
  getSkinDef,
  type SkinTheme,
  type WeaponDefinition,
  type ShieldDefinition,
} from "./economyConfig";
import type { PlayerInventory } from "./PlayerInventory";

export interface ComputedPlayerStats {
  // Weapon Stats
  weapon: WeaponDefinition;
  weaponLevel: number;
  damage: number;
  damagePerShot: number;
  fireRate: number; // shots per sec
  fireInterval: number; // sec between shots (1 / fireRate)
  projectileSpeed: number;
  penetration: number;
  energyCost: number;

  // Shield Stats
  shield: ShieldDefinition;
  shieldLevel: number;
  shieldRadius: number;
  damageReduction: number;
  reactiveEnergyRefund: number;

  // Core & Engine Stats
  maxHealth: number;
  maxEnergy: number;
  energyRegen: number;
  energyRechargeRate: number;
  assistRadius: number;
  lockTime: number;
  repairBetweenWaves: number;

  // Cosmetic Skin Theme (affects visuals ONLY, no combat stats)
  skinTheme: SkinTheme;
}

export class PlayerStatsCalculator {
  static compute(inventory: PlayerInventory): ComputedPlayerStats {
    const weaponDef = getWeaponDef(inventory.equippedWeaponId);
    const weaponLvl = inventory.getWeaponLevel(weaponDef.id);

    const shieldDef = getShieldDef(inventory.equippedShieldId);
    const shieldLvl = inventory.getShieldLevel(shieldDef.id);

    const skinDef = getSkinDef(inventory.equippedSkinId);

    // Weapon Stat Scaling
    const damageMultiplier = 1 + (weaponLvl - 1) * weaponDef.damagePerLevel;
    const finalDamage = Number((weaponDef.baseDamage * damageMultiplier).toFixed(2));
    const finalFireRate = Number(
      (weaponDef.fireRate + (weaponLvl - 1) * weaponDef.fireRatePerLevel).toFixed(2),
    );
    const finalFireInterval = Math.max(0.08, Number((1 / finalFireRate).toFixed(3)));

    // Shield Stat Scaling
    const shieldRadiusLvlBonus = (shieldLvl - 1) * shieldDef.radiusPerLevel;
    const shieldRadius = Math.round(
      balance.shieldRadius * (shieldDef.radiusMultiplier + shieldRadiusLvlBonus),
    );
    const shieldRegenBonus = shieldDef.energyRegenBonus + (shieldLvl - 1) * shieldDef.regenPerLevel;

    // Upgrades
    const coreArmorLvl = inventory.getUpgradeLevel("core_armor");
    const targetingArrayLvl = inventory.getUpgradeLevel("targeting_array");
    const lockProcLvl = inventory.getUpgradeLevel("lock_processor");
    const energyCellLvl = inventory.getUpgradeLevel("energy_cell");
    const energyRecyclerLvl = inventory.getUpgradeLevel("energy_recycler");
    const repairSystemLvl = inventory.getUpgradeLevel("repair_system");

    // Applied values with strict safety caps
    const maxHealth = Math.min(175, balance.health + coreArmorLvl * 15);
    const maxEnergy = Math.min(
      200,
      balance.energy + shieldDef.energyCapBonus + energyCellLvl * 15,
    );
    const energyRegen = Math.min(
      60,
      balance.energyRegen + shieldRegenBonus + energyRecyclerLvl * 4,
    );
    const assistRadius = Math.min(
      150,
      balance.assistRadius + targetingArrayLvl * 12,
    );
    const lockTime = Math.max(
      0.06,
      balance.lockTime + weaponDef.lockTimeModifier - lockProcLvl * 0.015,
    );
    const repairBetweenWaves = repairSystemLvl * 10;

    return {
      weapon: weaponDef,
      weaponLevel: weaponLvl,
      damage: finalDamage,
      damagePerShot: finalDamage,
      fireRate: finalFireRate,
      fireInterval: finalFireInterval,
      projectileSpeed: weaponDef.projectileSpeed,
      penetration: weaponDef.penetration,
      energyCost: weaponDef.energyCost,

      shield: shieldDef,
      shieldLevel: shieldLvl,
      shieldRadius,
      damageReduction: shieldDef.damageReduction,
      reactiveEnergyRefund: shieldDef.reactiveEnergyRefund,

      maxHealth,
      maxEnergy,
      energyRegen,
      energyRechargeRate: energyRegen,
      assistRadius,
      lockTime,
      repairBetweenWaves,

      skinTheme: skinDef.theme,
    };
  }
}
