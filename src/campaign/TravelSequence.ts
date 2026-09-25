import { Container, Graphics, Text } from "pixi.js";
import type { StageConfig } from "./StageConfig";

export interface TravelProps {
  fromStage: StageConfig;
  toStage: StageConfig;
  isFinalVictory?: boolean;
  onComplete: () => void;
}

export class TravelSequence {
  readonly container = new Container();

  private warpBackdrop = new Graphics();
  private originPlanet = new Graphics();
  private destPlanet = new Graphics();
  private warpStreaks = new Graphics();
  private navRings = new Graphics();
  private telemetryContainer = new Container();
  private statusText: Text;
  private coordText: Text;
  private stageTitleText: Text;
  private skipHintText: Text;

  private elapsed = 0;
  private duration = 6.5;
  private isSkipped = false;
  private isFinished = false;

  constructor(private readonly props: TravelProps) {
    this.container.addChild(
      this.warpBackdrop,
      this.originPlanet,
      this.destPlanet,
      this.warpStreaks,
      this.navRings,
      this.telemetryContainer,
    );

    this.statusText = new Text({
      text: "ALIGNING NAVIGATION COILS",
      style: {
        fontFamily: "monospace",
        fontSize: 14,
        letterSpacing: 3,
        fill: 0x8df8ff,
        fontWeight: "bold",
      },
    });
    this.statusText.anchor.set(0.5);
    this.statusText.position.set(600, 560);

    this.coordText = new Text({
      text: "VECTOR: [ 0.00 · 0.00 · 0.00 ]",
      style: {
        fontFamily: "monospace",
        fontSize: 10,
        letterSpacing: 2,
        fill: 0x5a8a9e,
      },
    });
    this.coordText.anchor.set(0.5);
    this.coordText.position.set(600, 595);

    this.stageTitleText = new Text({
      text: props.isFinalVictory ? "SOLAR SYSTEM LIBERATED" : props.toStage.name,
      style: {
        fontFamily: "monospace",
        fontSize: 26,
        letterSpacing: 4,
        fill: 0xffffff,
        fontWeight: "bold",
      },
    });
    this.stageTitleText.anchor.set(0.5);
    this.stageTitleText.position.set(600, 375);
    this.stageTitleText.alpha = 0;

    this.skipHintText = new Text({
      text: "[ SPACE / CLICK TO SKIP ]",
      style: {
        fontFamily: "monospace",
        fontSize: 9,
        letterSpacing: 1.5,
        fill: 0x4a6a7c,
      },
    });
    this.skipHintText.anchor.set(0.5);
    this.skipHintText.position.set(600, 710);

    this.telemetryContainer.addChild(
      this.statusText,
      this.coordText,
      this.stageTitleText,
      this.skipHintText,
    );

    this.buildPlanets();
  }

  private buildPlanets() {
    // 1. Origin planet
    this.originPlanet.circle(0, 0, 110).fill({ color: this.props.fromStage.palette.secondary });
    this.originPlanet.circle(0, 0, 105).stroke({ color: this.props.fromStage.palette.primary, width: 2, alpha: 0.6 });
    this.originPlanet.position.set(600, 375);

    // 2. Destination planet
    this.destPlanet.circle(0, 0, 130).fill({ color: this.props.toStage.palette.secondary });
    this.destPlanet.circle(0, 0, 125).stroke({ color: this.props.toStage.palette.primary, width: 2.5, alpha: 0.8 });
    this.destPlanet.position.set(600, 375);
    this.destPlanet.scale.set(0.01);
    this.destPlanet.alpha = 0;
  }

  skip() {
    if (this.isSkipped || this.isFinished) return;
    this.isSkipped = true;
    this.finish();
  }

