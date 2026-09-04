import { createElement, type ReactElement } from "react";

/**
 * The Commit mark, as a single definition rendered at every size it is needed.
 *
 * Google's most common OAuth rejection is branding the reviewer cannot match to
 * the public-facing app, so the consent-screen logo, the favicon, the
 * apple-touch icon and the manifest icon are all this one function. Changing the
 * mark here changes all of them together, which is the only way they stay in
 * agreement — and changing the logo after approval re-triggers verification, so
 * they must not drift apart by accident.
 *
 * The colours are the ones already used by the navbar wordmark and by
 * src/app/opengraph-image.tsx: orange on near-black.
 *
 * Written with createElement rather than JSX so that scripts/generate-brand-assets.ts
 * can import it. That script runs under `node --experimental-strip-types`, which
 * removes type annotations but does not compile JSX.
 */

export const BRAND_ORANGE = "#f97316";
export const BRAND_BACKGROUND = "#09090b";

/**
 * A dark tile rather than a bare glyph. The consent screen is light-themed and
 * an orange mark on white loses its edges; the tile gives the logo its own
 * boundary wherever it is placed.
 */
export function BrandMark({ size }: { size: number }): ReactElement {
  return createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_BACKGROUND,
        // Proportional, so the silhouette is identical at 32px and at 512px.
        borderRadius: size * 0.2,
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          fontSize: size * 0.42,
          fontWeight: 700,
          color: BRAND_ORANGE,
          fontFamily: "monospace",
          lineHeight: 1,
        },
      },
      "</>",
    ),
  );
}
