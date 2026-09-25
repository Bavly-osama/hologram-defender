import { Assets, Spritesheet, Texture, type SpritesheetData } from "pixi.js";
import { assetManifest, type AssetId } from "./AssetManifest";
// Procedural source art is baked once into atlases. Replace manifest atlas URLs
// with TexturePacker JSON (PNG/WebP + animations) without changing gameplay.
export class SpriteSheetManager {
  private sheets = new Map<AssetId, Spritesheet>();
  warnings: string[] = [];
  async load(progress: (value: number) => void) {
    const entries = Object.entries(assetManifest) as [
      AssetId,
      { kind: string; atlas: string },
    ][];
    for (let i = 0; i < entries.length; i++) {
      const [id, entry] = entries[i];
      let sheet: Spritesheet | undefined;
      if (entry.atlas) {
        try {
          sheet = await Assets.load<Spritesheet>(entry.atlas);
        } catch {
          this.warnings.push(`${id}: using procedural fallback`);
        }
      }
      this.sheets.set(id, sheet ?? (await this.generate(entry.kind)));
      progress((i + 1) / entries.length);
    }
  }
  frames(id: AssetId, state = "MOVE"): Texture[] {
    const sheet = this.sheets.get(id);
    if (!sheet) return [];
    return sheet.animations[state] ?? sheet.animations.MOVE ?? [];
  }
  private async generate(kind: string) {
    const isBoss =
      kind === "boss" ||
      kind === "mars_war_machine" ||
      kind === "void_leviathan" ||
      kind === "fracture_architect";
    const size = isBoss ? 256 : 128,
      count = 8;
    const canvas = document.createElement("canvas");
    canvas.width = size * count;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const frames: SpritesheetData["frames"] = {};
    for (let frame = 0; frame < count; frame++) {
      ctx.save();
      ctx.translate(frame * size + size / 2, size / 2);
      ctx.scale(size / 128, size / 128);
      this.draw(ctx, kind, frame / count);
      ctx.restore();
      frames[`frame${frame}`] = {
        frame: { x: frame * size, y: 0, w: size, h: size },
        sourceSize: { w: size, h: size },
        spriteSourceSize: { x: 0, y: 0, w: size, h: size },
      };
    }
    const names = Array.from({ length: count }, (_, i) => `frame${i}`);
    const sheet = new Spritesheet(Texture.from(canvas), {
      frames,
      meta: { scale: "1" },
      animations: {
        SPAWN: names,
        MOVE: names,
        ATTACK: [...names].reverse(),
        HIT: [names[4], names[5]],
        DEATH: names,
      },
    });
    await sheet.parse();
    return sheet;
  }
  private draw(c: CanvasRenderingContext2D, kind: string, time: number) {
    const pulse = 0.75 + Math.sin(time * Math.PI * 2) * 0.25;
    if (kind === "scout") {
      this.drawScout(c, time, pulse);
    } else if (kind === "orb") {
      this.drawOrb(c, time, pulse);
    } else if (kind === "heavy") {
      this.drawHeavy(c, time, pulse);
    } else if (kind === "mars_rover") {
      this.drawMarsRover(c, time, pulse);
    } else if (kind === "phase_striker") {
      this.drawPhaseStriker(c, time, pulse);
    } else if (kind === "magma_walker") {
      this.drawMagmaWalker(c, time, pulse);
    } else if (kind === "storm_drone") {
      this.drawStormDrone(c, time, pulse);
    } else if (kind === "splitter") {
      this.drawSplitter(c, time, pulse);
    } else if (kind === "splitter_mini") {
      this.drawSplitterMini(c, time, pulse);
    } else if (kind === "abyss_ray") {
      this.drawAbyssRay(c, time, pulse);
    } else if (kind === "mimic_drone") {
      this.drawMimicDrone(c, time, pulse);
    } else if (kind === "null_hunter") {
      this.drawNullHunter(c, time, pulse);
    } else if (kind === "entropy_core") {
      this.drawEntropyCore(c, time, pulse);
    } else if (kind === "boss") {
      this.drawBoss(c, time, pulse);
    } else if (kind === "mars_war_machine") {
      this.drawMarsWarMachine(c, time, pulse);
    } else if (kind === "void_leviathan") {
      this.drawVoidLeviathan(c, time, pulse);
    } else if (kind === "fracture_architect") {
      this.drawFractureArchitect(c, time, pulse);
    } else {
      this.drawFx(c, kind, time);
    }
  }

  private drawScout(c: CanvasRenderingContext2D, time: number, pulse: number) {
    // Helper: draw shaded polygon
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. 2.5D Ground / Space Drop Shadow (separates drone from background)
    c.save();
    c.translate(0, 10);
    poly(
      [-46, -12, -22, -6, 0, -22, 22, -6, 46, -12, 28, 22, 0, 32, -28, 22],
      "rgba(4, 9, 14, 0.45)",
    );
    c.restore();

    // 2. Twin Ion Thruster Plumes (Rear)
    const plumeLen = 14 + pulse * 12 + Math.sin(time * 28) * 3;
    for (const tx of [-18, 18]) {
      const grad = c.createLinearGradient(tx, 16, tx, 16 + plumeLen);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.2, "#40f4ff");
      grad.addColorStop(0.65, "#ff4b36");
      grad.addColorStop(1, "transparent");
      c.beginPath();
      c.moveTo(tx - 4, 16);
      c.lineTo(tx + 4, 16);
      c.lineTo(tx, 16 + plumeLen);
      c.closePath();
      c.fillStyle = grad;
      c.fill();

      // Outer heat glow
      const hg = c.createRadialGradient(tx, 16, 2, tx, 16, 12);
      hg.addColorStop(0, "rgba(255, 75, 54, 0.7)");
      hg.addColorStop(1, "transparent");
      c.fillStyle = hg;
      c.fillRect(tx - 12, 4, 24, 24);
    }

    // 3. Lower Chassis & Mechanical Engine Nacelles (Dark Titanium)
    const chassisGrad = c.createLinearGradient(0, -24, 0, 24);
    chassisGrad.addColorStop(0, "#19252e");
    chassisGrad.addColorStop(1, "#0d1419");
    poly(
      [-48, -14, -20, -8, 0, -26, 20, -8, 48, -14, 28, 20, 11, 14, 0, 26, -11, 14, -28, 20],
      chassisGrad,
      "#080c10",
      1.5,
    );

    // 4. Swept Wing Plates with 2.5D Directional Lighting (Top Lit)
    // Left Wing Upper Facet
    const lUpper = c.createLinearGradient(-48, -18, -10, 8);
    lUpper.addColorStop(0, "#3a5160");
    lUpper.addColorStop(0.6, "#24343e");
    lUpper.addColorStop(1, "#18232a");
    poly([-48, -14, -20, -8, -12, 8, -34, 16], lUpper, "#56778c", 0.8);

    // Left Wing Lower Bevel (In Shadow)
    const lLower = c.createLinearGradient(-34, 16, -20, -8);
    lLower.addColorStop(0, "#0f161c");
    lLower.addColorStop(1, "#18232a");
    poly([-48, -14, -34, 16, -24, 18, -20, -8], lLower);

