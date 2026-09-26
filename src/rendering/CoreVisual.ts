import { Container, Graphics } from "pixi.js";
import { mix, clamp } from "../core/Config";

// ── Sci-Fi Hologram Palette ──────────────────────────────────────────────────
const CYAN = 0x7deaf4;
const CYAN_BRIGHT = 0xd6ffff;
const CYAN_GLOW = 0x27b9de;
const CYAN_DEEP = 0x093a48;
const CYAN_CORE = 0x165c6e;
const WHITE = 0xffffff;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Vec2 {
  x: number;
  y: number;
}

interface ProjectedFace {
  pts: Vec2[];
  avgZ: number;
  fillColor: number;
  fillAlpha: number;
  strokeColor: number;
  strokeAlpha: number;
  strokeWidth: number;
}

// Directional light vector (top-right-front light source)
const LIGHT: Vec3 = (() => {
  const lx = 0.4, ly = 0.8, lz = 0.45;
  const len = Math.hypot(lx, ly, lz);
  return { x: lx / len, y: ly / len, z: lz / len };
})();

export class CoreVisual {
  readonly container = new Container();

  private glow = new Graphics();
  private basePlatform = new Graphics();
  private mesh3D = new Graphics();
  private muzzleFlash = new Graphics();

  // Control & Animation State
  private currentAngle = 0; // Traversal angle (0 is straight UP)
  private recoil = 0;       // Recoil displacement along barrel bore (downwards)
  private flashAlpha = 0;   // Muzzle flash decay
  private reactorRot = 0;   // 3D gyro reactor spin

  // Camera perspective settings
  // Moderate top-down view (~18°) so the cannon clearly points UP towards enemies
  private readonly cosCam = Math.cos(0.32);
  private readonly sinCam = Math.sin(0.32);
  private readonly fov = 460;
  private readonly camDist = 520;

  constructor() {
    this.buildGlow();
    this.container.addChild(
      this.glow,
      this.basePlatform,
      this.mesh3D,
      this.muzzleFlash,
    );
  }

  private buildGlow() {
    this.glow.clear();
    for (let r = 115; r > 0; r -= 8) {
      this.glow
        .circle(0, 4, r)
        .fill({ color: CYAN_GLOW, alpha: 0.007 + (115 - r) / 11000 });
    }
  }

  triggerRecoil() {
    this.recoil = 12.0; // Slides 12 units backward down the barrel
    this.flashAlpha = 1.0;
  }

  // ── 3D Vector Math Pipeline ─────────────────────────────────────────────────

