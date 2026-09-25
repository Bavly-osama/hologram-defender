import { Container, Graphics } from "pixi.js";
import { mix, clamp } from "../core/Config";

const CYAN = 0x7deaf4;
const CYAN_BRIGHT = 0xd6ffff;
const CYAN_GLOW = 0x27b9de;
const CYAN_DEEP = 0x0c7186;

export class CoreVisual {
  readonly container = new Container();

  // 2.5D layer hierarchy for defense cannon
  private glow = new Graphics();
  private pedestal = new Graphics();
  private turretMount = new Container();
  private turretBase = new Graphics();
  private barrelAssembly = new Container();
  private barrels = new Graphics();
  private reactor = new Graphics();
  private muzzleFlash = new Graphics();
  private statusRings = new Graphics();

  private currentAngle = 0;
  private recoil = 0;
  private flashAlpha = 0;

  constructor() {
    this.buildGlow();
    this.buildPedestal();
    this.buildTurret();

    this.container.addChild(
      this.glow,
      this.pedestal,
      this.turretMount,
      this.statusRings,
    );
  }

  private buildGlow() {
    for (let r = 110; r > 0; r -= 8) {
      this.glow
        .circle(0, 0, r)
        .fill({ color: CYAN_GLOW, alpha: 0.007 + (110 - r) / 12000 });
    }
  }

