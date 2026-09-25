import { Container, Graphics } from "pixi.js";

const CYAN = 0x7deaf4;
const CYAN_BRIGHT = 0xd6ffff;
const CYAN_GLOW = 0x27b9de;
const CYAN_DEEP = 0x0c7186;

export class ShieldVisual {
  readonly container = new Container();

  private glow = new Graphics();
  private outerCrest = new Graphics();
  private innerCrest = new Graphics();
  private hexMatrix = new Graphics();
  private orbitalRings = new Graphics();
  private pointer = new Graphics();
  private impactLayer = new Graphics();

  private impactFlash = 0;

  constructor() {
    this.buildGlow();
    this.buildShieldCrest();
    this.buildHexMatrix();
    this.buildOrbitalRings();
    this.buildReticle();

    this.container.addChild(
      this.glow,
      this.outerCrest,
      this.innerCrest,
      this.hexMatrix,
      this.orbitalRings,
      this.impactLayer,
      this.pointer,
    );
  }

  private buildGlow() {
    for (let r = 70; r > 0; r -= 10) {
      this.glow
        .circle(0, 0, r)
        .fill({ color: CYAN_GLOW, alpha: 0.008 + (70 - r) / 10000 });
    }
  }

  private buildShieldCrest() {
    // 1. Outer Holographic Shield Crest Escutcheon
    const outerPts = [
      0, -46,
      -20, -50,
      -44, -42,
      -48, -12,
      -38, 18,
      -20, 42,
      0, 56,
      20, 42,
      38, 18,
      48, -12,
      44, -42,
      20, -50,
    ];

    this.outerCrest
      .poly(outerPts)
      .fill({ color: CYAN_DEEP, alpha: 0.08 })
      .stroke({ color: CYAN, width: 2, alpha: 0.85 });

    // Outer corner reinforced chevron brackets
    for (const [x, y] of [
      [-44, -42],
      [44, -42],
      [-48, -12],
      [48, -12],
      [0, 56],
      [0, -46],
    ]) {
      this.outerCrest.circle(x, y, 2.5).fill(CYAN_BRIGHT);
    }

    // 2. Inner Beveled Crest Frame
    const innerPts = [
      0, -36,
      -16, -40,
      -34, -34,
      -38, -10,
      -30, 14,
      -16, 33,
      0, 44,
      16, 33,
      30, 14,
      38, -10,
      34, -34,
      16, -40,
    ];

    this.innerCrest
      .poly(innerPts)
      .fill({ color: 0x092d3b, alpha: 0.12 })
      .stroke({ color: 0x98f6ff, width: 1.2, alpha: 0.7 });

    // Vertical crest spine
    this.innerCrest
      .moveTo(0, -36)
      .lineTo(0, -18)
      .moveTo(0, 18)
      .lineTo(0, 44)
      .stroke({ color: CYAN_BRIGHT, width: 1, alpha: 0.6 });

    // Horizontal reinforcement wing lines
    this.innerCrest
      .moveTo(-34, -10)
      .lineTo(-18, -10)
      .moveTo(18, -10)
      .lineTo(34, -10)
      .stroke({ color: CYAN, width: 1, alpha: 0.5 });
  }

  private buildHexMatrix() {
    // Symmetrical hexagonal energy barrier lattice
    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        const cx = x * 16;
        const cy = y * 18 + (x % 2) * 9;
        if (Math.hypot(cx, cy) > 36) continue;
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) {
          pts.push(
            cx + Math.cos((i * Math.PI) / 3) * 9.5,
            cy + Math.sin((i * Math.PI) / 3) * 9.5,
          );
        }
        this.hexMatrix
          .poly(pts)
          .stroke({ color: 0x6beafa, width: 0.6, alpha: 0.2 });
      }
    }
  }

  private buildOrbitalRings() {
    // Holographic orbital gyroscope rings around the core
    this.orbitalRings
      .ellipse(0, 0, 46, 17)
      .stroke({ color: CYAN, width: 1.2, alpha: 0.6 });

    this.orbitalRings.rotation = -0.35;
  }

  private buildReticle() {
    this.pointer
      .circle(0, 0, 9)
      .stroke({ color: 0xbafaff, width: 1, alpha: 0.85 })
      .circle(0, 0, 2.5)
      .fill(0xffffff)
      .moveTo(-16, 0)
      .lineTo(-11, 0)
      .moveTo(11, 0)
      .lineTo(16, 0)
      .moveTo(0, -16)
      .lineTo(0, -11)
      .moveTo(0, 11)
      .lineTo(0, 16)
      .stroke({ color: 0x9ffaff, width: 1.2 });
  }

  triggerImpact(_x = 0, _y = 0) {
    this.impactFlash = 1.0;
  }

  update(
    time: number,
    locked = false,
    dt = 0.016,
    _lockProgress = 0,
    pinching = false,
  ) {
    // 1. Subtle breathing and idle rotation
    this.orbitalRings.rotation = -0.35 + Math.sin(time * 0.8) * 0.15;
    this.hexMatrix.alpha = 0.65 + Math.sin(time * 3) * 0.25;

    // 2. Reticle lock state
    this.pointer.scale.set(locked ? 0.85 : 1);
    this.pointer.tint = locked ? 0xffc38e : 0xffffff;

    // 3. Impact deflection wave
    this.impactLayer.clear();
    if (this.impactFlash > 0) {
      this.impactFlash = Math.max(0, this.impactFlash - dt * 3.5);
      const expand = (1 - this.impactFlash) * 16;
      this.impactLayer
        .poly([
          0, -46 - expand,
          -20 - expand * 0.5, -50 - expand,
          -44 - expand, -42 - expand * 0.8,
          -48 - expand, -12,
          -38 - expand * 0.8, 18 + expand * 0.5,
          -20 - expand * 0.5, 42 + expand * 0.8,
          0, 56 + expand,
          20 + expand * 0.5, 42 + expand * 0.8,
          38 + expand * 0.8, 18 + expand * 0.5,
          48 + expand, -12,
          44 + expand, -42 - expand * 0.8,
          20 + expand * 0.5, -50 - expand,
        ])
        .stroke({
          color: 0xaef8ff,
          width: 2.2 * this.impactFlash,
          alpha: this.impactFlash * 0.9,
        });
    }

    // 4. Pinch / lock scale
    const baseScale = pinching ? 0.92 : locked ? 1.05 : 1.0;
    this.container.scale.set(baseScale * this.scaleMultiplier);
  }

  private scaleMultiplier = 1.0;

  setSkin(tint: number) {
    this.container.tint = tint;
  }

  setRadius(radius: number) {
    this.scaleMultiplier = Math.max(0.7, radius / 48);
  }
}

export { ShieldVisual as ShieldSprite };
