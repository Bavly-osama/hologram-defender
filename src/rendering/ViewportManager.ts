/**
 * ViewportManager — single source of truth for viewport geometry.
 *
 * Computes once per resize, then Game / PixiApp / InputManager all read
 * the same snapshot instead of each doing their own window queries.
 */

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type DeviceProfile = "DESKTOP" | "MOBILE_PORTRAIT" | "MOBILE_LANDSCAPE" | "TABLET";

export interface ViewportSnapshot {
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: number;
  isPortrait: boolean;
  safeArea: SafeArea;
  deviceProfile: DeviceProfile;
  /** Pixel ratio capped for performance */
  dpr: number;
  /** Canvas CSS width (== viewportWidth usually) */
  canvasW: number;
  /** Canvas CSS height */
  canvasH: number;
}

function parseSafeInset(prop: string): number {
  try {
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(prop)
      .trim();
    return val ? parseFloat(val) : 0;
  } catch {
    return 0;
  }
}

function computeSafeArea(): SafeArea {
  return {
    top: parseSafeInset("--sat"),
    right: parseSafeInset("--sar"),
    bottom: parseSafeInset("--sab"),
    left: parseSafeInset("--sal"),
  };
}

/** Inject CSS vars so env() can be read from JS */
function injectSafeAreaVars() {
  if (document.getElementById("__safe-area-vars")) return;
  const s = document.createElement("style");
  s.id = "__safe-area-vars";
  s.textContent = `:root {
    --sat: env(safe-area-inset-top, 0px);
    --sar: env(safe-area-inset-right, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
  }`;
  document.head.appendChild(s);
}

export class ViewportManager {
  private static _instance: ViewportManager | null = null;
  static get(): ViewportManager {
    if (!ViewportManager._instance) ViewportManager._instance = new ViewportManager();
    return ViewportManager._instance;
  }

  private _snap: ViewportSnapshot = this._compute();
  private _listeners: Array<(snap: ViewportSnapshot) => void> = [];

  private constructor() {
    injectSafeAreaVars();
    const update = () => {
      this._snap = this._compute();
      for (const fn of this._listeners) fn(this._snap);
    };
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(update, 120), {
      passive: true,
    });
    if ("visualViewport" in window && window.visualViewport) {
      window.visualViewport.addEventListener("resize", update, { passive: true });
    }
  }

  get snap(): ViewportSnapshot {
    return this._snap;
  }

  onChange(fn: (snap: ViewportSnapshot) => void) {
    this._listeners.push(fn);
  }

  private _compute(): ViewportSnapshot {
    // Prefer visualViewport (avoids browser chrome area on mobile)
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const W = vv ? Math.round(vv.width) : window.innerWidth;
    const H = vv ? Math.round(vv.height) : window.innerHeight;

    const isPortrait = H > W;
    const safe = computeSafeArea();

    // Cap device pixel ratio for mobile performance
    const isMobileUA = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const rawDpr = window.devicePixelRatio ?? 1;
    const dpr = isMobileUA ? Math.min(rawDpr, 1.25) : Math.min(rawDpr, 1.5);

    let deviceProfile: DeviceProfile;
    if (!isMobileUA && !("ontouchstart" in window)) {
      deviceProfile = "DESKTOP";
    } else if (W >= 768 && !isPortrait) {
      deviceProfile = "TABLET";
    } else if (isPortrait) {
      deviceProfile = "MOBILE_PORTRAIT";
    } else {
      deviceProfile = "MOBILE_LANDSCAPE";
    }

    return {
      viewportWidth: W,
      viewportHeight: H,
      aspectRatio: W / H,
      isPortrait,
      safeArea: safe,
      deviceProfile,
      dpr,
      canvasW: W,
      canvasH: H,
    };
  }

  /** Force a re-compute (call after font / layout changes) */
  refresh() {
    this._snap = this._compute();
    for (const fn of this._listeners) fn(this._snap);
  }
}
