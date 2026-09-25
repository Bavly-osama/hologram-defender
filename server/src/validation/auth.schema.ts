// Auth route validation schemas

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}
export const registerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "email", "password"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 32 },
    email: { type: "string", format: "email", maxLength: 254 },
    password: { type: "string", minLength: 8, maxLength: 128 },
  },
};

export interface LoginInput {
  email: string;
  password: string;
}
export const loginSchema = {
  type: "object",
  additionalProperties: false,
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email", maxLength: 254 },
    password: { type: "string", minLength: 1, maxLength: 128 },
  },
};

export interface ProfileSaveInput {
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
  weaponLevels: Record<string, number>;
  shieldLevels: Record<string, number>;
  upgrades: Record<string, number>;
  highestWave: number;
  highScore: number;
  transactions: unknown[];
  campaignProgress: unknown;
}
export const profileSaveSchema = {
  type: "object",
  additionalProperties: true,
  required: ["credits"],
  properties: {
    version: { type: "integer", minimum: 1 },
    credits: { type: "integer", minimum: 0, maximum: 10000000 },
    totalCreditsEarned: { type: "integer", minimum: 0 },
    totalEnemiesKilled: { type: "integer", minimum: 0 },
    equippedWeaponId: { type: "string", maxLength: 50 },
    equippedShieldId: { type: "string", maxLength: 50 },
    equippedSkinId: { type: "string", maxLength: 50 },
    ownedWeapons: { type: "array", items: { type: "string" } },
    ownedShields: { type: "array", items: { type: "string" } },
    ownedSkins: { type: "array", items: { type: "string" } },
    weaponLevels: { type: "object" },
    shieldLevels: { type: "object" },
    upgrades: { type: "object" },
    highestWave: { type: "integer", minimum: 1 },
    highScore: { type: "integer", minimum: 0 },
    transactions: { type: "array" },
    campaignProgress: { type: "object" },
  },
};

export interface LevelCompleteInput {
  levelId: number;
  score: number;
  coreIntegrity: number;
  accuracy: number;
  duration: number;
  creditsEarned: number;
}
export const levelCompleteSchema = {
  type: "object",
  additionalProperties: false,
  required: ["levelId", "score", "coreIntegrity", "accuracy", "duration", "creditsEarned"],
  properties: {
    levelId: { type: "integer", minimum: 1, maximum: 20 },
    score: { type: "integer", minimum: 0, maximum: 10000000 },
    coreIntegrity: { type: "number", minimum: 0, maximum: 100 },
    accuracy: { type: "number", minimum: 0, maximum: 1 },
    duration: { type: "integer", minimum: 1, maximum: 7200 },
    creditsEarned: { type: "integer", minimum: 0, maximum: 5000 },
  },
};
