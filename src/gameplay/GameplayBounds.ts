/**
 * GameplayBounds — defines the playable rectangle inside the canvas
 * and its mapping to world coordinates.
 *
 * Excludes:
 *  - HUD header at top (masthead)
 *  - Status-bar footer / camera preview at bottom
 *  - Safe-area insets on left/right/top/bottom
 */

import { WORLD, type Point } from "../core/Config";
import type { SafeArea } from "../rendering/ViewportManager";

export interface PlayableBounds {
  /** Left edge in canvas CSS pixels */
  left: number;
  /** Top edge in canvas CSS pixels */
  top: number;
  /** Right edge in canvas CSS pixels */
  right: number;
  /** Bottom edge in canvas CSS pixels */
  bottom: number;
  /** Derived width in CSS pixels */
  width: number;
  /** Derived height in CSS pixels */
  height: number;
}

export interface WorldPlayableBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export class GameplayBounds {
  private static _instance: GameplayBounds | null = null;
  static get(): GameplayBounds {
    if (!GameplayBounds._instance) GameplayBounds._instance = new GameplayBounds();
    return GameplayBounds._instance;
  }

  private _bounds: PlayableBounds = {
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
    width: 1,
    height: 1,
  };

  private _worldBounds: WorldPlayableBounds = {
    left: 0,
    top: 0,
    right: WORLD.width,
    bottom: WORLD.height,
    width: WORLD.width,
    height: WORLD.height,
  };

  isPortrait = false;

  get bounds(): PlayableBounds {
    return this._bounds;
  }

  get worldBounds(): WorldPlayableBounds {
    return this._worldBounds;
  }

  /**
   * Called from PixiApp.resize() with current canvas dimensions, safe-area, and transforms.
   */
  update(
    canvasW: number,
    canvasH: number,
    safe: SafeArea,
    transform: { scaleX: number; scaleY: number; offsetX: number; offsetY: number; isPortrait: boolean },
    options: {
      hudTopPx?: number;
      footerPx?: number;
    } = {},
  ) {
    this.isPortrait = transform.isPortrait;
    const hudTop = options.hudTopPx ?? (this.isPortrait ? 44 : 48);
    const footer = options.footerPx ?? (this.isPortrait ? 40 : 36);

    const left = safe.left;
    const right = canvasW - safe.right;
    const top = hudTop + safe.top;
    const bottom = canvasH - footer - safe.bottom;

    this._bounds = {
      left,
      top,
      right,
      bottom,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
    };

    // Derive world-coordinate playable rect
    const sx = Math.max(0.001, transform.scaleX);
    const sy = Math.max(0.001, transform.scaleY);
    const wLeft = (left - transform.offsetX) / sx;
    const wRight = (right - transform.offsetX) / sx;
    const wTop = (top - transform.offsetY) / sy;
    const wBottom = (bottom - transform.offsetY) / sy;

    this._worldBounds = {
      left: wLeft,
      top: wTop,
      right: wRight,
      bottom: wBottom,
      width: Math.max(1, wRight - wLeft),
      height: Math.max(1, wBottom - wTop),
    };
  }

  /**
   * Map a canvas-local point to 0-1 normalized coords within the playable area.
   */
  normalize(canvasX: number, canvasY: number): { nx: number; ny: number } {
    const b = this._bounds;
    return {
      nx: Math.max(0, Math.min(1, (canvasX - b.left) / b.width)),
      ny: Math.max(0, Math.min(1, (canvasY - b.top) / b.height)),
    };
  }

  /**
   * Map normalized (0..1, 0..1) coordinates to world coordinates within the visible bounds.
   * On mobile portrait, clamps strictly inside visible screen bounds with margin.
   */
  toWorld(nx: number, ny: number, marginX = 35, marginY = 15): Point {
    const wb = this._worldBounds;
    const minX = wb.left + marginX;
    const maxX = wb.right - marginX;
    const minY = wb.top + marginY;
    const maxY = wb.bottom - marginY;

    return {
      x: minX + Math.max(0, Math.min(1, nx)) * Math.max(1, maxX - minX),
      y: minY + Math.max(0, Math.min(1, ny)) * Math.max(1, maxY - minY),
    };
  }
}
