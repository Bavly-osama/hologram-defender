export type EnemyKind =
  | "scout"
  | "orb"
  | "heavy"
  | "mars_rover"
  | "phase_striker"
  | "magma_walker"
  | "storm_drone"
  | "splitter"
  | "splitter_mini"
  | "abyss_ray"
  | "mimic_drone"
  | "null_hunter"
  | "entropy_core"
  | "boss"
  | "mars_war_machine"
  | "void_leviathan"
  | "fracture_architect";

export function isBossKind(kind: EnemyKind): boolean {
  return (
    kind === "boss" ||
    kind === "mars_war_machine" ||
    kind === "void_leviathan" ||
    kind === "fracture_architect"
  );
}

export const balance = {
  health: 100,
  energy: 100,
  shotCost: 8,
  energyRegen: 28,
  shieldRadius: 61,
  projectileSpeed: 1350,
  comboTimeout: 3.5,
  assistRadius: 90,
  lockTime: 0.14,
  autoFireInterval: 0.16,
  enemies: {
    scout: { hp: 1, speed: 0.065, damage: 10, radius: 25, score: 100 },
    orb: { hp: 1, speed: 0.105, damage: 20, radius: 22, score: 150 },
    heavy: { hp: 6, speed: 0.036, damage: 15, radius: 44, score: 300 },
    mars_rover: { hp: 3, speed: 0.07, damage: 12, radius: 26, score: 220 },
    phase_striker: { hp: 4, speed: 0.082, damage: 16, radius: 28, score: 280 },
    magma_walker: { hp: 8, speed: 0.038, damage: 22, radius: 46, score: 450 },
    storm_drone: { hp: 5, speed: 0.085, damage: 18, radius: 30, score: 320 },
    splitter: { hp: 7, speed: 0.052, damage: 18, radius: 36, score: 380 },
    splitter_mini: { hp: 1, speed: 0.09, damage: 8, radius: 18, score: 100 },
    abyss_ray: { hp: 9, speed: 0.045, damage: 24, radius: 48, score: 500 },
    mimic_drone: { hp: 6, speed: 0.075, damage: 22, radius: 28, score: 420 },
    null_hunter: { hp: 5, speed: 0.125, damage: 28, radius: 24, score: 480 },
    entropy_core: { hp: 12, speed: 0.032, damage: 32, radius: 50, score: 650 },
    boss: { hp: 42, speed: 0, damage: 15, radius: 100, score: 5000 },
    mars_war_machine: { hp: 65, speed: 0, damage: 20, radius: 110, score: 7500 },
    void_leviathan: { hp: 90, speed: 0, damage: 25, radius: 120, score: 10000 },
    fracture_architect: { hp: 120, speed: 0, damage: 30, radius: 130, score: 15000 },
  },
  waves: [
    { count: 7, interval: 2.8, types: ["scout"] },
    { count: 10, interval: 2.35, types: ["scout", "scout", "orb"] },
    { count: 10, interval: 2.4, types: ["scout", "heavy", "scout"] },
    { count: 15, interval: 1.85, types: ["scout", "orb", "heavy", "scout"] },
  ] as { count: number; interval: number; types: EnemyKind[] }[],
};
