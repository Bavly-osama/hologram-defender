import type { EnemyKind } from "../gameplay/gameBalance";

export type StageId = 1 | 2 | 3 | 4;

export interface StagePalette {
  primary: number;
  secondary: number;
  glow: number;
  haze: string;
  hudAccent: string;
  spaceColor: string;
}

export interface StageConfig {
  id: StageId;
  stageIndex: number;
  name: string;
  subtitle: string;
  location: string;
  sectorTag: string;
  levelIds: [number, number, number, number, number];
  palette: StagePalette;
  stageSpecificEnemy: EnemyKind;
  stageSpecificEnemyName: string;
  bossKind: EnemyKind;
  bossName: string;
  ambientFx: "orbital_debris" | "dust_storm" | "electric_arcs" | "space_fractures";
  travelDestination: string;
  travelDescription: string;
}

export const STAGES_CONFIG: Record<StageId, StageConfig> = {
  1: {
    id: 1,
    stageIndex: 0,
    name: "EARTH DEFENSE GRID",
    subtitle: "ORBITAL SANCTUARY",
    location: "Low Earth Orbit · Sector 07",
    sectorTag: "TERRA-01",
    levelIds: [1, 2, 3, 4, 5],
    palette: {
      primary: 0x42f5e9,
      secondary: 0x227b9c,
      glow: 0x8df8ff,
      haze: "#061f3088",
      hudAccent: "#42f5e9",
      spaceColor: "#050e18",
    },
    stageSpecificEnemy: "heavy",
    stageSpecificEnemyName: "Heavy Siege Drone",
    bossKind: "boss",
    bossName: "ORBITAL SENTINEL",
    ambientFx: "orbital_debris",
    travelDestination: "Mars Orbit",
    travelDescription: "Plotting interplanetary trajectory to Mars orbital battlezone...",
  },
  2: {
    id: 2,
    stageIndex: 1,
    name: "MARS RED FRONTIER",
    subtitle: "RUST & LIGHTNING",
    location: "Ares Low Orbit · Sector 04",
    sectorTag: "ARES-02",
    levelIds: [6, 7, 8, 9, 10],
    palette: {
      primary: 0xff6a3d,
      secondary: 0x8f2d14,
      glow: 0xffaa66,
      haze: "#3a130988",
      hudAccent: "#ff7744",
      spaceColor: "#140806",
    },
    stageSpecificEnemy: "mars_rover",
    stageSpecificEnemyName: "Rust Ravager / Phase Striker",
    bossKind: "mars_war_machine",
    bossName: "MARS WAR MACHINE",
    ambientFx: "dust_storm",
    travelDestination: "Neptune Outer Rings",
    travelDescription: "Engaging deep-system ion drive towards Neptune storm fronts...",
  },
  3: {
    id: 3,
    stageIndex: 2,
    name: "NEPTUNE VOID",
    subtitle: "DEEP FROZEN STORMS",
    location: "Outer Gas Giant Rim · Sector 09",
    sectorTag: "NEPT-03",
    levelIds: [11, 12, 13, 14, 15],
    palette: {
      primary: 0x5a7cff,
      secondary: 0x243280,
      glow: 0x94b4ff,
      haze: "#09123888",
      hudAccent: "#6692ff",
      spaceColor: "#050818",
    },
    stageSpecificEnemy: "storm_drone",
    stageSpecificEnemyName: "Cryo Splitter / Abyssal Ray",
    bossKind: "void_leviathan",
    bossName: "VOID LEVIATHAN",
    ambientFx: "electric_arcs",
    travelDestination: "The Spatial Fracture",
    travelDescription: "Entering unknown tachyon rift beyond the planetary barrier...",
  },
  4: {
    id: 4,
    stageIndex: 3,
    name: "THE FRACTURE",
    subtitle: "UNSTABLE SINGULARITY",
    location: "Deep Space Fold · Sector Ω",
    sectorTag: "OMEGA-04",
    levelIds: [16, 17, 18, 19, 20],
    palette: {
      primary: 0xd946ef,
      secondary: 0x6b1480,
      glow: 0xf472b6,
      haze: "#2c063888",
      hudAccent: "#ec4899",
      spaceColor: "#0e0314",
    },
    stageSpecificEnemy: "entropy_core",
    stageSpecificEnemyName: "Tachyon Hunter / Entropy Core",
    bossKind: "fracture_architect",
    bossName: "THE ARCHITECT",
    ambientFx: "space_fractures",
    travelDestination: "Earth Orbit (Return Vector)",
    travelDescription: "Singularity collapsed. Establishing homeward quantum gate...",
  },
};

export const STAGES: StageConfig[] = Object.values(STAGES_CONFIG);

export function getStageByLevelId(levelId: number): StageConfig {
  const stageId = (Math.ceil(Math.max(1, Math.min(20, levelId)) / 5) as StageId);
  return STAGES_CONFIG[stageId];
}

