import type { Appearance } from "@clerk/types";

/**
 * Clerk's own UI, themed to match the app.
 *
 * Two lessons are baked into the shape of this file.
 *
 * **Let Clerk own its card.** The first attempt wrapped `<SignIn />` in an app
 * card with its own heading, which produced a card inside a card and two
 * headings saying the same thing — "Sign in" above "Sign in to Commit". Clerk's
 * own chrome is well made; the job here is to recolour it, not to rebuild it.
 *
 * **Use `variables`, not `elements` with Tailwind classes.** Clerk's internal
 * styles are more specific than a single Tailwind utility, so class overrides
 * silently lost — the primary button stayed Clerk's default near-black rather
 * than the brand orange. `variables` feed Clerk's own token system, so it
 * derives its hover, focus and disabled shades correctly from them.
 *
 * Colours are concrete rather than `hsl(var(--primary))` for the same reason:
 * Clerk computes derived shades from the value it is given and cannot do that
 * arithmetic on a CSS variable reference. They mirror globals.css by hand, so a
 * palette change there needs echoing here — the trade for Clerk deriving a
 * correct hover state.
 */

/** Orange-500, matching `--primary` in globals.css. */
const BRAND = "#f97316";

const LIGHT = {
  colorBackground: "#ffffff",
  colorText: "#0f172a",
  colorTextSecondary: "#64748b",
  colorInputBackground: "#ffffff",
  colorInputText: "#0f172a",
  colorNeutral: "#0f172a",
};

const DARK = {
  // Matches the lifted `--card` in dark mode, so Clerk's card reads as elevated
  // against the page rather than floating as a white slab.
  colorBackground: "#141417",
  colorText: "#fafafa",
  colorTextSecondary: "#a1a1aa",
  colorInputBackground: "#1c1c20",
  colorInputText: "#fafafa",
  colorNeutral: "#fafafa",
};

export const buildClerkAppearance = (isDark: boolean): Appearance => {
  const palette = isDark ? DARK : LIGHT;

  return {
    layout: {
      // The page already shows the wordmark directly above; Clerk repeating it
      // was part of what made the screen feel like it said everything twice.
      logoPlacement: "none",
      socialButtonsVariant: "blockButton",
      shimmer: false,
    },
    variables: {
      colorPrimary: BRAND,
      colorDanger: "#e11d48",
      colorSuccess: "#059669",
      borderRadius: "0.75rem",
      fontFamily: "var(--font-jakarta-sans), ui-sans-serif, system-ui, sans-serif",
      ...palette,
    },
    elements: {
      // Clerk's card sits inside the page's own centred column, so it should not
      // add a second drop shadow on top of the one the page already provides.
      cardBox: "shadow-none",
      card: "shadow-none",
      // Clerk's free tier requires its attribution, so the footer stays. Only
      // the extra padding around it is trimmed.
      footer: "bg-transparent",
    },
  };
};
