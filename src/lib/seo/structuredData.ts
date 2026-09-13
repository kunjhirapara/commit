// Relative and extension-qualified, rather than the "@/" alias. The test runner
// is `node --experimental-strip-types`, which reads neither tsconfig path
// mappings nor extensionless specifiers, so either shortcut would make this
// module impossible to unit test. tsconfig sets allowImportingTsExtensions, so
// the explicit extension is equally valid to tsc and the bundler.
import { absoluteUrl } from "../siteUrl.ts";

/**
 * JSON-LD structured data for the public pages.
 *
 * This is the part of the page written for machines rather than people, and the
 * reason it is worth the effort is that AI search engines do not rank pages,
 * they cite sources — structured data is how a crawler learns what this product
 * is without inferring it from marketing copy.
 *
 * Every claim below is taken from the landing page's own copy. Structured data
 * that describes things the page does not actually say is a guidelines
 * violation, not a shortcut, and Google issues manual actions for it.
 *
 * Notably absent: FAQPage. Its schema requires the questions and answers to be
 * visible on the page, and there is no FAQ section today. Adding the markup
 * without the content would risk a manual action for the sake of a metric.
 * Write the FAQ section first; the schema is a two-line addition afterwards.
 */

const APP_NAME = "Commit";

const DESCRIPTION =
  "Run technical interviews end to end: HD video, a shared code editor, and a " +
  "sandboxed runner for JavaScript, Python and Java, plus structured scorecards.";

export const buildOrganizationSchema = (base: string) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: APP_NAME,
  url: absoluteUrl("", base),
  // Next serves the icon file convention at this extensionless path.
  logo: absoluteUrl("/icon", base),
  description: DESCRIPTION,
});

export const buildSoftwareApplicationSchema = (base: string) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_NAME,
  url: absoluteUrl("", base),
  // Required by Google for SoftwareApplication; omitting it invalidates the
  // whole block rather than just this field.
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  featureList: [
    "HD video calls with device checks and host controls",
    "Shared Monaco code editor alongside the call",
    "Sandboxed code execution for JavaScript, Python and Java",
    "Structured scorecards with weighted competencies",
    "Timezone-aware scheduling with reminders and reschedules",
    "Role-based access for candidates, interviewers, recruiters and admins",
  ],
});
