export const FEATURE_FLAG_DEFAULTS = {
  emailDeliveryApi: true,
  strictApiRateLimiting: true,
  telemetryIngestion: true,
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
