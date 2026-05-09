import { z } from "zod";

const requiredServerEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_STREAM_API_KEY: z.string().min(1),
  STREAM_SECRET_KEY: z.string().min(1),
});

const optionalServerEnvSchema = requiredServerEnvSchema.extend({
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
  // SMTP (optional in dev – emails are logged to console)
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  // Internal API key for email route
  INTERNAL_API_KEY: z.string().min(1).optional(),
  // App URL for email links
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  FEATURE_FLAGS: z.string().optional(),
  NEXT_PUBLIC_FEATURE_FLAGS: z.string().optional(),
});

const productionServerEnvSchema = requiredServerEnvSchema.extend({
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  // SMTP required in production
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().min(1),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM_EMAIL: z.string().email(),
  INTERNAL_API_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  FEATURE_FLAGS: z.string().optional(),
  NEXT_PUBLIC_FEATURE_FLAGS: z.string().optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_STREAM_API_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_FEATURE_FLAGS: z.string().optional(),
});

let cachedServerEnv:
  | z.infer<typeof optionalServerEnvSchema>
  | z.infer<typeof productionServerEnvSchema>
  | null = null;
let cachedClientEnv: z.infer<typeof clientEnvSchema> | null = null;

// During `next build`, secrets are not available — only NEXT_PUBLIC_* build args are.
// Validation runs at runtime when actual requests arrive.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const formatIssues = (issues: z.ZodIssue[]) =>
  issues.map((issue) => issue.path.join(".")).join(", ");

export const getValidatedServerEnv = () => {
  if (isBuildPhase)
    return process.env as z.infer<typeof productionServerEnvSchema>;
  if (cachedServerEnv) return cachedServerEnv;

  const schema =
    process.env.NODE_ENV === "production"
      ? productionServerEnvSchema
      : optionalServerEnvSchema;
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration: ${formatIssues(parsed.error.issues)}`,
    );
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
};

export const getValidatedClientEnv = () => {
  if (isBuildPhase)
    return process.env as z.infer<typeof clientEnvSchema>;
  if (cachedClientEnv) return cachedClientEnv;

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STREAM_API_KEY: process.env.NEXT_PUBLIC_STREAM_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_FEATURE_FLAGS: process.env.NEXT_PUBLIC_FEATURE_FLAGS,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid client environment configuration: ${formatIssues(parsed.error.issues)}`,
    );
  }

  cachedClientEnv = parsed.data;
  return cachedClientEnv;
};