    // Right Wing Upper Facet
    const rUpper = c.createLinearGradient(48, -18, 10, 8);
    rUpper.addColorStop(0, "#3a5160");
    rUpper.addColorStop(0.6, "#24343e");
    rUpper.addColorStop(1, "#18232a");
    poly([48, -14, 20, -8, 12, 8, 34, 16], rUpper, "#56778c", 0.8);

    // Right Wing Lower Bevel (In Shadow)
    const rLower = c.createLinearGradient(34, 16, 20, -8);
    rLower.addColorStop(0, "#0f161c");
    rLower.addColorStop(1, "#18232a");
    poly([48, -14, 34, 16, 24, 18, 20, -8], rLower);

    // Wing Leading Edge Chamfer Bevels (Crisp Crimson/Cyan Highlights)
    c.beginPath();
    c.moveTo(-48, -14);
    c.lineTo(-20, -8);
    c.lineTo(0, -26);
    c.lineTo(20, -8);
    c.lineTo(48, -14);
    c.strokeStyle = "#ff786e";
    c.lineWidth = 1.2;
    c.stroke();

    // 5. Central Raised Fuselage Spine & Cockpit Citadel
    const spineGrad = c.createLinearGradient(-10, 0, 10, 0);
    spineGrad.addColorStop(0, "#1c2b33");
    spineGrad.addColorStop(0.3, "#3d5766");
    spineGrad.addColorStop(0.7, "#3d5766");
    spineGrad.addColorStop(1, "#121b21");
    poly([0, -28, 10, -8, 8, 16, 0, 24, -8, 16, -10, -8], spineGrad, "#648b9f", 1);

    // Fuselage Dorsal Ridge Highlight
    c.beginPath();
    c.moveTo(0, -28);
    c.lineTo(0, 24);
    c.strokeStyle = "#80b2cc";
    c.lineWidth = 1;
    c.stroke();

    // 6. Holographic Optical Visor / Sensor Eye with Animated Sweep
    const eyeGrad = c.createRadialGradient(0, -4, 0, 0, -4, 16);
    eyeGrad.addColorStop(0, "#ff4033");
    eyeGrad.addColorStop(0.6, "#c41c10");
    eyeGrad.addColorStop(1, "transparent");
    c.fillStyle = eyeGrad;
    c.fillRect(-16, -12, 32, 16);

    // Visor Glass Slit
    poly([-9, -4, -6, -7, 6, -7, 9, -4, 6, -1, -6, -1], "#1a0808", "#ff5447", 1);
    // Scanning beam
    const scanX = Math.sin(time * 8) * 6;
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(scanX, -4, 2, 0, Math.PI * 2);
    c.fill();

