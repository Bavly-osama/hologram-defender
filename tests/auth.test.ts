import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../server/src/app";
import { SQLiteScoreRepository } from "../server/src/db/database";

const makeApp = () => {
  const db = new SQLiteScoreRepository(":memory:");
  return createApp(db, db);
};

const apps: ReturnType<typeof makeApp>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

// ─── Helper: register + login and return cookie ─────────────────────────────
const registerUser = async (app: ReturnType<typeof makeApp>, suffix = "") => {
  return app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: `Cmdr${suffix}`,
      email: `cmdr${suffix}@sector07.net`,
      password: "password1234",
    },
  });
};

const getCookieHeader = (res: Awaited<ReturnType<ReturnType<typeof makeApp>["inject"]>>) => {
  const raw = res.headers["set-cookie"];
  const cookieStr = Array.isArray(raw) ? raw[0] : raw;
  return cookieStr ? { cookie: cookieStr.split(";")[0] } : {};
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Auth: Registration", () => {
  it("registers a new user and returns user data (no password)", async () => {
    const app = makeApp();
    apps.push(app);
    const res = await registerUser(app);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user).toBeDefined();
    expect(body.user.name).toBe("Cmdr");
    expect(body.user.email).toBe("cmdr@sector07.net");
    expect(body.user.password).toBeUndefined();
    expect(body.user.password_hash).toBeUndefined();
    // Session cookie must be set
    const cookie = res.headers["set-cookie"];
    const cookieStr = Array.isArray(cookie) ? cookie[0] : cookie;
    expect(cookieStr).toContain("hd_session=");
    expect(cookieStr).toContain("HttpOnly");
  });

  it("rejects duplicate email", async () => {
    const app = makeApp();
    apps.push(app);
    await registerUser(app);
    const res2 = await registerUser(app);
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error).toContain("already exists");
  });

  it("rejects short password", async () => {
    const app = makeApp();
    apps.push(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Cmdr", email: "test@x.net", password: "short" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid email format", async () => {
    const app = makeApp();
    apps.push(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Cmdr", email: "not-an-email", password: "password123" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects extra injected fields", async () => {
    const app = makeApp();
    apps.push(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Cmdr", email: "t@x.net", password: "password123", admin: true },
    });
    // Should either succeed without admin flag or fail — not grant admin
    if (res.statusCode === 201) {
      expect(res.json().user.admin).toBeUndefined();
    }
  });
});

describe("Auth: Login", () => {
  it("logs in with correct credentials", async () => {
    const app = makeApp();
    apps.push(app);
    await registerUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "cmdr@sector07.net", password: "password1234" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe("cmdr@sector07.net");
    const cookie = res.headers["set-cookie"];
    const cookieStr = Array.isArray(cookie) ? cookie[0] : cookie;
    expect(cookieStr).toContain("hd_session=");
  });

  it("rejects wrong password", async () => {
    const app = makeApp();
    apps.push(app);
    await registerUser(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "cmdr@sector07.net", password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects unknown email", async () => {
    const app = makeApp();
    apps.push(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ghost@sector07.net", password: "password1234" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("Auth: Session / Me", () => {
  it("returns user for valid session", async () => {
    const app = makeApp();
    apps.push(app);
    const regRes = await registerUser(app);
    const cookieHeader = getCookieHeader(regRes);
    const meRes = await app.inject({ url: "/api/auth/me", headers: cookieHeader });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().user.email).toBe("cmdr@sector07.net");
    expect(meRes.json().user.password_hash).toBeUndefined();
  });

  it("returns 401 without cookie", async () => {
    const app = makeApp();
    apps.push(app);
    const res = await app.inject({ url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("logout clears session", async () => {
    const app = makeApp();
    apps.push(app);
    const regRes = await registerUser(app);
    const cookieHeader = getCookieHeader(regRes);
    await app.inject({ method: "POST", url: "/api/auth/logout", headers: cookieHeader });
    const meRes = await app.inject({ url: "/api/auth/me", headers: cookieHeader });
    expect(meRes.statusCode).toBe(401);
  });
});

describe("Player Profile", () => {
  it("returns default profile for new user", async () => {
    const app = makeApp();
    apps.push(app);
    const regRes = await registerUser(app);
    const cookieHeader = getCookieHeader(regRes);
    const res = await app.inject({ url: "/api/player/profile", headers: cookieHeader });
    expect(res.statusCode).toBe(200);
    const { profile } = res.json();
    expect(profile).toBeDefined();
    expect(profile.credits).toBe(0);
    expect(profile.ownedWeapons).toContain("pulse_cannon");
    expect(profile.password_hash).toBeUndefined();
  });

  it("saves and retrieves profile", async () => {
    const app = makeApp();
    apps.push(app);
    const regRes = await registerUser(app);
    const cookieHeader = getCookieHeader(regRes);

    const saveRes = await app.inject({
      method: "POST",
      url: "/api/player/profile",
      headers: { ...cookieHeader, "Content-Type": "application/json" },
      payload: {
        version: 1,
        credits: 1500,
        totalCreditsEarned: 2000,
        totalEnemiesKilled: 50,
        equippedWeaponId: "rapid_pulse",
        equippedShieldId: "standard_shield",
        equippedSkinId: "classic_cyan",
        ownedWeapons: ["pulse_cannon", "rapid_pulse"],
        ownedShields: ["standard_shield"],
        ownedSkins: ["classic_cyan"],
        weaponLevels: { pulse_cannon: 1, rapid_pulse: 2 },
        shieldLevels: { standard_shield: 1 },
        upgrades: { core_armor: 2 },
        highestWave: 5,
        highScore: 12500,
        transactions: [],
        campaignProgress: {
          highestUnlockedLevel: 3,
          highestUnlockedStage: 1,
          completedLevels: { 1: { completed: true, perfect: false, bestScore: 5000, bestCoreIntegrity: 80, bestAccuracy: 0.7, firstClearedAt: Date.now() } },
          seenCinematics: [],
          campaignCompleted: false,
          totalCampaignTime: 120,
        },
      },
    });
    expect(saveRes.statusCode).toBe(200);
    expect(saveRes.json().saved).toBe(true);

    // Re-fetch and verify
    const getRes = await app.inject({ url: "/api/player/profile", headers: cookieHeader });
    expect(getRes.statusCode).toBe(200);
    const { profile } = getRes.json();
    expect(profile.credits).toBe(1500);
    expect(profile.equippedWeaponId).toBe("rapid_pulse");
    expect(profile.ownedWeapons).toContain("rapid_pulse");
    expect(profile.upgrades.core_armor).toBe(2);
  });

  it("returns 401 without auth for profile endpoints", async () => {
    const app = makeApp();
    apps.push(app);
    expect((await app.inject({ url: "/api/player/profile" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/player/profile", payload: { credits: 0 } })).statusCode).toBe(401);
  });
});

describe("Progress: Level Complete", () => {
  it("records level completion with server-authoritative credits", async () => {
    const app = makeApp();
    apps.push(app);
    const regRes = await registerUser(app);
    const cookieHeader = getCookieHeader(regRes);

    const res = await app.inject({
      method: "POST",
      url: "/api/progress/level-complete",
      headers: { ...cookieHeader, "Content-Type": "application/json" },
      payload: {
        levelId: 1,
        score: 5000,
        coreIntegrity: 97,
        accuracy: 0.85,
        duration: 120,
        creditsEarned: 300,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.creditsGranted).toBe(300);
    expect(body.nextUnlockedLevel).toBe(2);
    expect(body.isPerfect).toBe(true); // coreIntegrity >= 95 && accuracy >= 0.7
  });

  it("detects perfect clear correctly", async () => {
    const app = makeApp();
    apps.push(app);
    const regRes = await registerUser(app);
    const cookieHeader = getCookieHeader(regRes);

    // Non-perfect: low accuracy
    const res = await app.inject({
      method: "POST",
      url: "/api/progress/level-complete",
      headers: { ...cookieHeader, "Content-Type": "application/json" },
      payload: { levelId: 2, score: 3000, coreIntegrity: 99, accuracy: 0.5, duration: 60, creditsEarned: 200 },
    });
    expect(res.json().isPerfect).toBe(false);
  });

  it("caps or rejects excessive creditsEarned", async () => {
    const app = makeApp();
    apps.push(app);
    const regRes = await registerUser(app);
    const cookieHeader = getCookieHeader(regRes);

    const res = await app.inject({
      method: "POST",
      url: "/api/progress/level-complete",
      headers: { ...cookieHeader, "Content-Type": "application/json" },
      payload: { levelId: 1, score: 100, coreIntegrity: 80, accuracy: 0.5, duration: 30, creditsEarned: 99999 },
    });
    // Server should either reject with 400 (schema) or cap to <= 5000
    if (res.statusCode === 200) {
      expect(res.json().creditsGranted).toBeLessThanOrEqual(5000);
    } else {
      expect(res.statusCode).toBe(400);
    }
  });

  it("rejects invalid level ID", async () => {
    const app = makeApp();
    apps.push(app);
    const regRes = await registerUser(app);
    const cookieHeader = getCookieHeader(regRes);
    const res = await app.inject({
      method: "POST",
      url: "/api/progress/level-complete",
      headers: { ...cookieHeader, "Content-Type": "application/json" },
      payload: { levelId: 99, score: 0, coreIntegrity: 0, accuracy: 0, duration: 1, creditsEarned: 0 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("Multi-user isolation", () => {
  it("two users have independent profiles", async () => {
    const app = makeApp();
    apps.push(app);
    const res1 = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: { name: "Player1", email: "p1@test.net", password: "password1234" },
    });
    const res2 = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: { name: "Player2", email: "p2@test.net", password: "password5678" },
    });
    const h1 = getCookieHeader(res1);
    const h2 = getCookieHeader(res2);

    // Give Player1 credits via level complete
    await app.inject({
      method: "POST", url: "/api/progress/level-complete",
      headers: { ...h1, "Content-Type": "application/json" },
      payload: { levelId: 1, score: 5000, coreIntegrity: 100, accuracy: 0.9, duration: 60, creditsEarned: 1000 },
    });

    // Player2 should not see Player1's credits
    const prof2 = await app.inject({ url: "/api/player/profile", headers: h2 });
    expect(prof2.json().profile.credits).toBe(0);

    // Player1 should have 1000
    const prof1 = await app.inject({ url: "/api/player/profile", headers: h1 });
    expect(prof1.json().profile.credits).toBe(1000);
  });
});
