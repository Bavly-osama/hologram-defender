import { settings } from "../core/Settings";
export type SoundEvent =
  | "ui_hover"
  | "game_start"
  | "pinch_fire"
  | "energy_shot"
  | "enemy_hit"
  | "enemy_destroy"
  | "shield_hit"
  | "core_damage"
  | "wave_complete"
  | "boss_warning"
  | "boss_destroy"
  | "game_over";

export class AudioManager {
  private context?: AudioContext;
  private voices = 0;

  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Silent fallback */
    }
  }

  play(event: SoundEvent) {
    if (
      !settings.sound ||
      !this.context ||
      this.context.state !== "running" ||
      this.voices > 14
    )
      return;
    try {
      this.voices++;
      this.synthesize(event);
    } catch {
      this.voices--;
    }
  }

  private synthesize(event: SoundEvent) {
    const ctx = this.context!;
    const now = ctx.currentTime;

    const osc = (
      freq: number,
      type: OscillatorType,
      start = 0,
      dur = 0.2,
      freqEnd?: number,
    ) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now + start);
      if (freqEnd !== undefined)
        o.frequency.exponentialRampToValueAtTime(
          Math.max(20, freqEnd),
          now + start + dur,
        );
      o.connect(g);
      g.connect(ctx.destination);
      return { o, g, start, dur };
    };

    const fire = (
      nodes: { o: OscillatorNode; g: GainNode; start: number; dur: number }[],
      masterVol = 0.04,
    ) => {
      for (const { o, g, start, dur } of nodes) {
        g.gain.setValueAtTime(0.001, now + start);
        g.gain.linearRampToValueAtTime(masterVol, now + start + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        o.start(now + start);
        o.stop(now + start + dur + 0.01);
        o.onended = () => {
          this.voices--;
          o.disconnect();
          g.disconnect();
        };
      }
    };

    switch (event) {
      case "energy_shot": {
        // Rising cyan pulse: clean sine up-sweep
        const n = osc(320, "sine", 0, 0.14, 1400);
        fire([n], 0.035);
        break;
      }
      case "shield_hit": {
        // Low thump + high ping
        const a = osc(80, "sine", 0, 0.18, 40);
        const b = osc(1800, "sine", 0, 0.09, 800);
        fire([a, b], 0.06);
        break;
      }
      case "enemy_hit": {
        // Sharp square pop
        const n = osc(200, "square", 0, 0.07, 80);
        fire([n], 0.025);
        break;
      }
      case "enemy_destroy": {
        // Descending explosion crunch
        const a = osc(300, "sawtooth", 0, 0.25, 40);
        const b = osc(180, "square", 0, 0.2, 30);
        fire([a, b], 0.055);
        break;
      }
      case "core_damage": {
        // Heavy low boom — impact
        const a = osc(55, "sawtooth", 0, 0.55, 20);
        const b = osc(120, "sine", 0, 0.3, 40);
        fire([a, b], 0.07);
        break;
      }
      case "wave_complete": {
        // 3-note ascending chime
        [0, 0.12, 0.25].forEach((t, i) => {
          const freq = [660, 880, 1100][i];
          const n = osc(freq, "sine", t, 0.45);
          fire([n], 0.045);
        });
        break;
      }
      case "game_start": {
        // Short ascending fanfare
        [0, 0.1, 0.22].forEach((t, i) => {
          const freq = [440, 550, 880][i];
          const n = osc(freq, "sine", t, 0.35);
          fire([n], 0.04);
        });
        break;
      }
      case "boss_warning": {
        // Deep descending alarm
        const a = osc(110, "sawtooth", 0, 0.9, 55);
        const b = osc(220, "square", 0, 0.5, 80);
        fire([a, b], 0.06);
        break;
      }
      case "boss_destroy": {
        // Multi-layer epic explosion
        [0, 0.15, 0.35, 0.6].forEach((t, i) => {
          const freq = [55, 80, 110, 160][i];
          const n = osc(freq, "sawtooth", t, 1.2 - t, 20);
          fire([n], 0.08);
        });
        break;
      }
      case "game_over": {
        // Descending sadness chord
        [0, 0.2, 0.45].forEach((t, i) => {
          const freq = [440, 330, 220][i];
          const n = osc(freq, "triangle", t, 0.6, freq * 0.5);
          fire([n], 0.04);
        });
        break;
      }
      case "ui_hover": {
        // Soft portal ping
        const n = osc(640, "sine", 0, 0.12, 320);
        fire([n], 0.025);
        break;
      }
      case "pinch_fire": {
        // Same as energy_shot (pinch fires a shot)
        const n = osc(400, "triangle", 0, 0.1, 1200);
        fire([n], 0.03);
        break;
      }
    }
  }
}
