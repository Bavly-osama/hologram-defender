import type { SQLiteScoreRepository } from "../db/database";
import type { PlayerProfile } from "../../../src/economy/StorageService";
import { DEFAULT_PROFILE } from "../../../src/economy/StorageService";

export class PlayerService {
  constructor(private db: SQLiteScoreRepository) {}

  /** Return a merged PlayerProfile for frontend consumption. Never returns password_hash. */
  getFullProfile(userId: number): PlayerProfile {
    const row = this.db.getProfile(userId);
    if (!row) return JSON.parse(JSON.stringify(DEFAULT_PROFILE)) as PlayerProfile;

    let campaignProgress = JSON.parse(JSON.stringify(DEFAULT_PROFILE.campaignProgress));
    try {
      const parsed = JSON.parse(row.campaign_progress);
      if (parsed && typeof parsed === "object") {
        campaignProgress = {
          highestUnlockedLevel: Math.max(1, Math.min(20, parsed.highestUnlockedLevel ?? 1)),
          highestUnlockedStage: Math.max(1, Math.min(4, parsed.highestUnlockedStage ?? 1)),
          completedLevels: parsed.completedLevels ?? {},
          seenCinematics: Array.isArray(parsed.seenCinematics) ? parsed.seenCinematics : [],
          campaignCompleted: Boolean(parsed.campaignCompleted),
          totalCampaignTime: parsed.totalCampaignTime ?? 0,
        };
      }
    } catch { /* keep default */ }

    const safeJson = <T>(raw: string, fallback: T): T => {
      try { return JSON.parse(raw) as T; } catch { return fallback; }
    };

    // Overlay level_progress rows onto campaignProgress.completedLevels
    const levelRows = this.db.getLevelProgress(userId);
    for (const lr of levelRows) {
      campaignProgress.completedLevels[lr.level_id] = {
        completed: Boolean(lr.completed),
        perfect: Boolean(lr.perfect),
        bestScore: lr.best_score,
        bestCoreIntegrity: lr.best_core_integrity,
        bestAccuracy: lr.best_accuracy,
        firstClearedAt: lr.first_cleared_at,
      };
      if (Boolean(lr.completed) && lr.level_id >= campaignProgress.highestUnlockedLevel) {
        campaignProgress.highestUnlockedLevel = Math.min(20, lr.level_id + 1);
      }
    }

    return {
      version: row.version,
      credits: row.credits,
      totalCreditsEarned: row.total_credits_earned,
      totalEnemiesKilled: row.total_enemies_killed,
      highestWave: row.highest_wave,
      highScore: row.high_score,
      equippedWeaponId: row.equipped_weapon_id,
      equippedShieldId: row.equipped_shield_id,
      equippedSkinId: row.equipped_skin_id,
      ownedWeapons: safeJson(row.owned_weapons, ["pulse_cannon"]),
      ownedShields: safeJson(row.owned_shields, ["standard_shield"]),
      ownedSkins: safeJson(row.owned_skins, ["classic_cyan"]),
      weaponLevels: safeJson(row.weapon_levels, { pulse_cannon: 1 }),
      shieldLevels: safeJson(row.shield_levels, { standard_shield: 1 }),
      upgrades: safeJson(row.upgrades, DEFAULT_PROFILE.upgrades),
      transactions: [],
      campaignProgress,
    };
  }

