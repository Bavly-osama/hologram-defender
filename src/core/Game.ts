import { GameStateManager } from "./GameStateManager";
import { settings, saveSettings } from "./Settings";
import { PixiApp } from "../rendering/PixiApp";
import { InputManager } from "../input/InputManager";
import {
  CombatSimulation,
  type CombatEvent,
} from "../gameplay/CombatSimulation";
import { WaveManager } from "../gameplay/WaveManager";
import { TutorialController } from "../gameplay/TutorialController";
import { HUD } from "../ui/HUD";
import { AudioManager, type SoundEvent } from "../audio/AudioManager";
import { PerformanceManager } from "../performance/PerformanceManager";
import { PlayerInventory } from "../economy/PlayerInventory";
import { PlayerStatsCalculator } from "../economy/PlayerStatsCalculator";
import { ShopModal } from "../ui/ShopModal";
import { getSkinDef } from "../economy/economyConfig";
import { EventBus } from "./EventBus";
import { CampaignManager } from "../campaign/CampaignManager";
import { CinematicManager } from "../campaign/CinematicManager";
import { getLevelConfig } from "../campaign/LevelConfig";
import { getStageByLevelId, STAGES } from "../campaign/StageConfig";
import { isBossKind } from "../gameplay/gameBalance";
import { AuthService } from "../auth/AuthService";
import { AuthScreen } from "../auth/AuthScreen";
import { ViewportManager } from "../rendering/ViewportManager";



export class Game {
  readonly state = new GameStateManager();
  readonly view = new PixiApp();
  readonly quality = new PerformanceManager();
  readonly audio = new AudioManager();
  readonly inventory = new PlayerInventory();
  readonly campaign: CampaignManager;
  cinematics!: CinematicManager;
  sim: CombatSimulation;
  waves = new WaveManager();
  input!: InputManager;
  private tutorial = new TutorialController();
  private hud: HUD;
  private shopModal!: ShopModal;
  private lastTime = 0;
  private hudTimer = 0;
  private debug = false;
  private tutorialStep = -1;
  private cameraAttempt = 0;
  private authService = AuthService.get();
  private authScreen: AuthScreen;
  private authContainer: HTMLElement;

  constructor(root: HTMLElement) {
    this.hud = new HUD(root);
    this.campaign = new CampaignManager(
      this.inventory.campaignProgress,
      () => this.inventory.saveCampaignProgress(this.campaign.progress.data),
    );
    const initialStats = PlayerStatsCalculator.compute(this.inventory);
    this.sim = new CombatSimulation(initialStats);

    // Auth container sits above everything
    this.authContainer = document.createElement("div");
    this.authContainer.id = "auth-container";
    this.authContainer.hidden = true;
    document.body.appendChild(this.authContainer);
    this.authScreen = new AuthScreen(this.authContainer);
  }

  async init() {
    this.state.onChange = (state) => this.hud.state(state);
    this.state.set("LOADING");
    await this.view.init(this.hud.arena, this.quality, (progress) =>
      this.hud.loading(progress),
    );
    this.cinematics = new CinematicManager(
      this.view.layers.layers.CINEMATICS,
      this.campaign.progress,
    );
    this.input = new InputManager(this.view.app.canvas, () => this.view.transform);
    this.shopModal = new ShopModal(this.hud.root, this.inventory, () => {
      this.applyStatsToSimulation();
    });
    this.applyStatsToSimulation();
    this.hud.updateCredits(this.inventory.wallet.balance);

    // EventBus economy listeners
    EventBus.get().on("ENEMY_DESTROYED", (data) => {
      this.inventory.wallet.add(data.credits, `Defeated ${data.kind}`);
      this.hud.updateCredits(this.inventory.wallet.balance);
    });
    EventBus.get().on("CREDITS_SPENT", () => {
      this.hud.updateCredits(this.inventory.wallet.balance);
    });
    EventBus.get().on("STATS_CHANGED", () => {
      this.applyStatsToSimulation();
    });

    this.bind();
    this.connectSimulation();

    // ── Wire ViewportManager → CameraPreview layout ────────────────────────
    const vm = ViewportManager.get();
    const updatePreviewLayout = () => {
      const snap = vm.snap;
      const isMobile = snap.deviceProfile !== "DESKTOP";
      this.input?.tracker?.preview?.updateLayout(snap.isPortrait, isMobile);
    };
    vm.onChange(updatePreviewLayout);
    // Update once immediately
    updatePreviewLayout();

    // ── Load initial planetary stage assets on boot so space & planet are visible ──
    const initialStage = this.campaign.stageManager.currentStage;
    this.view.setStage(initialStage.stageIndex);

    // ── Auth check: try to restore session from server ────────────────────────
    await this._bootAuth();

    requestAnimationFrame(this.frame);
    if (this.view.sheets.warnings.length)
      this.hud.toast(
        "Some art assets are unavailable. Procedural visuals are active.",
      );
  }

