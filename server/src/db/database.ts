import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ScoreInput } from "../validation/score.schema";

export interface ScoreRow extends ScoreInput {
  id: number;
  createdAt: string;
}
export interface ScoreRepository {
  save(score: ScoreInput): number;
  top(limit: number): ScoreRow[];
  close(): void;
}

// ─── User account types ─────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface PlayerProfileRow {
  user_id: number;
  version: number;
  credits: number;
  total_credits_earned: number;
  total_enemies_killed: number;
  highest_wave: number;
  high_score: number;
  equipped_weapon_id: string;
  equipped_shield_id: string;
  equipped_skin_id: string;
  owned_weapons: string; // JSON
  owned_shields: string; // JSON
  owned_skins: string;   // JSON
  weapon_levels: string; // JSON
  shield_levels: string; // JSON
  upgrades: string;      // JSON
  campaign_progress: string; // JSON
  updated_at: string;
}

export interface LevelProgressRow {
  user_id: number;
  level_id: number;
  completed: number; // 0/1
  perfect: number;   // 0/1
  best_score: number;
  best_core_integrity: number;
  best_accuracy: number;
  first_cleared_at: number;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: number;
  expires_at: number;
  created_at: string;
}

// ─── SQLite repository ───────────────────────────────────────────────────────

export class SQLiteScoreRepository implements ScoreRepository {
  readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    this._migrateScores();
    this._migrateAuth();
  }

  // ─── Scores table ──────────────────────────────────────────────────────────

  private _migrateScores() {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playerName TEXT NOT NULL,
        score INTEGER NOT NULL,
        wave INTEGER NOT NULL,
        coreIntegrity REAL NOT NULL,
        accuracy REAL NOT NULL,
        duration INTEGER NOT NULL,
        createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS scores_rank ON scores(score DESC);`
    );
  }

  save(input: ScoreInput) {
    const result = this.db
      .prepare(
        "INSERT INTO scores (playerName, score, wave, coreIntegrity, accuracy, duration) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        input.playerName.trim(),
        input.score,
        input.wave,
        input.coreIntegrity,
        input.accuracy,
        input.duration,
      );
    return Number(result.lastInsertRowid);
  }

  top(limit: number) {
    return this.db
      .prepare(
        "SELECT id, playerName, score, wave, coreIntegrity, accuracy, duration, createdAt FROM scores ORDER BY score DESC, id ASC LIMIT ?"
      )
      .all(limit) as unknown as ScoreRow[];
  }

  // ─── Auth / account tables ──────────────────────────────────────────────────

  private _migrateAuth() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS users_email ON users(email COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS player_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        version INTEGER NOT NULL DEFAULT 1,
        credits INTEGER NOT NULL DEFAULT 0,
        total_credits_earned INTEGER NOT NULL DEFAULT 0,
        total_enemies_killed INTEGER NOT NULL DEFAULT 0,
        highest_wave INTEGER NOT NULL DEFAULT 1,
        high_score INTEGER NOT NULL DEFAULT 0,
        equipped_weapon_id TEXT NOT NULL DEFAULT 'pulse_cannon',
        equipped_shield_id TEXT NOT NULL DEFAULT 'standard_shield',
        equipped_skin_id TEXT NOT NULL DEFAULT 'classic_cyan',
        owned_weapons TEXT NOT NULL DEFAULT '["pulse_cannon"]',
        owned_shields TEXT NOT NULL DEFAULT '["standard_shield"]',
        owned_skins TEXT NOT NULL DEFAULT '["classic_cyan"]',
        weapon_levels TEXT NOT NULL DEFAULT '{"pulse_cannon":1}',
        shield_levels TEXT NOT NULL DEFAULT '{"standard_shield":1}',
        upgrades TEXT NOT NULL DEFAULT '{"core_armor":0,"targeting_array":0,"lock_processor":0,"energy_cell":0,"energy_recycler":0,"repair_system":0}',
        campaign_progress TEXT NOT NULL DEFAULT '{"highestUnlockedLevel":1,"highestUnlockedStage":1,"completedLevels":{},"seenCinematics":[],"campaignCompleted":false,"totalCampaignTime":0}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS level_progress (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level_id INTEGER NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        perfect INTEGER NOT NULL DEFAULT 0,
        best_score INTEGER NOT NULL DEFAULT 0,
        best_core_integrity REAL NOT NULL DEFAULT 0,
        best_accuracy REAL NOT NULL DEFAULT 0,
        first_cleared_at INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, level_id)
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires ON user_sessions(expires_at);
    `);
  }

  // ─── User CRUD ─────────────────────────────────────────────────────────────

  createUser(name: string, email: string, passwordHash: string): number {
    const result = this.db
      .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name.trim(), email.toLowerCase().trim(), passwordHash);
    const userId = Number(result.lastInsertRowid);
    // Create default profile in the same operation
    this.db
      .prepare("INSERT INTO player_profiles (user_id) VALUES (?)")
      .run(userId);
    return userId;
  }

  findUserByEmail(email: string): UserRow | undefined {
    return this.db
      .prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE email = ? COLLATE NOCASE")
      .get(email.toLowerCase().trim()) as UserRow | undefined;
  }

  findUserById(id: number): Pick<UserRow, "id" | "name" | "email" | "created_at"> | undefined {
    return this.db
      .prepare("SELECT id, name, email, created_at FROM users WHERE id = ?")
      .get(id) as Pick<UserRow, "id" | "name" | "email" | "created_at"> | undefined;
  }

  // ─── Session CRUD ───────────────────────────────────────────────────────────

  createSession(sessionId: string, userId: number, expiresAt: number) {
    this.db
      .prepare("INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .run(sessionId, userId, expiresAt);
  }

  findSession(sessionId: string): SessionRow | undefined {
    return this.db
      .prepare("SELECT id, user_id, expires_at, created_at FROM user_sessions WHERE id = ? AND expires_at > ?")
      .get(sessionId, Date.now()) as SessionRow | undefined;
  }

  deleteSession(sessionId: string) {
    this.db.prepare("DELETE FROM user_sessions WHERE id = ?").run(sessionId);
  }

  deleteUserSessions(userId: number) {
    this.db.prepare("DELETE FROM user_sessions WHERE user_id = ?").run(userId);
  }

  purgeExpiredSessions() {
    this.db.prepare("DELETE FROM user_sessions WHERE expires_at <= ?").run(Date.now());
  }

  // ─── Player profile CRUD ────────────────────────────────────────────────────

  getProfile(userId: number): PlayerProfileRow | undefined {
    return this.db
      .prepare("SELECT * FROM player_profiles WHERE user_id = ?")
      .get(userId) as PlayerProfileRow | undefined;
  }

  saveProfile(userId: number, profile: Omit<PlayerProfileRow, "user_id" | "updated_at">) {
    this.db.prepare(`
      UPDATE player_profiles SET
        version = ?,
        credits = ?,
        total_credits_earned = ?,
        total_enemies_killed = ?,
        highest_wave = ?,
        high_score = ?,
        equipped_weapon_id = ?,
        equipped_shield_id = ?,
        equipped_skin_id = ?,
        owned_weapons = ?,
        owned_shields = ?,
        owned_skins = ?,
        weapon_levels = ?,
        shield_levels = ?,
        upgrades = ?,
        campaign_progress = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      profile.version,
      profile.credits,
      profile.total_credits_earned,
      profile.total_enemies_killed,
      profile.highest_wave,
      profile.high_score,
      profile.equipped_weapon_id,
      profile.equipped_shield_id,
      profile.equipped_skin_id,
      profile.owned_weapons,
      profile.owned_shields,
      profile.owned_skins,
      profile.weapon_levels,
      profile.shield_levels,
      profile.upgrades,
      profile.campaign_progress,
      userId,
    );
  }

  // ─── Level progress CRUD ────────────────────────────────────────────────────

  getLevelProgress(userId: number): LevelProgressRow[] {
    return this.db
      .prepare("SELECT * FROM level_progress WHERE user_id = ?")
      .all(userId) as unknown as LevelProgressRow[];
  }

  upsertLevelProgress(userId: number, row: Omit<LevelProgressRow, "user_id" | "updated_at">) {
    this.db.prepare(`
      INSERT INTO level_progress (user_id, level_id, completed, perfect, best_score, best_core_integrity, best_accuracy, first_cleared_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, level_id) DO UPDATE SET
        completed = MAX(completed, excluded.completed),
        perfect = MAX(perfect, excluded.perfect),
        best_score = MAX(best_score, excluded.best_score),
        best_core_integrity = MAX(best_core_integrity, excluded.best_core_integrity),
        best_accuracy = MAX(best_accuracy, excluded.best_accuracy),
        first_cleared_at = CASE WHEN first_cleared_at = 0 THEN excluded.first_cleared_at ELSE first_cleared_at END,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      userId,
      row.level_id,
      row.completed,
      row.perfect,
      row.best_score,
      row.best_core_integrity,
      row.best_accuracy,
      row.first_cleared_at,
    );
  }

  close() {
    this.db.close();
  }
}
