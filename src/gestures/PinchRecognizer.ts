export class PinchRecognizer {
  state: "OPEN" | "PINCH_START" | "PINCH_HELD" | "PINCH_RELEASE" = "OPEN";
  update(ratio: number): boolean {
    if (this.state === "PINCH_START" || this.state === "PINCH_HELD") {
      this.state = ratio > 0.43 ? "PINCH_RELEASE" : "PINCH_HELD";
      return false;
    }
    if (ratio < 0.25) {
      this.state = "PINCH_START";
      return true;
    }
    this.state = "OPEN";
    return false;
  }
  reset() {
    this.state = "OPEN";
  }
}
