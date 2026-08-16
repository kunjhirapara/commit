export const FEATURE_FLAG_DEFAULTS = {
  emailDeliveryApi: true,
  strictApiRateLimiting: true,
  telemetryIngestion: true,
  /**
   * Whether deterrent mode actually enforces anything.
   *
   * Off by default so the mode can be scheduled, stored and reported on before
   * any candidate has the screen blurred at them. Recording is unaffected —
   * this gates enforcement only, so turning it off mid-incident degrades a
   * deterrent interview to an observed one rather than to nothing.
   */
  integrityDeterrentMode: false,
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAG_DEFAULTS;

const parseFeatureFlagToken = (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const [rawName, rawValue] = trimmed.split("=");
  const name = rawName?.trim() as FeatureFlagName | undefined;

  if (!name || !(name in FEATURE_FLAG_DEFAULTS)) {
    return null;
  }

  if (!rawValue) {
    return { name, enabled: true };
  }

  const value = rawValue.trim().toLowerCase();
  return {
    name,
    enabled: value === "true" || value === "1" || value === "on",
  };
};

export const parseFeatureFlags = (
  input: string | undefined,
  defaults = FEATURE_FLAG_DEFAULTS,
) => {
  const flags: Record<FeatureFlagName, boolean> = { ...defaults };

  if (!input) return flags;

  for (const token of input.split(",")) {
    const parsed = parseFeatureFlagToken(token);
    if (!parsed) continue;

    flags[parsed.name] = parsed.enabled;
  }

  return flags;
};

export const getServerFeatureFlags = (env = process.env) =>
  parseFeatureFlags(env.FEATURE_FLAGS);

export const isServerFeatureEnabled = (
  flag: FeatureFlagName,
  env = process.env,
) => getServerFeatureFlags(env)[flag];

/**
 * Flags readable in the browser.
 *
 * Deliberately a separate variable from `FEATURE_FLAGS` rather than the same one
 * re-exported: anything named `NEXT_PUBLIC_*` is inlined into the client bundle
 * and is therefore public, so an operator has to opt a flag into that
 * explicitly rather than discovering later that a server-side toggle shipped to
 * every visitor.
 *
 * The reference below must stay a static literal — Next.js substitutes it at
 * build time and a computed lookup would resolve to nothing.
 */
export const getClientFeatureFlags = () =>
  parseFeatureFlags(process.env.NEXT_PUBLIC_FEATURE_FLAGS);

export const isClientFeatureEnabled = (flag: FeatureFlagName) =>
  getClientFeatureFlags()[flag];
