import {
  DEFAULT_CAMPAIGN_PROGRESS,
  type CampaignProgressData,
} from "../campaign/CampaignProgress";

export interface TransactionRecord {
  id: string;
  type: "ENEMY_REWARD" | "WAVE_REWARD" | "BOSS_REWARD" | "PURCHASE" | "UPGRADE";
  amount: number;
  source: string;
  itemId?: string;
  timestamp: number;
}

export interface PlayerProfile {
  version: number;
  credits: number;
  totalCreditsEarned: number;
  totalEnemiesKilled: number;

  equippedWeaponId: string;
  equippedShieldId: string;
  equippedSkinId: string;

  ownedWeapons: string[];
  ownedShields: string[];
  ownedSkins: string[];

  weaponLevels: Record<string, number>; // level 1..5
  shieldLevels: Record<string, number>; // level 1..5
  upgrades: Record<string, number>; // upgrade id -> level 0..5

  highestWave: number;
  highScore: number;
  transactions: TransactionRecord[];
  campaignProgress: CampaignProgressData;
}

export const DEFAULT_PROFILE: PlayerProfile = {
  version: 1,
  credits: 0,
  totalCreditsEarned: 0,
  totalEnemiesKilled: 0,

  equippedWeaponId: "pulse_cannon",
  equippedShieldId: "standard_shield",
  equippedSkinId: "classic_cyan",

  ownedWeapons: ["pulse_cannon"],
  ownedShields: ["standard_shield"],
  ownedSkins: ["classic_cyan"],

  weaponLevels: { pulse_cannon: 1 },
  shieldLevels: { standard_shield: 1 },
  upgrades: {
    core_armor: 0,
    targeting_array: 0,
    lock_processor: 0,
    energy_cell: 0,
    energy_recycler: 0,
    repair_system: 0,
  },

  highestWave: 1,
  highScore: 0,
  transactions: [],
  campaignProgress: JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN_PROGRESS)),
};

export class StorageService {
  static readonly STORAGE_KEY = "hd.player.profile.v1";
  private static memoryBackup?: PlayerProfile;

  static createDefaultProfile(): PlayerProfile {
    return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  }

  static load(): PlayerProfile {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return StorageService.memoryBackup
          ? JSON.parse(JSON.stringify(StorageService.memoryBackup))
          : JSON.parse(JSON.stringify(DEFAULT_PROFILE));
      }

      const raw = window.localStorage.getItem(StorageService.STORAGE_KEY);
      if (!raw) {
        const initial = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
        StorageService.save(initial);
        return initial;
      }

      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      const migrated = StorageService.migrate(parsed);
      StorageService.memoryBackup = JSON.parse(JSON.stringify(migrated));
      return migrated;
    } catch (error) {
      console.warn("[StorageService] Corrupted save profile, recovering with defaults:", error);
      const recovered = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
      StorageService.save(recovered);
      return recovered;
    }
  }

  static save(profile: PlayerProfile): boolean {
    try {
      // Ensure transaction history doesn't grow unbounded
      if (profile.transactions && profile.transactions.length > 50) {
        profile.transactions = profile.transactions.slice(-50);
      }
      StorageService.memoryBackup = JSON.parse(JSON.stringify(profile));

      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(
          StorageService.STORAGE_KEY,
          JSON.stringify(profile),
        );
      }
      return true;
    } catch (error) {
      console.error("[StorageService] Failed to persist profile:", error);
      return false;
    }
  }

  static migrate(data: any): PlayerProfile {
    const version = typeof data.version === "number" ? data.version : 0;
    const base = JSON.parse(JSON.stringify(DEFAULT_PROFILE)) as PlayerProfile;

    if (version < 1) {
      // Version 0 or unversioned -> Upgrade to v1
      return {
        ...base,
        credits: typeof data.credits === "number" ? Math.max(0, data.credits) : 0,
        totalCreditsEarned:
          typeof data.totalCreditsEarned === "number" ? data.totalCreditsEarned : 0,
        highScore: typeof data.highScore === "number" ? data.highScore : 0,
        highestWave: typeof data.highestWave === "number" ? data.highestWave : 1,
      };
    }

    // Merge missing fields safely to prevent undefined bugs when new fields are added
    return {
      version: 1,
      credits: typeof data.credits === "number" ? Math.max(0, data.credits) : 0,
      totalCreditsEarned:
        typeof data.totalCreditsEarned === "number" ? data.totalCreditsEarned : 0,
      totalEnemiesKilled:
        typeof data.totalEnemiesKilled === "number" ? data.totalEnemiesKilled : 0,

      equippedWeaponId: data.equippedWeaponId || base.equippedWeaponId,
      equippedShieldId: data.equippedShieldId || base.equippedShieldId,
      equippedSkinId: data.equippedSkinId || base.equippedSkinId,

      ownedWeapons: Array.isArray(data.ownedWeapons) && data.ownedWeapons.length
        ? Array.from(new Set(data.ownedWeapons))
        : base.ownedWeapons,
      ownedShields: Array.isArray(data.ownedShields) && data.ownedShields.length
        ? Array.from(new Set(data.ownedShields))
        : base.ownedShields,
      ownedSkins: Array.isArray(data.ownedSkins) && data.ownedSkins.length
        ? Array.from(new Set(data.ownedSkins))
        : base.ownedSkins,

      weaponLevels: { ...base.weaponLevels, ...(data.weaponLevels || {}) },
      shieldLevels: { ...base.shieldLevels, ...(data.shieldLevels || {}) },
      upgrades: { ...base.upgrades, ...(data.upgrades || {}) },

      highestWave: typeof data.highestWave === "number" ? data.highestWave : 1,
      highScore: typeof data.highScore === "number" ? data.highScore : 0,
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
      campaignProgress: data.campaignProgress
        ? {
            highestUnlockedLevel: Math.max(1, Math.min(20, data.campaignProgress.highestUnlockedLevel ?? 1)),
            highestUnlockedStage: Math.max(1, Math.min(4, data.campaignProgress.highestUnlockedStage ?? 1)),
            completedLevels: data.campaignProgress.completedLevels ?? {},
            seenCinematics: Array.isArray(data.campaignProgress.seenCinematics) ? data.campaignProgress.seenCinematics : [],
            campaignCompleted: Boolean(data.campaignProgress.campaignCompleted),
            totalCampaignTime: data.campaignProgress.totalCampaignTime ?? 0,
          }
        : JSON.parse(JSON.stringify(DEFAULT_CAMPAIGN_PROGRESS)),
    };
  }
}
