/**
 * MobileSpawnMapper — converts normalized (0.0 → 1.0) spawn coordinates
 * to concrete world positions dynamically using GameplayBounds.
 *
 * Ensures enemies NEVER spawn off-screen on mobile devices,
 * while preserving classic wide desktop formation spread.
 */

import { WORLD, type Point } from "../core/Config";
import { GameplayBounds } from "./GameplayBounds";

export interface NormalizedOrigin {
  nx: number; // 0.0 (left) → 1.0 (right)
  ny: number; // 0.0 (top)  → 1.0 (bottom of spawn zone)
}

/**
 * Normalized spawn anchors.
 * nx spans from 0.08 (near left edge) to 0.92 (near right edge).
 * ny spans from 0.05 to 0.35 (upper combat sector).
 */
export const NORMALIZED_SPAWN_PATTERNS: NormalizedOrigin[] = [
  { nx: 0.15, ny: 0.10 }, // Left high
  { nx: 0.50, ny: 0.05 }, // Center top
  { nx: 0.85, ny: 0.10 }, // Right high
  { nx: 0.25, ny: 0.22 }, // Left mid
  { nx: 0.75, ny: 0.22 }, // Right mid
  { nx: 0.38, ny: 0.14 }, // Left-center
  { nx: 0.62, ny: 0.14 }, // Right-center
  { nx: 0.50, ny: 0.28 }, // Center drop
];

export class MobileSpawnMapper {
  private static _patterns = NORMALIZED_SPAWN_PATTERNS;

  /**
   * Get dynamic spawn world coordinate by pattern index.
   * On mobile portrait, maps strictly within GameplayBounds visible area.
   * On desktop landscape, maps across standard 1200x750 formation field.
   */
  static getOrigin(index: number): Point {
    const pattern = this._patterns[index % this._patterns.length];
    return this.map(pattern.nx, pattern.ny);
  }

  /**
   * Map normalized (nx, ny) to world coordinates.
   */
  static map(nx: number, ny: number): Point {
    const gb = GameplayBounds.get();

    if (gb.isPortrait) {
      // Mobile portrait: use visible world bounds with safe margin
      // Upper 40% of the playable area is the enemy spawn sector
      const marginX = 40;
      const wb = gb.worldBounds;
      const minX = wb.left + marginX;
      const maxX = wb.right - marginX;
      // Spawn Y is mapped into the upper 38% of visible height
      const minY = wb.top + 20;
      const maxY = wb.top + wb.height * 0.38;

      return {
        x: minX + Math.max(0, Math.min(1, nx)) * Math.max(1, maxX - minX),
        y: minY + Math.max(0, Math.min(1, ny)) * Math.max(1, maxY - minY),
      };
    }

    // Desktop / Landscape: standard formation space
    // X spans 120 to 1080 (leaving outer margin for aesthetics)
    // Y spans 90 to 340
    return {
      x: 120 + nx * 960,
      y: 85 + ny * 255,
    };
  }

  /**
   * Get standard boss spawn position.
   */
  static getBossOrigin(): Point {
    const gb = GameplayBounds.get();
    if (gb.isPortrait) {
      const wb = gb.worldBounds;
      return {
        x: (wb.left + wb.right) / 2,
        y: wb.top + wb.height * 0.20,
      };
    }
    return { x: WORLD.core.x, y: 180 };
  }
}
