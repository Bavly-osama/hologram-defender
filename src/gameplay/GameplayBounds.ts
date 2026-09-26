/**
 * GameplayBounds — defines the playable rectangle inside the canvas.
 *
 * The playable area excludes:
 *  - HUD header at top (masthead height)
 *  - Status-bar footer at bottom
 *  - Safe-area insets on sides
 *
 * Updated by PixiApp.resize() after every viewport change.
 */

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
  /** Derived width */
  width: number;
  /** Derived height */
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

  get bounds(): PlayableBounds {
    return this._bounds;
  }

  /**
   * Call from PixiApp.resize() passing current canvas dimensions and insets.
   */
  update(
    canvasW: number,
    canvasH: number,
    safe: SafeArea,
    options: {
      /** Height of the HUD masthead in CSS pixels */
      hudTopPx?: number;
      /** Height of the footer statusbar in CSS pixels */
      footerPx?: number;
    } = {},
  ) {
    const hudTop = options.hudTopPx ?? 48;
    const footer = options.footerPx ?? 32;

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
}
