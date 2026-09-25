import { balance } from "./gameBalance";
export class ScoreSystem {
  value = 0;
  shots = 0;
  hits = 0;
  combo = 0;
  bestCombo = 0;
  lastHit = -Infinity;
  hit(time: number) {
    this.hits++;
    this.combo =
      time - this.lastHit < balance.comboTimeout
        ? Math.min(4, this.combo + 1)
        : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastHit = time;
  }
  miss() {
    this.combo = 0;
  }
  update(time: number) {
    if (time - this.lastHit > balance.comboTimeout) this.combo = 0;
  }
  kill(points: number) {
    const earned = points * Math.max(1, this.combo);
    this.value += earned;
    return earned;
  }
  get accuracy() {
    return this.shots ? Math.min(1, this.hits / this.shots) : 0;
  }
}
