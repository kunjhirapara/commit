/**
 * docker-runner.ts
 * Server-side utility that executes code inside ephemeral Docker containers.
 * Each run gets a fresh, isolated container that is force-removed on exit.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";

const execFileAsync = promisify(execFile);

/** Absolute CPU/memory caps imposed on every container */
const CONTAINER_LIMITS = {
  /** Maximum wall-clock seconds before the container is killed */
  timeoutSeconds: 10,
  /** Memory hard limit (cgroup) */
  memory: "128m",
  /** CPU quota — 0.5 means half a core */
  cpus: "0.5",
  /** Disable network inside the container */
  network: "none",
};

/** Maps Monaco language IDs to Docker images + file extensions */
const LANGUAGE_CONFIG: Record<
  string,
  { image: string; ext: string; runCmd: (file: string) => string[] }
> = {
  javascript: {
    image: "node:20-alpine",
    ext: "js",
    runCmd: (file) => ["node", file],
  },
  python: {
    image: "python:3.12-alpine",
    ext: "py",
    runCmd: (file) => ["python3", file],
  },
  java: {
    image: "eclipse-temurin:21-alpine",
    ext: "java",
    // Java needs to compile then run; we wrap in sh -c
    // We copy to /tmp so javac can write the .class file, since /code is read-only
    runCmd: (file) => {
      const base = path.basename(file, ".java");
      return [
        "sh",
        "-c",
        `cp ${file} /tmp/ && cd /tmp/ && javac ${base}.java && java ${base}`,
      ];
    },
  },
};

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  executionMs: number;
}

/**
 * Runs the given source code in a Docker container for the specified language.
 * The container is always removed afterwards (--rm flag).
 */
export async function runCodeInDocker(
  language: string,
  code: string,
): Promise<ExecutionResult> {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return {
      stdout: "",
      stderr: `Unsupported language: ${language}`,
      exitCode: 1,
      timedOut: false,
      executionMs: 0,
    };
  }

  // Write code to a secure temp directory on the host
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "commit-run-"));
  const fileName =
    language === "java" ? "Solution.java" : `solution.${config.ext}`;
  const filePath = path.join(tmpDir, fileName);
  await fs.writeFile(filePath, code, "utf8");

  const containerFilePath = `/code/${fileName}`;
  const runCmd = config.runCmd(containerFilePath);

  const dockerArgs = [
    "run",
    "--rm",
    "--network",
    CONTAINER_LIMITS.network,
    "--memory",
    CONTAINER_LIMITS.memory,
    "--cpus",
    CONTAINER_LIMITS.cpus,
    "--read-only",
    "--tmpfs",
    "/tmp:size=32m",
    "-v",
    `${tmpDir}:/code:ro`,
    config.image,
    ...runCmd,
  ];

  const start = Date.now();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  let timedOut = false;

  try {
    const result = await execFileAsync("docker", dockerArgs, {
      timeout: CONTAINER_LIMITS.timeoutSeconds * 1000,
      maxBuffer: 1024 * 256, // 256 KB output cap
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException & {
      code?: string | number;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
    };

    stdout = error.stdout ?? "";
    stderr = error.stderr ?? "";
    exitCode = typeof error.code === "number" ? error.code : 1;

    if (error.killed || error.code === "ETIMEDOUT") {
      timedOut = true;
      stderr = `Execution timed out after ${CONTAINER_LIMITS.timeoutSeconds} seconds.`;
    }
  } finally {
    // Clean up temp directory (best-effort, don't crash if it fails)
    await fs
      .rm(tmpDir, { recursive: true, force: true })
      .catch(() => undefined);
  }

  return {
    stdout: stdout.slice(0, 10_000), // Hard cap on what we return to the client
    stderr: stderr.slice(0, 4_000),
    exitCode,
    timedOut,
    executionMs: Date.now() - start,
  };
}

/**
 * Pulls a Docker image if it isn't already present locally.
 * Safe to call on every server start — Docker is smart about skipping existing images.
 */
export async function ensureImage(language: string): Promise<void> {
  const config = LANGUAGE_CONFIG[language];
  if (!config) return;

  try {
    await execFileAsync("docker", ["pull", config.image]);
  } catch {
    // Non-fatal — the run step will surface the error if the image is truly missing
  }
}

export { LANGUAGE_CONFIG };
