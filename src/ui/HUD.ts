import {
  settings,
  saveSettings,
  readLocal,
  writeLocal,
} from "../core/Settings";
import type { GameState } from "../core/GameStateManager";
import type { CombatSimulation } from "../gameplay/CombatSimulation";
import { isBossKind } from "../gameplay/gameBalance";
import type { CampaignManager } from "../campaign/CampaignManager";
import type { LevelConfig } from "../campaign/LevelConfig";
import type { StageConfig } from "../campaign/StageConfig";
import type { LevelCompletionSummary } from "../campaign/LevelManager";
import { STAGES } from "../campaign/StageConfig";
import { getLevelConfig } from "../campaign/LevelConfig";

export interface RunResult {
  score: number;
  wave: number;
  coreIntegrity: number;
  accuracy: number;
  duration: number;
  bestCombo: number;
  victory: boolean;
  creditsEarned?: number;
  bonusCredits?: number;
  totalCredits?: number;
}

export class HUD {
  readonly arena: HTMLElement;
  private overlay: HTMLElement;
  private notice: HTMLElement;
  private noticeTimer = 0;
  onStart: (mode: "mouse" | "hand") => void = () => {};
  onResume = () => {};
  onPause = () => {};
  onReplay = () => {};
  onMode = () => {};
  onSound = () => {};
  onQuality = () => {};
  onTutorial = () => {};
  onShop = () => {};
  onCampaignMap = () => {};
  onSelectLevel: (levelId: number) => void = () => {};
  private lastResult?: RunResult;
  constructor(readonly root: HTMLElement) {
    root.innerHTML = `<div id="arena"></div>
      <header class="masthead"><a class="brand" href="/" aria-label="Hologram Defender home"><svg viewBox="0 0 36 40" aria-hidden="true"><path d="M18 2 34 11v18L18 38 2 29V11Z"/><path d="m10 12 8 16 8-16M10 20h16"/></svg><span>HOLOGRAM<span class="brand-light">DEFENDER</span></span></a><div class="station">ORBITAL DEFENSE NETWORK<span>SECTOR 07 / EARTH ORBIT</span></div><div class="wallet-pill" id="hud-wallet"><span class="currency-symbol">◈</span> <b id="wallet-credits">0</b></div><div class="system"><i></i><span id="system-status">SYSTEM STANDBY</span></div><button id="armory-btn" class="armory-button" aria-label="Open Armory">ARMORY ◈</button><button id="pause" class="icon-button" aria-label="Pause game" hidden>Ⅱ</button></header>
      <div id="hud" hidden><div class="meter"><span>CORE INTEGRITY <b id="health-number">100%</b></span><div class="track"><i id="health-fill"></i></div></div><div class="hud-center"><span id="wave-label">WAVE 01 / 05</span><b id="score">000000</b><div class="hud-sub"><span id="combo">DEFEND THE CORE</span><span id="lock-status" class="lock-tag">SEARCHING</span></div></div><div class="meter energy"><span>PULSE ENERGY <b id="energy-number">100%</b></span><div class="track"><i id="energy-fill"></i></div></div></div>
      <div id="boss-hud" hidden><span>SENTINEL <b id="boss-phase">PHASE 01</b></span><div class="track"><i id="boss-fill"></i></div><small id="boss-hint">Aim for the central eye · block incoming fire</small></div>
      <section id="overlay"></section><section id="tutorial" hidden aria-live="polite"><span id="tutorial-step">CONTROL SYNC / 01</span><h2 id="tutorial-title"></h2><p id="tutorial-description"></p></section>
      <div id="banner" hidden aria-live="polite"><span id="banner-label"></span><h2 id="banner-title"></h2><p id="banner-detail"></p></div>
      <div id="notice" role="status" hidden></div>
      <footer class="statusbar"><div class="control-status"><i id="control-dot"></i><span id="camera-status">MOUSE CONTROL READY</span></div><div class="footer-actions"><button id="control-mode">HAND MODE</button><button id="sound" aria-label="Toggle sound">SOUND ON</button><button id="quality" aria-label="Change quality">QUALITY AUTO</button><button id="fullscreen" aria-label="Toggle fullscreen">⛶</button></div><span class="version">HD / V.1.0</span></footer>
      <div id="rotate">Rotate your device for the best defense experience.</div><pre id="debug" hidden></pre>`;
    this.arena = root.querySelector("#arena")!;
    this.overlay = root.querySelector("#overlay")!;
    this.notice = root.querySelector("#notice")!;
    this.el("pause").onclick = () => this.onPause();
    this.el("armory-btn").onclick = () => this.onShop();
    this.el("control-mode").onclick = () => this.onMode();
    this.el("sound").onclick = () => {
      settings.sound = !settings.sound;
      saveSettings();
      this.updateSettings();
      this.onSound();
    };
    this.el("quality").onclick = () => {
      settings.quality =
        settings.quality === "auto"
          ? "low"
          : settings.quality === "low"
            ? "high"
            : "auto";
      saveSettings();
      this.updateSettings();
      this.onQuality();
    };
    this.el("fullscreen").onclick = () => {
      if (document.fullscreenElement)
        void document
          .exitFullscreen()
          .catch(() => this.toast("Fullscreen unavailable"));
      else
        void root
          .requestFullscreen?.()
          .catch(() => this.toast("Fullscreen unavailable"));
    };
    this.updateSettings();
  }
  el(id: string) {
    return this.root.querySelector<HTMLElement>(`#${id}`)!;
  }
  private set(id: string, text: string) {
    this.el(id).textContent = text;
  }
  updateCredits(credits: number) {
    const el = this.root.querySelector("#wallet-credits");
    if (el) el.textContent = credits.toLocaleString();
  }
  updateSettings() {
    this.set("sound", `SOUND ${settings.sound ? "ON" : "OFF"}`);
    this.set("quality", `QUALITY ${settings.quality.toUpperCase()}`);
    this.set(
      "control-mode",
      settings.mode === "hand" ? "MOUSE MODE" : "HAND MODE",
    );
  }
  loading(progress: number) {
    this.overlay.innerHTML = `<div class="loading"><span>ESTABLISHING UPLINK</span><h2>Preparing defense systems</h2><div class="track"><i style="width:${Math.round(progress * 100)}%"></i></div><small>${Math.round(progress * 100)}% / ASSET SYNC</small></div>`;
  }
  setLocation(stageName: string, levelName: string) {
    const el = this.root.querySelector("#hud-location");
    if (el) el.textContent = `${stageName.toUpperCase()} / ${levelName.toUpperCase()}`;
  }

