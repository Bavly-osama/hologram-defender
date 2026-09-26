import { Application, Graphics, Container, Text } from "pixi.js";
import { WORLD, mix } from "../core/Config";
import { LayerManager } from "./LayerManager";
import { CoreVisual } from "./CoreVisual";
import { ShieldVisual } from "./ShieldVisual";
import { SpriteSheetManager } from "../assets/SpriteSheetManager";
import { EnemyAnimationController } from "../enemies/EnemyAnimationController";
import { EffectManager } from "../effects/EffectManager";
import type {
  CombatSimulation,
  CombatEvent,
} from "../gameplay/CombatSimulation";
import type { InputManager } from "../input/InputManager";
import type { PerformanceManager } from "../performance/PerformanceManager";
import { isBossKind, type EnemyKind } from "../gameplay/gameBalance";
import type { AssetId } from "../assets/AssetManifest";
import { StageBackgroundManager } from "./StageBackgroundManager";
import { ViewportManager } from "./ViewportManager";
import { GameplayBounds } from "../gameplay/GameplayBounds";

const ids: Record<EnemyKind, AssetId> = {
  scout: "SCOUT_DRONE",
  orb: "KAMIKAZE_ORB",
  heavy: "HEAVY_DRONE",
  mars_rover: "MARS_ROVER",
  phase_striker: "PHASE_STRIKER",
  magma_walker: "MAGMA_WALKER",
  storm_drone: "STORM_DRONE",
  splitter: "SPLITTER",
  splitter_mini: "SPLITTER_MINI",
  abyss_ray: "ABYSS_RAY",
  mimic_drone: "MIMIC_DRONE",
  null_hunter: "NULL_HUNTER",
  entropy_core: "ENTROPY_CORE",
  boss: "SENTINEL",
  mars_war_machine: "MARS_WAR_MACHINE",
  void_leviathan: "VOID_LEVIATHAN",
  fracture_architect: "FRACTURE_ARCHITECT",
};

