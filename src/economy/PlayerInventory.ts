import { EventBus } from "../core/EventBus";
import {
  getWeaponDef,
  getShieldDef,
  getUpgradeDef,
  getSkinDef,
  getUpgradeCost,
} from "./economyConfig";
import { StorageService, type PlayerProfile } from "./StorageService";
import { WalletSystem } from "./WalletSystem";

export interface PurchaseResult {
  success: boolean;
  message: string;
  itemType?: "weapon" | "shield" | "upgrade" | "skin";
  itemId?: string;
  cost?: number;
  newLevel?: number;
}

export class PlayerInventory {
  readonly profile: PlayerProfile;
  readonly wallet: WalletSystem;
  private purchaseLock = false;

  constructor(profile?: PlayerProfile) {
    this.profile = profile ?? StorageService.load();
    this.wallet = new WalletSystem(
      this.profile.credits,
      this.profile.totalCreditsEarned,
      () => this.syncWalletToProfile(),
    );
  }

  private syncWalletToProfile() {
    this.profile.credits = this.wallet.credits;
    this.profile.totalCreditsEarned = this.wallet.totalEarned;
    this.save();
  }

  save() {
    StorageService.save(this.profile);
    EventBus.get().emit("STATS_CHANGED");
  }

  get campaignProgress() {
    return this.profile.campaignProgress;
  }

  saveCampaignProgress(progress: any) {
    this.profile.campaignProgress = progress;
    this.save();
  }

  get activeWeapon(): string {
    return this.profile.equippedWeaponId;
  }

  get activeShield(): string {
    return this.profile.equippedShieldId;
  }

  get activeSkin(): string {
    return this.profile.equippedSkinId;
  }

  get ownedWeapons(): string[] {
    return this.profile.ownedWeapons;
  }

  get ownedShields(): string[] {
    return this.profile.ownedShields;
  }

  get ownedSkins(): string[] {
    return this.profile.ownedSkins;
  }

  purchaseUpgrade(id: string): PurchaseResult {
    return this.buyUpgrade(id);
  }

  getUpgradeCost(id: string): number {
    const def = getUpgradeDef(id);
    if (!def) return 0;
    return getUpgradeCost(def, this.getUpgradeLevel(id));
  }

  // --- WEAPONS ---
  ownsWeapon(id: string): boolean {
    return this.profile.ownedWeapons.includes(id);
  }

  getWeaponLevel(id: string): number {
    return this.profile.weaponLevels[id] ?? (this.ownsWeapon(id) ? 1 : 0);
  }

  get equippedWeaponId(): string {
    return this.profile.equippedWeaponId;
  }

  buyWeapon(id: string): PurchaseResult {
    if (this.purchaseLock) return { success: false, message: "Transaction in progress" };
    this.purchaseLock = true;
    try {
      const def = getWeaponDef(id);
      if (!def) return { success: false, message: "Unknown weapon" };
      if (this.ownsWeapon(id)) return { success: false, message: "Weapon already owned" };

      if (!this.wallet.canAfford(def.price)) {
        return {
          success: false,
          message: `INSUFFICIENT CREDITS (Need ${(def.price - this.wallet.credits).toLocaleString()} more ◈)`,
        };
      }

      if (!this.wallet.spend(def.price, `BUY_WEAPON_${id}`)) {
        return { success: false, message: "Payment failed" };
      }

      this.profile.ownedWeapons.push(id);
      this.profile.weaponLevels[id] = 1;
      this.profile.transactions.push(
        this.wallet.createTransaction("PURCHASE", def.price, "SHOP", id),
      );

      // Auto-equip first weapon purchase
      this.profile.equippedWeaponId = id;
      this.save();

      EventBus.get().emit("ITEM_PURCHASED", { type: "weapon", id, level: 1 });
      EventBus.get().emit("ITEM_EQUIPPED", { type: "weapon", id });

      return {
        success: true,
        message: `Unlocked ${def.name}`,
        itemType: "weapon",
        itemId: id,
        cost: def.price,
        newLevel: 1,
      };
    } finally {
      this.purchaseLock = false;
    }
  }