    // 7. Wingtip Micro Plasma Blasters
    for (const bx of [-48, 48]) {
      c.fillStyle = "#22313a";
      c.fillRect(bx > 0 ? bx - 2 : bx - 4, -18, 6, 8);
      c.fillStyle = "#ff6347";
      c.fillRect(bx > 0 ? bx - 1 : bx - 3, -20, 4, 3);
    }
  }

  private drawOrb(c: CanvasRenderingContext2D, time: number, pulse: number) {
    const r = 24;

    // 1. Back Arc of Tilted 2.5D Gimbal Ring 1 (Draws BEHIND the sphere for true 2.5D depth)
    const ang1 = time * 2.2;
    c.save();
    c.rotate(0.35);
    c.beginPath();
    c.ellipse(0, 0, 36, 12, ang1, Math.PI, Math.PI * 2);
    c.strokeStyle = "#80351b";
    c.lineWidth = 1.8;
    c.stroke();
    c.restore();

    // Back Arc of Ring 2 (Counter-rotating)
    const ang2 = -time * 1.8;
    c.save();
    c.rotate(-0.4);
    c.beginPath();
    c.ellipse(0, 0, 38, 14, ang2, Math.PI, Math.PI * 2);
    c.strokeStyle = "#6b2a14";
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();

    // 2. Volumetric 3D Shaded Core Sphere
    // Multi-stop radial gradient with light source offset towards top-left (-8, -8)
    const sphereGrad = c.createRadialGradient(-7, -7, 1, 0, 0, r);
    sphereGrad.addColorStop(0, "#fff5ea");
    sphereGrad.addColorStop(0.18, "#ff8d47");
    sphereGrad.addColorStop(0.5, "#962c16");
    sphereGrad.addColorStop(0.82, "#240b0f");
    sphereGrad.addColorStop(0.96, "#120608");
    sphereGrad.addColorStop(1, "#183e4a"); // Subtle cyan atmosphere rim light!

    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = sphereGrad;
    c.fill();
    c.strokeStyle = "#ff7a3d";
    c.lineWidth = 1.2;
    c.stroke();

    // Geodesic / Latitude Surface Rings on the Sphere (giving curved 3D volume)
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.ellipse(0, i * 9, Math.sqrt(Math.max(1, r * r - i * i * 81)), 5, 0, 0, Math.PI * 2);
      c.strokeStyle = "rgba(255, 140, 75, 0.25)";
      c.lineWidth = 0.8;
      c.stroke();
    }

    // 3. Front Arc of Tilted 2.5D Gimbal Ring 1 (Draws IN FRONT of the sphere!)
    c.save();
    c.rotate(0.35);
    c.beginPath();
    c.ellipse(0, 0, 36, 12, ang1, 0, Math.PI);
    c.strokeStyle = "#ffa05c";
    c.lineWidth = 2.4;
    c.stroke();

    // Gyro Orbit Stabilizer Nodes
    const nx1 = Math.cos(ang1) * 36;
    const ny1 = Math.sin(ang1) * 12;
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(nx1, ny1, 2.5, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Front Arc of Ring 2 (In front of sphere)
    c.save();
    c.rotate(-0.4);
    c.beginPath();
    c.ellipse(0, 0, 38, 14, ang2, 0, Math.PI);
    c.strokeStyle = "#ff7e38";
    c.lineWidth = 2.0;
    c.stroke();
    const nx2 = Math.cos(ang2) * 38;
    const ny2 = Math.sin(ang2) * 14;
    c.fillStyle = "#ffe2b8";
    c.beginPath();
    c.arc(nx2, ny2, 2.2, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 4. Central Singularity / Coronal Solar Eruptions
    const coreGrad = c.createRadialGradient(0, 0, 0, 0, 0, 14 + pulse * 6);
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.3, "#ffbc42");
    coreGrad.addColorStop(0.7, "#ff4b2b");
    coreGrad.addColorStop(1, "transparent");
    c.fillStyle = coreGrad;
    c.beginPath();
    c.arc(0, 0, 14 + pulse * 6, 0, Math.PI * 2);
    c.fill();

    // Micro Electric Arc Filaments
    c.strokeStyle = "#fff0c2";
    c.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + time * 4;
      c.beginPath();
      c.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      c.lineTo(Math.cos(a + 0.3) * (14 + pulse * 4), Math.sin(a + 0.3) * (14 + pulse * 4));
      c.lineTo(Math.cos(a + 0.1) * (22 + pulse * 5), Math.sin(a + 0.1) * (22 + pulse * 5));
      c.stroke();
    }
  }

  private drawHeavy(c: CanvasRenderingContext2D, time: number, pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. 2.5D Heavy Drop Shadow
    c.save();
    c.translate(0, 12);
    poly(
      [-48, -26, -18, -40, 18, -40, 48, -26, 52, 24, 26, 44, -26, 44, -52, 24],
      "rgba(4, 6, 12, 0.5)",
    );
    c.restore();

    // 2. Quad Heavy Thrusters & Radiator Flames (Aft)
    for (const tx of [-32, -14, 14, 32]) {
      const fl = 10 + pulse * 8 + Math.sin(time * 24 + tx) * 3;
      const thGrad = c.createLinearGradient(tx, 38, tx, 38 + fl);
      thGrad.addColorStop(0, "#ffffff");
      thGrad.addColorStop(0.3, "#c442ff");
      thGrad.addColorStop(0.7, "#e43d78");
      thGrad.addColorStop(1, "transparent");
      c.beginPath();
      c.moveTo(tx - 3.5, 38);
      c.lineTo(tx + 3.5, 38);
      c.lineTo(tx, 38 + fl);
      c.closePath();
      c.fillStyle = thGrad;
      c.fill();
    }

    // 3. Base Armored Chassis (Dark Gunmetal Alloy)
    const baseGrad = c.createLinearGradient(0, -42, 0, 42);
    baseGrad.addColorStop(0, "#2c2a38");
    baseGrad.addColorStop(0.5, "#1b1924");
    baseGrad.addColorStop(1, "#121017");
    poly(
      [-44, -30, -16, -42, 16, -42, 44, -30, 48, 22, 24, 40, -24, 40, -48, 22],
      baseGrad,
      "#0f0d14",
      1.5,
    );

    // 4. Side Armor Sponsons with 3D Bevels & Hazard Chevrons
    // Left Sponson Plate
    const lSponson = c.createLinearGradient(-48, -28, -20, 20);
    lSponson.addColorStop(0, "#484354");
    lSponson.addColorStop(0.5, "#302b3a");
    lSponson.addColorStop(1, "#1e1b24");
    poly([-44, -28, -20, -34, -16, 28, -42, 20], lSponson, "#7c728a", 1);

    // Hazard Stripes on Left Sponson
    c.save();
    c.beginPath();
    c.rect(-40, -6, 20, 16);
    c.clip();
    for (let i = -10; i < 30; i += 7) {
      c.beginPath();
      c.moveTo(-45 + i, -10);
      c.lineTo(-35 + i, 15);
      c.strokeStyle = "#e59e35";
      c.lineWidth = 3;
      c.stroke();
    }
    c.restore();

    // Right Sponson Plate
    const rSponson = c.createLinearGradient(48, -28, 20, 20);
    rSponson.addColorStop(0, "#484354");
    rSponson.addColorStop(0.5, "#302b3a");
    rSponson.addColorStop(1, "#1e1b24");
    poly([44, -28, 20, -34, 16, 28, 42, 20], rSponson, "#7c728a", 1);

    // Hazard Stripes on Right Sponson
    c.save();
    c.beginPath();
    c.rect(20, -6, 20, 16);
    c.clip();
    for (let i = -10; i < 30; i += 7) {
      c.beginPath();
      c.moveTo(15 + i, -10);
      c.lineTo(25 + i, 15);
      c.strokeStyle = "#e59e35";
      c.lineWidth = 3;
      c.stroke();
    }
    c.restore();

    // 5. Twin Forward Heavy Railgun Barrels (Extending to -50)
    for (const bx of [-12, 12]) {
      // Cylindrical 2.5D shading
      const bg = c.createLinearGradient(bx - 4, 0, bx + 4, 0);
      bg.addColorStop(0, "#26222b");
      bg.addColorStop(0.3, "#544e5f");
      bg.addColorStop(0.7, "#544e5f");
      bg.addColorStop(1, "#1a1620");
      c.fillStyle = bg;
      c.fillRect(bx - 3.5, -50, 7, 26);
      c.strokeStyle = "#807691";
      c.lineWidth = 0.8;
      c.strokeRect(bx - 3.5, -50, 7, 26);

      // Magnetic Accelerator Rings
      for (const my of [-46, -38, -30]) {
        c.fillStyle = "#e0487d";
        c.fillRect(bx - 4.5, my, 9, 2);
      }
      // Glowing Muzzle
      c.fillStyle = "#ff70a0";
      c.fillRect(bx - 2.5, -52, 5, 2.5);
    }

    // 6. Central Elevated Command Citadel & Heavy Plasma Reactor
    const citadelGrad = c.createLinearGradient(0, -36, 0, 24);
    citadelGrad.addColorStop(0, "#50485c");
    citadelGrad.addColorStop(0.5, "#332c3d");
    citadelGrad.addColorStop(1, "#211c29");
    poly([-16, -34, 16, -34, 18, 24, -18, 24], citadelGrad, "#a899bc", 1.2);

    // Heavy Slit Optical Sensor
    c.fillStyle = "#120814";
    c.fillRect(-12, -22, 24, 6);
    c.fillStyle = "#ff2e74";
    c.fillRect(-10, -21, 20, 4);
    c.fillStyle = "#ffffff";
    c.fillRect(-2, -21, 4, 4);

    // Glowing Heavy Reactor Core Grill
    const reactGrad = c.createRadialGradient(0, 4, 0, 0, 4, 14);
    reactGrad.addColorStop(0, "#ffffff");
    reactGrad.addColorStop(0.3, "#e43d78");
    reactGrad.addColorStop(1, "transparent");
    c.fillStyle = reactGrad;
    c.fillRect(-14, -6, 28, 20);

    for (let y = -4; y <= 10; y += 4) {
      c.fillStyle = "#18101a";
      c.fillRect(-10, y, 20, 2);
    }
  }

  private drawBoss(c: CanvasRenderingContext2D, time: number, pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Deep Space Gravitational Distortion Corona
    const corona = c.createRadialGradient(0, 0, 20, 0, 0, 68);
    corona.addColorStop(0, "rgba(255, 75, 43, 0.45)");
    corona.addColorStop(0.5, "rgba(200, 30, 20, 0.18)");
    corona.addColorStop(1, "transparent");
    c.fillStyle = corona;
    c.beginPath();
    c.arc(0, 0, 68, 0, Math.PI * 2);
    c.fill();

    // 2. Outer Kinetic Armor Shield Petals (6 Articulated Armor Plates Rotating)
    const rotSpeed = time * Math.PI * 0.35;
    c.save();
    c.rotate(rotSpeed);
    for (let i = 0; i < 6; i++) {
      c.rotate(Math.PI / 3);
      // Petal 3D faceted geometry
      const pGrad = c.createLinearGradient(0, -58, 0, -32);
      pGrad.addColorStop(0, "#4a3c3b");
      pGrad.addColorStop(0.5, "#2a2223");
      pGrad.addColorStop(1, "#171213");
      poly([-16, -42, -12, -58, 12, -58, 16, -42, 8, -30, -8, -30], pGrad, "#9e7772", 1.2);

      // Embedded Glowing Conduit on each petal
      c.beginPath();
      c.moveTo(0, -56);
      c.lineTo(0, -34);
      c.strokeStyle = "#ff5733";
      c.lineWidth = 1.8;
      c.stroke();

      // Lateral Chevron Highlights
      c.beginPath();
      c.moveTo(-10, -54);
      c.lineTo(-14, -44);
      c.moveTo(10, -54);
      c.lineTo(14, -44);
      c.strokeStyle = "#ff8c69";
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();

    // 3. Middle Counter-Rotating Gear Ring with Sensor Nodes
    c.save();
    c.rotate(-rotSpeed * 0.7);
    c.beginPath();
    c.arc(0, 0, 36, 0, Math.PI * 2);
    c.strokeStyle = "#5a433f";
    c.lineWidth = 3.5;
    c.stroke();

    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      c.fillStyle = i % 2 ? "#ff7c4d" : "#241919";
      c.beginPath();
      c.arc(Math.cos(a) * 36, Math.sin(a) * 36, i % 2 ? 3 : 2, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // 4. Central Quantum Core Sphere (Volumetric 3D Shading)
    const cr = 28;
    const coreGrad = c.createRadialGradient(-8, -8, 1, 0, 0, cr);
    coreGrad.addColorStop(0, "#fff5e8");
    coreGrad.addColorStop(0.2, "#ff6b3d");
    coreGrad.addColorStop(0.55, "#8a1e19");
    coreGrad.addColorStop(0.85, "#22090b");
    coreGrad.addColorStop(1, "#214e5b"); // Subtle cyan outer horizon
    c.beginPath();
    c.arc(0, 0, cr, 0, Math.PI * 2);
    c.fillStyle = coreGrad;
    c.fill();
    c.strokeStyle = "#ff9366";
    c.lineWidth = 1.8;
    c.stroke();

    // 3D Orbital Rings with Perspective Foreshortening
    c.beginPath();
    c.ellipse(0, 0, 26, 12, 0.4, 0, Math.PI * 2);
    c.strokeStyle = "rgba(255, 140, 80, 0.55)";
    c.lineWidth = 1.2;
    c.stroke();

    c.beginPath();
    c.ellipse(0, 0, 26, 12, -0.4, 0, Math.PI * 2);
    c.strokeStyle = "rgba(255, 90, 60, 0.4)";
    c.lineWidth = 1.0;
    c.stroke();

    // 5. Pulsating Singularity Eye & Coronal Coruscation
    const eyeR = 8 + pulse * 4;
    const singGrad = c.createRadialGradient(0, 0, 0, 0, 0, eyeR);
    singGrad.addColorStop(0, "#ffffff");
    singGrad.addColorStop(0.35, "#ffea78");
    singGrad.addColorStop(0.7, "#ff4019");
    singGrad.addColorStop(1, "transparent");
    c.fillStyle = singGrad;
    c.beginPath();
    c.arc(0, 0, eyeR, 0, Math.PI * 2);
    c.fill();
  }

  private drawPhaseStriker(c: CanvasRenderingContext2D, time: number, pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Phasing energy shadow / distortion field
    c.save();
    c.translate(0, 8);
    poly([-42, -10, 0, -28, 42, -10, 24, 26, 0, 34, -24, 26], "rgba(30, 8, 4, 0.45)");
    c.restore();

    // 2. Twin high-speed Martian thruster plumes
    for (const tx of [-14, 14]) {
      const fl = 16 + pulse * 12;
      const thGrad = c.createLinearGradient(tx, 16, tx, 16 + fl);
      thGrad.addColorStop(0, "#ffffff");
      thGrad.addColorStop(0.2, "#ffaa33");
      thGrad.addColorStop(0.7, "#ff3311");
      thGrad.addColorStop(1, "transparent");
      c.beginPath();
      c.moveTo(tx - 3, 16);
      c.lineTo(tx + 3, 16);
      c.lineTo(tx, 16 + fl);
      c.fillStyle = thGrad;
      c.fill();
    }

    // 3. Swept razor-wing hull (Martian rust & scorched carbon)
    const hullGrad = c.createLinearGradient(0, -32, 0, 28);
    hullGrad.addColorStop(0, "#c84a2b");
    hullGrad.addColorStop(0.5, "#6e2114");
    hullGrad.addColorStop(1, "#1c0d0a");
    poly(
      [-44, -8, -18, -4, 0, -32, 18, -4, 44, -8, 22, 22, 0, 28, -22, 22],
      hullGrad,
      "#e56b43",
      1.2,
    );

    // 4. Forward Phasing Blade Edges (Glowing Amber/Crimson)
    c.beginPath();
    c.moveTo(-44, -8);
    c.lineTo(0, -32);
    c.lineTo(44, -8);
    c.strokeStyle = "#ffb076";
    c.lineWidth = 1.5;
    c.stroke();

    // 5. Central Tachyon Phase Emitter
    const emitGrad = c.createRadialGradient(0, 0, 0, 0, 0, 10 + pulse * 4);
    emitGrad.addColorStop(0, "#ffffff");
    emitGrad.addColorStop(0.4, "#ff9933");
    emitGrad.addColorStop(0.8, "#d92b00");
    emitGrad.addColorStop(1, "transparent");
    c.fillStyle = emitGrad;
    c.beginPath();
    c.arc(0, 0, 10 + pulse * 4, 0, Math.PI * 2);
    c.fill();

    // Tachyon phase pulse rings
    c.strokeStyle = "rgba(255, 170, 70, 0.6)";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(0, 0, 18 + pulse * 6, 8, time * 3, 0, Math.PI * 2);
    c.stroke();
  }

  private drawStormDrone(c: CanvasRenderingContext2D, time: number, pulse: number) {
    // 1. Triangular lightning stator pylon arms
    const ang = time * Math.PI * 1.5;
    c.save();
    c.rotate(ang);
    for (let i = 0; i < 3; i++) {
      c.rotate((Math.PI * 2) / 3);
      // Pylon arm
      const pGrad = c.createLinearGradient(0, -32, 0, 0);
      pGrad.addColorStop(0, "#123048");
      pGrad.addColorStop(0.7, "#25537a");
      pGrad.addColorStop(1, "#0d2030");
      c.fillStyle = pGrad;
      c.beginPath();
      c.moveTo(-6, 0);
      c.lineTo(6, 0);
      c.lineTo(3, -34);
      c.lineTo(-3, -34);
      c.closePath();
      c.fill();
      c.strokeStyle = "#50b5e8";
      c.lineWidth = 1;
      c.stroke();

      // Pylon electrode orb
      c.fillStyle = "#a8f5ff";
      c.beginPath();
      c.arc(0, -34, 3.5, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // 2. Crackling Lightning Arcs between rotating electrodes
    c.strokeStyle = "#e0faff";
    c.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const a1 = ang + (i * Math.PI * 2) / 3;
      const a2 = ang + (((i + 1) % 3) * Math.PI * 2) / 3;
      const x1 = Math.sin(a1) * 34,
        y1 = -Math.cos(a1) * 34;
      const x2 = Math.sin(a2) * 34,
        y2 = -Math.cos(a2) * 34;
      const mx = (x1 + x2) / 2 + (Math.sin(time * 30 + i) * 6);
      const my = (y1 + y2) / 2 + (Math.cos(time * 30 + i) * 6);
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(mx, my);
      c.lineTo(x2, y2);
      c.stroke();
    }

    // 3. Central Supercharged Ion Accumulator Core
    const coreGrad = c.createRadialGradient(-3, -3, 1, 0, 0, 18);
    coreGrad.addColorStop(0, "#ffffff");
    coreGrad.addColorStop(0.2, "#82f5ff");
    coreGrad.addColorStop(0.6, "#1486bd");
    coreGrad.addColorStop(0.9, "#092e42");
    coreGrad.addColorStop(1, "#021017");
    c.fillStyle = coreGrad;
    c.beginPath();
    c.arc(0, 0, 18, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#9eeeff";
    c.lineWidth = 1.5;
    c.stroke();

    // Storm discharge aura
    const aura = c.createRadialGradient(0, 0, 0, 0, 0, 24 + pulse * 6);
    aura.addColorStop(0, "rgba(100, 230, 255, 0.45)");
    aura.addColorStop(1, "transparent");
    c.fillStyle = aura;
    c.beginPath();
    c.arc(0, 0, 24 + pulse * 6, 0, Math.PI * 2);
    c.fill();
  }

  private drawSplitter(c: CanvasRenderingContext2D, time: number, pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Shadow
    c.save();
    c.translate(0, 10);
    poly([-36, -20, 36, -20, 28, 24, -28, 24], "rgba(3, 18, 14, 0.45)");
    c.restore();

    // Separation oscillation simulating imminent mitosis
    const sep = Math.sin(time * Math.PI * 4) * 2;

    // 2. Left Crystalline Half
    const lGrad = c.createLinearGradient(-36, -26, 0, 26);
    lGrad.addColorStop(0, "#287a62");
    lGrad.addColorStop(0.5, "#154236");
    lGrad.addColorStop(1, "#0a211b");
    poly(
      [-36 - sep, -18, -12 - sep, -28, -2 - sep, -22, -2 - sep, 22, -18 - sep, 26, -34 - sep, 16],
      lGrad,
      "#4eed9c",
      1.2,
    );

    // 3. Right Crystalline Half
    const rGrad = c.createLinearGradient(0, -26, 36, 26);
    rGrad.addColorStop(0, "#287a62");
    rGrad.addColorStop(0.5, "#154236");
    rGrad.addColorStop(1, "#0a211b");
    poly(
      [2 + sep, -22, 12 + sep, -28, 36 + sep, -18, 34 + sep, 16, 18 + sep, 26, 2 + sep, 22],
      rGrad,
      "#4eed9c",
      1.2,
    );

    // 4. Central Cleavage Fracture Energy
    const fGrad = c.createLinearGradient(0, -26, 0, 26);
    fGrad.addColorStop(0, "#aaffd2");
    fGrad.addColorStop(0.5, "#38ef7d");
    fGrad.addColorStop(1, "#11998e");
    c.strokeStyle = fGrad;
    c.lineWidth = 2.5 + pulse * 1.5;
    c.beginPath();
    c.moveTo(0, -26);
    c.lineTo(-3 + sep * 0.5, -8);
    c.lineTo(3 - sep * 0.5, 6);
    c.lineTo(0, 24);
    c.stroke();

    // Twin mini reactive cores
    for (const cx of [-16 - sep, 16 + sep]) {
      c.fillStyle = "#b5ffd9";
      c.beginPath();
      c.arc(cx, 0, 3.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  private drawSplitterMini(c: CanvasRenderingContext2D, _time: number, pulse: number) {
    // Sharp emerald crystal dart
    const g = c.createLinearGradient(0, -20, 0, 16);
    g.addColorStop(0, "#4eed9c");
    g.addColorStop(0.5, "#1b5e4c");
    g.addColorStop(1, "#0b261e");
    c.beginPath();
    c.moveTo(0, -20);
    c.lineTo(14, 8);
    c.lineTo(0, 16);
    c.lineTo(-14, 8);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "#82ffbd";
    c.lineWidth = 1.2;
    c.stroke();

    // Core spark
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(0, -2, 2.5 + pulse, 0, Math.PI * 2);
    c.fill();
  }

  private drawMimicDrone(c: CanvasRenderingContext2D, time: number, _pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Holographic Displaced Glitch Ghost
    const glitchDx = Math.sin(time * 30) * 4;
    c.save();
    c.translate(glitchDx, -2);
    c.globalAlpha = 0.35;
    poly([-28, -6, 0, -26, 28, -6, 16, 22, -16, 22], "#9e44ea");
    c.restore();

    // 2. Prismatic Hull Plate
    const mGrad = c.createLinearGradient(-28, -26, 28, 22);
    mGrad.addColorStop(0, "#4a1c6d");
    mGrad.addColorStop(0.5, "#250b38");
    mGrad.addColorStop(1, "#12041c");
    poly([-28, -6, -8, -4, 0, -26, 8, -4, 28, -6, 16, 22, 0, 14, -16, 22], mGrad, "#c770ff", 1.2);

    // 3. Shifting Optical Mimic Visor (Magenta / Cyan scan)
    const scanY = Math.sin(time * 12) * 5;
    c.fillStyle = "#ff007f";
    c.beginPath();
    c.ellipse(0, scanY, 12, 3, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = "#00f5d4";
    c.beginPath();
    c.arc(Math.sin(time * 8) * 8, scanY, 2, 0, Math.PI * 2);
    c.fill();

    // Glitch horizontal interference scan lines
    c.strokeStyle = "rgba(180, 100, 255, 0.4)";
    c.lineWidth = 0.8;
    for (let y = -14; y <= 16; y += 7) {
      c.beginPath();
      c.moveTo(-22, y);
      c.lineTo(22, y);
      c.stroke();
    }
  }

  private drawNullHunter(c: CanvasRenderingContext2D, time: number, _pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Deep Space Shadow
    c.save();
    c.translate(0, 10);
    poly([-34, -12, 0, -32, 34, -12, 14, 24, -14, 24], "rgba(5, 2, 10, 0.6)");
    c.restore();

    // 2. Twin Tachyon Prongs (Forward Needles extending to -36)
    const nGrad = c.createLinearGradient(0, -36, 0, 24);
    nGrad.addColorStop(0, "#2a183d");
    nGrad.addColorStop(0.6, "#13091c");
    nGrad.addColorStop(1, "#08030d");
    poly(
      [-32, -10, -12, -36, -8, -12, 0, -22, 8, -12, 12, -36, 32, -10, 16, 20, 0, 28, -16, 20],
      nGrad,
      "#9b4dff",
      1.2,
    );

    // Needle tips glowing with violet event-horizon energy
    for (const nx of [-12, 12]) {
      c.fillStyle = "#e8a8ff";
      c.beginPath();
      c.arc(nx, -36, 2.5, 0, Math.PI * 2);
      c.fill();
    }

    // 3. Central Null Singularity Core
    const singGrad = c.createRadialGradient(0, 4, 1, 0, 4, 12);
    singGrad.addColorStop(0, "#000000");
    singGrad.addColorStop(0.5, "#42095e");
    singGrad.addColorStop(0.85, "#c742ff");
    singGrad.addColorStop(1, "transparent");
    c.fillStyle = singGrad;
    c.beginPath();
    c.arc(0, 4, 12, 0, Math.PI * 2);
    c.fill();

    // Event horizon distortion filament
    c.strokeStyle = "#f3bfff";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(0, 4, 14, 5, time * 4, 0, Math.PI * 2);
    c.stroke();
  }

  private drawMarsWarMachine(c: CanvasRenderingContext2D, time: number, _pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Massive Ground Shadow
    c.save();
    c.translate(0, 18);
    poly([-72, -30, 0, -56, 72, -30, 60, 44, -60, 44], "rgba(20, 5, 2, 0.55)");
    c.restore();

    // 2. Heavy Dual Siege Railguns (Extending to -68)
    for (const bx of [-38, 38]) {
      const bg = c.createLinearGradient(bx - 8, 0, bx + 8, 0);
      bg.addColorStop(0, "#2e120c");
      bg.addColorStop(0.4, "#6b2a1a");
      bg.addColorStop(0.8, "#6b2a1a");
      bg.addColorStop(1, "#1c0a06");
      c.fillStyle = bg;
      c.fillRect(bx - 7, -68, 14, 38);
      c.strokeStyle = "#b84f33";
      c.lineWidth = 1.2;
      c.strokeRect(bx - 7, -68, 14, 38);

      // Magnetic rings & muzzle
      for (const ry of [-62, -50, -38]) {
        c.fillStyle = "#ff6a33";
        c.fillRect(bx - 9, ry, 18, 3);
      }
      c.fillStyle = "#ffb07a";
      c.fillRect(bx - 5, -71, 10, 4);
    }

    // 3. Heavy Armored Dreadnought Chassis (Martian Iron & Crimson Plates)
    const cGrad = c.createLinearGradient(0, -48, 0, 46);
    cGrad.addColorStop(0, "#822719");
    cGrad.addColorStop(0.4, "#47150d");
    cGrad.addColorStop(1, "#1a0805");
    poly(
      [-64, -28, -26, -46, 26, -46, 64, -28, 54, 38, 0, 52, -54, 38],
      cGrad,
      "#d94d32",
      1.8,
    );

    // Hazard chevrons on front sponsons
    for (const sx of [-46, 32]) {
      c.save();
      c.beginPath();
      c.rect(sx, 4, 16, 20);
      c.clip();
      for (let i = -10; i < 30; i += 6) {
        c.beginPath();
        c.moveTo(sx - 5 + i, 0);
        c.lineTo(sx + 5 + i, 26);
        c.strokeStyle = "#ffb733";
        c.lineWidth = 2.5;
        c.stroke();
      }
      c.restore();
    }

    // 4. Central Superheated Magma Core Reactor
    const rGrad = c.createRadialGradient(0, 0, 2, 0, 0, 28);
    rGrad.addColorStop(0, "#ffffff");
    rGrad.addColorStop(0.25, "#ffb347");
    rGrad.addColorStop(0.65, "#cc3300");
    rGrad.addColorStop(0.9, "#3d0b00");
    rGrad.addColorStop(1, "transparent");
    c.fillStyle = rGrad;
    c.beginPath();
    c.arc(0, 0, 28, 0, Math.PI * 2);
    c.fill();

    // Rotating protective reactor shroud
    c.save();
    c.rotate(time * Math.PI * 0.5);
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      c.fillStyle = "#2b0d07";
      c.fillRect(-4, -30, 8, 8);
      c.strokeStyle = "#ff7733";
      c.strokeRect(-4, -30, 8, 8);
    }
    c.restore();
  }

  private drawVoidLeviathan(c: CanvasRenderingContext2D, time: number, _pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Ambient supercell storm cloud
    const cloud = c.createRadialGradient(0, 0, 20, 0, 0, 75);
    cloud.addColorStop(0, "rgba(0, 180, 255, 0.4)");
    cloud.addColorStop(0.6, "rgba(10, 40, 80, 0.2)");
    cloud.addColorStop(1, "transparent");
    c.fillStyle = cloud;
    c.beginPath();
    c.arc(0, 0, 75, 0, Math.PI * 2);
    c.fill();

    // 2. Segmented Chitinous Carapace Plates (Undulating biomechanical serpent head)
    const wave = Math.sin(time * 6) * 4;
    for (let seg = 3; seg >= 0; seg--) {
      const sy = 34 - seg * 22;
      const sw = 64 - seg * 8;
      const segGrad = c.createLinearGradient(0, sy - 14, 0, sy + 14);
      segGrad.addColorStop(0, "#194a6d");
      segGrad.addColorStop(0.5, "#0b263b");
      segGrad.addColorStop(1, "#03101a");
      poly(
        [-sw, sy, 0, sy - 14 + (seg === 0 ? -12 : 0), sw, sy, sw * 0.7, sy + 16, -sw * 0.7, sy + 16],
        segGrad,
        "#40c8ff",
        1.2,
      );

      // Bioluminescent storm sacs on flanks
      for (const sx of [-sw * 0.8, sw * 0.8]) {
        c.fillStyle = "#80f5ff";
        c.beginPath();
        c.arc(sx, sy + 6, 3, 0, Math.PI * 2);
        c.fill();
      }
    }

    // 3. Central Lightning Maw / Hyper-Conduit
    const maw = c.createRadialGradient(0, -18, 1, 0, -18, 20);
    maw.addColorStop(0, "#ffffff");
    maw.addColorStop(0.3, "#70eaff");
    maw.addColorStop(0.7, "#0066aa");
    maw.addColorStop(1, "transparent");
    c.fillStyle = maw;
    c.beginPath();
    c.arc(0, -18, 20, 0, Math.PI * 2);
    c.fill();

    // Lightning discharge bolts
    c.strokeStyle = "#e6fbff";
    c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + time * 5;
      c.beginPath();
      c.moveTo(0, -18);
      c.lineTo(Math.cos(a) * 26 + wave, -18 + Math.sin(a) * 26);
      c.stroke();
    }
  }

  private drawFractureArchitect(c: CanvasRenderingContext2D, time: number, pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Spacetime Fracture Radiation Cracks
    c.strokeStyle = "#ff007f";
    c.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + time * 0.3;
      c.beginPath();
      c.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
      c.lineTo(Math.cos(a + 0.1) * 48, Math.sin(a + 0.1) * 48);
      c.lineTo(Math.cos(a - 0.1) * 72, Math.sin(a - 0.1) * 72);
      c.stroke();
    }

    // 2. Four Orbiting Geometric Precursor Monoliths
    const rot = time * Math.PI * 0.4;
    c.save();
    c.rotate(rot);
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      const mGrad = c.createLinearGradient(0, -66, 0, -42);
      mGrad.addColorStop(0, "#2c0e44");
      mGrad.addColorStop(0.5, "#140420");
      mGrad.addColorStop(1, "#08010d");
      poly([-8, -66, 8, -66, 12, -42, -12, -42], mGrad, "#d166ff", 1.2);

      // Hieroglyphic glyph line
      c.strokeStyle = "#ff9eff";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, -64);
      c.lineTo(0, -44);
      c.stroke();
    }
    c.restore();

    // 3. Central Singularity (Event Horizon & Photon Ring)
    const r = 26;
    // Photon ring
    const prGrad = c.createRadialGradient(0, 0, r - 3, 0, 0, r + 10);
    prGrad.addColorStop(0, "#ffffff");
    prGrad.addColorStop(0.3, "#e6007e");
    prGrad.addColorStop(0.7, "#7000aa");
    prGrad.addColorStop(1, "transparent");
    c.fillStyle = prGrad;
    c.beginPath();
    c.arc(0, 0, r + 10, 0, Math.PI * 2);
    c.fill();

    // Absolute black core
    c.fillStyle = "#000000";
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#ff66cc";
    c.lineWidth = 1.5;
    c.stroke();

    // Dimensional rift iris
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.ellipse(0, 0, 4 + pulse * 3, 10 + pulse * 6, time * 2, 0, Math.PI * 2);
    c.fill();
  }

  private drawMarsRover(c: CanvasRenderingContext2D, time: number, pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Martian Red Dust Drop Shadow
    c.save();
    c.translate(0, 10);
    poly([-28, -6, 28, -6, 22, 16, -22, 16], "rgba(35, 10, 5, 0.45)");
    c.restore();

    // 2. Twin Armored Caterpillar Treads / Skimmer Skids
    for (const sx of [-22, 22]) {
      const tg = c.createLinearGradient(sx - 5, 0, sx + 5, 0);
      tg.addColorStop(0, "#2b1008");
      tg.addColorStop(0.5, "#4a1c0d");
      tg.addColorStop(1, "#1c0a05");
      c.fillStyle = tg;
      c.fillRect(sx - 5, -16, 10, 32);
      c.strokeStyle = "#8f381b";
      c.lineWidth = 1;
      c.strokeRect(sx - 5, -16, 10, 32);

      // Tread rollers
      c.fillStyle = "#ff7744";
      c.fillRect(sx - 4, -14, 8, 3);
      c.fillRect(sx - 4, 11, 8, 3);
    }

    // 3. Central Chassis - Rust Red Armored Hull
    const hg = c.createLinearGradient(0, -18, 0, 16);
    hg.addColorStop(0, "#b83d1d");
    hg.addColorStop(0.4, "#80270f");
    hg.addColorStop(1, "#401206");
    poly([-16, -18, 16, -18, 14, 16, -14, 16], hg, "#e05828", 1.2);

    // Front angled wedge / sand plow
    poly([-14, -18, 0, -26, 14, -18, 0, -14], "#e6602e", "#ff884d", 1);

    // 4. Optical Sensor Head (Scanning red laser)
    c.fillStyle = "#1f0904";
    c.beginPath();
    c.arc(0, -4, 7, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#ff7733";
    c.stroke();

    // Sweeping laser eye
    const sweep = Math.sin(time * 6) * 4;
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(sweep, -4, 2 + pulse, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ff3300";
    c.beginPath();
    c.arc(sweep, -4, 4, 0, Math.PI * 2);
    c.stroke();

    // 5. Dual Rear Incendiary Exhaust Plumes
    for (const ex of [-8, 8]) {
      const pl = 8 + pulse * 6;
      const eg = c.createLinearGradient(ex, 16, ex, 16 + pl);
      eg.addColorStop(0, "#ffffff");
      eg.addColorStop(0.3, "#ff9933");
      eg.addColorStop(1, "transparent");
      c.fillStyle = eg;
      c.fillRect(ex - 2, 16, 4, pl);
    }
  }

  private drawMagmaWalker(c: CanvasRenderingContext2D, _time: number, pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Heavy Molten Drop Shadow
    c.save();
    c.translate(0, 16);
    poly([-48, -14, 0, -28, 48, -14, 34, 26, -34, 26], "rgba(30, 8, 4, 0.5)");
    c.restore();

    // 2. Heavy Magma Mortar Barrels (Left and Right)
    for (const bx of [-32, 32]) {
      const bg = c.createLinearGradient(bx - 6, 0, bx + 6, 0);
      bg.addColorStop(0, "#1f0d08");
      bg.addColorStop(0.5, "#421a10");
      bg.addColorStop(1, "#120603");
      c.fillStyle = bg;
      c.fillRect(bx - 5, -34, 10, 36);
      c.strokeStyle = "#b3401b";
      c.lineWidth = 1;
      c.strokeRect(bx - 5, -34, 10, 36);

      // Superheated Muzzle Flare
      c.fillStyle = "#ffaa00";
      c.fillRect(bx - 4, -36, 8, 3);
    }

    // 3. Volcanic Basalt Carapace
    const bg = c.createLinearGradient(0, -28, 0, 26);
    bg.addColorStop(0, "#4a180e");
    bg.addColorStop(0.5, "#260c07");
    bg.addColorStop(1, "#120502");
    poly(
      [-42, -16, -18, -28, 18, -28, 42, -16, 30, 24, 0, 32, -30, 24],
      bg,
      "#cc441b",
      1.5,
    );

    // 4. Magma Fissures / Core Vents Glowing Molten Lava
    const fGrad = c.createRadialGradient(0, 0, 2, 0, 0, 18);
    fGrad.addColorStop(0, "#ffffff");
    fGrad.addColorStop(0.2, "#ffcc00");
    fGrad.addColorStop(0.6, "#ff4400");
    fGrad.addColorStop(1, "transparent");
    c.fillStyle = fGrad;
    c.beginPath();
    c.arc(0, 0, 18, 0, Math.PI * 2);
    c.fill();

    // Protective Cooling Grate Bars
    c.strokeStyle = "#290c05";
    c.lineWidth = 2.5;
    for (let gy = -8; gy <= 8; gy += 4) {
      c.beginPath();
      c.moveTo(-12, gy);
      c.lineTo(12, gy);
      c.stroke();
    }

    // Cooling vent spark
    c.fillStyle = "#ffeb99";
    c.beginPath();
    c.arc(0, 0, 3 + pulse * 2, 0, Math.PI * 2);
    c.fill();
  }

  private drawAbyssRay(c: CanvasRenderingContext2D, time: number, pulse: number) {
    const poly = (pts: number[], fill: string | CanvasGradient, stroke = "", width = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
      if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = width;
        c.stroke();
      }
    };

    // 1. Deep Ocean Drop Shadow
    c.save();
    c.translate(0, 12);
    poly([-52, -4, 0, -22, 52, -4, 0, 28], "rgba(2, 10, 25, 0.45)");
    c.restore();

    // 2. Wide Sweeping Bioluminescent Manta Wings (Undulating edge)
    const wingFlex = Math.sin(time * 4) * 6;
    const wg = c.createLinearGradient(0, -24, 0, 24);
    wg.addColorStop(0, "#08203d");
    wg.addColorStop(0.4, "#041426");
    wg.addColorStop(1, "#01070d");

    poly(
      [-54, -6 + wingFlex, -24, -22, 0, -28, 24, -22, 54, -6 + wingFlex, 32, 14, 0, 30, -32, 14],
      wg,
      "#26b6d4",
      1.2,
    );

    // 3. Bioluminescent Photophore Clusters on Wingtips
    for (const [wx, wy] of [
      [-42, -2 + wingFlex * 0.7],
      [42, -2 + wingFlex * 0.7],
      [-26, 4],
      [26, 4],
    ]) {
      const pg = c.createRadialGradient(wx, wy, 0, wx, wy, 7);
      pg.addColorStop(0, "#e0ffff");
      pg.addColorStop(0.4, "#30e6ff");
      pg.addColorStop(1, "transparent");
      c.fillStyle = pg;
      c.beginPath();
      c.arc(wx, wy, 7, 0, Math.PI * 2);
      c.fill();
    }

    // 4. Central Bio-Electric Shock Spine
    c.strokeStyle = "#80f0ff";
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(0, -26);
    c.lineTo(0, 34);
    c.stroke();

    // Shock nodes along spine
    for (let sy = -16; sy <= 24; sy += 10) {
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(0, sy, 2 + pulse, 0, Math.PI * 2);
      c.fill();
    }

    // Front Electro-horns
    for (const hx of [-10, 10]) {
      c.strokeStyle = "#4ff0e6";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(hx, -24);
      c.lineTo(hx * 1.4, -34);
      c.stroke();
    }
  }

  private drawEntropyCore(c: CanvasRenderingContext2D, time: number, pulse: number) {
    // 1. Accretion Disk - Multi-Stop Cosmic Swirl
    c.save();
    c.rotate(time * 1.5);
    const disk = c.createRadialGradient(0, 0, 12, 0, 0, 46);
    disk.addColorStop(0, "rgba(230, 40, 180, 0.8)");
    disk.addColorStop(0.3, "rgba(130, 20, 200, 0.5)");
    disk.addColorStop(0.7, "rgba(50, 10, 90, 0.2)");
    disk.addColorStop(1, "transparent");
    c.fillStyle = disk;
    c.beginPath();
    c.ellipse(0, 0, 46, 26, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 2. Floating Obsidian Reality Shards (Orbiting in 2.5D)
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + time * 2;
      const sx = Math.cos(a) * 36;
      const sy = Math.sin(a) * 16;
      const sz = Math.sin(a); // depth factor

      c.save();
      c.translate(sx, sy);
      c.rotate(time * 3 + i);
      c.fillStyle = sz > 0 ? "#1e042b" : "#0d0114";
      c.beginPath();
      c.moveTo(0, -8);
      c.lineTo(6, 0);
      c.lineTo(0, 8);
      c.lineTo(-6, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = "#e879f9";
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }

    // 3. Singularity Event Horizon Core (Absolute Void Center)
    const eg = c.createRadialGradient(0, 0, 2, 0, 0, 20);
    eg.addColorStop(0, "#000000");
    eg.addColorStop(0.75, "#0b0012");
    eg.addColorStop(0.95, "#c026d3");
    eg.addColorStop(1, "transparent");
    c.fillStyle = eg;
    c.beginPath();
    c.arc(0, 0, 20, 0, Math.PI * 2);
    c.fill();

    // 4. Reality Fracture Sparks
    c.strokeStyle = "#f5d0fe";
    c.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const ra = (k * Math.PI * 2) / 3 + time * 6;
      c.beginPath();
      c.moveTo(Math.cos(ra) * 10, Math.sin(ra) * 10);
      c.lineTo(Math.cos(ra) * (22 + pulse * 6), Math.sin(ra) * (22 + pulse * 6));
      c.stroke();
    }
  }

  private drawFx(c: CanvasRenderingContext2D, kind: string, time: number) {
    const cyan = ["impact", "shot", "core"].includes(kind);
    const color = cyan ? "#9ff5ff" : "#ff965d";
    c.globalAlpha = Math.max(0, 1 - time * 0.95);

    if (kind === "explosion") {
      // 2.5D Expanding Fireball Shockwave
      const grad = c.createRadialGradient(0, 0, 0, 0, 0, 10 + time * 50);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.2, "#ffbe3b");
      grad.addColorStop(0.5, "#ff3e24");
      grad.addColorStop(0.85, "rgba(80, 15, 10, 0.4)");
      grad.addColorStop(1, "transparent");
      c.fillStyle = grad;
      c.beginPath();
      c.arc(0, 0, 10 + time * 50, 0, Math.PI * 2);
      c.fill();

      // Flying Debris Shards with trails
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + 0.2;
        const dist = time * 48;
        c.fillStyle = i % 2 ? "#ffffff" : "#ffa35c";
        c.fillRect(Math.cos(a) * dist, Math.sin(a) * dist, 3 * (1 - time), 3 * (1 - time));
      }
    } else if (kind === "portal") {
      // Swirling Spacetime Vortex Spiral
      const pGrad = c.createRadialGradient(0, 0, 2, 0, 0, 25 + time * 30);
      pGrad.addColorStop(0, "#000000");
      pGrad.addColorStop(0.4, "#2e124d");
      pGrad.addColorStop(0.75, "#7830b8");
      pGrad.addColorStop(1, "transparent");
      c.fillStyle = pGrad;
      c.beginPath();
      c.arc(0, 0, 25 + time * 30, 0, Math.PI * 2);
      c.fill();

      // Vortex Spiral Arms
      c.strokeStyle = "#c078ff";
      c.lineWidth = 1.5;
      for (let arm = 0; arm < 3; arm++) {
        const offset = (arm * Math.PI * 2) / 3 + time * 5;
        c.beginPath();
        for (let t = 0; t < Math.PI * 1.5; t += 0.2) {
          const r = 5 + t * 14;
          const th = offset + t;
          c.lineTo(Math.cos(th) * r, Math.sin(th) * r);
        }
        c.stroke();
      }
    } else {
      // General impact / shot / core glow
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 14 + time * 45);
      g.addColorStop(0, color);
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 14 + time * 45, 0, Math.PI * 2);
      c.fill();

      c.beginPath();
      c.arc(0, 0, 5 + time * 45, 0, Math.PI * 2);
      c.strokeStyle = color;
      c.lineWidth = 2.5 * (1 - time) + 0.5;
      c.stroke();
    }
  }
}