  /** Rotate in 3D around Z axis (in-plane traverse: right is +, left is -) */
  private rotZ(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: v.x * c + v.y * s,
      y: -v.x * s + v.y * c,
      z: v.z,
    };
  }

  /** Rotate in 3D around X axis (elevation tilt) */
  private rotX(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: v.x,
      y: v.y * c - v.z * s,
      z: v.y * s + v.z * c,
    };
  }

  /** Rotate in 3D around Y axis */
  private rotY(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: v.x * c - v.z * s,
      y: v.y,
      z: v.x * s + v.z * c,
    };
  }

  /**
   * Project 3D vertex to 2D screen coordinate.
   * Coordinate space:
   *   +X: Right, -X: Left
   *   +Y: UPWARDS (towards top of screen / enemies)
   *   +Z: Out of screen towards player, -Z: Into screen
   */
  private project(p: Vec3): { v2: Vec2; camZ: number } {
    // Camera overhead pitch
    const yCam = p.y * this.cosCam + p.z * this.sinCam;
    const zCam = -p.y * this.sinCam + p.z * this.cosCam;

    const depth = this.camDist - zCam;
    const factor = this.fov / Math.max(10, depth);

    return {
      v2: {
        x: p.x * factor,
        y: -yCam * factor, // Screen Y is inverted (negative is UP)
      },
      camZ: zCam,
    };
  }

  // ── 3D Procedural Mesh Builder ──────────────────────────────────────────────

  private render3D(angle: number, recoil: number, time: number, damage: number) {
    const faces: ProjectedFace[] = [];

    // Helper: add a 3D quad/triangle face with directional lighting
    const addFace = (
      p0: Vec3,
      p1: Vec3,
      p2: Vec3,
      p3: Vec3,
      baseColor = CYAN_DEEP,
      baseAlpha = 0.45,
      strokeColor = CYAN,
      strokeAlpha = 0.85,
      strokeWidth = 1.2,
    ) => {
      // Calculate face normal
      const ax = p1.x - p0.x, ay = p1.y - p0.y, az = p1.z - p0.z;
      const bx = p2.x - p0.x, by = p2.y - p0.y, bz = p2.z - p0.z;
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const nlen = Math.hypot(nx, ny, nz);
      if (nlen < 0.0001) return;

      const normX = nx / nlen;
      const normY = ny / nlen;
      const normZ = nz / nlen;

      // Project vertices
      const pr0 = this.project(p0);
      const pr1 = this.project(p1);
      const pr2 = this.project(p2);
      const pr3 = this.project(p3);

      const avgZ = (pr0.camZ + pr1.camZ + pr2.camZ + pr3.camZ) / 4;

      // Directional diffuse lighting
      const dot = Math.max(0, normX * LIGHT.x + normY * LIGHT.y + normZ * LIGHT.z);
      const shadeAlpha = Math.min(0.88, baseAlpha + dot * 0.35);

      faces.push({
        pts: [pr0.v2, pr1.v2, pr2.v2, pr3.v2],
        avgZ,
        fillColor: baseColor,
        fillAlpha: shadeAlpha,
        strokeColor: dot > 0.45 ? CYAN_BRIGHT : strokeColor,
        strokeAlpha: Math.min(1.0, strokeAlpha + dot * 0.25),
        strokeWidth: dot > 0.45 ? strokeWidth * 1.15 : strokeWidth,
      });
    };

    // ── 1. 3D Cylindrical Pedestal / Base Turret Well ──────────────────────────
    const baseRadius = 52;
    const baseSegments = 16;
    const baseBottomY = -18;
    const baseTopY = 0;
    const basePtsBot: Vec3[] = [];
    const basePtsTop: Vec3[] = [];

    for (let i = 0; i < baseSegments; i++) {
      const a = (i * Math.PI * 2) / baseSegments;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      basePtsBot.push({ x: cos * (baseRadius + 5), y: baseBottomY, z: sin * 18 });
      basePtsTop.push({ x: cos * baseRadius, y: baseTopY, z: sin * 15 });
    }

    for (let i = 0; i < baseSegments; i++) {
      const next = (i + 1) % baseSegments;
      addFace(
        basePtsBot[i],
        basePtsBot[next],
        basePtsTop[next],
        basePtsTop[i],
        0x062832,
        0.35,
        CYAN,
        0.55,
        0.8,
      );
    }

    // ── 2. 3D Rotating Armored Turret Chassis ─────────────────────────────────
    // Local coords rotate around Z axis by traverse angle (right is +, left is -)
    const tfChassis = (local: Vec3): Vec3 => {
      return this.rotZ(local, angle);
    };

    const chassisR = 32;
    const chassisPtsBot: Vec3[] = [];
    const chassisPtsTop: Vec3[] = [];
    const chassisSides = 8;

    for (let i = 0; i < chassisSides; i++) {
      const a = (i * Math.PI * 2) / chassisSides + Math.PI / 8;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      // Armored hull in local coordinates: extends upward along +Y
      chassisPtsBot.push(
        tfChassis({
          x: cos * chassisR,
          y: sin * (chassisR * 0.75),
          z: -8,
        }),
      );
      chassisPtsTop.push(
        tfChassis({
          x: cos * (chassisR * 0.75),
          y: sin * (chassisR * 0.60),
          z: 14,
        }),
      );
    }

    // Chassis side plates
    for (let i = 0; i < chassisSides; i++) {
      const next = (i + 1) % chassisSides;
      addFace(
        chassisPtsBot[i],
        chassisPtsBot[next],
        chassisPtsTop[next],
        chassisPtsTop[i],
        CYAN_DEEP,
        0.6,
        CYAN,
        0.85,
        1.2,
      );
    }

    // Chassis top armor deck plate
    for (let i = 1; i < chassisSides - 1; i++) {
      addFace(
        chassisPtsTop[0],
        chassisPtsTop[i],
        chassisPtsTop[i + 1],
        chassisPtsTop[i + 1],
        CYAN_CORE,
        0.7,
        CYAN_BRIGHT,
        0.95,
        1.3,
      );
    }

    // Armored Elevation Trunnions on Left & Right sides of turret
    for (const side of [-1, 1]) {
      const trunPts: Vec3[] = [];
      const trunR = 9;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        trunPts.push(
          tfChassis({
            x: side * (chassisR * 0.95),
            y: Math.sin(a) * trunR,
            z: 2 + Math.cos(a) * trunR,
          }),
        );
      }
      for (let i = 1; i < 5; i++) {
        addFace(
          trunPts[0],
          trunPts[i],
          trunPts[i + 1],
          trunPts[i + 1],
          0x0c3e4d,
          0.75,
          CYAN_BRIGHT,
          0.95,
          1.2,
        );
      }
    }

    // ── 3. 3D Twin Railgun Barrels (Pointing UPWARDS along +Y) ──────────────────
    // Local coords:
    //   +Y: Along barrel bore (0 to 68 UPWARDS towards enemies)
    //   Recoil: slides -recoil down along -Y
    //   Angle: rotates left/right
    const tfBarrel = (local: Vec3): Vec3 => {
      const recoiled: Vec3 = {
        x: local.x,
        y: local.y - recoil, // Slides DOWNWARDS on recoil
        z: local.z,
      };
      return tfChassis(recoiled);
    };

    const barrelLength = 68; // Height extending UPWARDS
    const barrelHalfW = 4.2;
    const barrelHalfZ = 4.2;
    const barrelOffsetsX = [-13, 13];

    for (const bx of barrelOffsetsX) {
      // 8 vertices of the 3D rectangular railgun barrel
      // Base at y = 0, muzzle tip at y = barrelLength (UPWARDS!)
      const b0 = tfBarrel({ x: bx - barrelHalfW, y: 0, z: -barrelHalfZ });
      const b1 = tfBarrel({ x: bx + barrelHalfW, y: 0, z: -barrelHalfZ });
      const b2 = tfBarrel({ x: bx + barrelHalfW, y: 0, z: barrelHalfZ });
      const b3 = tfBarrel({ x: bx - barrelHalfW, y: 0, z: barrelHalfZ });

      const m0 = tfBarrel({ x: bx - barrelHalfW, y: barrelLength, z: -barrelHalfZ });
      const m1 = tfBarrel({ x: bx + barrelHalfW, y: barrelLength, z: -barrelHalfZ });
      const m2 = tfBarrel({ x: bx + barrelHalfW, y: barrelLength, z: barrelHalfZ });
      const m3 = tfBarrel({ x: bx - barrelHalfW, y: barrelLength, z: barrelHalfZ });

      // Front / Top-facing barrel plate (facing player / light)
      addFace(b3, b2, m2, m3, 0x145a6c, 0.7, CYAN_BRIGHT, 0.95, 1.3);
      // Rear plate
      addFace(b0, b1, m1, m0, 0x05202a, 0.45, CYAN, 0.7, 1.0);
      // Outer side plate
      if (bx > 0) {
        addFace(b1, b2, m2, m1, 0x0a3b49, 0.6, CYAN, 0.85, 1.1);
      } else {
        addFace(b0, b3, m3, m0, 0x0a3b49, 0.6, CYAN, 0.85, 1.1);
      }
      // Inner side plate
      if (bx > 0) {
        addFace(b0, b3, m3, m0, 0x072834, 0.45, CYAN, 0.75, 0.9);
      } else {
        addFace(b1, b2, m2, m1, 0x072834, 0.45, CYAN, 0.75, 0.9);
      }
      // Muzzle bore cap (pointing UP toward enemies)
      addFace(m0, m1, m2, m3, 0x021117, 0.9, WHITE, 1.0, 1.4);

      // 4 Volumetric Magnetic Accelerator Rings wrapped around each barrel
      for (const coilY of [16, 30, 44, 58]) {
        const ringHw = barrelHalfW + 2.5;
        const ringHz = barrelHalfZ + 2.5;
        const ringLen = 4.5;
        const pulse = Math.sin(time * 5 + coilY * 0.1) * 0.12;
        const ringColor = damage > 0 ? 0x8a2424 : 0x1d758c;

        const rb0 = tfBarrel({ x: bx - ringHw, y: coilY - ringLen / 2, z: -ringHz });
        const rb1 = tfBarrel({ x: bx + ringHw, y: coilY - ringLen / 2, z: -ringHz });
        const rb2 = tfBarrel({ x: bx + ringHw, y: coilY - ringLen / 2, z: ringHz });
        const rb3 = tfBarrel({ x: bx - ringHw, y: coilY - ringLen / 2, z: ringHz });

        const rf0 = tfBarrel({ x: bx - ringHw, y: coilY + ringLen / 2, z: -ringHz });
        const rf1 = tfBarrel({ x: bx + ringHw, y: coilY + ringLen / 2, z: -ringHz });
        const rf2 = tfBarrel({ x: bx + ringHw, y: coilY + ringLen / 2, z: ringHz });
        const rf3 = tfBarrel({ x: bx - ringHw, y: coilY + ringLen / 2, z: ringHz });

        // Front Face (Facing Player)
        addFace(rb3, rb2, rf2, rf3, ringColor, 0.75 + pulse, CYAN_BRIGHT, 1.0, 1.4);
        // Outer Face
        if (bx > 0) {
          addFace(rb1, rb2, rf2, rf1, 0x145a6c, 0.65 + pulse, CYAN, 0.9, 1.1);
        } else {
          addFace(rb0, rb3, rf3, rf0, 0x145a6c, 0.65 + pulse, CYAN, 0.9, 1.1);
        }
      }
    }

    // Heavy Cross-Bridge armor strut connecting the twin barrels
    for (const bridgeY of [22, 50]) {
      const cr0 = tfBarrel({ x: -13, y: bridgeY - 3, z: 2 });
      const cr1 = tfBarrel({ x: 13, y: bridgeY - 3, z: 2 });
      const cr2 = tfBarrel({ x: 13, y: bridgeY - 3, z: -2 });
      const cr3 = tfBarrel({ x: -13, y: bridgeY - 3, z: -2 });
      const cf0 = tfBarrel({ x: -13, y: bridgeY + 3, z: 2 });
      const cf1 = tfBarrel({ x: 13, y: bridgeY + 3, z: 2 });
      const cf2 = tfBarrel({ x: 13, y: bridgeY + 3, z: -2 });
      const cf3 = tfBarrel({ x: -13, y: bridgeY + 3, z: -2 });

      addFace(cr0, cr1, cf1, cf0, 0x124d5d, 0.7, CYAN, 0.9, 1.2);
      addFace(cr3, cr2, cf2, cf3, 0x082730, 0.5, CYAN, 0.75, 1.0);
    }

    // ── 4. 3D Volumetric Quantum Reactor Core ────────────────────────────────
    // Spinning 3D Gyroscopic Octahedron in the breech
    const coreR = 10;
    const rx = this.reactorRot;
    const ry = this.reactorRot * 1.4;
    const rz = this.reactorRot * 0.7;

    const tfCore = (local: Vec3): Vec3 => {
      let r = this.rotX(local, rx);
      r = this.rotY(r, ry);
      r = this.rotZ(r, rz);
      r.z += 8;
      return tfChassis(r);
    };

    const octTop = tfCore({ x: 0, y: coreR, z: 0 });
    const octBot = tfCore({ x: 0, y: -coreR, z: 0 });
    const octE0 = tfCore({ x: coreR, y: 0, z: 0 });
    const octE1 = tfCore({ x: 0, y: 0, z: coreR });
    const octE2 = tfCore({ x: -coreR, y: 0, z: 0 });
    const octE3 = tfCore({ x: 0, y: 0, z: -coreR });

    const octFaces: [Vec3, Vec3, Vec3][] = [
      [octTop, octE0, octE1],
      [octTop, octE1, octE2],
      [octTop, octE2, octE3],
      [octTop, octE3, octE0],
      [octBot, octE1, octE0],
      [octBot, octE2, octE1],
      [octBot, octE3, octE2],
      [octBot, octE0, octE3],
    ];

    for (const [v0, v1, v2] of octFaces) {
      addFace(v0, v1, v2, v2, 0x228fa8, 0.55, WHITE, 0.95, 1.2);
    }

    // ── 5. Depth Sort (Painter's Algorithm) & Render to Pixi Graphics ─────────
    faces.sort((a, b) => a.avgZ - b.avgZ);

    this.mesh3D.clear();

    for (const f of faces) {
      const p = f.pts;
      if (p.length < 3) continue;

      this.mesh3D
        .poly([p[0].x, p[0].y, p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y])
        .fill({ color: f.fillColor, alpha: f.fillAlpha })
        .stroke({ color: f.strokeColor, width: f.strokeWidth, alpha: f.strokeAlpha });
    }
  }

  // ── Frame Update ──────────────────────────────────────────────────────────

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
    // 1. Calculate Target Yaw Angle (0 is straight UP, right is +, left is -)
    const dx = aimX - coreX;
    const dy = aimY - coreY; // Target is above on screen, so dy < 0

    // Math.atan2(dx, -dy):
    //   dx > 0 (aiming right) -> positive angle (rotates RIGHT)
    //   dx < 0 (aiming left)  -> negative angle (rotates LEFT)
    //   dx = 0 (center)       -> 0 angle (points straight UP)
    const targetAngle = clamp(Math.atan2(dx, -dy), -1.15, 1.15);

    // Smooth traversal interpolation
    this.currentAngle = mix(this.currentAngle, targetAngle, 1 - Math.exp(-dt * 14));

    // 2. Recoil Recovery
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 38);
    }

    // 3. Spinning Quantum Reactor Gyroscope
    this.reactorRot += dt * 2.8;

    // 4. Render 3D Projected Mesh
    this.render3D(this.currentAngle, this.recoil, time, damage);

    // 5. 3D Muzzle Flash Emitters (Projected at Muzzle Tips)
    this.muzzleFlash.clear();
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 6);
      const barrelLength = 68;
      for (const bx of [-13, 13]) {
        // Compute muzzle position at tip of barrel (y = barrelLength)
        const localMuzzle: Vec3 = {
          x: bx,
          y: barrelLength - this.recoil,
          z: 0,
        };
        const muzzle3D = this.rotZ(localMuzzle, this.currentAngle);
        const pr = this.project(muzzle3D);

        this.muzzleFlash
          .circle(pr.v2.x, pr.v2.y, 11 * this.flashAlpha)
          .fill({ color: WHITE, alpha: this.flashAlpha * 0.95 })
          .circle(pr.v2.x, pr.v2.y, 22 * this.flashAlpha)
          .fill({ color: CYAN_BRIGHT, alpha: this.flashAlpha * 0.5 })
          .circle(pr.v2.x, pr.v2.y, 38 * this.flashAlpha)
          .fill({ color: CYAN_GLOW, alpha: this.flashAlpha * 0.2 });
      }
    }

    // 6. Base Platform Telemetry & Calibration Rings
    this.basePlatform.clear();
    const pulse = Math.sin(time * 3);
    for (let i = 0; i < 3; i++) {
      const r = 70 + i * 16 + (i === 1 ? pulse * 2 : 0);
      this.basePlatform
        .ellipse(0, 10, r, r * 0.32)
        .stroke({
          color: CYAN,
          width: i === 1 ? 1.4 : 0.6,
          alpha: i === 1 ? 0.65 : 0.25,
        });
    }

    // Azimuth Compass Ticks
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI * 2) / 36;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const r1 = 76;
      const r2 = i % 3 === 0 ? 86 : 81;
      this.basePlatform
        .moveTo(cos * r1, 10 + sin * (r1 * 0.32))
        .lineTo(cos * r2, 10 + sin * (r2 * 0.32))
        .stroke({
          color: CYAN,
          width: i % 3 === 0 ? 1.2 : 0.5,
          alpha: i % 3 === 0 ? 0.65 : 0.25,
        });
    }

    // 7. Ambient Glow & Damage Flash
    this.glow.alpha = 0.75 + Math.sin(time * 2) * 0.2;
    this.container.tint =
      health < 35 || damage > 0 ? 0xff847d : health < 60 ? 0xb6dfea : 0xffffff;
  }
}