  private buildPedestal() {
    // 1. Outer telemetry calibration rings
    for (let i = 0; i < 3; i++) {
      this.pedestal
        .ellipse(0, 10, 95 + i * 10, 32 + i * 3)
        .stroke({
          color: CYAN,
          width: i === 1 ? 1.4 : 0.6,
          alpha: i === 1 ? 0.6 : 0.2,
        });
    }

    // 2. Azimuth compass tick marks around the base
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI * 2) / 36;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const r1 = 78;
      const r2 = i % 3 === 0 ? 86 : 82;
      this.pedestal
        .moveTo(cos * r1, 10 + sin * (r1 * 0.35))
        .lineTo(cos * r2, 10 + sin * (r2 * 0.35))
        .stroke({
          color: CYAN,
          width: i % 3 === 0 ? 1.2 : 0.6,
          alpha: i % 3 === 0 ? 0.65 : 0.3,
        });
    }

    // 3. Heavy Armored Base Ring & Mounting Flange
    this.pedestal
      .ellipse(0, 10, 68, 26)
      .fill({ color: CYAN_DEEP, alpha: 0.08 })
      .stroke({ color: CYAN, width: 1.5, alpha: 0.75 });

    // Base cross-bracing struts
    for (const sx of [-45, 45]) {
      this.pedestal
        .moveTo(sx, 14)
        .lineTo(sx * 1.35, 26)
        .stroke({ color: CYAN, width: 1.2, alpha: 0.5 });
    }
  }

  private buildTurret() {
    this.turretMount.addChild(
      this.barrelAssembly,
      this.turretBase,
      this.reactor,
    );
    this.barrelAssembly.addChild(this.barrels, this.muzzleFlash);

    // 1. Turret Base / Armored Breech Housing
    this.turretBase
      .poly([
        -28, 12,
        -32, -4,
        -18, -22,
        18, -22,
        32, -4,
        28, 12,
        14, 20,
        -14, 20,
      ])
      .fill({ color: CYAN_DEEP, alpha: 0.15 })
      .stroke({ color: CYAN, width: 1.4, alpha: 0.85 });

    // Side armor sponsons / elevation trunnions
    for (const tx of [-26, 26]) {
      this.turretBase
        .circle(tx, -4, 9)
        .fill({ color: 0x072b36, alpha: 0.3 })
        .stroke({ color: CYAN, width: 1.2, alpha: 0.7 })
        .circle(tx, -4, 4)
        .stroke({ color: CYAN_BRIGHT, width: 1, alpha: 0.9 });
    }

    // Recoil damping hydraulic cylinders
    this.turretBase
      .moveTo(-20, -18)
      .lineTo(-14, -36)
      .moveTo(20, -18)
      .lineTo(14, -36)
      .stroke({ color: CYAN, width: 1.5, alpha: 0.55 });

    // 2. Barrels & Magnetic Accelerator Rails
    this.drawBarrels();

    // 3. Central Quantum Reactor Core (in the breech)
    this.reactor
      .circle(0, -2, 14)
      .fill({ color: 0x3cdcf0, alpha: 0.18 })
      .stroke({ color: CYAN, width: 1.2, alpha: 0.8 });

    // Hexagonal containment cage
    const hexPts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      hexPts.push(Math.cos(a) * 9, -2 + Math.sin(a) * 9);
    }
    this.reactor
      .poly(hexPts)
      .fill({ color: CYAN_BRIGHT, alpha: 0.25 })
      .stroke({ color: CYAN_BRIGHT, width: 1.0, alpha: 0.9 });

    this.reactor.circle(0, -2, 3.5).fill(CYAN_BRIGHT);
  }

  private drawBarrels() {
    this.barrels.clear();

    const barrelX = [-11, 11];
    const barrelW = 7;
    const barrelL = 58; // Extends upwards to y = -62

    // Dual Heavy Railgun Barrels
    for (const bx of barrelX) {
      // Main Barrel Tube
      this.barrels
        .rect(bx - barrelW / 2, -barrelL - 4, barrelW, barrelL)
        .fill({ color: 0x0a3b4a, alpha: 0.25 })
        .stroke({ color: CYAN, width: 1.3, alpha: 0.85 });

      // Internal Bore line
      this.barrels
        .moveTo(bx, -4)
        .lineTo(bx, -barrelL - 4)
        .stroke({ color: CYAN_BRIGHT, width: 0.8, alpha: 0.5 });

      // 4 Magnetic Accelerator Coils per barrel
      for (const coilY of [-16, -28, -40, -52]) {
        this.barrels
          .rect(bx - barrelW / 2 - 2, coilY - 3, barrelW + 4, 6)
          .fill({ color: 0x1a586e, alpha: 0.45 })
          .stroke({ color: CYAN_BRIGHT, width: 1.0, alpha: 0.95 });
      }

      // Muzzle Brake / Ionization Emitter
      this.barrels
        .rect(bx - barrelW / 2 - 3, -barrelL - 8, barrelW + 6, 4)
        .fill({ color: CYAN_BRIGHT, alpha: 0.6 })
        .stroke({ color: 0xffffff, width: 1.2, alpha: 0.95 });
    }

    // Central Plasma Accelerator Rail between the twin barrels
    this.barrels
      .moveTo(0, -12)
      .lineTo(0, -barrelL - 4)
      .stroke({ color: 0xa8f8ff, width: 1.5, alpha: 0.7 });

    // Cross-brace connectors between barrels
    for (const cy of [-22, -46]) {
      this.barrels
        .moveTo(-11 + barrelW / 2, cy)
        .lineTo(11 - barrelW / 2, cy)
        .stroke({ color: CYAN, width: 1.2, alpha: 0.8 });
    }
  }

  triggerRecoil() {
    this.recoil = 8.0;
    this.flashAlpha = 1.0;
  }

  update(
    time: number,
    health: number,
    damage: number,
    dt = 0.016,
    aimX = 600,
    aimY = 200,
    coreX = 600,
    coreY = 585,
  ) {
    // 1. Calculate Target Azimuth Angle
    const dx = aimX - coreX;
    const dy = aimY - coreY; // Target is above, so dy < 0
    // Barrel points along -Y axis, so 0 angle is straight up
    const targetAngle = clamp(Math.atan2(dx, -dy), -1.15, 1.15);

    // Smoothly traverse cannon turret towards target
    this.currentAngle = mix(this.currentAngle, targetAngle, 1 - Math.exp(-dt * 10));
    this.turretMount.rotation = this.currentAngle;

    // 2. Recoil Recovery
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 28);
    }
    this.barrelAssembly.position.y = this.recoil;

    // 3. Muzzle Flash Decay
    this.muzzleFlash.clear();
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 6);
      for (const bx of [-11, 11]) {
        this.muzzleFlash
          .circle(bx, -68, 8 * this.flashAlpha)
          .fill({ color: 0xffffff, alpha: this.flashAlpha * 0.9 })
          .circle(bx, -68, 16 * this.flashAlpha)
          .fill({ color: CYAN_BRIGHT, alpha: this.flashAlpha * 0.4 });
      }
    }

    // 4. Status Rings & Telemetry Rotation
    this.statusRings.clear();
    const pulse = Math.sin(time * 3);
    this.statusRings
      .ellipse(0, 10, 76 + pulse * 2, 29 + pulse * 0.8)
      .stroke({ color: CYAN, width: 0.8, alpha: 0.35 + pulse * 0.15 });

    // Quantum Reactor Core Breathing & Rotation
    this.reactor.rotation = time * 0.8;
    this.reactor.alpha = 0.8 + Math.sin(time * 4) * 0.2;

    // 5. Ambient Glow & Damage Flash
    this.glow.alpha = 0.75 + Math.sin(time * 2) * 0.2;
    this.container.tint =
      health < 35 || damage > 0 ? 0xff847d : health < 60 ? 0xb6dfea : 0xffffff;
  }
}
