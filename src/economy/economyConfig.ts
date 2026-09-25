import type { EnemyKind } from "../gameplay/gameBalance";

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  baseDamage: number;
  fireRate: number; // shots per second
  projectileSpeed: number;
  lockTimeModifier: number; // added to base lockTime
  penetration: number; // number of targets it can hit
  energyCost: number;
  upgradeCosts: number[]; // costs for Lv2, Lv3, Lv4, Lv5 (length 4)
  damagePerLevel: number; // multiplier increment per level (e.g. 0.15 = +15%)
  fireRatePerLevel: number; // increment per level
}

export interface ShieldDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  radiusMultiplier: number;
  energyCapBonus: number;
  energyRegenBonus: number;
  damageReduction: number; // 0 to 1 fraction reduced from core damage
  reactiveEnergyRefund: number; // energy restored on blocking hostile shots
  upgradeCosts: number[];
  radiusPerLevel: number;
  regenPerLevel: number;
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  basePrice: number;
  priceMultiplier: number;
  unit: string;
  statPerLevel: number;
  formatStat: (level: number) => string;
}

export interface SkinTheme {
  primary: number; // hex color integer for Pixi
  secondary: number;
  glow: number;
  projectile: number;
  hexCode: string; // CSS color string
  beamCode: string;
}

export interface SkinDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  theme: SkinTheme;
}

