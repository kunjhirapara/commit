import type { DisplaySupport } from "./types.ts";

/** The single property of `screen` this module needs, so it can be tested. */
export type ScreenLike = {
  isExtended?: boolean;
};

export type WindowGeometry = {
  screenX: number;
  screenY: number;
  outerWidth: number;
  outerHeight: number;
  availWidth: number;
  availHeight: number;
};

/**
 * How far a window may hang off the primary display before it is treated as
 * sitting on another one. Windows routinely overhang an edge by a few pixels,
 * and a tighter bound would flag most sessions.
 */
const OVERHANG_TOLERANCE_PX = 200;

/**
 * Resolves the three-state multi-display answer.
 *
 * `screen.isExtended` needs no permission prompt, unlike `getScreenDetails()`,
 * which is what makes it usable when monitoring is meant to be silent. Two
 * things make a naive boolean read dangerous:
 *
 * - it is Chromium-only, so Firefox and Safari return `undefined`;
 * - a `window-management` Permissions-Policy makes it return `false` rather
 *   than throwing.
 *
 * In both cases the honest answer is "we do not know". Collapsing either into
 * `single` would let a candidate with three monitors on Safari read exactly like
 * an honest one on a laptop, and the interviewer would have no way to tell the
 * difference. Anything that is not an actual boolean is therefore `unsupported`.
 */
export const resolveDisplaySupport = (
  screen: ScreenLike | undefined,
): DisplaySupport => {
  if (!screen || typeof screen.isExtended !== "boolean") return "unsupported";
  return screen.isExtended ? "extended" : "single";
};

/**
 * Permission-free fallback for browsers without `isExtended`.
 *
 * If the window sits meaningfully outside the primary display's bounds, there is
 * another display. Noisier than `isExtended` — hence Tier B — but it works
 * everywhere and needs no prompt.
 */
export const isLikelyOffPrimaryDisplay = (
  geometry: WindowGeometry | undefined,
): boolean => {
  if (!geometry) return false;

  const { screenX, screenY, outerWidth, outerHeight, availWidth, availHeight } =
    geometry;

  if (
    ![screenX, screenY, outerWidth, outerHeight, availWidth, availHeight].every(
      (value) => Number.isFinite(value),
    )
  ) {
    return false;
  }

  // A negative offset means a display arranged above or to the left.
  if (screenX < -OVERHANG_TOLERANCE_PX) return true;
  if (screenY < -OVERHANG_TOLERANCE_PX) return true;

  // Extending past the right or bottom edge by more than the tolerance means the
  // window is not on the primary display.
  if (screenX + outerWidth > availWidth + OVERHANG_TOLERANCE_PX) return true;
  if (screenY + outerHeight > availHeight + OVERHANG_TOLERANCE_PX) return true;

  return false;
};

/**
 * `screen` as an event target.
 *
 * The Window Management API adds a `change` event to `screen`, but it is not in
 * TypeScript's DOM lib, and the methods are absent entirely in browsers without
 * the API. Both facts are handled here rather than by casting at each call site.
 */
export type DisplayChangeTarget = {
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

export const getDisplayChangeTarget = (): DisplayChangeTarget | undefined => {
  if (typeof window === "undefined") return undefined;
  return window.screen as unknown as DisplayChangeTarget;
};

/** Reads the live browser state. Separated so the logic above stays testable. */
export const readDisplayState = (): {
  support: DisplaySupport;
  offPrimary: boolean;
} => {
  if (typeof window === "undefined") {
    return { support: "unsupported", offPrimary: false };
  }

  const support = resolveDisplaySupport(
    window.screen as unknown as ScreenLike | undefined,
  );

  const offPrimary = isLikelyOffPrimaryDisplay({
    screenX: window.screenX,
    screenY: window.screenY,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    availWidth: window.screen?.availWidth ?? Number.NaN,
    availHeight: window.screen?.availHeight ?? Number.NaN,
  });

  return { support, offPrimary };
};
