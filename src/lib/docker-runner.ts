/**
 * docker-runner.ts
 * Server-side utility that executes code inside ephemeral Docker containers.
 * Each run gets a fresh, isolated container that is force-removed on exit.
 *
 * Code is streamed to the container over stdin instead of via a bind mount.
 * Bind mounts don't work when the app calls the host's docker daemon through
 * a mounted socket: the daemon resolves paths against its own filesystem, not
 * the calling container's, so /tmp/commit-run-xxx would mount empty.
 */

import { spawn, execFile } from "child_process";
import { promisify } from "util";

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

/** Maps Monaco language IDs to Docker images + the shell command to compile/run. */
const LANGUAGE_CONFIG: Record<string, { image: string; runCmd: string }> = {
  javascript: {
    image: "node:20-alpine",
    runCmd: "cat > /tmp/solution.js && node /tmp/solution.js",
  },
  python: {
    image: "python:3.12-alpine",
    runCmd: "cat > /tmp/solution.py && python3 /tmp/solution.py",
  },
  java: {
    image: "eclipse-temurin:21-alpine",
    runCmd:
      "cat > /tmp/Solution.java && cd /tmp && javac Solution.java && java Solution",
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
 * The container is always removed afterwards (--rm).
 * Throws on infra failures (docker CLI missing, daemon unreachable) so the
 * route layer can return 503 instead of treating them as user-code errors.
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

  const dockerArgs = [
    "run",
    "-i",
    "--rm",
    "--network", CONTAINER_LIMITS.network,
    "--memory", CONTAINER_LIMITS.memory,
    "--memory-swap", CONTAINER_LIMITS.memory, // disable swap; total RAM == memory
    "--cpus", CONTAINER_LIMITS.cpus,
    "--pids-limit", "64",                      // stop fork bombs
    "--security-opt", "no-new-privileges",     // no setuid escalation
    "--cap-drop", "ALL",                       // drop every Linux capability
    "--read-only",                             // rootfs immutable
    "--tmpfs", "/tmp:size=32m,exec,mode=1777", // only writable surface
    "-e", "HOME=/tmp",                          // avoid writes outside /tmp
    config.image,
    "sh",
    "-c",
    config.runCmd,
  ];

  return new Promise<ExecutionResult>((resolve, reject) => {
    const start = Date.now();
    const child = spawn("docker", dockerArgs);

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const MAX_OUTPUT = 256 * 1024;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, CONTAINER_LIMITS.timeoutSeconds * 1000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > MAX_OUTPUT) child.kill("SIGKILL");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > MAX_OUTPUT) child.kill("SIGKILL");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // ENOENT / EACCES on spawn → infra problem, let the route handle it.
      reject(err);
    });

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      // Daemon-level failures (exit 125) with no user output are infra issues.
      const daemonUnreachable =
        exitCode === 125 &&
        /Cannot connect to the Docker daemon|permission denied|docker daemon/i.test(
          stderr,
        );
      if (daemonUnreachable) {
        const err = new Error(stderr.trim() || "Docker daemon unreachable.");
        (err as NodeJS.ErrnoException).code = "EACCES";
        reject(err);
        return;
      }

      resolve({
        stdout: stdout.slice(0, 10_000),
        stderr: timedOut
          ? `Execution timed out after ${CONTAINER_LIMITS.timeoutSeconds} seconds.`
          : stderr.slice(0, 4_000),
        exitCode: exitCode ?? 1,
        timedOut,
        executionMs: Date.now() - start,
      });
    });

    // Pipe the source into the container.
    child.stdin.on("error", () => {
      /* container exited before we finished writing — handled by close */
    });
    child.stdin.end(code);
  });
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