  upgradeWeapon(id: string): PurchaseResult {
    if (this.purchaseLock) return { success: false, message: "Transaction in progress" };
    this.purchaseLock = true;
    try {
      const def = getWeaponDef(id);
      if (!def) return { success: false, message: "Unknown weapon" };
      if (!this.ownsWeapon(id)) return { success: false, message: "Weapon not owned" };

      const currentLvl = this.getWeaponLevel(id);
      if (currentLvl >= 5) return { success: false, message: "Maximum level reached" };

      // cost index: level 1 -> 2 is upgradeCosts[0], level 2 -> 3 is [1], etc.
      const cost = def.upgradeCosts[currentLvl - 1];
      if (cost === undefined || !Number.isFinite(cost)) {
        return { success: false, message: "Maximum level reached" };
      }

      if (!this.wallet.canAfford(cost)) {
        return {
          success: false,
          message: `INSUFFICIENT CREDITS (Need ${(cost - this.wallet.credits).toLocaleString()} more ◈)`,
        };
      }

      if (!this.wallet.spend(cost, `UPGRADE_WEAPON_${id}_LV${currentLvl + 1}`)) {
        return { success: false, message: "Payment failed" };
      }

      const nextLvl = currentLvl + 1;
      this.profile.weaponLevels[id] = nextLvl;
      this.profile.transactions.push(
        this.wallet.createTransaction("UPGRADE", cost, "SHOP", `${id}_lv${nextLvl}`),
      );
      this.save();

      EventBus.get().emit("ITEM_PURCHASED", { type: "weapon", id, level: nextLvl });

      return {
        success: true,
        message: `Upgraded ${def.name} to Level ${nextLvl}`,
        itemType: "weapon",
        itemId: id,
        cost,
        newLevel: nextLvl,
      };
    } finally {
      this.purchaseLock = false;
    }
  }

  equipWeapon(id: string): boolean {
    if (!this.ownsWeapon(id)) return false;
    this.profile.equippedWeaponId = id;
    this.save();
    EventBus.get().emit("ITEM_EQUIPPED", { type: "weapon", id });
    return true;
  }

  // --- SHIELDS ---
  ownsShield(id: string): boolean {
    return this.profile.ownedShields.includes(id);
  }

  getShieldLevel(id: string): number {
    return this.profile.shieldLevels[id] ?? (this.ownsShield(id) ? 1 : 0);
  }

  get equippedShieldId(): string {
    return this.profile.equippedShieldId;
  }

  buyShield(id: string): PurchaseResult {
    if (this.purchaseLock) return { success: false, message: "Transaction in progress" };
    this.purchaseLock = true;
    try {
      const def = getShieldDef(id);
      if (!def) return { success: false, message: "Unknown shield" };
      if (this.ownsShield(id)) return { success: false, message: "Shield already owned" };

      if (!this.wallet.canAfford(def.price)) {
        return {
          success: false,
          message: `INSUFFICIENT CREDITS (Need ${(def.price - this.wallet.credits).toLocaleString()} more ◈)`,
        };
      }

      if (!this.wallet.spend(def.price, `BUY_SHIELD_${id}`)) {
        return { success: false, message: "Payment failed" };
      }

      this.profile.ownedShields.push(id);
      this.profile.shieldLevels[id] = 1;
      this.profile.transactions.push(
        this.wallet.createTransaction("PURCHASE", def.price, "SHOP", id),
      );

      this.profile.equippedShieldId = id;
      this.save();

      EventBus.get().emit("ITEM_PURCHASED", { type: "shield", id, level: 1 });
      EventBus.get().emit("ITEM_EQUIPPED", { type: "shield", id });

      return {
        success: true,
        message: `Unlocked ${def.name}`,
        itemType: "shield",
        itemId: id,
        cost: def.price,
        newLevel: 1,
      };
    } finally {
      this.purchaseLock = false;
    }
  }

  upgradeShield(id: string): PurchaseResult {
    if (this.purchaseLock) return { success: false, message: "Transaction in progress" };
    this.purchaseLock = true;
    try {
      const def = getShieldDef(id);
      if (!def) return { success: false, message: "Unknown shield" };
      if (!this.ownsShield(id)) return { success: false, message: "Shield not owned" };

      const currentLvl = this.getShieldLevel(id);
      if (currentLvl >= 5) return { success: false, message: "Maximum level reached" };

      const cost = def.upgradeCosts[currentLvl - 1];
      if (cost === undefined || !Number.isFinite(cost)) {
        return { success: false, message: "Maximum level reached" };
      }

      if (!this.wallet.canAfford(cost)) {
        return {
          success: false,
          message: `INSUFFICIENT CREDITS (Need ${(cost - this.wallet.credits).toLocaleString()} more ◈)`,
        };
      }

      if (!this.wallet.spend(cost, `UPGRADE_SHIELD_${id}_LV${currentLvl + 1}`)) {
        return { success: false, message: "Payment failed" };
      }

      const nextLvl = currentLvl + 1;
      this.profile.shieldLevels[id] = nextLvl;
      this.profile.transactions.push(
        this.wallet.createTransaction("UPGRADE", cost, "SHOP", `${id}_lv${nextLvl}`),
      );
      this.save();

      EventBus.get().emit("ITEM_PURCHASED", { type: "shield", id, level: nextLvl });

      return {
        success: true,
        message: `Upgraded ${def.name} to Level ${nextLvl}`,
        itemType: "shield",
        itemId: id,
        cost,
        newLevel: nextLvl,
      };
    } finally {
      this.purchaseLock = false;
    }
  }

