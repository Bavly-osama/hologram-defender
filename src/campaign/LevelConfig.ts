import type { EnemyKind } from "../gameplay/gameBalance";
import type { StageId } from "./StageConfig";

export type LevelModifier =
  | "NONE"
  | "DUST_SWEEP"
  | "ELECTRICAL_STORM"
  | "FRACTURE_ANOMALY";

export interface WaveDefinition {
  count: number;
  interval: number;
  types: EnemyKind[];
  speedScale?: number;
}

export interface EnemyScannerCard {
  name: string;
  classTag: string;
  ability: string;
  threatRating: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
}

export interface LevelConfig {
  id: number;
  stageId: StageId;
  levelInStage: number;
  name: string;
  subtitle: string;
  briefing: string;
  enemyPool: EnemyKind[];
  waves: WaveDefinition[];
  difficulty: number;
  rewards: {
    credits: number;
    firstClearBonus: number;
  };
  modifier: LevelModifier;
  isBossLevel: boolean;
  bossKind: EnemyKind | null;
  introScannerEnemy?: EnemyScannerCard;
}

export const LEVELS_CONFIG: Record<number, LevelConfig> = {
  // ── STAGE 1: EARTH DEFENSE GRID (1–5) ──────────────────────────
  1: {
    id: 1,
    stageId: 1,
    levelInStage: 1,
    name: "First Contact",
    subtitle: "PERIMETER BREACH",
    briefing: "Rogue drone reconnaissance detected in Sector 07. Calibrate targeting reticle and auto-fire.",
    enemyPool: ["scout"],
    difficulty: 1.0,
    rewards: { credits: 80, firstClearBonus: 100 },
    modifier: "NONE",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "SCOUT DRONE",
      classTag: "LIGHT RECON",
      ability: "Direct orbital approach. Quick single-shot targets.",
      threatRating: "LOW",
    },
    waves: [
      { count: 5, interval: 2.8, types: ["scout"] },
      { count: 6, interval: 2.5, types: ["scout"] },
    ],
  },
  2: {
    id: 2,
    stageId: 1,
    levelInStage: 2,
    name: "Orbital Pressure",
    subtitle: "HOSTILE CADENCE",
    briefing: "Enemy flight vectors converging on the communication relay. Maintain steady reticle focus.",
    enemyPool: ["scout"],
    difficulty: 1.08,
    rewards: { credits: 110, firstClearBonus: 120 },
    modifier: "NONE",
    isBossLevel: false,
    bossKind: null,
    waves: [
      { count: 7, interval: 2.3, types: ["scout"] },
      { count: 9, interval: 2.0, types: ["scout"] },
    ],
  },
  3: {
    id: 3,
    stageId: 1,
    levelInStage: 3,
    name: "Kamikaze Signal",
    subtitle: "EXPLOSIVE TRAJECTORIES",
    briefing: "High-speed suicide orbs identified. Intercept with shield or eliminate before they impact the Core.",
    enemyPool: ["scout", "orb"],
    difficulty: 1.15,
    rewards: { credits: 140, firstClearBonus: 150 },
    modifier: "NONE",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "KAMIKAZE ORB",
      classTag: "FAST DIVE-BOMBER",
      ability: "Pauses briefly then accelerates at high velocity towards the Quantum Core.",
      threatRating: "MODERATE",
    },
    waves: [
      { count: 8, interval: 2.2, types: ["scout", "orb"] },
      { count: 10, interval: 1.9, types: ["scout", "orb", "orb"] },
    ],
  },
  4: {
    id: 4,
    stageId: 1,
    levelInStage: 4,
    name: "Heavy Assault",
    subtitle: "ARMORED FRONT",
    briefing: "Armored cruisers entering range. Aim for illuminated weak points to maximize penetration damage.",
    enemyPool: ["scout", "orb", "heavy"],
    difficulty: 1.22,
    rewards: { credits: 180, firstClearBonus: 200 },
    modifier: "NONE",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "HEAVY DRONE",
      classTag: "ARMORED CAPITAL HULL",
      ability: "Heavy armor plates. Precision hits on central optical core deal bonus damage.",
      threatRating: "HIGH",
    },
    waves: [
      { count: 8, interval: 2.2, types: ["scout", "heavy"] },
      { count: 10, interval: 1.9, types: ["scout", "orb", "heavy"] },
      { count: 8, interval: 1.8, types: ["heavy", "orb", "scout"] },
    ],
  },
  5: {
    id: 5,
    stageId: 1,
    levelInStage: 5,
    name: "Orbital Sentinel",
    subtitle: "STAGE 1 CLIMAX",
    briefing: "Command vessel Sentinel has entered orbit. Block defensive barrages and destroy exposed conduits.",
    enemyPool: ["boss", "scout"],
    difficulty: 1.3,
    rewards: { credits: 350, firstClearBonus: 500 },
    modifier: "NONE",
    isBossLevel: true,
    bossKind: "boss",
    waves: [
      { count: 1, interval: 3.0, types: ["boss"] },
    ],
  },

  // ── STAGE 2: MARS RED FRONTIER (6–10) ──────────────────────────
  6: {
    id: 6,
    stageId: 2,
    levelInStage: 1,
    name: "Red Arrival",
    subtitle: "ARES ORBIT INSERTION",
    briefing: "Exiting transit above Mars surface. Heavy tracked Rust Ravagers patrolling the rust dunes.",
    enemyPool: ["mars_rover"],
    difficulty: 1.38,
    rewards: { credits: 200, firstClearBonus: 220 },
    modifier: "NONE",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "RUST RAVAGER",
      classTag: "MARTIAN TANK SKIMMER",
      ability: "Heavy tread armor shrugs off glancing fire. Fires twin incendiary bursts.",
      threatRating: "MODERATE",
    },
    waves: [
      { count: 9, interval: 2.0, types: ["mars_rover"] },
      { count: 11, interval: 1.8, types: ["mars_rover", "mars_rover"] },
    ],
  },
  7: {
    id: 7,
    stageId: 2,
    levelInStage: 2,
    name: "Phase Contact",
    subtitle: "TACTICAL SHIFT",
    briefing: "Target signatures flickering in and out of optical tracking. Watch for phase distortion flashes.",
    enemyPool: ["mars_rover", "phase_striker"],
    difficulty: 1.45,
    rewards: { credits: 240, firstClearBonus: 250 },
    modifier: "NONE",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "PHASE STRIKER",
      classTag: "STEALTH INTERCEPTOR",
      ability: "Briefly enters phase-shift state, shifting orbital lanes while untargetable.",
      threatRating: "HIGH",
    },
    waves: [
      { count: 10, interval: 2.0, types: ["mars_rover", "phase_striker"] },
      { count: 11, interval: 1.7, types: ["phase_striker", "mars_rover", "phase_striker"] },
    ],
  },
  8: {
    id: 8,
    stageId: 2,
    levelInStage: 3,
    name: "Rust Canyon Ambush",
    subtitle: "ARES HIGH PLATEAU",
    briefing: "Massed Martian hunter packs descending through thermal air pockets. Rapid target switching required.",
    enemyPool: ["mars_rover", "phase_striker"],
    difficulty: 1.52,
    rewards: { credits: 280, firstClearBonus: 300 },
    modifier: "NONE",
    isBossLevel: false,
    bossKind: null,
    waves: [
      { count: 12, interval: 1.8, types: ["mars_rover", "phase_striker", "mars_rover"] },
      { count: 14, interval: 1.6, types: ["phase_striker", "mars_rover", "phase_striker"] },
    ],
  },
  9: {
    id: 9,
    stageId: 2,
    levelInStage: 4,
    name: "Magma Vanguard",
    subtitle: "VOLCANIC CRATER SIEGE",
    briefing: "Volcanic basalt armor signatures detected. Magma Colossi advancing behind heavy thermal mortar fire.",
    enemyPool: ["mars_rover", "phase_striker", "magma_walker"],
    difficulty: 1.6,
    rewards: { credits: 320, firstClearBonus: 350 },
    modifier: "DUST_SWEEP",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "MAGMA COLOSSUS",
      classTag: "VOLCANIC SIEGE MECH",
      ability: "Encased in basalt plates. Fires high-damage molten mortars at Quantum Core.",
      threatRating: "CRITICAL",
    },
    waves: [
      { count: 11, interval: 1.8, types: ["mars_rover", "magma_walker"] },
      { count: 13, interval: 1.5, types: ["phase_striker", "mars_rover", "magma_walker"] },
      { count: 10, interval: 1.4, types: ["magma_walker", "phase_striker", "magma_walker"] },
    ],
  },
  10: {
    id: 10,
    stageId: 2,
    levelInStage: 5,
    name: "Mars War Machine",
    subtitle: "STAGE 2 CLIMAX",
    briefing: "Heavy planetary siege dreadnought detected. Destroy rotating weakpoint nodes and penetrate molten core.",
    enemyPool: ["mars_war_machine", "mars_rover"],
    difficulty: 1.7,
    rewards: { credits: 600, firstClearBonus: 800 },
    modifier: "DUST_SWEEP",
    isBossLevel: true,
    bossKind: "mars_war_machine",
    waves: [
      { count: 1, interval: 3.0, types: ["mars_war_machine"] },
    ],
  },

  // ── STAGE 3: NEPTUNE VOID (11–15) ─────────────────────────────
  11: {
    id: 11,
    stageId: 3,
    levelInStage: 1,
    name: "Frozen Signal",
    subtitle: "CRYOGENIC SILENCE",
    briefing: "Outer gas giant perimeter. Storm Drones riding high-altitude atmospheric lightning squalls.",
    enemyPool: ["storm_drone"],
    difficulty: 1.78,
    rewards: { credits: 350, firstClearBonus: 380 },
    modifier: "NONE",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "CRYO STORM DRONE",
      classTag: "ION HOVERCRAFT",
      ability: "Discharges static electrical arcs. Weaves erratically along planetary storm fronts.",
      threatRating: "HIGH",
    },
    waves: [
      { count: 11, interval: 1.7, types: ["storm_drone"] },
      { count: 13, interval: 1.5, types: ["storm_drone", "storm_drone"] },
    ],
  },
  12: {
    id: 12,
    stageId: 3,
    levelInStage: 2,
    name: "Crystal Fractures",
    subtitle: "CELLULAR MULTIPLICATION",
    briefing: "Crystalline drone hulls detected. Target fractures into dual high-speed crystal shards upon destruction.",
    enemyPool: ["storm_drone", "splitter"],
    difficulty: 1.86,
    rewards: { credits: 390, firstClearBonus: 420 },
    modifier: "ELECTRICAL_STORM",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "CRYSTAL SPLITTER",
      classTag: "CLUSTER BIO-DRONE",
      ability: "Fractures into two aggressive Splitter Mini Shards when destroyed.",
      threatRating: "HIGH",
    },
    waves: [
      { count: 12, interval: 1.6, types: ["storm_drone", "splitter"] },
      { count: 14, interval: 1.4, types: ["splitter", "storm_drone", "splitter"] },
    ],
  },
  13: {
    id: 13,
    stageId: 3,
    levelInStage: 3,
    name: "Abyssal Drift",
    subtitle: "BIOLUMINESCENT DEPTHS",
    briefing: "Massive biological signatures rising from dense methane clouds. Abyssal Mantas sweeping with EMP shockwaves.",
    enemyPool: ["splitter", "abyss_ray"],
    difficulty: 1.95,
    rewards: { credits: 430, firstClearBonus: 460 },
    modifier: "ELECTRICAL_STORM",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "ABYSSAL MANTA",
      classTag: "BIOLUMINESCENT EMP RAY",
      ability: "Glides across screen emitting EMP pulses that disrupt core energy shields.",
      threatRating: "CRITICAL",
    },
    waves: [
      { count: 10, interval: 1.8, types: ["splitter", "abyss_ray"] },
      { count: 12, interval: 1.5, types: ["abyss_ray", "splitter", "abyss_ray"] },
    ],
  },
  14: {
    id: 14,
    stageId: 3,
    levelInStage: 4,
    name: "Deep Blue Assault",
    subtitle: "ELECTRICAL HURRICANE",
    briefing: "Full supercell storm assault. Splitters, Storm Drones, and Abyssal Mantas converging simultaneously.",
    enemyPool: ["storm_drone", "splitter", "abyss_ray"],
    difficulty: 2.05,
    rewards: { credits: 480, firstClearBonus: 500 },
    modifier: "ELECTRICAL_STORM",
    isBossLevel: false,
    bossKind: null,
    waves: [
      { count: 12, interval: 1.6, types: ["storm_drone", "splitter", "abyss_ray"] },
      { count: 14, interval: 1.4, types: ["splitter", "abyss_ray", "storm_drone"] },
      { count: 12, interval: 1.3, types: ["abyss_ray", "storm_drone", "splitter"] },
    ],
  },
  15: {
    id: 15,
    stageId: 3,
    levelInStage: 5,
    name: "Void Leviathan",
    subtitle: "STAGE 3 CLIMAX",
    briefing: "Colossal biomechanical dreadnought rising from deep storm mantle. Deflect hyper-bolts and tear through armor rings.",
    enemyPool: ["void_leviathan", "storm_drone"],
    difficulty: 2.15,
    rewards: { credits: 900, firstClearBonus: 1200 },
    modifier: "ELECTRICAL_STORM",
    isBossLevel: true,
    bossKind: "void_leviathan",
    waves: [
      { count: 1, interval: 3.0, types: ["void_leviathan"] },
    ],
  },

  // ── STAGE 4: THE FRACTURE (16–20) ──────────────────────────────
  16: {
    id: 16,
    stageId: 4,
    levelInStage: 1,
    name: "Unknown Space",
    subtitle: "SINGULARITY VECTOR",
    briefing: "Exited known universe into a fractured spatial rift. Reality geometry is destabilizing.",
    enemyPool: ["mimic_drone"],
    difficulty: 2.25,
    rewards: { credits: 550, firstClearBonus: 600 },
    modifier: "FRACTURE_ANOMALY",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "FRACTURE MIMIC",
      classTag: "HOLOGRAPHIC PROJECTION",
      ability: "Jitters and flickers with dimensional decoys. High-speed evasive vector.",
      threatRating: "CRITICAL",
    },
    waves: [
      { count: 12, interval: 1.5, types: ["mimic_drone"] },
      { count: 15, interval: 1.3, types: ["mimic_drone", "mimic_drone"] },
    ],
  },
  17: {
    id: 17,
    stageId: 4,
    levelInStage: 2,
    name: "Null Incursion",
    subtitle: "TERMINAL DISRUPTION",
    briefing: "Hyper-speed tachyon interdictors zeroing in on Quantum Core containment coils. Intercept before impact.",
    enemyPool: ["mimic_drone", "null_hunter"],
    difficulty: 2.35,
    rewards: { credits: 600, firstClearBonus: 650 },
    modifier: "FRACTURE_ANOMALY",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "NULL HUNTER",
      classTag: "CORE INTERDICTOR",
      ability: "High velocity needle predator designed to pierce shields at tachyon speed.",
      threatRating: "CRITICAL",
    },
    waves: [
      { count: 12, interval: 1.5, types: ["mimic_drone", "null_hunter"] },
      { count: 14, interval: 1.3, types: ["null_hunter", "mimic_drone", "null_hunter"] },
    ],
  },
  18: {
    id: 18,
    stageId: 4,
    levelInStage: 3,
    name: "Entropy Horizon",
    subtitle: "GRAVITATIONAL COLLAPSE",
    briefing: "Singularity cores distorting surrounding space. Protected by rotating obsidian reality shards.",
    enemyPool: ["null_hunter", "entropy_core"],
    difficulty: 2.45,
    rewards: { credits: 660, firstClearBonus: 700 },
    modifier: "FRACTURE_ANOMALY",
    isBossLevel: false,
    bossKind: null,
    introScannerEnemy: {
      name: "ENTROPY SINGULARITY",
      classTag: "GRAVITATIONAL ANOMALY",
      ability: "Miniature black hole shielded by rotating obsidian shards. Absorbs heavy damage.",
      threatRating: "CRITICAL",
    },
    waves: [
      { count: 13, interval: 1.4, types: ["null_hunter", "entropy_core"] },
      { count: 15, interval: 1.2, types: ["entropy_core", "null_hunter", "entropy_core"] },
    ],
  },
  19: {
    id: 19,
    stageId: 4,
    levelInStage: 4,
    name: "Singularity Threshold",
    subtitle: "EVENT HORIZON CONVERGENCE",
    briefing: "Final reality barrier before the Architect's sanctum. Full singularity legion unleashed.",
    enemyPool: ["mimic_drone", "null_hunter", "entropy_core"],
    difficulty: 2.6,
    rewards: { credits: 750, firstClearBonus: 850 },
    modifier: "FRACTURE_ANOMALY",
    isBossLevel: false,
    bossKind: null,
    waves: [
      { count: 14, interval: 1.4, types: ["null_hunter", "mimic_drone", "entropy_core"] },
      { count: 16, interval: 1.2, types: ["entropy_core", "mimic_drone", "null_hunter"] },
      { count: 14, interval: 1.1, types: ["entropy_core", "null_hunter", "entropy_core"] },
    ],
  },
  20: {
    id: 20,
    stageId: 4,
    levelInStage: 5,
    name: "The Architect",
    subtitle: "FINAL CAMPAIGN CONVERGENCE",
    briefing: "The hyper-dimensional entity controlling the spatial breach. Multi-phase entity. Destroy core matrices to restore realspace.",
    enemyPool: ["fracture_architect", "null_hunter"],
    difficulty: 2.8,
    rewards: { credits: 1500, firstClearBonus: 2500 },
    modifier: "FRACTURE_ANOMALY",
    isBossLevel: true,
    bossKind: "fracture_architect",
    waves: [
      { count: 1, interval: 3.0, types: ["fracture_architect"] },
    ],
  },
};

export function getLevelConfig(levelId: number): LevelConfig {
  const clamped = Math.max(1, Math.min(20, Math.floor(levelId)));
  return LEVELS_CONFIG[clamped] ?? LEVELS_CONFIG[1];
}