  home(campaign?: CampaignManager) {
    const nextLvl = campaign ? campaign.unlockService.getNextPlayableLevel() : 1;
    const isCompleted = campaign ? campaign.progress.isCampaignComplete() : false;

    this.overlay.innerHTML = `<div class="home-copy"><div class="eyebrow"><span class="little-line"></span> 20-LEVEL CINEMATIC CAMPAIGN</div><h1>YOUR HAND.<br>OUR <span>FUTURE.</span></h1><p>The defense grid has fallen across Earth, Mars, Neptune, and The Fracture.<br>Take control of the Quantum Core across 20 escalating combat sectors.</p><div class="launch-actions"><button class="primary" id="start-campaign">${isCompleted ? "REPLAY CAMPAIGN" : `CONTINUE CAMPAIGN (LVL ${nextLvl})`} <span>↗</span></button><button class="secondary" id="open-map">SECTOR STAR MAP ⌖</button></div><div class="control-toggle-row"><button class="text-button" id="start-hand">${settings.mode === "hand" ? "Tracking: Hand Active" : "Enable Hand Control ↗"}</button><button class="text-button" id="start-mouse">${settings.mode === "mouse" ? "Control: Mouse Active" : "Play with Mouse →"}</button></div><div class="privacy"><svg viewBox="0 0 16 18"><path d="m8 1 6 3v5c0 4-6 8-6 8S2 13 2 9V4Z"/></svg> Local camera tracking only. Zero external data transmission.</div></div>
      <div class="core-caption"><span class="live-dot"></span>QUANTUM CORE<span>INTEGRITY 100%</span></div>
      <div class="briefing-strip"><div class="briefing-heading"><span>CAMPAIGN BRIEFING</span><strong>4 Stages.<br>20 Sectors.</strong></div><div class="control-card"><span class="control-symbol">⌖</span><div><b>MOVE TO DEFEND</b><p>Shield intercepts projectiles.</p></div></div><div class="control-card"><span class="control-symbol pinch-symbol">⚡</span><div><b>AUTO-TARGET & FIRE</b><p>Lock on enemies to neutralize.</p></div></div><button id="armory-home" class="records">ARMORY ◈</button><button id="leaderboard-home" class="records">FLIGHT RECORDS <span>↗</span></button></div>`;

    this.el("start-campaign").onclick = () => {
      if (this.onSelectLevel) this.onSelectLevel(nextLvl);
    };
    this.el("open-map").onclick = () => {
      if (this.onCampaignMap) this.onCampaignMap();
    };
    this.el("start-hand").onclick = () => this.onStart("hand");
    this.el("start-mouse").onclick = () => this.onStart("mouse");
    this.el("armory-home").onclick = () => this.onShop();
    this.el("leaderboard-home").onclick = () =>
      void this.leaderboard(() => this.home(campaign));
  }

