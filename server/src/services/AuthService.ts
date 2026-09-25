import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { SQLiteScoreRepository } from "../db/database";

export interface AuthResult {
  userId: number;
  name: string;
  email: string;
  sessionId: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class AuthService {
  constructor(private db: SQLiteScoreRepository) {}

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    // Check for existing email
    const existing = this.db.findUserByEmail(email);
    if (existing) {
      throw new Error("EMAIL_TAKEN");
    }

    // Hash password with argon2id (resistant to GPU and side-channel attacks)
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });

    const userId = this.db.createUser(name, email, hash);
    const { sessionId, expiresAt } = this._newSession(userId);

    return { userId, name: name.trim(), email: email.toLowerCase().trim(), sessionId, expiresAt };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = this.db.findUserByEmail(email);
    if (!user) {
      // Perform dummy hash to prevent timing-based user enumeration
      await argon2.hash("dummy_prevent_timing_attack");
      throw new Error("INVALID_CREDENTIALS");
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      throw new Error("INVALID_CREDENTIALS");
    }

    // Invalidate stale sessions, create fresh one
    this.db.purgeExpiredSessions();
    const { sessionId, expiresAt } = this._newSession(user.id);

    return { userId: user.id, name: user.name, email: user.email, sessionId, expiresAt };
  }

  logout(sessionId: string) {
    this.db.deleteSession(sessionId);
  }

  validateSession(sessionId: string): { userId: number } | null {
    const session = this.db.findSession(sessionId);
    if (!session) return null;
    return { userId: session.user_id };
  }

  private _newSession(userId: number) {
    const sessionId = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + SESSION_TTL_MS;
    this.db.createSession(sessionId, userId, expiresAt);
    return { sessionId, expiresAt };
  }
}
