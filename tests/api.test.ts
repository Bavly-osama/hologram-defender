import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../server/src/app";
import { SQLiteScoreRepository } from "../server/src/db/database";
const apps: ReturnType<typeof createApp>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
describe("leaderboard boundary", () => {
  it("persists valid scores and returns only bounded public fields", async () => {
    const app = createApp(new SQLiteScoreRepository(":memory:"));
    apps.push(app);
    const result = await app.inject({
      method: "POST",
      url: "/api/scores",
      payload: {
        playerName: "Pilot",
        score: 1800,
        wave: 2,
        coreIntegrity: 80,
        accuracy: 0.8,
        duration: 50,
      },
    });
    expect(result.statusCode).toBe(201);
    const board = await app.inject({ url: "/api/leaderboard?limit=5" });
    expect(board.statusCode).toBe(200);
    expect(board.json().scores[0].playerName).toBe("Pilot");
  });
  it("rejects impossible scores, unsafe names, and injected fields", async () => {
    const app = createApp(new SQLiteScoreRepository(":memory:"));
    apps.push(app);
    for (const patch of [
      { score: -1 },
      { accuracy: 4 },
      { playerName: "<script>" },
      { admin: true },
      { score: 500000, duration: 1 },
    ]) {
      const result = await app.inject({
        method: "POST",
        url: "/api/scores",
        payload: {
          playerName: "Pilot",
          score: 100,
          wave: 1,
          coreIntegrity: 90,
          accuracy: 0.5,
          duration: 20,
          ...patch,
        },
      });
      expect(result.statusCode).toBe(400);
    }
  });
  it("bounds queries and rate limits repeated submissions", async () => {
    const app = createApp(new SQLiteScoreRepository(":memory:"));
    apps.push(app);
    expect(
      (await app.inject({ url: "/api/leaderboard?limit=1000" })).statusCode,
    ).toBe(400);
    for (let i = 0; i < 10; i++)
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/scores",
            payload: {
              playerName: "Pilot",
              score: 100,
              wave: 1,
              coreIntegrity: 80,
              accuracy: 0.8,
              duration: 50,
            },
          })
        ).statusCode,
      ).toBe(201);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/scores",
          payload: {
            playerName: "Pilot",
            score: 100,
            wave: 1,
            coreIntegrity: 80,
            accuracy: 0.8,
            duration: 50,
          },
        })
      ).statusCode,
    ).toBe(429);
  });
  it("returns an actionable service error when storage is unavailable", async () => {
    const app = createApp({
      save() {
        throw new Error("Unavailable");
      },
      top() {
        throw new Error("Unavailable");
      },
      close() {},
    });
    apps.push(app);
    expect((await app.inject({ url: "/api/leaderboard" })).statusCode).toBe(
      503,
    );
  });

  it("serves shop catalog and validates purchases against economy rules", async () => {
    const app = createApp(new SQLiteScoreRepository(":memory:"));
    apps.push(app);

    // 1. Catalog endpoint
    const catalogRes = await app.inject({ url: "/api/shop/catalog" });
    expect(catalogRes.statusCode).toBe(200);
    const catalog = catalogRes.json();
    expect(catalog.weapons).toBeDefined();
    expect(catalog.weapons.length).toBeGreaterThan(0);
    expect(catalog.shields.length).toBeGreaterThan(0);

    // 2. Validate valid purchase
    const validPurchase = await app.inject({
      method: "POST",
      url: "/api/shop/validate-purchase",
      payload: {
        itemType: "weapon",
        itemId: "rapid_pulse",
        currentBalance: 500,
      },
    });
    expect(validPurchase.statusCode).toBe(200);
    expect(validPurchase.json().valid).toBe(true);
    expect(validPurchase.json().remainingBalance).toBeLessThan(500);

    // 3. Reject purchase with insufficient credits
    const poorPurchase = await app.inject({
      method: "POST",
      url: "/api/shop/validate-purchase",
      payload: {
        itemType: "weapon",
        itemId: "rapid_pulse",
        currentBalance: 10,
      },
    });
    expect(poorPurchase.statusCode).toBe(400);

    // 4. Reject unknown item
    const unknownItem = await app.inject({
      method: "POST",
      url: "/api/shop/validate-purchase",
      payload: {
        itemType: "weapon",
        itemId: "plasma_death_star_9000",
        currentBalance: 50000,
      },
    });
    expect(unknownItem.statusCode).toBe(404);

    // 5. Profile sync
    const syncRes = await app.inject({
      method: "POST",
      url: "/api/player/sync-profile",
      payload: {
        version: 1,
        credits: 1250,
        activeWeapon: "rapid_pulse",
        activeShield: "standard_shield",
        activeSkin: "classic_cyan",
        ownedWeapons: ["pulse_cannon", "rapid_pulse"],
        ownedShields: ["standard_shield"],
        ownedSkins: ["classic_cyan"],
        upgrades: { core_armor: 1 },
      },
    });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().synced).toBe(true);
  });
});