  equipShield(id: string): boolean {
    if (!this.ownsShield(id)) return false;
    this.profile.equippedShieldId = id;
    this.save();
    EventBus.get().emit("ITEM_EQUIPPED", { type: "shield", id });
    return true;
  }

  // --- UPGRADES ---
  getUpgradeLevel(id: string): number {
    return this.profile.upgrades[id] ?? 0;
  }

  buyUpgrade(id: string): PurchaseResult {
    if (this.purchaseLock) return { success: false, message: "Transaction in progress" };
    this.purchaseLock = true;
    try {
      const def = getUpgradeDef(id);
      if (!def) return { success: false, message: "Unknown upgrade" };

      const currentLvl = this.getUpgradeLevel(id);
      if (currentLvl >= def.maxLevel) {
        return { success: false, message: "Maximum level reached" };
      }

      const cost = getUpgradeCost(def, currentLvl);
      if (!this.wallet.canAfford(cost)) {
        return {
          success: false,
          message: `INSUFFICIENT CREDITS (Need ${(cost - this.wallet.credits).toLocaleString()} more ◈)`,
        };
      }

      if (!this.wallet.spend(cost, `BUY_UPGRADE_${id}_LV${currentLvl + 1}`)) {
        return { success: false, message: "Payment failed" };
      }

      const nextLvl = currentLvl + 1;
      this.profile.upgrades[id] = nextLvl;
      this.profile.transactions.push(
        this.wallet.createTransaction("UPGRADE", cost, "SHOP", `${id}_lv${nextLvl}`),
      );
      this.save();

      EventBus.get().emit("UPGRADE_PURCHASED", { id, newLevel: nextLvl });

      return {
        success: true,
        message: `${def.name} upgraded to Level ${nextLvl}`,
        itemType: "upgrade",
        itemId: id,
        cost,
        newLevel: nextLvl,
      };
    } finally {
      this.purchaseLock = false;
    }
  }

  // --- SKINS ---
  ownsSkin(id: string): boolean {
    return this.profile.ownedSkins.includes(id);
  }

  get equippedSkinId(): string {
    return this.profile.equippedSkinId;
  }

  buySkin(id: string): PurchaseResult {
    if (this.purchaseLock) return { success: false, message: "Transaction in progress" };
    this.purchaseLock = true;
    try {
      const def = getSkinDef(id);
      if (!def) return { success: false, message: "Unknown skin" };
      if (this.ownsSkin(id)) return { success: false, message: "Skin already owned" };

      if (!this.wallet.canAfford(def.price)) {
        return {
          success: false,
          message: `INSUFFICIENT CREDITS (Need ${(def.price - this.wallet.credits).toLocaleString()} more ◈)`,
        };
      }

      if (!this.wallet.spend(def.price, `BUY_SKIN_${id}`)) {
        return { success: false, message: "Payment failed" };
      }

      this.profile.ownedSkins.push(id);
      this.profile.equippedSkinId = id;
      this.profile.transactions.push(
        this.wallet.createTransaction("PURCHASE", def.price, "SHOP", id),
      );
      this.save();

      EventBus.get().emit("ITEM_PURCHASED", { type: "skin", id });
      EventBus.get().emit("ITEM_EQUIPPED", { type: "skin", id });

      return {
        success: true,
        message: `Unlocked and equipped ${def.name}`,
        itemType: "skin",
        itemId: id,
        cost: def.price,
      };
    } finally {
      this.purchaseLock = false;
    }
  }

  equipSkin(id: string): boolean {
    if (!this.ownsSkin(id)) return false;
    this.profile.equippedSkinId = id;
    this.save();
    EventBus.get().emit("ITEM_EQUIPPED", { type: "skin", id });
    return true;
  }
}