  camera(message: string, busy: boolean) {
    this.overlay.innerHTML = `<div class="modal camera-modal"><span class="eyebrow">SPATIAL CONTROL / ONE HAND</span><div class="camera-glyph">⌖</div><h2>${busy ? "Establishing hand control" : "Your hand is the controller"}</h2><p id="permission-message"></p><p class="muted">Keep one hand in view, with light on your fingers.<br>Move to aim and shield. The Quantum Core auto-fires on locked targets.</p><button class="secondary" id="fallback">Use mouse instead →</button></div>`;
    this.set("permission-message", message);
    this.el("fallback").onclick = () => this.onStart("mouse");
  }

  state(state: GameState) {
    this.root.dataset.state = state;
    this.el("hud").hidden = [
      "BOOT",
      "LOADING",
      "CAMERA_PERMISSION",
      "CAMERA_READY",
      "MAIN_MENU",
      "CAMPAIGN_MAP",
      "STAGE_INTRO",
      "LEVEL_INTRO",
      "LEVEL_COMPLETE",
      "LEVEL_FAILED",
      "STAGE_COMPLETE",
      "TRAVEL_CINEMATIC",
      "NEXT_STAGE_INTRO",
      "CAMPAIGN_COMPLETE",
    ].includes(state);
    this.el("pause").hidden = ![
      "PLAYING",
      "BOSS",
      "TUTORIAL",
    ].includes(state);
    this.el("tutorial").hidden = state !== "TUTORIAL";
    this.el("banner").hidden = ![
      "COUNTDOWN",
      "WAVE_COMPLETE",
      "BOSS_WARNING",
      "GAME_OVER",
      "VICTORY",
      "STAGE_COMPLETE",
      "NEXT_STAGE_INTRO",
    ].includes(state);
    this.el("boss-hud").hidden = state !== "BOSS";
    this.set(
      "system-status",
      state === "PAUSED"
        ? "SYSTEM PAUSED"
        : state === "PLAYING" || state === "BOSS"
          ? "DEFENSE ACTIVE"
          : "SYSTEM STANDBY",
    );
    if (
      ![
        "BOOT",
        "LOADING",
        "CAMERA_PERMISSION",
        "CAMERA_READY",
        "MAIN_MENU",
        "PAUSED",
        "RESULTS",
        "CAMPAIGN_MAP",
        "LEVEL_INTRO",
        "LEVEL_COMPLETE",
        "LEVEL_FAILED",
        "CAMPAIGN_COMPLETE",
      ].includes(state)
    )
      this.overlay.innerHTML = "";
    if (state === "PAUSED") this.paused();
  }

