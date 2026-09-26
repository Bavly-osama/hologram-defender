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

// Fixed directional light source (top-front-right)
const LIGHT: Vec3 = (() => {
  const lx = 0.35, ly = 0.75, lz = 0.55;
  const len = Math.hypot(lx, ly, lz);
  return { x: lx / len, y: ly / len, z: lz / len };
})();

export class CoreVisual {
  readonly container = new Container();

  // 2D Backdrop Glow & Telemetry Graphics
  private glow = new Graphics();
  private basePlatform = new Graphics();
  private mesh3D = new Graphics();
  private muzzleFlash = new Graphics();
  private telemetry = new Graphics();

  // Animation & Control State
  private currentYaw = 0;
  private currentPitch = 0;
  private recoil = 0;
  private flashAlpha = 0;
  private reactorRot = 0;

  // Camera parameters for 3D perspective projection (overhead isometric view)
  private readonly cosCam = Math.cos(0.44);
  private readonly sinCam = Math.sin(0.44);
  private readonly fov = 440;
  private readonly camDist = 520;

  constructor() {
    this.buildGlow();
    this.container.addChild(
      this.glow,
      this.basePlatform,
      this.mesh3D,
      this.muzzleFlash,
      this.telemetry,
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
    this.recoil = 12.0; // 3D units backward along barrel bore
    this.flashAlpha = 1.0;
  }

  // ── 3D Geometry Transform Pipeline ──────────────────────────────────────────

  /** Rotate vector around Y axis (Yaw - azimuth rotation) */
  private rotY(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: v.x * c + v.z * s,
      y: v.y,
      z: -v.x * s + v.z * c,
    };
  }

