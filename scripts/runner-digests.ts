/**
 * Prints the current multi-arch manifest digest for each code-runner base image.
 *
 * `src/lib/docker-runner.ts` pins these by digest so a mutable upstream tag cannot
 * silently change the runtime that executes untrusted user code. The cost of that
 * is losing automatic base-image patches, so run this periodically and paste the
 * new digests in deliberately:
 *
 *   npm run runner:digests
 *
 * Requires network access but not a Docker daemon — it talks to the registry API
 * directly, so it works in CI and on a dev box with Docker Desktop stopped.
 */

export {};

const IMAGES = [
  { repo: "node", tag: "20-alpine" },
  { repo: "python", tag: "3.12-alpine" },
  { repo: "eclipse-temurin", tag: "21-alpine" },
];

// Docker Hub namespaces official images under `library/`, and even anonymous
// pulls need a bearer token scoped to the repository.
const getToken = async (repo: string) => {
  const response = await fetch(
    `https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/${repo}:pull`,
  );

  if (!response.ok) {
    throw new Error(`Token request failed for ${repo}: ${response.status}`);
  }

  const body = (await response.json()) as { token?: string };
  if (!body.token) throw new Error(`No token returned for ${repo}`);

  return body.token;
};

const getDigest = async (repo: string, tag: string) => {
  const token = await getToken(repo);
  const response = await fetch(
    `https://registry-1.docker.io/v2/library/${repo}/manifests/${tag}`,
    {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${token}`,
        // Ask for the index rather than a platform manifest, so the digest we pin
        // resolves on arm64 (the VM) and amd64 (dev machines) alike.
        Accept: [
          "application/vnd.oci.image.index.v1+json",
          "application/vnd.docker.distribution.manifest.list.v2+json",
        ].join(","),
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Manifest request failed for ${repo}:${tag}: ${response.status}`);
  }

  const digest = response.headers.get("docker-content-digest");
  if (!digest) throw new Error(`No digest header for ${repo}:${tag}`);

  return digest;
};

const main = async () => {
  let failed = false;

  for (const { repo, tag } of IMAGES) {
    try {
      const digest = await getDigest(repo, tag);
      console.log(`${repo}:${tag}\n  ${repo}@${digest}\n`);
    } catch (error) {
      failed = true;
      console.error(
        `${repo}:${tag} -> ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  if (failed) process.exitCode = 1;
};

await main();