  campaignMap(
    campaign: CampaignManager,
    onSelectLevel: (lvl: number) => void,
    onBack: () => void,
  ) {
    let selectedStageIndex = campaign.stageManager.currentStage.stageIndex;

    const render = () => {
      const stage = STAGES[selectedStageIndex];
      const stageLevels = stage.levelIds;
      const totalCompleted = campaign.progress.completedLevelCount;
      const totalPerfect = campaign.progress.perfectLevelCount;

      let tabsHtml = "";
      for (let i = 0; i < STAGES.length; i++) {
        const s = STAGES[i];
        const isUnlocked = campaign.unlockService.canAccessStage((i + 1) as 1 | 2 | 3 | 4);
        const isActive = i === selectedStageIndex;
        tabsHtml += `
          <button class="stage-tab-btn ${isActive ? "active" : ""} ${isUnlocked ? "" : "locked"}" data-stage="${i}">
            <span class="tab-stage-num">STAGE 0${i + 1}</span>
            <span class="tab-stage-name">${s.name}</span>
            ${isUnlocked ? "" : `<span class="tab-lock">🔒</span>`}
          </button>
        `;
      }

      let levelsHtml = "";
      for (const levelId of stageLevels) {
        const config = getLevelConfig(levelId);
        const canPlay = campaign.unlockService.canPlayLevel(levelId);
        const isDone = campaign.progress.isLevelCompleted(levelId);
        const isPerf = campaign.progress.isLevelPerfect(levelId);
        const best = campaign.progress.getLevelResult(levelId);
        const isCurrent = levelId === campaign.currentLevelId;

        const statusClass = !canPlay.allowed
          ? "node-locked"
          : isPerf
            ? "node-perfect"
            : isDone
              ? "node-completed"
              : isCurrent
                ? "node-active"
                : "node-available";

        const starsCount = Math.min(5, Math.max(1, Math.ceil(config.difficulty * 2)));

        levelsHtml += `
          <div class="level-card ${statusClass} ${config.isBossLevel ? "node-boss" : ""}" data-level="${levelId}">
            <div class="level-card-top">
              <span class="level-num">LEVEL 0${levelId}</span>
              ${config.isBossLevel ? `<span class="badge-boss">◈ BOSS</span>` : ""}
              ${isPerf ? `<span class="badge-perfect">★ PERFECT</span>` : isDone ? `<span class="badge-done">✓ CLEARED</span>` : ""}
            </div>
            <h3 class="level-card-name">${config.name}</h3>
            <div class="level-card-meta">
              <span>THREAT: <b style="color:#ff9070;">${"★".repeat(starsCount)}</b></span>
              <span>REWARD: <b style="color:#ffd855;">+${config.rewards.credits} ◈</b></span>
            </div>
            ${best ? `<div class="level-card-best">BEST: ${best.bestScore.toLocaleString()} · ${Math.round(best.bestAccuracy * 100)}% ACC</div>` : ""}
            ${!canPlay.allowed ? `<div class="level-card-locked-hint">🔒 ${canPlay.reason ?? "Locked"}</div>` : ""}
            ${canPlay.allowed ? `<button class="card-play-btn">${isDone ? "REPLAY" : "ENGAGE"} <span>→</span></button>` : ""}
          </div>
        `;
      }

      this.overlay.innerHTML = `
        <div class="modal campaign-map-modal">
          <div class="campaign-header">
            <div>
              <span class="eyebrow">DEFENSE GRID NAVIGATION SYSTEM</span>
              <h2>SOLAR CAMPAIGN STAR MAP</h2>
            </div>
            <div class="campaign-summary-pill">
              <span>SECTORS: <b>${totalCompleted}/20</b></span>
              <span>PERFECT: <b style="color:#ffd855;">★ ${totalPerfect}</b></span>
            </div>
          </div>

          <div class="stage-tabs-row">${tabsHtml}</div>

          <div class="stage-banner-card" style="border-left: 3px solid ${stage.palette.hudAccent};">
            <div>
              <span class="stage-location-tag">${stage.location.toUpperCase()} · ${stage.ambientFx.replace(/_/g, " ").toUpperCase()}</span>
              <h3>${stage.name}</h3>
              <p>${stage.subtitle} — ${stage.travelDescription}</p>
            </div>
            <div class="stage-boss-badge">
              <span>SECTOR GUARDIAN</span>
              <b>${stage.bossName}</b>
            </div>
          </div>

          <div class="levels-grid">${levelsHtml}</div>

          <div class="campaign-footer">
            <button class="secondary" id="map-back">← MAIN MENU</button>
            <button class="armory-button" id="map-armory">ARMORY ◈</button>
          </div>
        </div>
      `;

      // Event handlers
      this.overlay.querySelectorAll<HTMLButtonElement>(".stage-tab-btn").forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.stage);
          if (campaign.unlockService.canAccessStage((idx + 1) as 1 | 2 | 3 | 4)) {
            selectedStageIndex = idx;
            render();
          } else {
            this.toast(`Stage ${idx + 1} locked. Clear previous sectors first.`);
          }
        };
      });

      this.overlay.querySelectorAll<HTMLElement>(".level-card").forEach((card) => {
        const lvl = Number(card.dataset.level);
        if (campaign.unlockService.canPlayLevel(lvl).allowed) {
          card.onclick = () => onSelectLevel(lvl);
        }
      });

      this.el("map-back").onclick = onBack;
      this.el("map-armory").onclick = () => this.onShop();
    };

    render();
  }

  levelBriefing(
    levelConfig: LevelConfig,
    stageConfig: StageConfig,
    onEngage: () => void,
    onBack: () => void,
  ) {
    const scanner = levelConfig.introScannerEnemy;
    const scannerHtml = scanner
      ? `
      <div class="scanner-card">
        <div class="scanner-header">
          <span class="scanner-title">TACTICAL SCANNER · THREAT ANALYSIS</span>
          <span class="scanner-tag">${scanner.threatRating} THREAT</span>
        </div>
        <div class="scanner-body">
          <div class="scanner-holo-box">
            <span class="scanner-holo-symbol">${levelConfig.isBossLevel ? "◈" : "⌖"}</span>
            <small>${scanner.classTag}</small>
          </div>
          <div class="scanner-intel">
            <h4>${scanner.name}</h4>
            <p>${scanner.ability}</p>
          </div>
        </div>
      </div>
    `
      : "";

    const modifiersHtml =
      levelConfig.modifier !== "NONE"
        ? `<div class="briefing-modifiers">
            <span>SECTOR CONDITIONS:</span>
            <b class="mod-pill">${levelConfig.modifier.replace(/_/g, " ")}</b>
          </div>`
        : "";

    this.overlay.innerHTML = `
      <div class="modal briefing-modal">
        <div class="briefing-top">
          <span class="eyebrow">${stageConfig.name.toUpperCase()} · ${stageConfig.location.toUpperCase()}</span>
          <h2>LEVEL 0${levelConfig.id}: ${levelConfig.name.toUpperCase()}</h2>
        </div>

        <p class="briefing-desc">${levelConfig.briefing}</p>
        ${modifiersHtml}
        ${scannerHtml}

        <div class="briefing-rewards-bar">
          <div><span>SECTOR REWARD: </span><b style="color:#ffd855;">+${levelConfig.rewards.credits} ◈</b></div>
          <div><span>FIRST CLEAR BONUS: </span><b style="color:#ffd855;">+${levelConfig.rewards.firstClearBonus} ◈</b></div>
          <div><span>PERFECT DEFENSE: </span><b style="color:#ffd855;">+150 ◈</b></div>
        </div>

        <div class="briefing-actions">
          <button class="primary" id="briefing-engage">ENGAGE SECTOR <span>↗</span></button>
          <button class="secondary" id="briefing-back">← SECTOR MAP</button>
        </div>
      </div>
    `;

    this.el("briefing-engage").onclick = onEngage;
    this.el("briefing-back").onclick = onBack;
  }

  levelComplete(
    summary: LevelCompletionSummary,
    nextLevelId: number | null,
    onNextLevel: () => void,
    onMap: () => void,
    onShop: () => void,
  ) {
    const totalPayout = summary.creditsEarned + summary.firstClearBonus + summary.perfectBonus;

    this.overlay.innerHTML = `
      <div class="modal level-complete-modal">
        <span class="eyebrow">SECTOR PACIFIED · DEFENSE SECURED</span>
        <h2>LEVEL 0${summary.levelId} CLEARED</h2>

        ${
          summary.isPerfect
            ? `<div class="perfect-defense-badge">
                <span class="badge-star">★</span>
                <div>
                  <strong>PERFECT DEFENSE ACHIEVED</strong>
                  <p>Core Integrity ≥ 95% & Accuracy ≥ 70%</p>
                </div>
              </div>`
            : ""
        }

        <div class="result-score">${summary.score.toLocaleString()}<span>SECTOR SCORE</span></div>

        <div class="result-grid">
          <div><b>×${summary.bestCombo}</b><span>BEST COMBO</span></div>
          <div><b>${Math.round(summary.accuracy * 100)}%</b><span>ACCURACY</span></div>
          <div><b>${Math.ceil(summary.coreIntegrity)}%</b><span>CORE INTEGRITY</span></div>
          <div><b>${summary.duration}s</b><span>DURATION</span></div>
        </div>

        <div class="result-economy">
          <div><span>CLEAR REWARD: </span><b style="color:#ffd855;">+${summary.creditsEarned} ◈</b></div>
          ${summary.firstClearBonus > 0 ? `<div><span>FIRST CLEAR: </span><b style="color:#ffd855;">+${summary.firstClearBonus} ◈</b></div>` : ""}
          ${summary.perfectBonus > 0 ? `<div><span>PERFECT DEFENSE: </span><b style="color:#ffd855;">+${summary.perfectBonus} ◈</b></div>` : ""}
          <div><span>TOTAL EARNED: </span><b style="color:#42f5e9;">+${totalPayout} ◈</b></div>
        </div>

        <div class="result-actions">
          ${nextLevelId ? `<button id="level-next" class="primary">NEXT LEVEL (0${nextLevelId}) <span>→</span></button>` : ""}
          <button id="level-map" class="secondary">SECTOR MAP ⌖</button>
          <button id="level-armory" class="secondary">ARMORY ◈</button>
        </div>
      </div>
    `;

    if (nextLevelId) {
      this.el("level-next").onclick = onNextLevel;
    }
    this.el("level-map").onclick = onMap;
    this.el("level-armory").onclick = onShop;
  }

  levelFailed(
    levelConfig: LevelConfig,
    onRetry: () => void,
    onMap: () => void,
    onShop: () => void,
  ) {
    this.overlay.innerHTML = `
      <div class="modal level-failed-modal">
        <span class="eyebrow" style="color:#ff4b4b;">CORE INTEGRITY LOST</span>
        <h2>MISSION FAILED</h2>
        <p>The Quantum Core was overwhelmed in Level 0${levelConfig.id}: ${levelConfig.name}.<br>Reinforce your weapon systems and shield in the Armory before re-engaging.</p>

        <div class="result-actions">
          <button id="fail-retry" class="primary">RETRY MISSION <span>→</span></button>
          <button id="fail-armory" class="secondary">ARMORY UPGRADES ◈</button>
          <button id="fail-map" class="secondary">SECTOR MAP ⌖</button>
        </div>
      </div>
    `;

    this.el("fail-retry").onclick = onRetry;
    this.el("fail-armory").onclick = onShop;
    this.el("fail-map").onclick = onMap;
  }

  campaignComplete(
    stats: { totalScore: number; perfectCount: number; creditsEarned: number },
    onReturnToMap: () => void,
    onShop: () => void,
  ) {
    this.overlay.innerHTML = `
      <div class="modal campaign-complete-modal">
        <span class="eyebrow" style="color:#42f5e9;">SOLAR SYSTEM SECURED</span>
        <h2>CAMPAIGN VICTORY</h2>
        <p>All 20 sectors have been pacified. The dimensional rift at The Fracture is sealed.<br>You are the supreme guardian of the Hologram Defense Grid.</p>

        <div class="result-score">${stats.totalScore.toLocaleString()}<span>TOTAL CAMPAIGN SCORE</span></div>

        <div class="result-grid">
          <div><b>20 / 20</b><span>SECTORS SECURED</span></div>
          <div><b>★ ${stats.perfectCount}</b><span>PERFECT DEFENSES</span></div>
          <div><b>+${stats.creditsEarned.toLocaleString()} ◈</b><span>TOTAL REWARDS</span></div>
        </div>

        <div class="result-actions" style="margin-top:20px;">
          <button id="campaign-map-return" class="primary">SECTOR STAR MAP <span>→</span></button>
          <button id="campaign-armory" class="secondary">VISIT ARMORY ◈</button>
        </div>
      </div>
    `;

    this.el("campaign-map-return").onclick = onReturnToMap;
    this.el("campaign-armory").onclick = onShop;
  }
  tutorial(step: number, mode: string) {
    const titles = [
      mode === "hand" ? "MOVE YOUR HAND" : "MOVE TO AIM",
      "AIM AT THE TARGET",
      "AUTO FIRE ACTIVE",
      "BLOCK THE ATTACK",
    ];
    const descriptions = [
      "Move left and right. Your shield and reticle follow your hand.",
      "Place your reticle over the enemy drone to initiate target lock.",
      "Keep reticle on target. The core weapon fires automatically.",
      "Move your shield to intercept the incoming hostile projectile.",
    ];
    this.set("tutorial-step", `CONTROL SYNC / 0${step + 1}`);
    this.set("tutorial-title", titles[step] ?? "");
    this.set("tutorial-description", descriptions[step] ?? "");
  }
  banner(label: string, title: string, detail = "") {
    this.set("banner-label", label);
    this.set("banner-title", title);
    this.set("banner-detail", detail);
  }
  showBanner(label: string, title: string, detail = "") {
    this.banner(label, title, detail);
    this.el("banner").hidden = false;
  }
  hideBanner() {
    this.el("banner").hidden = true;
  }
  update(sim: CombatSimulation, wave: number) {
    this.set("health-number", `${Math.ceil(sim.health)}%`);
    this.el("health-fill").style.width = `${sim.health}%`;
    this.el("health-fill").classList.toggle("danger", sim.health < 35);
    this.root.classList.toggle("health-critical", sim.health < 35);
    this.set("energy-number", `${Math.floor(sim.energy)}%`);
    this.el("energy-fill").style.width = `${sim.energy}%`;
    this.set("score", sim.score.value.toString().padStart(6, "0"));
    this.set("wave-label", `WAVE 0${wave} / 05`);
    const combo = sim.score.combo;
    this.root.dataset.combo = combo > 1 ? String(combo) : "";
    this.set(
      "combo",
      combo > 1 ? `×${combo} COMBO` : "DEFEND THE CORE",
    );
    const lockEl = this.el("lock-status");
    if (lockEl) {
      if (sim.lockState === "LOCKED") {
        lockEl.textContent = "TARGET LOCKED";
        lockEl.className = "lock-tag locked";
      } else if (sim.lockState === "LOCKING") {
        lockEl.textContent = `LOCKING ${(sim.lockProgress * 100).toFixed(0)}%`;
        lockEl.className = "lock-tag locking";
      } else {
        lockEl.textContent = "SEARCHING";
        lockEl.className = "lock-tag idle";
      }
    }
    const boss = sim.enemies.active.find((e) => isBossKind(e.kind));
    if (boss) {
      this.el("boss-hud").hidden = false;
      this.el("boss-fill").style.width = `${(boss.hp / boss.maxHp) * 100}%`;
      this.set("boss-phase", `PHASE 0${boss.phase}`);
      this.set(
        "boss-hint",
        boss.phase === 2
          ? `Destroy the illuminated nodes · ${Math.min(3, boss.weakIndex + 1)} / 3`
          : boss.phase === 3
            ? "Central core exposed · incoming reinforcements"
            : "Aim for the central eye/core · block incoming fire",
      );
    }
  }
  paused() {
    this.overlay.innerHTML = `<div class="modal"><span class="eyebrow">DEFENSE ON HOLD</span><h2>Take a breath.</h2><p>Resume when you're ready.<br>In hand mode, bring your hand back into view.</p><button id="resume" class="primary">Resume defense <span>→</span></button><button id="pause-armory" class="secondary">Open Armory ◈ ↗</button><button id="pause-mouse" class="secondary">Switch to mouse control</button><button id="restart" class="text-button">Restart mission</button></div>`;
    this.el("resume").onclick = () => this.onResume();
    this.el("pause-armory").onclick = () => this.onShop();
    this.el("pause-mouse").onclick = () => this.onStart("mouse");
    this.el("restart").onclick = () => this.onReplay();
  }
  result(result: RunResult) {
    this.lastResult = result;
    writeLocal("hd.last-result", result);
    const previous = readLocal<number>("hd.best", 0);
    writeLocal("hd.best", Math.max(previous, result.score));
    this.overlay.innerHTML = `<div class="modal results"><span class="eyebrow">${result.victory ? "EARTH ORBIT SECURED" : "DEFENSE SESSION ENDED"}</span><h2>${result.victory ? "You held the line." : "The next defense is yours."}</h2><div class="result-score">${result.score.toLocaleString()}<span>FINAL SCORE ${result.score > previous ? "/ NEW PERSONAL BEST" : ""}</span></div><div class="result-grid"><div><b>×${result.bestCombo}</b><span>BEST COMBO</span></div><div><b>${Math.round(result.accuracy * 100)}%</b><span>ACCURACY</span></div><div><b>0${result.wave}</b><span>WAVE REACHED</span></div><div><b>${Math.ceil(result.coreIntegrity)}%</b><span>CORE INTEGRITY</span></div></div><div class="result-economy" style="display:flex; justify-content:space-around; background:#071a27; border:1px solid #1c3c50; padding:10px 14px; margin: 12px 0; font: 10px var(--mono);"><div><span>RUN CREDITS: </span><b style="color:#ffd855;">+${result.creditsEarned ?? 0} ◈</b></div><div><span>WAVE BONUS: </span><b style="color:#ffd855;">+${result.bonusCredits ?? 0} ◈</b></div><div><span>TOTAL WALLET: </span><b style="color:#ffd855;">${(result.totalCredits ?? 0).toLocaleString()} ◈</b></div></div><div class="result-actions"><button id="again" class="primary">Play again <span>→</span></button><button id="result-armory" class="secondary">Armory ◈</button><button id="leaderboard" class="secondary">Leaderboard</button></div><form id="score-form"><label for="pilot-name">PILOT CALLSIGN</label><div><input id="pilot-name" name="playerName" maxlength="20" placeholder="Your callsign" autocomplete="nickname" required pattern="[A-Za-z0-9 _.-]{1,20}"><button class="secondary" type="submit">Save score ↗</button></div><p id="save-status">Saved on this device. Submit to join the flight records.</p></form></div>`;
    this.el("again").onclick = () => this.onReplay();
    this.el("result-armory").onclick = () => this.onShop();
    this.el("leaderboard").onclick = () =>
      void this.leaderboard(() => this.result(result));
    this.el("score-form").onsubmit = (event) => {
      event.preventDefault();
      void this.submit();
    };
  }
  private async submit() {
    if (!this.lastResult) return;
    const form = this.el("score-form") as HTMLFormElement,
      button = form.querySelector("button")!;
    button.disabled = true;
    const { score, wave, coreIntegrity, accuracy, duration } = this.lastResult;
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: (this.el("pilot-name") as HTMLInputElement).value.trim(),
          score,
          wave,
          coreIntegrity,
          accuracy,
          duration,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        throw new Error(
          response.status >= 500
            ? "Leaderboard offline. Your result is safe on this device."
            : response.status === 429
              ? "Too many submissions. Try again in a minute."
              : "Score could not be submitted. Check your callsign.",
        );
      this.set("save-status", "Flight record saved.");
    } catch (error) {
      this.set(
        "save-status",
        error instanceof TypeError ||
          (error instanceof DOMException && error.name === "TimeoutError")
          ? "Leaderboard offline. Your result is safe on this device."
          : error instanceof Error
            ? error.message
            : "Leaderboard unavailable.",
      );
      button.disabled = false;
    }
  }
  async leaderboard(back: () => void) {
    this.overlay.innerHTML = `<div class="modal leaderboard"><span class="eyebrow">ORBITAL DEFENSE NETWORK</span><h2>Flight records</h2><p id="board-status">Connecting to the relay…</p><ol id="scores"></ol><button class="secondary" id="back">← Back</button></div>`;
    this.el("back").onclick = back;
    try {
      const response = await fetch("/api/leaderboard?limit=10", {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        scores: { playerName: string; score: number; wave: number }[];
      };
      if (!this.root.querySelector("#scores")) return;
      this.set(
        "board-status",
        data.scores.length
          ? "TOP PILOTS / ALL TIME"
          : "No flight records yet. Be the first pilot to hold the line.",
      );
      for (const [index, score] of data.scores.entries()) {
        const item = document.createElement("li");
        for (const text of [
          (index + 1).toString().padStart(2, "0"),
          score.playerName,
          score.score.toLocaleString(),
        ]) {
          const span = document.createElement("span");
          span.textContent = text;
          item.appendChild(span);
        }
        this.el("scores").appendChild(item);
      }
    } catch {
      if (this.root.querySelector("#board-status"))
        this.set(
          "board-status",
          `Relay offline. Personal best: ${readLocal<number>("hd.best", 0).toLocaleString()}. Gameplay is available offline.`,
        );
    }
  }
  cameraStatus(message: string) {
    this.set("camera-status", message);
  }
  toast(message: string) {
    this.notice.textContent = message;
    this.notice.hidden = false;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(
      () => (this.notice.hidden = true),
      4500,
    );
  }
}