export const ECONOMY_CONFIG = {
  currency: {
    name: "CREDITS",
    symbol: "◈",
  },

  enemyRewards: {
    scout: 10,
    orb: 15,
    heavy: 30,
    phase_striker: 35,
    storm_drone: 40,
    splitter: 45,
    splitter_mini: 10,
    mimic_drone: 50,
    null_hunter: 60,
    boss: 250,
    mars_war_machine: 400,
    void_leviathan: 600,
    fracture_architect: 1000,
  } as Record<EnemyKind, number>,

  bonuses: {
    waveBase: 50,
    waveMultiplier: 15, // extra per wave number
    perfectDefense: 35, // core took no damage during wave
    accuracyBonusMax: 40, // scaled by accuracy 0..1
    bossDefeated: 250,
  },

  weapons: [
    {
      id: "pulse_cannon",
      name: "PULSE CANNON",
      description: "Standard balanced orbital defense weapon with reliable cadence.",
      price: 0,
      baseDamage: 1.0,
      fireRate: 6.0,
      projectileSpeed: 1350,
      lockTimeModifier: 0,
      penetration: 1,
      energyCost: 8,
      upgradeCosts: [100, 220, 400, 700],
      damagePerLevel: 0.15,
      fireRatePerLevel: 0.35,
    },
    {
      id: "rapid_pulse",
      name: "RAPID PULSE",
      description: "High-cadence repeater excels at clearing swarms of scouts and kamikaze orbs.",
      price: 180,
      baseDamage: 0.65,
      fireRate: 9.5,
      projectileSpeed: 1450,
      lockTimeModifier: -0.02,
      penetration: 1,
      energyCost: 5,
      upgradeCosts: [140, 280, 480, 800],
      damagePerLevel: 0.12,
      fireRatePerLevel: 0.5,
    },
    {
      id: "heavy_blaster",
      name: "HEAVY BLASTER",
      description: "High-yield plasma blast destroys armored heavy hulls and boss shielding.",
      price: 320,
      baseDamage: 2.5,
      fireRate: 3.2,
      projectileSpeed: 1200,
      lockTimeModifier: 0.02,
      penetration: 1,
      energyCost: 14,
      upgradeCosts: [240, 450, 750, 1150],
      damagePerLevel: 0.22,
      fireRatePerLevel: 0.2,
    },
    {
      id: "piercing_beam",
      name: "PIERCING BEAM",
      description: "Coherent tachyon beam drills straight through multiple aligned targets in a line.",
      price: 480,
      baseDamage: 1.3,
      fireRate: 4.8,
      projectileSpeed: 1650,
      lockTimeModifier: 0,
      penetration: 3,
      energyCost: 12,
      upgradeCosts: [300, 560, 920, 1400],
      damagePerLevel: 0.18,
      fireRatePerLevel: 0.3,
    },
  ] as WeaponDefinition[],

  shields: [
    {
      id: "standard_shield",
      name: "STANDARD SHIELD",
      description: "Factory orbital aegis shield with well-rounded coverage and energy flow.",
      price: 0,
      radiusMultiplier: 1.0,
      energyCapBonus: 0,
      energyRegenBonus: 0,
      damageReduction: 0,
      reactiveEnergyRefund: 0,
      upgradeCosts: [90, 180, 320, 550],
      radiusPerLevel: 0.04,
      regenPerLevel: 2,
    },
    {
      id: "wide_deflector",
      name: "WIDE DEFLECTOR",
      description: "Extended interception field creates a huge safety corridor against hostile barrages.",
      price: 160,
      radiusMultiplier: 1.25,
      energyCapBonus: 10,
      energyRegenBonus: -2,
      damageReduction: 0,
      reactiveEnergyRefund: 0,
      upgradeCosts: [150, 290, 480, 780],
      radiusPerLevel: 0.05,
      regenPerLevel: 1.5,
    },
    {
      id: "fortified_shield",
      name: "FORTIFIED SHIELD",
      description: "Dense localized barrier dampens impact bleed-through to protect core integrity.",
      price: 280,
      radiusMultiplier: 0.88,
      energyCapBonus: 25,
      energyRegenBonus: 0,
      damageReduction: 0.25, // 25% core damage reduction
      reactiveEnergyRefund: 0,
      upgradeCosts: [200, 380, 620, 950],
      radiusPerLevel: 0.03,
      regenPerLevel: 2,
    },
    {
      id: "reactive_shield",
      name: "REACTIVE SHIELD",
      description: "Capacitor barrier siphons energy from intercepted hostile shots directly to battery.",
      price: 420,
      radiusMultiplier: 1.02,
      energyCapBonus: 15,
      energyRegenBonus: 3,
      damageReduction: 0.05,
      reactiveEnergyRefund: 7, // +7 energy per projectile blocked
      upgradeCosts: [260, 480, 750, 1100],
      radiusPerLevel: 0.035,
      regenPerLevel: 2.5,
    },
  ] as ShieldDefinition[],

  upgrades: [
    {
      id: "core_armor",
      name: "CORE ARMOR",
      description: "Reinforces Quantum Core chassis with heavy titanium nano-plating.",
      maxLevel: 5,
      basePrice: 110,
      priceMultiplier: 1.55,
      unit: "HP",
      statPerLevel: 15,
      formatStat: (level) => `+${level * 15} Core HP (Cap: 175)`,
    },
    {
      id: "targeting_array",
      name: "TARGETING ARRAY",
      description: "Calibrates sub-space radar sensors for wider aim-assist capture volume.",
      maxLevel: 5,
      basePrice: 95,
      priceMultiplier: 1.5,
      unit: "px",
      statPerLevel: 12,
      formatStat: (level) => `+${level * 12}px Lock Radius`,
    },
    {
      id: "lock_processor",
      name: "LOCK PROCESSOR",
      description: "High-speed quantum neural core locks onto hostile targets in a flash.",
      maxLevel: 5,
      basePrice: 130,
      priceMultiplier: 1.6,
      unit: "s",
      statPerLevel: -0.015,
      formatStat: (level) => `-${(level * 0.015 * 1000).toFixed(0)}ms Lock Time`,
    },
    {
      id: "energy_cell",
      name: "ENERGY CELL",
      description: "Expands orbital battery capacity for longer sustained auto-fire streams.",
      maxLevel: 5,
      basePrice: 85,
      priceMultiplier: 1.45,
      unit: "Energy",
      statPerLevel: 15,
      formatStat: (level) => `+${level * 15} Max Energy`,
    },
    {
      id: "energy_recycler",
      name: "ENERGY RECYCLER",
      description: "Thermal heat exchange conduits accelerate battery power regeneration.",
      maxLevel: 5,
      basePrice: 105,
      priceMultiplier: 1.5,
      unit: "EPS",
      statPerLevel: 4,
      formatStat: (level) => `+${level * 4} Energy/Sec`,
    },
    {
      id: "repair_system",
      name: "NANO REPAIR SYSTEM",
      description: "Automated fabrication drones repair core damage between wave phases.",
      maxLevel: 5,
      basePrice: 140,
      priceMultiplier: 1.6,
      unit: "HP/Wave",
      statPerLevel: 10,
      formatStat: (level) => `+${level * 10} HP Restored / Wave`,
    },
  ] as UpgradeDefinition[],

  skins: [
    {
      id: "classic_cyan",
      name: "CLASSIC CYAN",
      description: "Standard orbital defense cyan holographic spectral signature.",
      price: 0,
      theme: {
        primary: 0x7deaf4,
        secondary: 0xd6ffff,
        glow: 0x27b9de,
        projectile: 0xa3f7ff,
        hexCode: "#7deaf4",
        beamCode: "#4dd8ef",
      },
    },
    {
      id: "plasma_violet",
      name: "PLASMA VIOLET",
      description: "Deep ultraviolet ion discharge with amethyst energetic filaments.",
      price: 150,
      theme: {
        primary: 0xc462f8,
        secondary: 0xf3d6ff,
        glow: 0x8a2be2,
        projectile: 0xdc88ff,
        hexCode: "#c462f8",
        beamCode: "#af40f5",
      },
    },
    {
      id: "solar_gold",
      name: "SOLAR GOLD",
      description: "High-energy coronal solar spectrum with golden radiant flare.",
      price: 260,
      theme: {
        primary: 0xffcb45,
        secondary: 0xfffae6,
        glow: 0xe69500,
        projectile: 0xffd970,
        hexCode: "#ffcb45",
        beamCode: "#f5a300",
      },
    },
    {
      id: "crimson_protocol",
      name: "CRIMSON PROTOCOL",
      description: "Emergency override tactical scarlet with aggressive crimson lines.",
      price: 360,
      theme: {
        primary: 0xff4f58,
        secondary: 0xffdfe2,
        glow: 0xd41924,
        projectile: 0xff6b72,
        hexCode: "#ff4f58",
        beamCode: "#ff2632",
      },
    },
    {
      id: "void_white",
      name: "VOID WHITE",
      description: "Monochromatic zero-point singularity with blinding white purity.",
      price: 500,
      theme: {
        primary: 0xf2f8ff,
        secondary: 0xffffff,
        glow: 0x7892b0,
        projectile: 0xffffff,
        hexCode: "#f2f8ff",
        beamCode: "#cbdbee",
      },
    },
  ] as SkinDefinition[],
} as const;

export const getWeaponDef = (id: string): WeaponDefinition =>
  ECONOMY_CONFIG.weapons.find((w) => w.id === id) ?? ECONOMY_CONFIG.weapons[0];

export const getShieldDef = (id: string): ShieldDefinition =>
  ECONOMY_CONFIG.shields.find((s) => s.id === id) ?? ECONOMY_CONFIG.shields[0];

export const getUpgradeDef = (id: string): UpgradeDefinition | undefined =>
  ECONOMY_CONFIG.upgrades.find((u) => u.id === id);

export const getSkinDef = (id: string): SkinDefinition =>
  ECONOMY_CONFIG.skins.find((s) => s.id === id) ?? ECONOMY_CONFIG.skins[0];

export const getUpgradeCost = (def: UpgradeDefinition, currentLevel: number): number => {
  if (currentLevel >= def.maxLevel) return Infinity;
  return Math.round(def.basePrice * Math.pow(def.priceMultiplier, currentLevel));
};
