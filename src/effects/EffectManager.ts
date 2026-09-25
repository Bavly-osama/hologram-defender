import {
  AnimatedSprite,
  Container,
  Graphics,
  Text,
  type Ticker,
} from "pixi.js";
import type { SpriteSheetManager } from "../assets/SpriteSheetManager";
import type { CombatEvent } from "../gameplay/CombatSimulation";
interface Particle {
  active: boolean;
  sprite: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}
export class EffectManager {
  private particles: Particle[] = [];
  private bursts: { sprite: AnimatedSprite; life: number; portal: boolean }[] = [];
  private labels: { text: Text; life: number }[] = [];
  constructor(layer: Container, portalLayer: Container, sheets: SpriteSheetManager) {
    for (let i = 0; i < 260; i++) {
      const sprite = new Graphics().rect(-1.5, -1.5, 3, 3).fill(0xffffff);
      sprite.visible = false;
      layer.addChild(sprite);
      this.particles.push({
        active: false,
        sprite,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
      });
    }
    for (let i = 0; i < 24; i++) {
      const isPortal = i < 6;
      const sprite = new AnimatedSprite(sheets.frames("EXPLOSION_SMALL"));
      sprite.anchor.set(0.5);
      sprite.autoUpdate = false;
      sprite.loop = false;
      sprite.visible = false;
      (isPortal ? portalLayer : layer).addChild(sprite);
      this.bursts.push({ sprite, life: 0, portal: isPortal });
    }
    for (let i = 0; i < 32; i++) {
      const text = new Text({
        text: "",
        style: {
          fontFamily: "monospace",
          fontSize: 16,
          fill: 0xb6f6ff,
          letterSpacing: 2,
        },
      });
      text.anchor.set(0.5);
      text.visible = false;
      layer.addChild(text);
      this.labels.push({ text, life: 0 });
    }
  }
  emit(event: CombatEvent, sheets: SpriteSheetManager, limit: number) {
    if (event.type === "credit") {
      if (event.value) {
        const label = this.labels.find((l) => l.life <= 0);
        if (label) {
          label.text.text = `+${event.value} ◈`;
          label.text.style.fill = 0xffdf55;
          label.text.position.set(event.x, event.y - 32);
          label.text.visible = true;
          label.life = 1.1;
        }
      }
      for (
        let i = 0;
        i < Math.min(limit, this.particles.length);
        i++
      ) {
        const p = this.particles[i];
        if (p.active) continue;
        p.active = true;
        p.sprite.visible = true;
        p.sprite.position.set(event.x, event.y);
        p.sprite.tint = 0xffdf55;
        const angle = Math.random() * Math.PI * 2,
          speed = 20 + Math.random() * 60;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 20;
        p.life = p.maxLife = 0.3 + Math.random() * 0.4;
        break;
      }
      return;
    }

    const cyan = event.type === "block" || event.type === "shot";
    const wantPortal = event.type === "portal";
    const burst = this.bursts.find((b) => b.life <= 0 && b.portal === wantPortal)
      ?? this.bursts.find((b) => b.life <= 0);
    if (burst) {
      const assetId =
        event.type === "portal"
          ? "PORTAL"
          : cyan
            ? "SHIELD_IMPACT"
            : event.type === "kill" && event.kind === "boss"
              ? "EXPLOSION_LARGE"
              : "EXPLOSION_SMALL";
      burst.sprite.textures = sheets.frames(assetId);
      burst.sprite.position.set(event.x, event.y);
      burst.sprite.scale.set(
        event.kind === "boss" ? 3.5 : event.type === "kill" ? 1.3 : 0.7,
      );
      burst.sprite.visible = true;
      burst.sprite.animationSpeed = 0.27;
      burst.sprite.gotoAndPlay(0);
      burst.life = 0.65;
    }
    let count =
      event.type === "kill"
        ? event.kind === "boss"
          ? 80
          : 18
        : event.type === "shot"
          ? 3
          : 8;
    for (
      let i = 0;
      i < Math.min(limit, this.particles.length) && count > 0;
      i++
    ) {
      const p = this.particles[i];
      if (p.active) continue;
      p.active = true;
      p.sprite.visible = true;
      p.sprite.position.set(event.x, event.y);
      p.sprite.tint = cyan
        ? 0x82f6ff
        : event.type === "portal"
          ? 0xc48cf1
          : 0xff9e67;
      const angle = Math.random() * Math.PI * 2,
        speed = 25 + Math.random() * 150;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = p.maxLife = 0.25 + Math.random() * 0.6;
      count--;
    }
    if (event.value) {
      const label = this.labels.find((l) => l.life <= 0);
      if (label) {
        label.text.text = event.counter ? `+${event.value} COUNTER!` : `+${event.value}`;
        label.text.style.fill = event.counter ? 0xffdf70 : 0xb6f6ff;
        label.text.position.set(event.x, event.y - 20);
        label.text.visible = true;
        label.life = 1;
      }
    }
  }
  update(dt: number) {
    for (const p of this.particles)
      if (p.active) {
        p.life -= dt;
        p.sprite.x += p.vx * dt;
        p.sprite.y += p.vy * dt;
        p.sprite.alpha = Math.max(0, p.life / p.maxLife);
        if (p.life <= 0) {
          p.active = false;
          p.sprite.visible = false;
        }
      }
    for (const b of this.bursts)
      if (b.life > 0) {
        b.life -= dt;
        b.sprite.update({ deltaTime: dt * 60 } as Ticker);
        b.sprite.alpha = Math.min(1, b.life * 3);
        if (b.life <= 0) b.sprite.visible = false;
      }
    for (const l of this.labels)
      if (l.life > 0) {
        l.life -= dt;
        l.text.y -= dt * 28;
        l.text.alpha = l.life;
        if (l.life <= 0) l.text.visible = false;
      }
  }
  get count() {
    return this.particles.filter((p) => p.active).length;
  }
}
