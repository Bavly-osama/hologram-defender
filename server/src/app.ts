import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import type { ScoreRepository, SQLiteScoreRepository } from "./db/database";
import { ScoreService } from "./services/ScoreService";
import { AuthService } from "./services/AuthService";
import { PlayerService } from "./services/PlayerService";
import { scoreSchema, type ScoreInput } from "./validation/score.schema";
import {
  registerSchema, loginSchema, profileSaveSchema, levelCompleteSchema,
  type RegisterInput, type LoginInput, type ProfileSaveInput, type LevelCompleteInput,
} from "./validation/auth.schema";

const SESSION_COOKIE = "hd_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export function createApp(repository: ScoreRepository, authDb?: SQLiteScoreRepository) {
  const app = Fastify({
    bodyLimit: 32768,
    trustProxy: process.env.TRUST_PROXY === "true",
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });

  const service = new ScoreService(repository);
  // Auth services are only available when an explicit authDb is provided (not a mock)
  const authService = authDb ? new AuthService(authDb) : null;
  const playerService = authDb ? new PlayerService(authDb) : null;

  // ─── Security headers ────────────────────────────────────────────────────────
  void app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        workerSrc: ["'self'", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  void app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  void app.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? "hologram-defender-cookie-secret-change-in-production",
    parseOptions: {},
  });


  // ─── Routes ──────────────────────────────────────────────────────────────────
  void app.register(async (routes) => {

    // ── Health ────────────────────────────────────────────────────────────────
    routes.get("/api/health", async () => ({ status: "ok" }));

    // ── Scores / leaderboard ──────────────────────────────────────────────────
    routes.post<{ Body: ScoreInput }>(
      "/api/scores",
      {
        schema: { body: scoreSchema },
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        try {
          const id = service.submit(request.body);
          return reply.code(201).send({ id });
        } catch (error) {
          if (error instanceof RangeError)
            return reply.code(400).send({ error: error.message });
          request.log.error(error);
          return reply.code(503).send({
            error: "Leaderboard storage unavailable. Your local result is unaffected.",
          });
        }
      },
    );

    routes.get<{ Querystring: { limit?: string } }>(
      "/api/leaderboard",
      async (request, reply) => {
        const value = request.query.limit ?? "10";
        if (!/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > 50)
          return reply.code(400).send({ error: "Limit must be 1–50" });
        try {
          return { scores: service.leaderboard(Number(value)) };
        } catch (error) {
          request.log.error(error);
          return reply.code(503).send({ error: "Leaderboard unavailable" });
        }
      },
    );

    // ── Shop catalog & validate ───────────────────────────────────────────────
    routes.get("/api/shop/catalog", async () => {
      const { ECONOMY_CONFIG } = await import("../../src/economy/economyConfig");
      return {
        weapons: ECONOMY_CONFIG.weapons,
        shields: ECONOMY_CONFIG.shields,
        upgrades: ECONOMY_CONFIG.upgrades,
        skins: ECONOMY_CONFIG.skins,
      };
    });

    routes.post<{ Body: import("./validation/economy.schema").PurchaseValidateInput }>(
      "/api/shop/validate-purchase",
      {
        schema: { body: (await import("./validation/economy.schema")).purchaseValidateSchema },
        config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        const { ECONOMY_CONFIG, getUpgradeCost } = await import("../../src/economy/economyConfig");
        const { itemType, itemId, currentBalance, currentLevel = 0 } = request.body;
        let cost = 0;
        let exists = false;

        if (itemType === "weapon") {
          const item = ECONOMY_CONFIG.weapons.find((w) => w.id === itemId);
          if (item) { exists = true; cost = item.price; }
        } else if (itemType === "shield") {
          const item = ECONOMY_CONFIG.shields.find((s) => s.id === itemId);
          if (item) { exists = true; cost = item.price; }
        } else if (itemType === "skin") {
          const item = ECONOMY_CONFIG.skins.find((s) => s.id === itemId);
          if (item) { exists = true; cost = item.price; }
        } else if (itemType === "upgrade") {
          const item = ECONOMY_CONFIG.upgrades.find((u) => u.id === itemId);
          if (item) {
            exists = true;
            if (currentLevel >= item.maxLevel)
              return reply.code(400).send({ error: "Upgrade already maxed" });
            cost = getUpgradeCost(item, currentLevel);
          }
        }

        if (!exists)
          return reply.code(404).send({ error: `Unknown ${itemType} ID: ${itemId}` });
        if (currentBalance < cost)
          return reply.code(400).send({ error: "Insufficient credits", required: cost, currentBalance });

        return { valid: true, itemType, itemId, cost, remainingBalance: currentBalance - cost };
      },
    );

    routes.post<{ Body: import("./validation/economy.schema").ProfileSyncInput }>(
      "/api/player/sync-profile",
      {
        schema: { body: (await import("./validation/economy.schema")).profileSyncSchema },
        config: { rateLimit: { max: 15, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        const profile = request.body;
        if (profile.credits < 0 || profile.credits > 10_000_000)
          return reply.code(400).send({ error: "Invalid credits range" });
        return { synced: true, timestamp: Date.now() };
      },
    );

    // ── AUTH: Register ────────────────────────────────────────────────────────
    routes.post<{ Body: RegisterInput }>(
      "/api/auth/register",
      {
        schema: { body: registerSchema },
        config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        if (!authService) return reply.code(503).send({ error: "Auth service unavailable" });
        const { name, email, password } = request.body;
        try {
          const result = await authService.register(name, email, password);
          reply.setCookie(SESSION_COOKIE, result.sessionId, {
            httpOnly: true,
            sameSite: "strict",
            path: "/",
            maxAge: COOKIE_MAX_AGE,
            secure: process.env.NODE_ENV === "production",
          });
          return reply.code(201).send({
            user: { id: result.userId, name: result.name, email: result.email },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "";
          if (msg === "EMAIL_TAKEN")
            return reply.code(409).send({ error: "An account with this email already exists." });
          request.log.error(err);
          return reply.code(500).send({ error: "Registration failed. Please try again." });
        }
      },
    );

    // ── AUTH: Login ───────────────────────────────────────────────────────────
    routes.post<{ Body: LoginInput }>(
      "/api/auth/login",
      {
        schema: { body: loginSchema },
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        if (!authService) return reply.code(503).send({ error: "Auth service unavailable" });
        const { email, password } = request.body;
        try {
          const result = await authService.login(email, password);
          reply.setCookie(SESSION_COOKIE, result.sessionId, {
            httpOnly: true,
            sameSite: "strict",
            path: "/",
            maxAge: COOKIE_MAX_AGE,
            secure: process.env.NODE_ENV === "production",
          });
          return {
            user: { id: result.userId, name: result.name, email: result.email },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "";
          if (msg === "INVALID_CREDENTIALS")
            return reply.code(401).send({ error: "Invalid email or password." });
          request.log.error(err);
          return reply.code(500).send({ error: "Login failed. Please try again." });
        }
      },
    );

    // ── AUTH: Logout ──────────────────────────────────────────────────────────
    routes.post("/api/auth/logout", async (request, reply) => {
      if (!authService) return reply.code(503).send({ error: "Auth service unavailable" });
      const sessionId = request.cookies?.[SESSION_COOKIE];
      if (sessionId) authService.logout(sessionId);
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return { loggedOut: true };
    });

    // ── AUTH: Me ──────────────────────────────────────────────────────────────
    routes.get("/api/auth/me", async (request, reply) => {
      if (!authService) return reply.code(503).send({ error: "Auth service unavailable" });
      const sessionId = request.cookies?.[SESSION_COOKIE];
      if (!sessionId) return reply.code(401).send({ error: "Not authenticated" });

      const session = authService.validateSession(sessionId);
      if (!session) {
        reply.clearCookie(SESSION_COOKIE, { path: "/" });
        return reply.code(401).send({ error: "Session expired" });
      }

      const user = authDb!.findUserById(session.userId);
      if (!user) return reply.code(404).send({ error: "User not found" });

      return { user: { id: user.id, name: user.name, email: user.email } };
    });

    // ── Player: Get full profile ──────────────────────────────────────────────
    routes.get("/api/player/profile", async (request, reply) => {
      if (!authService || !playerService) return reply.code(503).send({ error: "Service unavailable" });
      const sessionId = request.cookies?.[SESSION_COOKIE];
      if (!sessionId) return reply.code(401).send({ error: "Not authenticated" });

      const session = authService.validateSession(sessionId);
      if (!session) return reply.code(401).send({ error: "Session expired" });

      const profile = playerService.getFullProfile(session.userId);
      return { profile };
    });

    // ── Player: Save full profile ─────────────────────────────────────────────
    routes.post<{ Body: ProfileSaveInput }>(
      "/api/player/profile",
      {
        schema: { body: profileSaveSchema },
        config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        if (!authService || !playerService) return reply.code(503).send({ error: "Service unavailable" });
        const sessionId = request.cookies?.[SESSION_COOKIE];
        if (!sessionId) return reply.code(401).send({ error: "Not authenticated" });

        const session = authService.validateSession(sessionId);
        if (!session) return reply.code(401).send({ error: "Session expired" });

        try {
          playerService.saveFullProfile(session.userId, request.body as any);
          return { saved: true, timestamp: Date.now() };
        } catch (err) {
          request.log.error(err);
          return reply.code(500).send({ error: "Failed to save profile" });
        }
      },
    );

    // ── Progress: Level complete ──────────────────────────────────────────────
    routes.post<{ Body: LevelCompleteInput }>(
      "/api/progress/level-complete",
      {
        schema: { body: levelCompleteSchema },
        config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      },
      async (request, reply) => {
        if (!authService || !playerService) return reply.code(503).send({ error: "Service unavailable" });
        const sessionId = request.cookies?.[SESSION_COOKIE];
        if (!sessionId) return reply.code(401).send({ error: "Not authenticated" });

        const session = authService.validateSession(sessionId);
        if (!session) return reply.code(401).send({ error: "Session expired" });

        try {
          const result = playerService.recordLevelComplete(session.userId, request.body.levelId, {
            score: request.body.score,
            coreIntegrity: request.body.coreIntegrity,
            accuracy: request.body.accuracy,
            duration: request.body.duration,
            creditsEarned: request.body.creditsEarned,
          });
          return { ...result };
        } catch (err: unknown) {
          if (err instanceof RangeError)
            return reply.code(400).send({ error: err.message });
          request.log.error(err);
          return reply.code(500).send({ error: "Failed to record level completion" });
        }
      },
    );

    // ── Campaign: Full progress ───────────────────────────────────────────────
    routes.get("/api/campaign/progress", async (request, reply) => {
      if (!authService || !playerService) return reply.code(503).send({ error: "Service unavailable" });
      const sessionId = request.cookies?.[SESSION_COOKIE];
      if (!sessionId) return reply.code(401).send({ error: "Not authenticated" });

      const session = authService.validateSession(sessionId);
      if (!session) return reply.code(401).send({ error: "Session expired" });

      const profile = playerService.getFullProfile(session.userId);
      return { campaignProgress: profile.campaignProgress };
    });
  });

  app.addHook("onClose", async () => repository.close());
  return app;
}
