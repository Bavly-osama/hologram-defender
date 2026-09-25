import { Container, Graphics, Text } from "pixi.js";
import { STAGES_CONFIG, type StageConfig, type StageId } from "../campaign/StageConfig";
import type { Point } from "../core/Config";

export class StageBackgroundManager {
  readonly root = new Container();

  get container(): Container {
    return this.root;
  }

  private farSpace = new Container();
  private celestial = new Container();
  private structures = new Container();
  private ambientParticles = new Container();
  private atmosphericHaze = new Graphics();
  private environmentalFx = new Graphics();

  private currentStageId = 0;
  private time = 0;
  private stars: Graphics[] = [];
  private particles: { g: Graphics; x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private lightningTimer = 3.0;
  private lightningFlash = 0;

  constructor() {
    this.root.addChild(
      this.farSpace,
      this.celestial,
      this.structures,
      this.atmosphericHaze,
      this.environmentalFx,
      this.ambientParticles,
    );
  }

  loadStage(stage: StageConfig) {
    if (this.currentStageId === stage.id) return;
    this.currentStageId = stage.id;
    this.time = 0;

    // Clear previous stage visual layers
    this.farSpace.removeChildren();
    this.celestial.removeChildren();
    this.structures.removeChildren();
    this.ambientParticles.removeChildren();
    this.atmosphericHaze.clear();
    this.environmentalFx.clear();
    this.stars = [];
    this.particles = [];

    // Build stage-specific visual layers
    this.buildFarStars(stage);

    switch (stage.id) {
      case 1:
        this.buildEarthOrbit(stage);
        break;
      case 2:
        this.buildMarsFrontier(stage);
        break;
      case 3:
        this.buildNeptuneVoid(stage);
        break;
      case 4:
        this.buildTheFracture(stage);
        break;
    }
  }

  private buildFarStars(stage: StageConfig) {
    for (let i = 0; i < 160; i++) {
      const g = new Graphics();
      const r = i % 15 === 0 ? 1.6 : i % 4 === 0 ? 1.0 : 0.6;
      g.circle(0, 0, r).fill({
        color: i % 5 === 0 ? stage.palette.primary : 0xd2eaf5,
        alpha: 0.15 + ((i * 17) % 10) / 15,
      });
      g.position.set((i * 317.17) % 1200, (i * 137.71) % 750);
      this.farSpace.addChild(g);
      this.stars.push(g);
    }
  }

  // ── STAGE 1: EARTH ORBIT ─────────────────────────────────────
  private buildEarthOrbit(stage: StageConfig) {
    // 1. Earth Limb Globe in distance (top-right)
    const earth = new Graphics();
    // Atmospheric glow
    for (let r = 240; r > 160; r -= 15) {
      earth.circle(920, 240, r).fill({ color: 0x42c8f5, alpha: 0.012 + (240 - r) / 4000 });
    }
    // Planet body
    earth.circle(920, 240, 160).fill({ color: 0x09283f });
    // Cloud band swirls
    earth.ellipse(900, 210, 140, 50).fill({ color: 0x22627e, alpha: 0.25 });
    earth.ellipse(940, 280, 120, 40).fill({ color: 0x1f546c, alpha: 0.3 });
    this.celestial.addChild(earth);

    // 2. Orbital Grid and Defense Station Silhouettes
    const grid = new Graphics();
    for (let i = 0; i < 5; i++) {
      grid.ellipse(920, 240, 180 + i * 45, 180 + i * 45).stroke({
        color: stage.palette.primary,
        width: 0.7,
        alpha: i === 0 ? 0.22 : 0.06,
      });
    }
    for (let x = 80; x < 1200; x += 100) {
      for (let y = 100; y < 750; y += 100) {
        grid.moveTo(x - 2, y).lineTo(x + 2, y).moveTo(x, y - 2).lineTo(x, y + 2).stroke({
          color: 0x3ac8db,
          width: 0.6,
          alpha: 0.08,
        });
      }
    }
    this.structures.addChild(grid);

    this.addTelemetryLabel("SECTOR 07 / ORBITAL RELAY", 940, 480);
    this.addTelemetryLabel("DEFENSE SATELLITE NETWORK ACTIVE", 720, 130);

    // Floating micro debris
    this.spawnParticleSet(30, 0x8be5f5, 15);
  }

  // ── STAGE 2: MARS RED FRONTIER ───────────────────────────────
  private buildMarsFrontier(_stage: StageConfig) {
    // 1. Curved Mars Surface Horizon
    const mars = new Graphics();
    mars.ellipse(600, 960, 750, 450).fill({ color: 0x2a0c06 });
    mars.ellipse(600, 960, 740, 440).stroke({ color: 0xd9441e, width: 2.5, alpha: 0.5 });
    // Craters & canyon ridges
    for (let i = 0; i < 5; i++) {
      const cx = 300 + i * 150;
      const cy = 620 + (i % 2) * 40;
      mars.ellipse(cx, cy, 50 + i * 12, 18).stroke({ color: 0x8a230c, width: 1.2, alpha: 0.4 });
    }
    this.celestial.addChild(mars);

    // 2. Abandoned Ares Outpost Structure Silhouettes
    const outpost = new Graphics();
    outpost.rect(180, 480, 80, 50).fill({ color: 0x180603, alpha: 0.85 });
    outpost.rect(210, 440, 20, 40).fill({ color: 0x180603, alpha: 0.85 });
    outpost.moveTo(190, 440).lineTo(220, 400).stroke({ color: 0x5a180b, width: 1 });
    // Antenna red blinking beacon
    outpost.circle(220, 400, 3).fill({ color: 0xff3b1f, alpha: 0.9 });

    outpost.rect(980, 490, 120, 60).fill({ color: 0x180603, alpha: 0.85 });
    outpost.moveTo(980, 490).lineTo(940, 530).stroke({ color: 0x5a180b, width: 1.2 });
    this.structures.addChild(outpost);

    this.addTelemetryLabel("ARES LOW ORBIT · SECTOR 04", 180, 550);
    this.addTelemetryLabel("ATMOSPHERIC DUST PRESSURE: HIGH", 880, 130);

    // Martian dust particles drifting horizontally
    this.spawnParticleSet(45, 0xe86538, 45, 12);
  }

  // ── STAGE 3: NEPTUNE VOID ────────────────────────────────────
  private buildNeptuneVoid(_stage: StageConfig) {
    // 1. Giant Neptune Gas Planet
    const neptune = new Graphics();
    // Cold blue/violet storm halos
    for (let r = 320; r > 200; r -= 20) {
      neptune.circle(300, 260, r).fill({ color: 0x3d5afc, alpha: 0.01 + (320 - r) / 5000 });
    }
    neptune.circle(300, 260, 200).fill({ color: 0x091438 });
    // Atmospheric violent storm bands
    neptune.ellipse(300, 220, 190, 35).fill({ color: 0x223fa8, alpha: 0.35 });
    neptune.ellipse(280, 270, 180, 40).fill({ color: 0x192e78, alpha: 0.4 });
    neptune.ellipse(320, 320, 160, 30).fill({ color: 0x274cbd, alpha: 0.3 });
    // Great Dark Spot vortex
    neptune.ellipse(260, 260, 40, 22).fill({ color: 0x060b24, alpha: 0.85 });
    neptune.ellipse(260, 260, 42, 24).stroke({ color: 0x5580ff, width: 1.5, alpha: 0.6 });
    this.celestial.addChild(neptune);

    // 2. Cryogenic Ice Rings & Pylon Relay
    const rings = new Graphics();
    rings.ellipse(300, 260, 360, 70).stroke({ color: 0x7da4ff, width: 1.2, alpha: 0.25 });
    rings.ellipse(300, 260, 410, 85).stroke({ color: 0x486ec9, width: 0.8, alpha: 0.15 });
    this.structures.addChild(rings);

    this.addTelemetryLabel("OUTER SYSTEM RIM · SECTOR 09", 760, 130);
    this.addTelemetryLabel("METHANE ION FLUX DETECTED", 200, 520);

    // Cold ice shard particles
    this.spawnParticleSet(40, 0xaed3ff, 20);
  }

  // ── STAGE 4: THE FRACTURE ────────────────────────────────────
  private buildTheFracture(stage: StageConfig) {
    // 1. Spatial Fracture Singularity (Center-Right)
    const rift = new Graphics();
    // Dark anomaly core
    rift.circle(750, 320, 90).fill({ color: 0x040008 });
    // Event horizon violet accretion rings
    for (let r = 160; r > 90; r -= 12) {
      rift.circle(750, 320, r).stroke({
        color: stage.palette.primary,
        width: 1.2,
        alpha: 0.1 + (160 - r) / 350,
      });
    }
    this.celestial.addChild(rift);

    // 2. Warped Reality Fracture Cracks
    const cracks = new Graphics();
    const crackPoints = [
      [750, 320, 520, 180, 400, 110],
      [750, 320, 960, 220, 1100, 180],
      [750, 320, 840, 510, 950, 620],
      [750, 320, 600, 460, 480, 580],
    ];
    for (const [x1, y1, x2, y2, x3, y3] of crackPoints) {
      cracks.moveTo(x1, y1).lineTo(x2, y2).lineTo(x3, y3).stroke({
        color: 0xf472b6,
        width: 1.8,
        alpha: 0.7,
      });
      cracks.moveTo(x1, y1).lineTo(x2, y2).lineTo(x3, y3).stroke({
        color: 0x9333ea,
        width: 4.5,
        alpha: 0.3,
      });
    }
    // Floating obsidian shards
    for (const [ox, oy] of [
      [580, 240],
      [890, 410],
      [640, 420],
      [820, 190],
    ]) {
      cracks
        .poly([ox, oy - 16, ox + 14, oy, ox, oy + 16, ox - 14, oy])
        .fill({ color: 0x160320, alpha: 0.9 })
        .stroke({ color: 0xd946ef, width: 1.2, alpha: 0.8 });
    }
    this.structures.addChild(cracks);

    this.addTelemetryLabel("THE FRACTURE · SINGULARITY EVENT", 720, 540);
    this.addTelemetryLabel("SPATIAL INTEGRITY: COMPROMISED", 200, 130);

    // Violet reality shards
    this.spawnParticleSet(50, 0xf0abfc, 25);
  }

  private addTelemetryLabel(text: string, x: number, y: number) {
    const label = new Text({
      text,
      style: {
        fontFamily: "monospace",
        fontSize: 9,
        letterSpacing: 1.5,
        fill: 0x5a7d90,
      },
    });
    label.position.set(x, y);
    this.structures.addChild(label);
  }

  private spawnParticleSet(count: number, color: number, speedMax = 20, vyBias = 0) {
    for (let i = 0; i < count; i++) {
      const g = new Graphics().circle(0, 0, 1.2 + Math.random() * 1.5).fill({ color, alpha: 0.4 });
      const x = Math.random() * 1200;
      const y = Math.random() * 750;
      g.position.set(x, y);
      this.ambientParticles.addChild(g);
      this.particles.push({
        g,
        x,
        y,
        vx: (Math.random() - 0.5) * speedMax + (this.currentStageId === 2 ? 15 : 0),
        vy: (Math.random() - 0.5) * speedMax + vyBias,
        life: Math.random(),
      });
    }
  }

  setStage(stageIndex: number) {
    const stageId = Math.max(1, Math.min(4, stageIndex + 1)) as StageId;
    this.loadStage(STAGES_CONFIG[stageId]);
  }

  update(dt: number, pointer: Point = { x: 600, y: 375 }, qualityLow = false) {
    this.time += dt;

    // Parallax displacement based on aim pointer (normalized around center 600, 375)
    const normX = (pointer.x - 600) / 600;
    const normY = (pointer.y - 375) / 375;

    this.farSpace.position.set(-normX * 6, -normY * 4);
    this.celestial.position.set(-normX * 18, -normY * 12);
    this.structures.position.set(-normX * 28, -normY * 20);

    // Particle drifts
    if (!qualityLow) {
      for (const p of this.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -20) p.x = 1220;
        if (p.x > 1220) p.x = -20;
        if (p.y < -20) p.y = 770;
        if (p.y > 770) p.y = -20;
        p.g.position.set(p.x, p.y);
      }
    }

    // Stage 3 & 4 ambient lightning flashes
    if (this.currentStageId === 3 || this.currentStageId === 4) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.5);
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningFlash = 1;
        this.lightningTimer = 3.5 + Math.random() * 5.0;
      }
      this.environmentalFx.clear();
      if (this.lightningFlash > 0 && !qualityLow) {
        const lx = 200 + Math.random() * 800;
        const ly = 100 + Math.random() * 300;
        this.environmentalFx
          .moveTo(lx, ly)
          .lineTo(lx + (Math.random() - 0.5) * 140, ly + 90)
          .lineTo(lx + (Math.random() - 0.5) * 180, ly + 220)
          .stroke({
            color: this.currentStageId === 3 ? 0x76b2fe : 0xf472b6,
            width: 1.5,
            alpha: this.lightningFlash * 0.45,
          });
      }
    }
  }
}