  update(dt: number) {
    if (this.isFinished) return;
    this.elapsed += dt;

    const t = Math.min(1, this.elapsed / this.duration);

    // Phase 1 (0.0 -> 0.3): Lock-on & Charge (origin planet visible, navigation rings spin)
    if (t < 0.3) {
      const p1 = t / 0.3;
      this.statusText.text = "WARP CAPACITORS CHARGING · 99.4%";
      this.coordText.text = `TARGET: ${this.props.toStage.location.toUpperCase()}`;
      this.originPlanet.scale.set(1 - p1 * 0.4);
      this.originPlanet.alpha = 1 - p1 * 0.2;

      this.renderNavRings(p1 * 4, 1 - p1 * 0.3);
      this.warpBackdrop.clear().rect(0, 0, 1200, 750).fill({ color: 0x02070d, alpha: 0.4 + p1 * 0.4 });
    }
    // Phase 2 (0.3 -> 0.7): Warp Speed Acceleration & Space Tunnel
    else if (t < 0.7) {
      const p2 = (t - 0.3) / 0.4;
      this.originPlanet.scale.set(0.6 - p2 * 0.6);
      this.originPlanet.alpha = Math.max(0, 0.8 - p2 * 1.5);

      const isAnomaly = this.props.fromStage.id === 3 && this.props.toStage.id === 4;
      if (isAnomaly && p2 > 0.4) {
        this.statusText.text = "WARNING: UNSTABLE SPATIAL ANOMALY DETECTED";
        this.statusText.style.fill = 0xff3b56;
      } else {
        this.statusText.text = `IN TRANSIT · ${(p2 * 4.2 + 0.8).toFixed(2)}c · TACHYON DRIVE`;
        this.statusText.style.fill = 0x8df8ff;
      }

      this.renderWarpTunnel(p2, isAnomaly);
      this.renderNavRings(1.2 + p2 * 8, 0.4);
    }
    // Phase 3 (0.7 -> 1.0): Drop out of warp, reveal destination planet and stage title
    else {
      const p3 = (t - 0.7) / 0.3;
      this.warpStreaks.clear();
      this.navRings.clear();

      this.statusText.text = "WARP DROP COMPLETE · ORBITAL INSERTION";
      this.statusText.style.fill = this.props.toStage.palette.primary;

      // Destination planet expands to hero size
      this.destPlanet.alpha = Math.min(1, p3 * 1.5);
      this.destPlanet.scale.set(0.1 + p3 * 0.9);

      // Title banner emerges
      this.stageTitleText.alpha = Math.min(1, Math.sin(p3 * Math.PI) * 1.3);
      this.stageTitleText.position.set(600, 375 - p3 * 20);
    }

    if (t >= 1) {
      this.finish();
    }
  }

  private renderNavRings(speed: number, alpha: number) {
    this.navRings.clear();
    const rot = this.elapsed * speed;

    for (let i = 0; i < 3; i++) {
      const rad = 70 + i * 35;
      this.navRings
        .ellipse(600, 375, rad, rad * 0.75)
        .stroke({
          color: this.props.toStage.palette.primary,
          width: 1.2,
          alpha: alpha * (0.8 - i * 0.2),
        });
    }

    // Alignment tick marks
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const x1 = 600 + Math.cos(a + rot) * 55;
      const y1 = 375 + Math.sin(a + rot) * 40;
      const x2 = 600 + Math.cos(a + rot) * 75;
      const y2 = 375 + Math.sin(a + rot) * 55;
      this.navRings.moveTo(x1, y1).lineTo(x2, y2).stroke({
        color: 0x8df8ff,
        width: 1.5,
        alpha: alpha * 0.7,
      });
    }
  }

  private renderWarpTunnel(progress: number, anomaly: boolean) {
    this.warpStreaks.clear();
    const streakCount = 45;
    const center = { x: 600, y: 375 };

    for (let i = 0; i < streakCount; i++) {
      const angle = (i / streakCount) * Math.PI * 2 + this.elapsed * (anomaly ? 2.5 : 0.8);
      const innerDist = 40 + Math.random() * 60;
      const length = 120 + progress * 400 + Math.random() * 80;

      const x1 = center.x + Math.cos(angle) * innerDist;
      const y1 = center.y + Math.sin(angle) * innerDist;
      const x2 = center.x + Math.cos(angle) * (innerDist + length);
      const y2 = center.y + Math.sin(angle) * (innerDist + length);

      this.warpStreaks.moveTo(x1, y1).lineTo(x2, y2).stroke({
        color: anomaly
          ? i % 2 === 0
            ? 0xd946ef
            : 0xff3b56
          : i % 2 === 0
            ? this.props.toStage.palette.primary
            : 0xffffff,
        width: 1.2 + Math.random() * 2.5,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }
  }

  private finish() {
    if (this.isFinished) return;
    this.isFinished = true;
    this.container.destroy({ children: true });
    this.props.onComplete();
  }
}