  /** Check server session; show auth screen or go directly to main menu. */
  private async _bootAuth() {
    const user = await this.authService.checkSession();
    if (user) {
      // Authenticated — sync profile from server
      await this._hydrateFromServer();
      this._showPlayerBadge(user.name);
      this.state.set("CAMERA_READY");
      this.hud.home(this.campaign);
    } else {
      // Show auth screen — allow skip for offline play
      this._showAuthScreen();
    }
  }

  private _showAuthScreen() {
    this.authContainer.hidden = false;
    this.authScreen.show();
    this.authScreen.onAuthenticated = async (user) => {
      this.authContainer.hidden = true;
      this.authScreen.showSyncing();
      this.authContainer.hidden = false;
      await this._hydrateFromServer();
      this.authContainer.hidden = true;
      this._showPlayerBadge(user.name);
      this.state.set("CAMERA_READY");
      this.hud.home(this.campaign);
    };
    this.authScreen.onSkip = () => {
      this.authContainer.hidden = true;
      this.state.set("CAMERA_READY");
      this.hud.home(this.campaign);
    };
  }

  /** Pull server profile and hydrate local inventory + campaign progress. */
  private async _hydrateFromServer() {
    try {
      const serverProfile = await this.authService.fetchProfile();
      if (serverProfile) {
        // Merge server profile fields into local profile object
        Object.assign(this.inventory.profile, serverProfile);
        // Sync wallet balance: spend current balance then add server amount
        const diff = serverProfile.credits - this.inventory.wallet.balance;
        if (diff > 0) {
          this.inventory.wallet.add(diff, "SERVER_SYNC");
        } else if (diff < 0) {
          this.inventory.wallet.spend(-diff, "SERVER_SYNC");
        }
        this.inventory.save();
        this.campaign.progress.data = serverProfile.campaignProgress;
        this.hud.updateCredits(this.inventory.wallet.balance);
        this.applyStatsToSimulation();
      }
    } catch {
      // Offline — continue with local save
      this.hud.toast("OFFLINE — Using local save. Progress will sync on reconnect.");
    }
  }

  private _showPlayerBadge(name: string) {
    const header = document.querySelector(".masthead");
    if (!header) return;
    const existing = header.querySelector(".player-badge");
    if (existing) existing.remove();
    const badge = document.createElement("button");
    badge.className = "player-badge";
    badge.innerHTML = `<span class="player-badge-name">${name.slice(0, 16).toUpperCase()}</span><span>CMDR ↗</span>`;
    badge.title = "Account options";
    badge.onclick = () => this._showAccountMenu(badge, name);
    header.appendChild(badge);
  }