export class PixiApp {
  readonly app = new Application();
  readonly layers = new LayerManager();
  readonly sheets = new SpriteSheetManager();
  readonly core = new CoreVisual();
  readonly shield = new ShieldVisual();
  readonly stageBackground = new StageBackgroundManager();
  effects!: EffectManager;
  private stars = new Container();
  private orbits = new Graphics();
  private arcs = new Graphics();
  private projectiles = new Graphics();
  private target = new Graphics();
  private weak = new Graphics();
  private skeleton = new Graphics();
  private decor = new Container();
  private enemies = new Map<
    number,
    { kind: EnemyKind; animation: EnemyAnimationController }
  >();
  private damage = 0;
  private time = 0;
  private menuBlend = 1;
  private arcFlash = 0;
  private arcNext = 3.5;
  async init(
    host: HTMLElement,
    privateQuality: PerformanceManager,
    progress: (n: number) => void,
  ) {
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: privateQuality.resolution,
      autoDensity: true,
      preference: "webgl",
      powerPreference: "high-performance",
      resizeTo: host,
    });
    this.app.stop();
    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute(
      "aria-label",
      "Orbital defense arena. Move to aim and shield. Click to fire.",
    );
    this.app.stage.addChild(this.layers.root);
    this.layers.layers.CORE.addChild(this.core.container);
    this.layers.layers.SHIELD.addChild(this.shield.container);
    this.layers.layers.DISTANT_PARTICLES.addChild(this.stars);
    this.layers.layers.BACKGROUND.addChild(
      this.stageBackground.container,
      this.orbits,
      this.arcs,
      this.decor,
    );
    this.layers.layers.PROJECTILES.addChild(this.projectiles);
    this.layers.layers.HAND_POINTER.addChild(this.target, this.weak, this.skeleton);
    this.background();
    await this.sheets.load(progress);
    this.effects = new EffectManager(
      this.layers.layers.EXPLOSIONS,
      this.layers.layers.PORTALS,
      this.sheets,
    );
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  readonly transform = {
    scaleX: 1,
    scaleY: 1,
    offsetX: 0,
    offsetY: 0,
    isPortrait: false,
  };

  /**
   * Extra sprite scale multiplier applied in update() to compensate for
   * the portrait world shrink (e.g. 390px / 1200 = 0.325 → enemies tiny).
   * 1.0 on desktop/landscape. Boosted on portrait mobile.
   */
  mobileScaleBoost = 1.0;

  private resize() {
    const { width, height } = this.app.screen;
    const snap = ViewportManager.get().snap;
    const isPortrait = height > width;
    this.transform.isPortrait = isPortrait;

    if (isPortrait) {
      const isMobile = snap.deviceProfile !== "DESKTOP";
      // Masthead (top: 8px) + compact HUD (top: 44px) end at ~82px
      const hudTop = snap.safeArea.top + (isMobile ? 84 : 48);
      // Statusbar + camera preview clearance at bottom
      const footer = snap.safeArea.bottom + (isMobile ? 54 : 36);
      const playableH = Math.max(300, height - hudTop - footer);
      const combatWidth = 460;
      const scale = Math.min(width / combatWidth, playableH / 620);

      this.transform.scaleX = scale;
      this.transform.scaleY = scale;
      this.transform.offsetX = (width - WORLD.width * scale) / 2;

      // Ground cannon nicely near the bottom of playable area without letting enemies overlap HUD
      const idealCannonY = height - footer - (isMobile ? 30 : 20);
      const targetOffsetY = idealCannonY - WORLD.core.y * scale;
      this.transform.offsetY = Math.max(hudTop + 10, Math.min(hudTop + 70, targetOffsetY));

      this.layers.root.scale.set(scale, scale);
      this.layers.root.position.set(this.transform.offsetX, this.transform.offsetY);

      this.mobileScaleBoost = isMobile ? 1.6 : 1.0;
    } else {
      // Landscape: fill canvas
      this.transform.scaleX = width / WORLD.width;
      this.transform.scaleY = height / WORLD.height;
      this.transform.offsetX = 0;
      this.transform.offsetY = 0;
      this.layers.root.scale.set(this.transform.scaleX, this.transform.scaleY);
      this.layers.root.position.set(0, 0);
      const isMobileDevice = snap.deviceProfile !== "DESKTOP";
      this.mobileScaleBoost = isMobileDevice ? 1.25 : 1.0;
    }

    // Update gameplay bounds with current transform
    const isMobile = snap.deviceProfile !== "DESKTOP";
    GameplayBounds.get().update(width, height, snap.safeArea, this.transform, {
      hudTopPx: isMobile ? 84 : 48,
      footerPx: isMobile ? 54 : 36,
    });
  }
  private background() {
    for (let i = 0; i < 150; i++) {
      const star = new Graphics().circle(0, 0, i % 11 === 0 ? 1.3 : 0.6).fill({
        color: i % 3 ? 0xaed3de : 0x70bdce,
        alpha: 0.15 + ((i * 13) % 10) / 20,
      });
      star.position.set((i * 317.17) % 1200, (i * 137.71) % 750);
      this.stars.addChild(star);
    }
    for (let i = 0; i < 6; i++)
      this.orbits
        .ellipse(890, 370, 190 + i * 57, 190 + i * 57)
        .stroke({ color: 0x7eb0c5, width: 0.6, alpha: i === 0 ? 0.19 : 0.05 });
    for (let x = 60; x < 1200; x += 80)
      for (let y = 130; y < 750; y += 80)
        this.orbits
          .moveTo(x - 2, y)
          .lineTo(x + 2, y)
          .moveTo(x, y - 2)
          .lineTo(x, y + 2)
          .stroke({ color: 0x70bad2, width: 0.7, alpha: 0.09 });
    const label = (text: string, x: number, y: number) => {
      const t = new Text({
        text,
        style: {
          fontFamily: "monospace",
          fontSize: 9,
          letterSpacing: 1.5,
          fill: 0x6c99a9,
        },
      });
      t.position.set(x, y);
      this.decor.addChild(t);
    };
    label("Q-01 / QUANTUM CORE", 939, 530);
    label("CONTAINMENT FIELD", 686, 200);
    label("ORBITAL RELAY / 07", 943, 211);
    const lines = new Graphics()
      .moveTo(840, 262)
      .lineTo(800, 222)
      .lineTo(690, 222)
      .moveTo(938, 452)
      .lineTo(975, 507)
      .lineTo(1080, 507)
      .stroke({ color: 0x6eafc7, width: 0.7, alpha: 0.35 });
    this.decor.addChild(lines);
  }
  event(event: CombatEvent, quality: PerformanceManager) {
    this.effects.emit(event, this.sheets, quality.particleLimit);
    if (event.type === "damage") this.damage = 0.35;
    if (event.type === "shot") {
      this.core.triggerRecoil();
    }
    if (event.type === "block") {
      this.shield.triggerImpact(
        event.x - this.shield.container.x,
        event.y - this.shield.container.y,
      );
    }
  }
  update(
    dt: number,
    sim: CombatSimulation,
    input: InputManager,
    menu: boolean,
    quality: PerformanceManager,
    frozen = false,
    debug = false,
  ) {
    if (!frozen) this.time += dt;
    this.damage = Math.max(0, this.damage - dt);
    this.stageBackground.update(
      dt,
      input.point,
      quality.low,
      this.transform.isPortrait,
    );
    this.menuBlend = mix(this.menuBlend, menu ? 1 : 0, 1 - Math.exp(-dt * 5));
    const menuTargetX = this.transform.isPortrait ? 600 : 890;
    const menuTargetY = this.transform.isPortrait ? 380 : 365;
    this.core.container.position.set(
      mix(WORLD.core.x, menuTargetX, this.menuBlend),
      mix(WORLD.core.y, menuTargetY, this.menuBlend),
    );
    const baseCoreScale = this.transform.isPortrait ? 1.25 : 0.85;
    this.core.container.scale.set(
      mix(baseCoreScale, this.transform.isPortrait ? 1.5 : 1.85, this.menuBlend),
    );
    const aim = sim.target ? sim.enemies.weakPoint(sim.target) : input.point;
    this.core.update(
      this.time,
      sim.health,
      this.damage,
      dt,
      aim.x,
      aim.y,
      this.core.container.x,
      this.core.container.y,
    );
    this.decor.alpha = this.menuBlend;
    this.orbits.alpha = mix(0.5, 1, this.menuBlend);
    this.stars.x =
      Math.sin(this.time * 0.03) * 6 - (input.point.x - 600) * 0.004;
    this.stars.y = Math.cos(this.time * 0.025) * 5;
    this.stars.children.forEach((star, i) => {
      star.visible = !quality.low || i < 55;
    });
    this.shield.container.visible = !menu;
    this.shield.container.position.set(input.point.x, input.point.y);
    this.shield.container.alpha = input.opacity;
    this.shield.setMobileScale(this.transform.isPortrait ? 1.35 : 1.0);
    const trackingWeak = input.presenceState === "WEAK" || input.presenceState === "PREDICTED";
    this.shield.update(
      this.time,
      Boolean(sim.target?.active),
      dt,
      sim.lockState === "LOCKED" ? 1 : sim.lockProgress,
      input.pinch.state !== "OPEN",
      trackingWeak,
    );
    // Animated energy arcs — occasional distant flashes
    if (!frozen && !quality.low) {
      this.arcFlash = Math.max(0, this.arcFlash - dt * 4);
      this.arcNext -= dt;
      if (this.arcNext <= 0) {
        this.arcFlash = 1;
        this.arcNext = 4 + Math.random() * 8;
      }
      if (this.arcFlash > 0) {
        const seed = Math.floor(this.arcNext * 31.7) % 5;
        const x1 = 120 + seed * 220, y1 = 80 + seed * 50;
        const x2 = x1 + (Math.random() - 0.5) * 180, y2 = y1 + (Math.random() - 0.5) * 90;
        this.arcs.clear()
          .moveTo(x1, y1).lineTo(x2, y2)
          .stroke({ color: 0x7ce5f2, width: 0.8, alpha: this.arcFlash * 0.35 });
      } else {
        this.arcs.clear();
      }
    }
    for (const e of sim.enemies.pool) {
      const isDying = e.dying && e.dyingTime > 0;
      let view = this.enemies.get(e.id);
      if (!e.active && !isDying) {
        if (view) view.animation.sprite.visible = false;
        continue;
      }
      if (!view || view.kind !== e.kind) {
        view?.animation.sprite.destroy();
        view = {
          kind: e.kind,
          animation: new EnemyAnimationController(this.sheets, ids[e.kind]),
        };
        this.enemies.set(e.id, view);
      }
      const sprite = view.animation.sprite;
      const layer =
        e.depth < 0.3
          ? "FAR_ENEMIES"
          : e.depth < 0.7
            ? "MID_ENEMIES"
            : "NEAR_ENEMIES";
      if (sprite.parent !== this.layers.layers[layer])
        this.layers.layers[layer].addChild(sprite);
      sprite.visible = true;
      sprite.position.set(e.x, e.y);
      const isBoss = isBossKind(e.kind);
      const isMobile = this.transform.isPortrait;

      if (isBoss) {
        // Boss: 1.45x on mobile, min 1.0 to stay imposing and readable
        sprite.scale.set(Math.max(1.0, 0.95 * (isMobile ? 1.45 : 1.0)));
      } else {
        // Regular enemies: apply type size modifier + mobile boost (1.75x on mobile)
        const typeMult =
          e.kind === "heavy" ||
          e.kind === "magma_walker" ||
          e.kind === "abyss_ray" ||
          e.kind === "entropy_core"
            ? 1.15
            : 0.8;
        // Minimum enemy scale: 0.45 so distant enemies are never tiny dots
        const baseScale = Math.max(0.45, e.scale);
        sprite.scale.set(baseScale * typeMult * (isMobile ? 1.75 : 1.0));
      }

      const baseAlpha = isBoss ? 1.0 : isMobile ? Math.max(0.80, 0.72 + e.depth * 0.28) : 0.6 + e.depth * 0.4;
      const dyingMax = isBoss ? 1.5 : 0.35;
      sprite.alpha = isDying
        ? baseAlpha * (e.dyingTime / dyingMax)
        : e.phased
          ? 0.25 + Math.sin(this.time * 22) * 0.15
          : baseAlpha;
      sprite.tint = isDying ? 0xff8866 : e.hitTime > 0 ? 0xffffff : 0xd9cdd4;
      view.animation.set(
        isDying
          ? "DEATH"
          : e.hitTime > 0
            ? "HIT"
            : e.age < 0.5
              ? "SPAWN"
              : e.attackTime < 0.2
                ? "ATTACK"
                : "MOVE",
      );
      if (!frozen) view.animation.update(dt);
    }
    this.projectiles.clear();
    const projScale = this.transform.isPortrait ? 1.30 : 1.0;
    for (const p of sim.projectiles.pool)
      if (p.active) {
        const color = p.team === "player" ? 0xa3f7ff : 0xff8058;
        this.projectiles
          .moveTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018)
          .lineTo(p.x, p.y)
          .stroke({ color, width: (p.team === "player" ? 2.5 : 4.5) * projScale, alpha: 0.85 })
          .circle(p.x, p.y, (p.team === "player" ? 3 : 6) * projScale)
          .fill(color)
          .circle(p.x, p.y, 10 * projScale)
          .fill({ color, alpha: 0.08 });
      }
    this.target.clear();
    this.weak.clear();
    if (sim.target?.active && !menu && !sim.target.phased) {
      const p = sim.enemies.weakPoint(sim.target);
      const isTargetBoss = isBossKind(sim.target.kind);
      const baseRadius = isTargetBoss
        ? 36
        : Math.max(22, sim.target.radius * sim.target.scale + 8);
      const isLocked = sim.lockState === "LOCKED";
      const isLocking = sim.lockState === "LOCKING";
      const radius = isLocking
        ? baseRadius + (1 - sim.lockProgress) * 16
        : baseRadius;
      const color = isLocked ? 0x64f5ff : 0x7be4f6;

      // 4 corner reticle brackets
      const arcLen = isLocked ? 0.65 : 0.45;
      for (let i = 0; i < 4; i++) {
        const start = (i * Math.PI) / 2 - arcLen / 2 + (isLocked ? 0 : this.time * 0.8);
        this.target
          .arc(p.x, p.y, radius, start, start + arcLen)
          .stroke({
            color,
            width: isLocked ? 2 : 1.2,
            alpha: isLocked ? 0.95 : 0.7,
          });
      }

      // Lock progress arc gauge
      if (isLocking) {
        this.target
          .arc(p.x, p.y, radius + 5, -Math.PI / 2, -Math.PI / 2 + sim.lockProgress * Math.PI * 2)
          .stroke({ color: 0x82f4ff, width: 1.5, alpha: 0.85 });
      }

      // When fully locked, draw targeting indicator & energy vector from core
      if (isLocked) {
        this.target
          .circle(p.x, p.y, 4)
          .fill({ color: 0xaefaff, alpha: 0.9 })
          .circle(p.x, p.y, radius + 4)
          .stroke({ color: 0x48dcfa, width: 0.8, alpha: 0.4 });

        // Faint holographic targeting vector from Core to Enemy
        this.target
          .moveTo(WORLD.core.x, WORLD.core.y - 25)
          .lineTo(p.x, p.y)
          .stroke({ color: 0x4dd8ef, width: 0.8, alpha: 0.22 });
      }
    }
    const boss = sim.enemies.active.find((e) => isBossKind(e.kind));
    if (boss?.phase === 2) {
      const offset = boss.kind === "void_leviathan" ? 80 : 68;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3,
          x = boss.x + Math.cos(a) * offset,
          y = boss.y + Math.sin(a) * offset;
        this.weak
          .circle(x, y, i === boss.weakIndex ? 18 : 10)
          .fill({
            color: i < boss.weakIndex ? 0x416c7a : 0xffb45e,
            alpha: i === boss.weakIndex ? 0.5 : 0.12,
          })
          .stroke({ color: 0xffcf91, width: 1, alpha: 0.7 });
      }
    }
    this.skeleton.clear();
    if (debug && input.mode === "hand" && input.landmarks.length === 21) {
      const connections: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
      ];
      const pts = input.landmarks.map((lm) => ({
        x: (1 - lm.x) * WORLD.width,
        y: lm.y * WORLD.height,
      }));
      for (const [a, b] of connections) {
        this.skeleton
          .moveTo(pts[a].x, pts[a].y)
          .lineTo(pts[b].x, pts[b].y)
          .stroke({ color: 0x00ffcc, width: 1.5, alpha: 0.65 });
      }
      for (const pt of pts) {
        this.skeleton.circle(pt.x, pt.y, 2.5).fill(0xffffff);
      }
    }
    if (!frozen) {
      this.effects.update(dt);
      this.stageBackground.update(dt);
    }
    this.app.renderer.render(this.app.stage);
  }
  setQuality(quality: PerformanceManager) {
    this.app.renderer.resolution = quality.resolution;
    this.app.resize();
    this.resize();
  }
  setStage(stageIndex: number) {
    this.stageBackground.setStage(stageIndex);
  }
}
