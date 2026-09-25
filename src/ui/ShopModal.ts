import {
  ECONOMY_CONFIG,
  getWeaponDef,
  getShieldDef,
  getSkinDef,
} from "../economy/economyConfig";
import type { PlayerInventory } from "../economy/PlayerInventory";
import { PlayerStatsCalculator } from "../economy/PlayerStatsCalculator";

export type ShopTab = "weapons" | "shields" | "upgrades" | "skins";

export class ShopModal {
  private activeTab: ShopTab = "weapons";
  private rootModal: HTMLElement | null = null;
  private isProcessing = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly inventory: PlayerInventory,
    private readonly onClose: () => void,
  ) {}

  show(initialTab: ShopTab = "weapons") {
    this.activeTab = initialTab;
    this.render();
  }

  hide() {
    if (this.rootModal) {
      this.rootModal.remove();
      this.rootModal = null;
    }
    this.onClose();
  }

  private render() {
    if (!this.rootModal) {
      this.rootModal = document.createElement("div");
      this.rootModal.className = "shop-backdrop";
      this.container.appendChild(this.rootModal);
    }

    const wallet = this.inventory.wallet.balance;
    const computedStats = PlayerStatsCalculator.compute(this.inventory);
    const activeWeaponDef = getWeaponDef(this.inventory.activeWeapon);
    const activeShieldDef = getShieldDef(this.inventory.activeShield);
    const activeSkinDef = getSkinDef(this.inventory.activeSkin);

    this.rootModal.innerHTML = `
      <div class="shop-modal" role="dialog" aria-modal="true" aria-labelledby="shop-title">
        <header class="shop-header">
          <div class="shop-header-left">
            <span class="eyebrow"><span class="little-line"></span> REQUISITION TERMINAL</span>
            <h2 id="shop-title">ORBITAL ARMORY <span>◈</span></h2>
          </div>
          <div class="shop-header-right">
            <div class="shop-wallet">
              <span class="shop-wallet-label">AVAILABLE CREDITS</span>
              <div class="shop-wallet-amount">
                <span class="currency-symbol">◈</span>
                <span id="shop-credits-val">${wallet.toLocaleString()}</span>
              </div>
            </div>
            <button id="shop-close-btn" class="shop-close-button" aria-label="Close shop">✕</button>
          </div>
        </header>

        <nav class="shop-tabs" role="tablist">
          <button class="shop-tab ${this.activeTab === "weapons" ? "active" : ""}" data-tab="weapons">WEAPONS</button>
          <button class="shop-tab ${this.activeTab === "shields" ? "active" : ""}" data-tab="shields">SHIELDS</button>
          <button class="shop-tab ${this.activeTab === "upgrades" ? "active" : ""}" data-tab="upgrades">UPGRADES</button>
          <button class="shop-tab ${this.activeTab === "skins" ? "active" : ""}" data-tab="skins">SKINS</button>
        </nav>

        <div class="shop-body">
          <div class="shop-items-grid" id="shop-items-grid">
            ${this.renderActiveTabItems()}
          </div>
          
          <aside class="shop-sidebar">
            <div class="sidebar-block stats-overview">
              <h3>ACTIVE COMBAT METRICS</h3>
              <div class="stat-line">
                <span>WEAPON</span>
                <b>${activeWeaponDef.name}</b>
              </div>
              <div class="stat-line">
                <span>DAMAGE / HIT</span>
                <b class="stat-cyan">${computedStats.damagePerShot} DMG</b>
              </div>
              <div class="stat-line">
                <span>FIRE RATE</span>
                <b class="stat-cyan">${computedStats.fireRate.toFixed(1)}/s</b>
              </div>
              <div class="stat-line">
                <span>PROJECTILE SPEED</span>
                <b>${computedStats.projectileSpeed} px/s</b>
              </div>
              <div class="stat-line">
                <span>PENETRATION</span>
                <b>${computedStats.penetration > 1 ? `${computedStats.penetration} TARGETS` : "SINGLE"}</b>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-line">
                <span>SHIELD</span>
                <b>${activeShieldDef.name}</b>
              </div>
              <div class="stat-line">
                <span>DEFENSE RADIUS</span>
                <b class="stat-cyan">${computedStats.shieldRadius} px</b>
              </div>
              <div class="stat-line">
                <span>CORE RESISTANCE</span>
                <b>${(computedStats.damageReduction * 100).toFixed(0)}%</b>
              </div>
              <div class="stat-line">
                <span>ENERGY RECOVERY</span>
                <b>${computedStats.energyRegen.toFixed(0)} EPS</b>
              </div>
              <div class="stat-line">
                <span>BETWEEN WAVE REPAIR</span>
                <b>+${computedStats.repairBetweenWaves} HP</b>
              </div>
            </div>
            
            <div class="sidebar-block holo-preview">
              <h3>HOLOGRAM PREVIEW</h3>
              <div class="holo-preview-box">
                <div class="preview-shield-halo" style="--skin-color: ${activeSkinDef.theme.hexCode}">
                  <div class="preview-reticle">⌖</div>
                  <div class="preview-rings"></div>
                </div>
                <div class="preview-label">
                  SKIN: <b>${activeSkinDef.name}</b>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <footer class="shop-footer">
          <div class="shop-footer-hint">
            All equipment is unlocked using earned in-game credits. Upgrades take effect immediately in combat.
          </div>
          <button id="shop-return-btn" class="primary">RETURN TO MISSION <span>→</span></button>
        </footer>
      </div>
    `;

    this.bindEvents();
  }

  private renderActiveTabItems(): string {
    switch (this.activeTab) {
      case "weapons":
        return this.renderWeapons();
      case "shields":
        return this.renderShields();
      case "upgrades":
        return this.renderUpgrades();
      case "skins":
        return this.renderSkins();
    }
  }

  private renderWeapons(): string {
    const list = ECONOMY_CONFIG.weapons;
    const active = this.inventory.activeWeapon;
    const owned = this.inventory.ownedWeapons;

    return list
      .map((w) => {
        const isEquipped = active === w.id;
        const isOwned = owned.includes(w.id);
        const canAfford = this.inventory.wallet.balance >= w.price;

        let actionButton = "";
        if (isEquipped) {
          actionButton = `<button class="shop-action-btn equipped" disabled>EQUIPPED</button>`;
        } else if (isOwned) {
          actionButton = `<button class="shop-action-btn equip" data-action="equip-weapon" data-id="${w.id}">EQUIP</button>`;
        } else {
          actionButton = `
            <button class="shop-action-btn buy ${canAfford ? "" : "disabled"}" 
                    data-action="buy-weapon" data-id="${w.id}" ${canAfford ? "" : "disabled"}>
              BUY ◈ ${w.price}
            </button>`;
        }

        return `
          <div class="shop-card ${isEquipped ? "equipped-card" : ""}">
            <div class="shop-card-badge">${isEquipped ? "ACTIVE" : isOwned ? "OWNED" : "LOCKED"}</div>
            <div class="shop-card-icon weapon-icon">⚡</div>
            <div class="shop-card-main">
              <h4 class="shop-card-title">${w.name}</h4>
              <p class="shop-card-desc">${w.description}</p>
              <div class="shop-card-stats">
                <div><span>DMG</span><b>${w.baseDamage}</b></div>
                <div><span>RATE</span><b>${w.fireRate}/s</b></div>
                <div><span>SPEED</span><b>${w.projectileSpeed}</b></div>
                <div><span>PIERCE</span><b>${w.penetration}</b></div>
              </div>
            </div>
            <div class="shop-card-footer">
              <div class="shop-card-price">${isOwned ? "UNLOCKED" : `◈ ${w.price}`}</div>
              ${actionButton}
            </div>
          </div>
        `;
      })
      .join("");
  }

  private renderShields(): string {
    const list = ECONOMY_CONFIG.shields;
    const active = this.inventory.activeShield;
    const owned = this.inventory.ownedShields;

    return list
      .map((s) => {
        const isEquipped = active === s.id;
        const isOwned = owned.includes(s.id);
        const canAfford = this.inventory.wallet.balance >= s.price;

        let actionButton = "";
        if (isEquipped) {
          actionButton = `<button class="shop-action-btn equipped" disabled>EQUIPPED</button>`;
        } else if (isOwned) {
          actionButton = `<button class="shop-action-btn equip" data-action="equip-shield" data-id="${s.id}">EQUIP</button>`;
        } else {
          actionButton = `
            <button class="shop-action-btn buy ${canAfford ? "" : "disabled"}" 
                    data-action="buy-shield" data-id="${s.id}" ${canAfford ? "" : "disabled"}>
              BUY ◈ ${s.price}
            </button>`;
        }

        return `
          <div class="shop-card ${isEquipped ? "equipped-card" : ""}">
            <div class="shop-card-badge">${isEquipped ? "ACTIVE" : isOwned ? "OWNED" : "LOCKED"}</div>
            <div class="shop-card-icon shield-icon">⛊</div>
            <div class="shop-card-main">
              <h4 class="shop-card-title">${s.name}</h4>
              <p class="shop-card-desc">${s.description}</p>
              <div class="shop-card-stats">
                <div><span>RADIUS</span><b>×${s.radiusMultiplier}</b></div>
                <div><span>ARMOR</span><b>+${(s.damageReduction * 100).toFixed(0)}%</b></div>
                <div><span>ABSORB</span><b>+${s.reactiveEnergyRefund} EN</b></div>
              </div>
            </div>
            <div class="shop-card-footer">
              <div class="shop-card-price">${isOwned ? "UNLOCKED" : `◈ ${s.price}`}</div>
              ${actionButton}
            </div>
          </div>
        `;
      })
      .join("");
  }

  private renderUpgrades(): string {
    const list = ECONOMY_CONFIG.upgrades;

    return list
      .map((u) => {
        const currentLvl = this.inventory.getUpgradeLevel(u.id);
        const isMaxed = currentLvl >= u.maxLevel;
        const nextCost = this.inventory.getUpgradeCost(u.id);
        const canAfford = !isMaxed && this.inventory.wallet.balance >= nextCost;

        let actionButton = "";
        if (isMaxed) {
          actionButton = `<button class="shop-action-btn equipped" disabled>MAX LEVEL</button>`;
        } else {
          actionButton = `
            <button class="shop-action-btn buy ${canAfford ? "" : "disabled"}" 
                    data-action="upgrade" data-id="${u.id}" ${canAfford ? "" : "disabled"}>
              UPGRADE ◈ ${nextCost}
            </button>`;
        }

        return `
          <div class="shop-card ${isMaxed ? "maxed-card" : ""}">
            <div class="shop-card-badge">LVL ${currentLvl} / ${u.maxLevel}</div>
            <div class="shop-card-icon upgrade-icon">⇪</div>
            <div class="shop-card-main">
              <h4 class="shop-card-title">${u.name}</h4>
              <p class="shop-card-desc">${u.description}</p>
              <div class="upgrade-pip-bar">
                ${Array.from({ length: u.maxLevel })
                  .map((_, i) => `<i class="upgrade-pip ${i < currentLvl ? "filled" : ""}"></i>`)
                  .join("")}
              </div>
            </div>
            <div class="shop-card-footer">
              <div class="shop-card-price">${isMaxed ? "MAXED" : `◈ ${nextCost}`}</div>
              ${actionButton}
            </div>
          </div>
        `;
      })
      .join("");
  }

  private renderSkins(): string {
    const list = ECONOMY_CONFIG.skins;
    const active = this.inventory.activeSkin;
    const owned = this.inventory.ownedSkins;

    return list
      .map((s) => {
        const isEquipped = active === s.id;
        const isOwned = owned.includes(s.id);
        const canAfford = this.inventory.wallet.balance >= s.price;

        let actionButton = "";
        if (isEquipped) {
          actionButton = `<button class="shop-action-btn equipped" disabled>EQUIPPED</button>`;
        } else if (isOwned) {
          actionButton = `<button class="shop-action-btn equip" data-action="equip-skin" data-id="${s.id}">EQUIP</button>`;
        } else {
          actionButton = `
            <button class="shop-action-btn buy ${canAfford ? "" : "disabled"}" 
                    data-action="buy-skin" data-id="${s.id}" ${canAfford ? "" : "disabled"}>
              BUY ◈ ${s.price}
            </button>`;
        }

        return `
          <div class="shop-card ${isEquipped ? "equipped-card" : ""}">
            <div class="shop-card-badge">${isEquipped ? "ACTIVE" : isOwned ? "OWNED" : "LOCKED"}</div>
            <div class="shop-card-icon skin-swatch" style="background: ${s.theme.hexCode}; box-shadow: 0 0 16px ${s.theme.hexCode}88;"></div>
            <div class="shop-card-main">
              <h4 class="shop-card-title">${s.name}</h4>
              <p class="shop-card-desc">${s.description}</p>
              <div class="cosmetic-tag">COSMETIC SHIELD COLOR</div>
            </div>
            <div class="shop-card-footer">
              <div class="shop-card-price">${isOwned ? "UNLOCKED" : `◈ ${s.price}`}</div>
              ${actionButton}
            </div>
          </div>
        `;
      })
      .join("");
  }

  private bindEvents() {
    if (!this.rootModal) return;

    // Close buttons
    this.rootModal.querySelector("#shop-close-btn")?.addEventListener("click", () => this.hide());
    this.rootModal.querySelector("#shop-return-btn")?.addEventListener("click", () => this.hide());

    // Tab buttons
    this.rootModal.querySelectorAll<HTMLElement>(".shop-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab as ShopTab;
        if (tab && tab !== this.activeTab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    // Action buttons in items grid
    this.rootModal.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.isProcessing) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!action || !id) return;

        this.handleAction(action, id);
      });
    });
  }

  private handleAction(action: string, id: string) {
    this.isProcessing = true;

    try {
      switch (action) {
        case "buy-weapon":
          this.inventory.buyWeapon(id);
          break;
        case "equip-weapon":
          this.inventory.equipWeapon(id);
          break;
        case "buy-shield":
          this.inventory.buyShield(id);
          break;
        case "equip-shield":
          this.inventory.equipShield(id);
          break;
        case "upgrade":
          this.inventory.purchaseUpgrade(id);
          break;
        case "buy-skin":
          this.inventory.buySkin(id);
          break;
        case "equip-skin":
          this.inventory.equipSkin(id);
          break;
      }
    } catch (e) {
      console.warn("Shop action failed:", e);
    } finally {
      this.isProcessing = false;
      this.render();
    }
  }
}
