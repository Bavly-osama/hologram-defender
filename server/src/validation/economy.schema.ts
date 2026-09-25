export interface PurchaseValidateInput {
  itemType: "weapon" | "shield" | "upgrade" | "skin";
  itemId: string;
  currentBalance: number;
  currentLevel?: number;
}

export const purchaseValidateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["itemType", "itemId", "currentBalance"],
  properties: {
    itemType: { type: "string", enum: ["weapon", "shield", "upgrade", "skin"] },
    itemId: { type: "string", minLength: 1, maxLength: 50 },
    currentBalance: { type: "integer", minimum: 0, maximum: 10000000 },
    currentLevel: { type: "integer", minimum: 0, maximum: 10 },
  },
};

export interface ProfileSyncInput {
  version: number;
  credits: number;
  activeWeapon: string;
  activeShield: string;
  activeSkin: string;
  ownedWeapons: string[];
  ownedShields: string[];
  ownedSkins: string[];
  upgrades: Record<string, number>;
}

export const profileSyncSchema = {
  type: "object",
  additionalProperties: true,
  required: [
    "version",
    "credits",
    "activeWeapon",
    "activeShield",
    "activeSkin",
    "ownedWeapons",
    "ownedShields",
    "ownedSkins",
    "upgrades",
  ],
  properties: {
    version: { type: "integer", minimum: 1, maximum: 100 },
    credits: { type: "integer", minimum: 0, maximum: 10000000 },
    activeWeapon: { type: "string" },
    activeShield: { type: "string" },
    activeSkin: { type: "string" },
    ownedWeapons: { type: "array", items: { type: "string" } },
    ownedShields: { type: "array", items: { type: "string" } },
    ownedSkins: { type: "array", items: { type: "string" } },
    upgrades: { type: "object" },
  },
};
