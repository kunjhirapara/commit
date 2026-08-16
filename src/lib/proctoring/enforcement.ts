import {
  isEnforcing,
  isMonitored,
  resolveIntegrityMode,
  type IntegrityMode,
} from "../../../convex/lib/integrityModes.ts";
import { isClientFeatureEnabled } from "../featureFlags.ts";

/**
 * What the browser should actually do for this interview.
 *
 * `MeetingSetup` and `MeetingRoom` both receive the same interview document and
 * both need this answer — one to decide what the disclosure promises, the other
 * to decide whether to blur the screen. Deriving it twice is how the notice and
 * the behaviour drift apart, so it is derived once here.
 *
 * `integrityDeterrentMode` is the kill switch. Enforcement is the risky half of
 * this feature — it blurs a candidate's screen mid-interview — so there has to
 * be a way to stop it without editing already-scheduled interviews. When it is
 * off, a `deterrent` interview degrades to `observe`: still recorded, nothing
 * enforced, and the disclosure describes the quieter behaviour that will
 * actually happen.
 */
export type EnforcementState = {
  /** The mode as scheduled, before the kill switch. What the report calls it. */
  scheduledMode: IntegrityMode;
  /** The mode the candidate actually experiences. Drives the disclosure copy. */
  mode: IntegrityMode;
  /** Whether rules are enforced: fullscreen required, content masked, paste blocked. */
  enforcing: boolean;
  /** Whether anything is recorded at all. */
  monitored: boolean;
};

export const resolveEnforcement = (
  rawMode: string | undefined,
): EnforcementState => {
  const scheduledMode = resolveIntegrityMode(rawMode);

  const killSwitchOff =
    isEnforcing(scheduledMode) &&
    !isClientFeatureEnabled("integrityDeterrentMode");

  const mode: IntegrityMode = killSwitchOff ? "observe" : scheduledMode;

  return {
    scheduledMode,
    mode,
    enforcing: isEnforcing(mode),
    monitored: isMonitored(mode),
  };
};