  private _showAccountMenu(anchor: HTMLElement, name: string) {
    const existing = document.querySelector(".account-menu");
    if (existing) { existing.remove(); return; }
    const menu = document.createElement("div");
    menu.className = "account-menu";
    menu.style.cssText = "position:fixed;top:56px;right:12px;z-index:9500;background:rgba(9,22,38,.97);border:1px solid rgba(155,233,238,.2);border-radius:2px;padding:16px;min-width:200px;font-family:var(--mono);";
    menu.innerHTML = `
      <div style="font-size:11px;color:#9be9ee;margin-bottom:12px;letter-spacing:.1em;">COMMANDER: ${name.slice(0, 16).toUpperCase()}</div>
      <button id="sync-profile-btn" style="display:block;width:100%;text-align:left;background:none;border:none;color:#8ba9b5;font-family:inherit;font-size:11px;padding:6px 0;cursor:pointer;">SYNC PROGRESS ↑</button>
      <button id="logout-btn" style="display:block;width:100%;text-align:left;background:none;border:none;color:#ff8080;font-family:inherit;font-size:11px;padding:6px 0;cursor:pointer;">LOGOUT</button>
    `;
    document.body.appendChild(menu);
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target as Node) && e.target !== anchor) menu.remove();
    }, { once: true });
    menu.querySelector("#sync-profile-btn")!.addEventListener("click", async () => {
      menu.remove();
      const ok = await this.authService.saveProfile(this.inventory.profile);
      this.hud.toast(ok ? "PROGRESS SYNCED ✓" : "Sync failed — will retry later.");
    });
    menu.querySelector("#logout-btn")!.addEventListener("click", async () => {
      menu.remove();
      await this.authService.logout();
      document.querySelector(".player-badge")?.remove();
      this._showAuthScreen();
    });
  }

  private applyStatsToSimulation() {
    const stats = PlayerStatsCalculator.compute(this.inventory);
    this.sim.stats = stats;
    const skin = getSkinDef(this.inventory.activeSkin);
    if (skin && this.view?.shield) {
      this.view.shield.setSkin(skin.theme.primary);
      this.view.shield.setRadius(stats.shieldRadius);
    }
  }

  private bind() {
    this.hud.onShop = () => {
      if (this.state.interactive) {
        this.state.pause();
      }
      this.shopModal.show();
    };
    this.hud.onCampaignMap = () => this.openCampaignMap();
    this.hud.onSelectLevel = (levelId) => this.showLevelBriefing(levelId);
    this.hud.onStart = (mode) => void this.start(mode);
    this.hud.onPause = () => this.state.pause();
    this.hud.onResume = () => this.resume();
    this.hud.onReplay = () => {
      void this.launchLevel(this.campaign.currentLevelId);
    };
    this.hud.onSound = () => this.audio.unlock();
    this.hud.onMode = () => {
      this.state.pause();
      void this.start(this.input.mode === "hand" ? "mouse" : "hand");
    };
    this.hud.onQuality = () => {
      this.quality.low = settings.quality === "low";
      this.view.setQuality(this.quality);
    };
    this.input.tracker.onState = (state, message) => {
      this.hud.cameraStatus(message);
      if (state === "DENIED" || state === "ERROR") {
        this.state.pause();
        this.hud.toast(message);
        if (this.state.current === "CAMERA_PERMISSION")
          void this.start("mouse");
      }
      // Show non-blocking camera overlay only while loading
      if (state === "LOADING") this.hud.camera(message, true);
      // Clear camera overlay when tracking is ready
      if (state === "READY") {
        // Remove the camera loading overlay if still showing
        const camOverlay = this.hud.root.querySelector(".camera-status-overlay");
        if (camOverlay) (camOverlay as HTMLElement).style.display = "none";
      }
    };
    // Keep CameraPreview landmarks fresh
    const origOnLandmarks = this.input.tracker.onLandmarks.bind(this.input.tracker);
    this.input.tracker.onLandmarks = (landmarks, time) => {
      this.input.tracker.preview.setLandmarks(landmarks);
      origOnLandmarks(landmarks, time);
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.state.pause();
    });
    window.addEventListener("keydown", (event) => {
      if ((event.target as HTMLElement)?.matches("input")) return;
      if (event.code === "Escape" || event.code === "KeyP")
        this.state.current === "PAUSED" ? this.resume() : this.state.pause();
      if (event.code === "Space" && this.state.current === "TRAVEL_CINEMATIC") {
        this.cinematics.skip();
      }
      if (import.meta.env.DEV && event.code === "Backquote") {
        this.debug = !this.debug;
        this.hud.el("debug").hidden = !this.debug;
      }
    });
    window.addEventListener("pagehide", () => this.input.tracker.stop());
  }

  openCampaignMap() {
    this.state.set("CAMPAIGN_MAP");
    this.hud.campaignMap(
      this.campaign,
      (lvl) => this.showLevelBriefing(lvl),
      () => {
        this.state.set("CAMERA_READY");
        this.hud.home(this.campaign);
      },
    );
  }

  showLevelBriefing(levelId: number) {
    const config = getLevelConfig(levelId);
    const stage = getStageByLevelId(levelId);
    this.state.set("LEVEL_INTRO");
    this.hud.levelBriefing(
      config,
      stage,
      () => void this.launchLevel(levelId),
      () => this.openCampaignMap(),
    );
  }

  async launchLevel(levelId: number) {
    this.audio.unlock();
    this.campaign.selectLevel(levelId);
    const stage = this.campaign.currentStageConfig;
    this.view.setStage(stage.stageIndex);
    this.hud.setLocation(stage.name, this.campaign.currentLevelConfig.name);
    this.reset();
    this.campaign.startLevel(levelId, this.sim);
    this.begin();
  }
  private async start(mode: "mouse" | "hand") {
    const attempt = ++this.cameraAttempt;
    this.audio.unlock();
    const resume = this.state.current === "PAUSED";
    if (mode === "hand") {
      this.state.set("CAMERA_PERMISSION");
      this.hud.camera("Allow camera access to activate hand control.", true);
      await this.input.setMode("hand");
      if (attempt !== this.cameraAttempt) return;
      if (this.input.tracker.state !== "READY") return;
    } else {
      await this.input.setMode("mouse");
      this.hud.cameraStatus("MOUSE CONTROL ENABLED");
    }
    this.hud.updateSettings();
    if (resume) {
      this.state.set("PAUSED");
      this.hud.paused();
    } else {
      this.reset();
      this.begin();
    }
  }
  private reset() {
    const stats = PlayerStatsCalculator.compute(this.inventory);
    this.sim = new CombatSimulation(stats);
    this.waves = new WaveManager();
    this.applyStatsToSimulation();
    this.connectSimulation();
  }
  private connectSimulation() {
    this.sim.onEvent = (event) => {
      this.view.event(event, this.quality);
      this.sound(event);
      if (event.type === "phase") {
        const boss = this.sim.enemies.pool.find((e) => e.kind === "boss" && e.active);
        if (boss) {
          this.hud.showBanner(
            boss.phase === 2
              ? "ARMOR COMPROMISED / WEAK NODES EXPOSED"
              : "CORE EXPOSED / FIRE AT WILL",
            boss.phase === 2 ? "PHASE 02" : "PHASE 03",
          );
          setTimeout(() => {
            if (this.state.current === "BOSS") this.hud.hideBanner();
          }, 2200);
        }
      }
    };
  }
  private sound(event: CombatEvent) {
    if (event.type === "credit") return;
    const events: Record<Exclude<CombatEvent["type"], "credit">, SoundEvent> = {
      shot: "energy_shot",
      hit: "enemy_hit",
      kill: event.kind === "boss" ? "boss_destroy" : "enemy_destroy",
      block: "shield_hit",
      damage: "core_damage",
      portal: "ui_hover",
      phase: "boss_warning",
    };
    this.audio.play(events[event.type]);
    if (event.type === "damage") {
      // CSS screen-pulse — remove then re-add class so animation restarts
      this.hud.root.classList.remove("damage-pulse");
      void this.hud.root.offsetWidth; // force reflow
      this.hud.root.classList.add("damage-pulse");
    }
  }
  private begin() {
    this.audio.play("game_start");
    if (!settings.tutorial) {
      this.tutorial.start(this.sim, this.input);
      this.tutorialStep = -1;
      this.state.set("TUTORIAL");
    } else {
      this.state.set("COUNTDOWN");
      this.hud.banner(
        "DEFENSE SYSTEM ONLINE",
        "3",
        "Move to defend · fire to eliminate",
      );
    }
  }
  private resume() {
    if (
      this.input.mode === "hand" &&
      (!this.input.active || this.input.tracker.state !== "READY")
    ) {
      this.hud.toast(
        "Show your hand to the camera, or switch to mouse control.",
      );
      return;
    }
    this.audio.unlock();
    this.state.resume();
  }
  private frame = (time: number) => {
    const rawDt = this.lastTime ? (time - this.lastTime) / 1000 : 1 / 60;
    this.lastTime = time;
    const dt = Math.min(rawDt, 0.05);
    this.input.update(dt, time);
    if (!document.hidden && rawDt < 0.3 && this.quality.update(rawDt))
      this.view.setQuality(this.quality);
    this.input.tracker.interval = this.quality.low ? 80 : 50;
    if (
      this.state.interactive &&
      this.state.elapsed > 1.8 &&
      this.input.mode === "hand" &&
      (this.input.handMissingFor > 1800 ||
        time - this.input.tracker.lastResult > 2000)
    )
      this.state.pause();
    const fire = this.input.consumeFire();
    if (
      this.state.interactive &&
      fire &&
      this.input.active &&
      !this.sim.fire(this.input.point)
    )
      this.hud.toast("Energy recharging");
    if (
      !this.state.interactive &&
      fire &&
      this.input.mode === "hand" &&
      this.input.active
    ) {
      const rect = this.view.app.canvas.getBoundingClientRect();
      const button = document
        .elementFromPoint(
          rect.left + (this.input.point.x / 1200) * rect.width,
          rect.top + (this.input.point.y / 750) * rect.height,
        )
        ?.closest("button");
      button?.click();
    }
    if (this.state.current !== "PAUSED") this.state.elapsed += dt;
    this.cinematics.update(dt);
    if (this.state.interactive) {
      this.sim.aim(this.input.point);
      this.sim.update(dt, {
        ...this.input.point,
        active:
          this.input.active &&
          (this.state.current !== "TUTORIAL" || this.tutorial.step === 3),
      });
      if (this.state.current === "TUTORIAL") {
        this.updateTutorial(dt);
      } else if (this.sim.health <= 0) {
        this.handleLevelFailed();
      } else if (this.campaign.update(dt, this.sim)) {
        this.handleLevelComplete();
      } else if (
        this.sim.enemies.active.some((e) => isBossKind(e.kind)) &&
        this.state.current === "PLAYING"
      ) {
        this.state.set("BOSS");
      }
    }
    this.updateTransitions();
    const menu = [
      "CAMERA_READY",
      "CAMERA_PERMISSION",
      "LOADING",
      "BOOT",
      "MAIN_MENU",
      "CAMPAIGN_MAP",
      "STAGE_INTRO",
      "LEVEL_INTRO",
      "TRAVEL_CINEMATIC",
      "CAMPAIGN_COMPLETE",
    ].includes(this.state.current);
    this.view.update(
      dt,
      this.sim,
      this.input,
      menu,
      this.quality,
      this.state.current === "PAUSED",
      this.debug,
    );
    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.hud.update(this.sim, this.campaign.levelManager.currentWaveNumber);
      this.updateDebug();
      if (this.input.mode === "hand" && this.input.tracker.state === "READY")
        this.hud.cameraStatus(
          this.input.active
            ? "HAND TRACKED · AIM TO AUTO-FIRE"
            : "CAMERA READY · SHOW ONE HAND",
        );
    }
    requestAnimationFrame(this.frame);
  };

  private updateTutorial(dt: number) {
    if (this.tutorial.update(dt, this.sim, this.input)) {
      settings.tutorial = true;
      saveSettings();
      this.reset();
      this.state.set("COUNTDOWN");
      this.hud.banner("DEFENSE SYSTEM ONLINE", "3", "Protect the Quantum Core");
      return;
    }
    if (this.tutorialStep !== this.tutorial.step) {
      this.tutorialStep = this.tutorial.step;
      this.hud.tutorial(this.tutorialStep, this.input.mode);
    }
  }

  private handleLevelComplete() {
    const summary = this.campaign.completeLevel(this.sim, this.inventory.wallet);
    this.hud.updateCredits(this.inventory.wallet.balance);

    // Report to server asynchronously (fire-and-forget; local save is already done)
    if (this.authService.isAuthenticated) {
      void this.authService.reportLevelComplete({
        levelId: summary.levelId,
        score: summary.score,
        coreIntegrity: summary.coreIntegrity,
        accuracy: summary.accuracy,
        duration: Math.round(this.state.elapsed),
        creditsEarned: summary.creditsEarned ?? 0,
      }).catch(() => { /* offline — local save is sufficient */ });
    }

    const isStageFinal = this.campaign.isStageCompleted(summary.levelId);
    const isCampaignFinal = summary.levelId >= 20;

    if (isCampaignFinal) {
      this.state.set("TRAVEL_CINEMATIC");
      const currentStage = this.campaign.currentStageConfig;
      this.cinematics.playTravel(currentStage, currentStage, true, () => {
        this.state.set("CAMPAIGN_COMPLETE");
        this.audio.play("boss_destroy");
        this.hud.campaignComplete(
          {
            totalScore: this.campaign.progress.totalScore,
            perfectCount: this.campaign.progress.perfectLevelCount,
            creditsEarned: this.inventory.wallet.totalEarned,
          },
          () => this.openCampaignMap(),
          () => this.hud.onShop(),
        );
      });
      return;
    }

    if (isStageFinal) {
      const currentStage = this.campaign.stageManager.currentStage;
      const nextStage = STAGES[currentStage.stageIndex + 1];
      this.state.set("STAGE_COMPLETE");
      this.audio.play("boss_destroy");
      this.hud.showBanner(
        "PLANETARY SECTOR SECURED",
        `${currentStage.name.toUpperCase()} LIBERATED`,
        "WARP VECTOR ENGAGED · TRAVELING TO NEXT SYSTEM",
      );

      setTimeout(() => {
        this.hud.hideBanner();
        this.state.set("TRAVEL_CINEMATIC");
        this.cinematics.playTravel(currentStage, nextStage, false, () => {
          this.view.setStage(nextStage.stageIndex);
          const nextLevelId = summary.levelId + 1;
          this.showLevelBriefing(nextLevelId);
        });
      }, 2500);
      return;
    }

    // Standard level clear
    this.state.set("LEVEL_COMPLETE");
    this.audio.play("wave_complete");
    const nextLevelId = summary.levelId < 20 ? summary.levelId + 1 : null;
    this.hud.levelComplete(
      summary,
      nextLevelId,
      () => {
        if (nextLevelId) this.showLevelBriefing(nextLevelId);
      },
      () => this.openCampaignMap(),
      () => this.hud.onShop(),
    );
  }

  private handleLevelFailed() {
    this.state.set("LEVEL_FAILED");
    this.audio.play("game_over");
    const config = this.campaign.currentLevelConfig;
    this.hud.levelFailed(
      config,
      () => void this.launchLevel(config.id),
      () => this.openCampaignMap(),
      () => this.hud.onShop(),
    );
  }

  private updateTransitions() {
    const { current, elapsed } = this.state;
    if (current === "COUNTDOWN") {
      this.hud.banner(
        "DEFENSE SYSTEM ONLINE",
        String(Math.max(1, 3 - Math.floor(elapsed))),
        "Protect the Quantum Core",
      );
      if (elapsed >= 3) {
        this.state.set("PLAYING");
      }
    }
  }
  private updateDebug() {
    if (!this.debug) return;
    const cameraOn = this.input.mode === "hand" && this.input.tracker.state === "READY";
    const handDetected = this.input.mode === "hand" && this.input.active;
    const lockDesc =
      this.sim.lockState === "LOCKING"
        ? `LOCKING (${(this.sim.lockProgress * 100).toFixed(0)}%)`
        : this.sim.lockState;

    this.hud.el("debug").textContent =
      `CAMERA: ${cameraOn ? "ON" : "OFF"} | TRACK: ${this.input.tracker.trackingFps.toFixed(0)} FPS | RENDER: ${this.quality.fps.toFixed(0)} FPS\n` +
      `HAND DETECTED: ${handDetected ? "YES" : "NO"} | HAND/POINTER: ${this.input.point.x.toFixed(0)}, ${this.input.point.y.toFixed(0)}\n` +
      `TARGET: ${this.sim.target?.active ? `${this.sim.target.kind} (#${this.sim.target.id})` : "NONE"} | LOCK: ${lockDesc}\n` +
      `AUTO-FIRE: ${this.sim.autoFireEnabled ? (this.sim.lockState === "LOCKED" ? "FIRING" : "ARMED") : "OFF"} | PROFILE: ${this.quality.profile}\n` +
      `ENEMIES: ${this.sim.enemies.active.length} | PROJECTILES: ${this.sim.projectiles.active.length} | PARTICLES: ${this.view.effects.count}\n` +
      `STATE: ${this.state.current} | PINCH: ${this.input.pinch.state}`;
  }
  debugSnapshot() {
    return {
      state: this.state.current,
      wave: this.waves.wave,
      health: this.sim.health,
      score: this.sim.score.value,
      energy: this.sim.energy,
      time: this.sim.time,
      enemies: this.sim.enemies.active.map((e) => ({
        id: e.id,
        kind: e.kind,
        x: e.x,
        y: e.y,
        hp: e.hp,
        phase: e.phase,
        weak: this.sim.enemies.weakPoint(e),
      })),
      projectiles: this.sim.projectiles.active.map((p) => ({
        team: p.team,
        x: p.x,
        y: p.y,
      })),
      cameraState: this.input.tracker.state,
    };
  }
}