  /** Rotate vector around X axis (Pitch - elevation rotation) */
  private rotX(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: v.x,
      y: v.y * c - v.z * s,
      z: v.y * s + v.z * c,
    };
  }

  /** Rotate vector around Z axis (Roll) */
  private rotZ(v: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: v.x * c - v.y * s,
      y: v.x * s + v.y * c,
      z: v.z,
    };
  }

  /**
   * Transforms 3D world space coordinate into 2D camera viewport projection.
   * Coordinate convention:
   *   X: Lateral (left/right)
   *   Y: Elevation (up is +Y)
   *   Z: Depth (towards enemy is -Z, towards camera is +Z)
   */
  private project(p: Vec3): { v2: Vec2; camZ: number } {
    // Camera overhead pitch: tilt downward
    const yCam = p.y * this.cosCam - p.z * this.sinCam;
    const zCam = p.y * this.sinCam + p.z * this.cosCam;

    // Perspective projection
    const depth = this.camDist - zCam;
    const factor = this.fov / Math.max(10, depth);

    return {
      v2: {
        x: p.x * factor,
        y: -yCam * factor, // Invert Y for screen canvas coordinates
      },
      camZ: zCam,
    };
  }

  // ── 3D Procedural Mesh Generation ─────────────────────────────────────────

  private render3DCannon(
    yaw: number,
    pitch: number,
    recoil: number,
    time: number,
    damage: number,
  ) {
    const faces: ProjectedFace[] = [];

    // Helper: compute face normal & directional lighting
    const addQuad = (
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
      // Normal via cross product
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

      // Shading calculation based on normal dot light
      const dot = Math.max(0, normX * LIGHT.x + normY * LIGHT.y + normZ * LIGHT.z);
      const shadeAlpha = Math.min(0.85, baseAlpha + dot * 0.35);

      faces.push({
        pts: [pr0.v2, pr1.v2, pr2.v2, pr3.v2],
        avgZ,
        fillColor: baseColor,
        fillAlpha: shadeAlpha,
        strokeColor: dot > 0.5 ? CYAN_BRIGHT : strokeColor,
        strokeAlpha: Math.min(1.0, strokeAlpha + dot * 0.25),
        strokeWidth: dot > 0.5 ? strokeWidth * 1.15 : strokeWidth,
      });
    };

    // ── 1. 3D Cylindrical Pedestal / Base Turret Well ──────────────────────────
    const baseRadius = 52;
    const baseHeight = 16;
    const baseSegments = 16;
    const basePtsBottom: Vec3[] = [];
    const basePtsTop: Vec3[] = [];

    for (let i = 0; i < baseSegments; i++) {
      const a = (i * Math.PI * 2) / baseSegments;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      basePtsBottom.push({ x: cos * (baseRadius + 6), y: -baseHeight, z: sin * (baseRadius + 6) });
      basePtsTop.push({ x: cos * baseRadius, y: 0, z: sin * baseRadius });
    }

    // Pedestal sides
    for (let i = 0; i < baseSegments; i++) {
      const next = (i + 1) % baseSegments;
      addQuad(
        basePtsBottom[i],
        basePtsBottom[next],
        basePtsTop[next],
        basePtsTop[i],
        0x062832,
        0.35,
        CYAN,
        0.5,
        0.8,
      );
    }

    // ── 2. 3D Rotating Turret Hull (Yaw-coupled) ──────────────────────────────
    // Transform helper for turret chassis (rotates around Y axis)
    const tfTurret = (local: Vec3): Vec3 => {
      const r = this.rotY(local, yaw);
      return { x: r.x, y: r.y + 4, z: r.z };
    };

    // Armored beveled hexagonal turret core housing
    const hullR = 32;
    const hullH = 22;
    const hullSegments = 8;
    const hullBot: Vec3[] = [];
    const hullTop: Vec3[] = [];

    for (let i = 0; i < hullSegments; i++) {
      const a = (i * Math.PI * 2) / hullSegments + Math.PI / 8;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      hullBot.push(tfTurret({ x: cos * hullR, y: 0, z: sin * hullR }));
      hullTop.push(tfTurret({ x: cos * (hullR * 0.75), y: hullH, z: sin * (hullR * 0.75) }));
    }

    // Turret hull side plates
    for (let i = 0; i < hullSegments; i++) {
      const next = (i + 1) % hullSegments;
      addQuad(
        hullBot[i],
        hullBot[next],
        hullTop[next],
        hullTop[i],
        CYAN_DEEP,
        0.55,
        CYAN,
        0.85,
        1.2,
      );
    }

    // Turret top deck plate
    for (let i = 1; i < hullSegments - 1; i++) {
      addQuad(
        hullTop[0],
        hullTop[i],
        hullTop[i + 1],
        hullTop[i + 1],
        CYAN_CORE,
        0.65,
        CYAN_BRIGHT,
        0.95,
        1.3,
      );
    }

    // Side Armored Elevation Trunnions (Left & Right)
    for (const side of [-1, 1]) {
      const tx = side * (hullR * 0.95);
      const trunPts: Vec3[] = [];
      const trunR = 9;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        trunPts.push(
          tfTurret({
            x: tx + (side * 3),
            y: hullH * 0.55 + Math.sin(a) * trunR,
            z: Math.cos(a) * trunR,
          }),
        );
      }
      for (let i = 1; i < 5; i++) {
        addQuad(
          trunPts[0],
          trunPts[i],
          trunPts[i + 1],
          trunPts[i + 1],
          0x0c3e4d,
          0.7,
          CYAN_BRIGHT,
          0.95,
          1.2,
        );
      }
    }

    // ── 3. 3D Twin Railgun Barrels (Yaw + Pitch + Recoil) ──────────────────────
    // Transform helper for barrel assembly:
    // Local coords -> Pitch tilt -> Recoil slide -> Yaw rotation -> Turret mount pos
    const tfBarrel = (local: Vec3): Vec3 => {
      // 1. Recoil along Z axis (into turret)
      const recoiled: Vec3 = {
        x: local.x,
        y: local.y,
        z: local.z + recoil,
      };
      // 2. Pitch tilt around X axis (elevation towards enemy)
      const pitched = this.rotX(recoiled, pitch);
      // 3. Yaw rotation around Y axis (traverse towards target)
      const yawed = this.rotY(pitched, yaw);
      // 4. Offset to trunnion pivot height
      return {
        x: yawed.x,
        y: yawed.y + hullH * 0.55,
        z: yawed.z,
      };
    };

    // Twin Heavy Railgun Barrels
    const barrelLength = 68;
    const barrelHalfW = 4.2;
    const barrelHalfH = 4.2;
    const barrelOffsetsX = [-13, 13];

    for (const bx of barrelOffsetsX) {
      // 8 vertices of 3D rectangular barrel box
      // Barrel points along -Z axis (forward into screen)
      const b0 = tfBarrel({ x: bx - barrelHalfW, y: -barrelHalfH, z: 8 });
      const b1 = tfBarrel({ x: bx + barrelHalfW, y: -barrelHalfH, z: 8 });
      const b2 = tfBarrel({ x: bx + barrelHalfW, y: barrelHalfH, z: 8 });
      const b3 = tfBarrel({ x: bx - barrelHalfW, y: barrelHalfH, z: 8 });

      const f0 = tfBarrel({ x: bx - barrelHalfW, y: -barrelHalfH, z: -barrelLength });
      const f1 = tfBarrel({ x: bx + barrelHalfW, y: -barrelHalfH, z: -barrelLength });
      const f2 = tfBarrel({ x: bx + barrelHalfW, y: barrelHalfH, z: -barrelLength });
      const f3 = tfBarrel({ x: bx - barrelHalfW, y: barrelHalfH, z: -barrelLength });

      // Bottom face
      addQuad(b0, b1, f1, f0, 0x05202a, 0.45, CYAN, 0.7, 1.0);
      // Top face
      addQuad(b3, b2, f2, f3, 0x145a6c, 0.65, CYAN_BRIGHT, 0.95, 1.3);
      // Outer side face
      if (bx > 0) {
        addQuad(b1, b2, f2, f1, 0x0a3b49, 0.55, CYAN, 0.85, 1.1);
      } else {
        addQuad(b0, b3, f3, f0, 0x0a3b49, 0.55, CYAN, 0.85, 1.1);
      }
      // Inner side face
      if (bx > 0) {
        addQuad(b0, b3, f3, f0, 0x072834, 0.4, CYAN, 0.75, 0.9);
      } else {
        addQuad(b1, b2, f2, f1, 0x072834, 0.4, CYAN, 0.75, 0.9);
      }
      // Front muzzle face (with dark hollow bore)
      addQuad(f0, f1, f2, f3, 0x021117, 0.85, WHITE, 0.95, 1.4);

      // 4 Volumetric Magnetic Accelerator Rings per barrel
      for (const coilZ of [-14, -28, -42, -56]) {
        const ringHw = barrelHalfW + 2.5;
        const ringHh = barrelHalfH + 2.5;
        const ringLen = 4.5;
        const coilPulse = Math.sin(time * 5 + coilZ * 0.1) * 0.1;
        const ringColor = damage > 0 ? 0x8a2424 : 0x1d758c;

        const rb0 = tfBarrel({ x: bx - ringHw, y: -ringHh, z: coilZ + ringLen / 2 });
        const rb1 = tfBarrel({ x: bx + ringHw, y: -ringHh, z: coilZ + ringLen / 2 });
        const rb2 = tfBarrel({ x: bx + ringHw, y: ringHh, z: coilZ + ringLen / 2 });
        const rb3 = tfBarrel({ x: bx - ringHw, y: ringHh, z: coilZ + ringLen / 2 });

        const rf0 = tfBarrel({ x: bx - ringHw, y: -ringHh, z: coilZ - ringLen / 2 });
        const rf1 = tfBarrel({ x: bx + ringHw, y: -ringHh, z: coilZ - ringLen / 2 });
        const rf2 = tfBarrel({ x: bx + ringHw, y: ringHh, z: coilZ - ringLen / 2 });
        const rf3 = tfBarrel({ x: bx - ringHw, y: ringHh, z: coilZ - ringLen / 2 });

        // Ring Top
        addQuad(rb3, rb2, rf2, rf3, ringColor, 0.75 + coilPulse, CYAN_BRIGHT, 1.0, 1.4);
        // Ring Sides
        addQuad(rb1, rb2, rf2, rf1, 0x145a6c, 0.65 + coilPulse, CYAN, 0.9, 1.1);
        addQuad(rb0, rb3, rf3, rf0, 0x145a6c, 0.65 + coilPulse, CYAN, 0.9, 1.1);
      }
    }

    // Heavy Armor Cross-Bridge between barrels
    for (const bridgeZ of [-20, -48]) {
      const cr0 = tfBarrel({ x: -13, y: 1.5, z: bridgeZ + 3 });
      const cr1 = tfBarrel({ x: 13, y: 1.5, z: bridgeZ + 3 });
      const cr2 = tfBarrel({ x: 13, y: -1.5, z: bridgeZ + 3 });
      const cr3 = tfBarrel({ x: -13, y: -1.5, z: bridgeZ + 3 });
      const cf0 = tfBarrel({ x: -13, y: 1.5, z: bridgeZ - 3 });
      const cf1 = tfBarrel({ x: 13, y: 1.5, z: bridgeZ - 3 });
      const cf2 = tfBarrel({ x: 13, y: -1.5, z: bridgeZ - 3 });
      const cf3 = tfBarrel({ x: -13, y: -1.5, z: bridgeZ - 3 });

      addQuad(cr0, cr1, cf1, cf0, 0x124d5d, 0.65, CYAN, 0.85, 1.1);
      addQuad(cr3, cr2, cf2, cf3, 0x082730, 0.45, CYAN, 0.75, 1.0);
    }

    // ── 4. 3D Volumetric Quantum Reactor Core ────────────────────────────────
    // Spinning 3D Gyroscopic Octahedron in the breech
    const coreR = 11;
    const rx = this.reactorRot;
    const ry = this.reactorRot * 1.4;
    const rz = this.reactorRot * 0.7;

    const tfCore = (local: Vec3): Vec3 => {
      // 3D gyroscopic rotation
      let r = this.rotX(local, rx);
      r = this.rotY(r, ry);
      r = this.rotZ(r, rz);
      // Position at breech
      r.y += hullH * 0.75;
      r.z += 4;
      // Follow turret yaw
      return tfTurret(r);
    };

    // 6 vertices of an Octahedron
    const octTop = tfCore({ x: 0, y: coreR, z: 0 });
    const octBot = tfCore({ x: 0, y: -coreR, z: 0 });
    const octE0 = tfCore({ x: coreR, y: 0, z: 0 });
    const octE1 = tfCore({ x: 0, y: 0, z: coreR });
    const octE2 = tfCore({ x: -coreR, y: 0, z: 0 });
    const octE3 = tfCore({ x: 0, y: 0, z: -coreR });

    // 8 triangular faces of the 3D spinning reactor
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
      addQuad(v0, v1, v2, v2, 0x228fa8, 0.5, WHITE, 0.95, 1.2);
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
    // 1. Calculate Target Yaw & Pitch in 3D Space
    const dx = aimX - coreX;
    const dy = aimY - coreY; // Target is above, so dy < 0

    // Target Yaw (traverse left/right)
    const targetYaw = clamp(Math.atan2(dx, -dy), -1.15, 1.15);

    // Target Pitch (barrel elevation angle up/down depending on distance)
    // Closer targets -> lower elevation; far targets -> higher elevation
    const targetPitch = clamp(mix(0.08, 0.38, (coreY - aimY) / 600), 0.05, 0.45);

    // Smooth traversal interpolation
    this.currentYaw = mix(this.currentYaw, targetYaw, 1 - Math.exp(-dt * 12));
    this.currentPitch = mix(this.currentPitch, targetPitch, 1 - Math.exp(-dt * 10));

    // 2. Recoil Recovery
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 38);
    }

    // 3. Spinning Quantum Reactor Gyroscope
    this.reactorRot += dt * 2.8;

    // 4. Render 3D Projected Mesh
    this.render3DCannon(this.currentYaw, this.currentPitch, this.recoil, time, damage);

    // 5. 3D Muzzle Flash Emitters (Projected at Muzzle Tips)
    this.muzzleFlash.clear();
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 6);
      const barrelLength = 68;
      for (const bx of [-13, 13]) {
        // Compute muzzle position in 3D
        const recoiled: Vec3 = { x: bx, y: 0, z: -barrelLength + this.recoil };
        const pitched = this.rotX(recoiled, this.currentPitch);
        const yawed = this.rotY(pitched, this.currentYaw);
        const muzzle3D: Vec3 = { x: yawed.x, y: yawed.y + 12, z: yawed.z };
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
