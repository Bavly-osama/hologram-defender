import type { ScoreRepository } from "../db/database";
import type { ScoreInput } from "../validation/score.schema";
export class ScoreService {
  constructor(private repository: ScoreRepository) {}
  submit(input: ScoreInput) {
    // Broad plausibility limits, not a claim of authoritative anti-cheat.
    if (
      input.score > input.duration * 2000 + 3000 ||
      input.duration < (input.wave - 1) * 10
    )
      throw new RangeError("Score is inconsistent with run duration");
    return this.repository.save(input);
  }
  leaderboard(limit: number) {
    return this.repository.top(Math.min(50, Math.max(1, limit)));
  }
}
