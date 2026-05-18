import cron from "node-cron";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), "Backup");
const SCHEDULE = process.env.BACKUP_CRON ?? "0 0 * * *";
const TIMEZONE = process.env.BACKUP_TZ ?? "UTC";
const RETENTION_COUNT = Math.max(1, Number(process.env.BACKUP_RETENTION ?? 14));
const RUN_ON_START = process.env.BACKUP_RUN_ON_START === "1";

const CONVEX_DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY;
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

function log(level: "info" | "warn" | "error", message: string) {
  const line = `[backup] [${new Date().toISOString()}] [${level}] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

if (!CONVEX_DEPLOY_KEY) {
  log("error", "CONVEX_DEPLOY_KEY is not set — refusing to start.");
  process.exit(1);
}

if (!cron.validate(SCHEDULE)) {
  log("error", `Invalid BACKUP_CRON expression: "${SCHEDULE}"`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function timestamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}` +
    `_${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(now.getUTCSeconds())}Z`
  );
}

function runCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with code ${code}: ${stderr.trim() || stdout.trim()}`,
          ),
        );
      }
    });
  });
}

function pruneOldBackups() {
  let entries: { name: string; mtime: number }[] = [];
  try {
    entries = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => name.startsWith("db-backup-") && name.endsWith(".zip"))
      .map((name) => ({
        name,
        mtime: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch (error) {
    log("warn", `Could not list backups for pruning: ${(error as Error).message}`);
    return;
  }

  for (const stale of entries.slice(RETENTION_COUNT)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, stale.name));
      log("info", `Pruned old backup ${stale.name}`);
    } catch (error) {
      log("warn", `Failed to prune ${stale.name}: ${(error as Error).message}`);
    }
  }
}

async function reportSnapshot(args: {
  status: "available" | "failed";
  summary: string;
  storageLocation?: string;
  notes?: string;
}) {
  if (!CONVEX_SITE_URL || !INTERNAL_API_KEY) {
    log(
      "warn",
      "Skipping Convex snapshot report — NEXT_PUBLIC_CONVEX_SITE_URL or INTERNAL_API_KEY missing.",
    );
    return;
  }

  try {
    const response = await fetch(`${CONVEX_SITE_URL}/internal/backup-record`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        status: args.status,
        summary: args.summary,
        scope: "convex-export",
        storageLocation: args.storageLocation,
        notes: args.notes,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      log(
        "warn",
        `Snapshot report responded ${response.status}: ${body.slice(0, 300)}`,
      );
    }
  } catch (error) {
    log("warn", `Snapshot report failed: ${(error as Error).message}`);
  }
}

async function runBackup() {
  const ts = timestamp();
  const filePath = path.join(BACKUP_DIR, `db-backup-${ts}.zip`);
  log("info", `Starting Convex export → ${filePath}`);

  try {
    const { stdout, stderr } = await runCommand("npx", [
      "--yes",
      "convex",
      "export",
      "--path",
      filePath,
    ]);
    if (stdout.trim()) log("info", `convex export stdout: ${stdout.trim()}`);
    if (stderr.trim()) log("info", `convex export stderr: ${stderr.trim()}`);

    const stats = fs.statSync(filePath);
    log("info", `Backup OK (${stats.size} bytes) → ${filePath}`);
    pruneOldBackups();

    await reportSnapshot({
      status: "available",
      summary: "Automatic Convex export completed.",
      storageLocation: filePath,
      notes: `sizeBytes=${stats.size}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", `Backup FAILED: ${message}`);

    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // best-effort cleanup
    }

    await reportSnapshot({
      status: "failed",
      summary: "Automatic Convex export failed.",
      notes: message.slice(0, 500),
    });
  }
}

log(
  "info",
  `Backup worker started. dir="${BACKUP_DIR}" cron="${SCHEDULE}" tz=${TIMEZONE} retention=${RETENTION_COUNT}`,
);

cron.schedule(
  SCHEDULE,
  () => {
    runBackup().catch((error) =>
      log("error", `Unhandled backup error: ${(error as Error).message}`),
    );
  },
  { timezone: TIMEZONE },
);

if (RUN_ON_START) {
  runBackup().catch((error) =>
    log("error", `Startup backup error: ${(error as Error).message}`),
  );
}

const shutdown = (signal: string) => {
  log("info", `Received ${signal}, shutting down.`);
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