  /** Persist a profile update from the client. Validates credit bounds. */
  saveFullProfile(userId: number, profile: PlayerProfile): void {
    const credits = Math.max(0, Math.min(10_000_000, profile.credits));

    this.db.saveProfile(userId, {
      version: profile.version ?? 1,
      credits,
      total_credits_earned: Math.max(0, profile.totalCreditsEarned ?? credits),
      total_enemies_killed: Math.max(0, profile.totalEnemiesKilled ?? 0),
      highest_wave: Math.max(1, profile.highestWave ?? 1),
      high_score: Math.max(0, profile.highScore ?? 0),
      equipped_weapon_id: profile.equippedWeaponId || "pulse_cannon",
      equipped_shield_id: profile.equippedShieldId || "standard_shield",
      equipped_skin_id: profile.equippedSkinId || "classic_cyan",
      owned_weapons: JSON.stringify(Array.isArray(profile.ownedWeapons) ? profile.ownedWeapons : ["pulse_cannon"]),
      owned_shields: JSON.stringify(Array.isArray(profile.ownedShields) ? profile.ownedShields : ["standard_shield"]),
      owned_skins: JSON.stringify(Array.isArray(profile.ownedSkins) ? profile.ownedSkins : ["classic_cyan"]),
      weapon_levels: JSON.stringify(profile.weaponLevels || { pulse_cannon: 1 }),
      shield_levels: JSON.stringify(profile.shieldLevels || { standard_shield: 1 }),
      upgrades: JSON.stringify(profile.upgrades || {}),
      campaign_progress: JSON.stringify(profile.campaignProgress || {}),
    });

    // Upsert individual level records for quick querying
    if (profile.campaignProgress?.completedLevels) {
      for (const [levelIdStr, lr] of Object.entries(profile.campaignProgress.completedLevels)) {
        const levelId = Number(levelIdStr);
        if (!Number.isInteger(levelId) || levelId < 1 || levelId > 20) continue;
        this.db.upsertLevelProgress(userId, {
          level_id: levelId,
          completed: lr.completed ? 1 : 0,
          perfect: lr.perfect ? 1 : 0,
          best_score: Math.max(0, lr.bestScore ?? 0),
          best_core_integrity: lr.bestCoreIntegrity ?? 0,
          best_accuracy: lr.bestAccuracy ?? 0,
          first_cleared_at: lr.firstClearedAt ?? Date.now(),
        });
      }
    }
  }

  /** Record a completed level with server-side unlock verification. */
  recordLevelComplete(
    userId: number,
    levelId: number,
    data: {
      score: number;
      coreIntegrity: number;
      accuracy: number;
      duration: number;
      creditsEarned: number;
    }
  ): { creditsGranted: number; nextUnlockedLevel: number; isPerfect: boolean } {
    if (levelId < 1 || levelId > 20) throw new RangeError("Invalid level ID");

    // Server-side perfect check
    const isPerfect = data.coreIntegrity >= 95 && data.accuracy >= 0.7;

    // Plausibility guard on credits
    const MAX_CREDITS_PER_LEVEL = 5000;
    const creditsGranted = Math.max(0, Math.min(MAX_CREDITS_PER_LEVEL, data.creditsEarned));

    // Upsert level progress
    this.db.upsertLevelProgress(userId, {
      level_id: levelId,
      completed: 1,
      perfect: isPerfect ? 1 : 0,
      best_score: Math.max(0, data.score),
      best_core_integrity: data.coreIntegrity,
      best_accuracy: data.accuracy,
      first_cleared_at: Date.now(),
    });

    // Update profile: add credits + update campaign_progress unlock
    const profile = this.db.getProfile(userId);
    if (profile) {
      let cp = JSON.parse(JSON.stringify({}));
      try { cp = JSON.parse(profile.campaign_progress); } catch { /* ok */ }

      const prevHighest = cp.highestUnlockedLevel ?? 1;
      const nextUnlockedLevel = Math.min(20, Math.max(prevHighest, levelId + 1));
      cp.highestUnlockedLevel = nextUnlockedLevel;
      if (levelId >= 5 && levelId < 10) cp.highestUnlockedStage = Math.max(cp.highestUnlockedStage ?? 1, 2);
      if (levelId >= 10 && levelId < 15) cp.highestUnlockedStage = Math.max(cp.highestUnlockedStage ?? 1, 3);
      if (levelId >= 15) cp.highestUnlockedStage = Math.max(cp.highestUnlockedStage ?? 1, 4);
      if (levelId === 20) cp.campaignCompleted = true;

      this.db.saveProfile(userId, {
        ...profile,
        credits: Math.min(10_000_000, (profile.credits ?? 0) + creditsGranted),
        total_credits_earned: (profile.total_credits_earned ?? 0) + creditsGranted,
        high_score: Math.max(profile.high_score ?? 0, data.score),
        campaign_progress: JSON.stringify(cp),
      });

      return { creditsGranted, nextUnlockedLevel, isPerfect };
    }

    return { creditsGranted, nextUnlockedLevel: Math.min(20, levelId + 1), isPerfect };
  }
}
