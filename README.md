# Commit 💻

Commit is a modern, real-time technical interviewing platform built with [Next.js](https://nextjs.org), [Convex](https://convex.dev/), [Clerk](https://clerk.com/), and [Stream](https://getstream.io/).

It offers real-time video, collaborative code execution, structured feedback scorecards, and scheduling tools to make technical interviewing seamless and professional.

---

## 🚀 Features

- **Real-Time Video Intervews:** Powered by Stream with customizable rooms, host controls, and health metrics.
- **Live Collaborative Code Editor:** Secure code execution environment for Python, JavaScript, and Java using Monaco Editor and Docker.
- **Identity & Roles:** Secure authentication via Clerk with a robust Hybrid RBAC (Role-Based Access Control) system.
- **Interactive Dashboards:** Comprehensive pipelines, schedules, and analytics powered by Convex's reactive datastore.
- **Structured Feedback Scorecards:** Blind-grading, weighted scoring, and internal candidate packet drafting.
- **Automated Notifications:** Email and in-app notifications with timezone-awareness and retry support.
- **Interview Integrity:** Per-interview monitoring modes, from silent recording to enforced fullscreen and blocked pastes, with an integrity report the interviewer reads during and after the call. Signals, never a score — and honest in the UI about what it cannot see.

- **Practice Sandbox:** Any signed-in user can work through coding problems solo at `/practice`, without needing a scheduled interview.

Roles and permissions are defined in one place — `convex/lib/permissions.ts` — and shared by the Convex functions and the browser. The database schema lives in `convex/schema.ts`.

### Deployment owner

`admin` is a peer group, not a hierarchy: any admin can grant admin to anyone
and demote any other admin. That is fine among people you trust and wrong for
anything only the operator should control, so a small number of actions are
reserved for the **owner**.

The owner is whoever signs in with an address listed in `OWNER_EMAILS` **on the
Convex deployment**. It is deliberately not a sixth role: a role lives in a
`users` row that admins can already reach, whereas an environment variable can
be read by the app but never written by it, so changing who owns the deployment
requires the Convex dashboard or CLI.

```bash
npx convex env set OWNER_EMAILS you@example.com
# or several
npx convex env set OWNER_EMAILS "you@example.com, cofounder@example.com"
```

Owner-only, once set:

- Granting or revoking the `admin` role, and inviting an admin.
- Changing an owner's own role or custom role — no admin can demote you.
- Assigning a custom role that carries `manageRoles`.

The owner also implicitly holds every permission, which is what makes this the
bootstrap path: set the variable, sign in, and promote yourself to `admin` from
the UI. There is no need to hand-edit the database.

Until `OWNER_EMAILS` is set, the admin-membership rules stay inert and behave
exactly as before, so deploying this cannot lock a running instance out. The
developer dashboard's health checks report `ownership` as degraded while it is
unset.

---

## 🛠️ Local Development Setup

### 1. Prerequisites

Ensure you have the following installed on your local machine:

- [Node.js](https://nodejs.org/en/) (v20+ recommended)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Required for the live code compiler)
- npm, yarn, pnpm, or bun

### 2. Set Up Environment Variables

Create a `.env.local` file in the root of the project. Your environment variables should include keys for Clerk, Convex, Stream, and SMTP (optional for local dev).

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_pub_key
CLERK_SECRET_KEY=your_clerk_secret_key
# Required for user syncing across Convex
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Stream (Video & Chat)
NEXT_PUBLIC_STREAM_API_KEY=your_stream_api_key
STREAM_SECRET_KEY=your_stream_secret_key

# App Base (For email notifications)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature flags (optional). Comma-separated name=true/false.
# Server-only flags:
FEATURE_FLAGS=emailDeliveryApi=true,strictApiRateLimiting=true
# Flags the browser needs. Anything here ships in the client bundle.
NEXT_PUBLIC_FEATURE_FLAGS=integrityDeterrentMode=false
```

### Interview integrity modes

Every interview carries an integrity mode, chosen when it is scheduled:

| Mode | What the candidate experiences |
| --- | --- |
| `off` | Nothing is recorded and no notice is shown. |
| `observe` | Focus changes, pastes and second displays are recorded. They are told before joining and never interrupted. **The default**, including for interviews scheduled before modes existed. |
| `deterrent` | The above, plus fullscreen is required, the problem and editor are hidden if they leave it, and pasting into the editor is blocked. |

`deterrent` additionally requires `integrityDeterrentMode=true` in
`NEXT_PUBLIC_FEATURE_FLAGS`. That flag is the kill switch for enforcement: with
it off, a deterrent interview degrades to `observe` — still recorded, nothing
enforced — and the pre-join notice describes the quieter behaviour that will
actually happen. Enforcement is the only part of this that acts on a candidate's
screen mid-interview, so it is off until switched on deliberately.

Design and the reasoning behind every threshold:
`docs/superpowers/specs/2026-08-15-interview-integrity-v2-design.md`. It is worth
reading §13 before relying on any of it — a candidate with a second device or an
invisible desktop overlay produces a clean report under every mode here, and no
browser-based scheme changes that.

### 3. Docker Code Compiler Setup 🐳

Commit utilizes isolated, ephemeral Docker containers to securely execute candidates' code (JS, Python, and Java). **To execute code locally, you must pull the required Docker images.**

Run the following commands in your terminal to cache the runtime images locally:

```bash
# Pull the JavaScript/Node.js runtime
docker pull node:20-alpine

# Pull the Python runtime
docker pull python:3.12-alpine

# Pull the Java runtime
docker pull eclipse-temurin:21-alpine
```

_Note: Ensure the Docker daemon is running in the background before you attempt to run any code on the platform._

The runner does not use these tags directly — `src/lib/docker-runner.ts` pins each
image by multi-arch digest, so a mutable upstream tag cannot silently change the
runtime that executes untrusted user code. The trade-off is that base-image
patches no longer arrive on their own, so refresh the digests periodically:

```bash
npm run runner:digests   # prints the current digest for each tag above
```

It queries the registry directly, so it needs network access but not a running
Docker daemon.

### 4. Install Dependencies & Run

```bash
# Install dependencies
npm install

# Start the Convex development server (in a separate terminal)
npx convex dev

# Start the Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The platform will hot-reload as you make changes.

## 🚢 Deployment

Commit handles backend infrastructure largely via **Convex Cloud**.
For the Next.js frontend, the easiest way to deploy is the [Vercel Platform](https://vercel.com).
If you wish to maintain the secure remote code execution feature in production, you must deploy the Next.js application to an environment that supports Docker execution (e.g., AWS ECS, Google Cloud Run, or a VPS with Docker installed), as Vercel Serverless Functions do not permit local Docker daemon access.

### Automatic rollout

Merging to `main` deploys Convex, then builds an arm64 image and pushes it to
GHCR. The `watchtower` service on the VM polls for that image and recreates the
`app` and `backup` containers when it changes. Nothing needs pressing.

**Set `CONVEX_DEPLOY_KEY` as a repository secret** (Settings → Secrets and
variables → Actions). Generate it in the Convex dashboard under
**Settings → Deploy keys** for the production deployment. Without it the deploy
step warns and skips, and the image still ships — which will break any screen
calling a function production does not have yet.

The ordering is the point. The frontend calls Convex functions by name, so an
image that reaches users ahead of its backend fails on whatever it added, and a
missing query is a broken dashboard rather than a graceful degradation.
Deploying Convex first, in the same workflow, means the backend is always live
before the image depending on it exists in the registry. If the Convex deploy
fails, the image is never pushed.

Portainer's stack webhook would be the usual way to have CI push a redeploy, but
it is a Business Edition feature. Watchtower polls instead, which also avoids
opening SSH to GitHub's runners — the VM exposes only HTTP today, and a stored
private key plus an inbound port is real attack surface for a convenience. The
trade is polling latency; set `WATCHTOWER_POLL_INTERVAL` (seconds, default 300).

Watchtower is scoped by label and only manages containers carrying
`com.centurylinklabs.watchtower.enable=true`, which is just `app` and `backup`.
Prometheus, Grafana, cAdvisor and node-exporter stay pinned to their exact
versions.

The GHCR package is public, so no registry credentials are needed. If you make
it private, add `REPO_USER` and `REPO_PASS` (a PAT with `read:packages`) to the
watchtower service.

### Reclaiming disk after redeploys

Each redeploy pulls a new `:latest`. The image it replaces keeps its layers but
loses its only local tag, so it becomes dangling and is never reclaimed — across
enough deploys that fills the disk.

Watchtower reclaims the image it replaces (`WATCHTOWER_CLEANUP`), which covers
the common case. The `image-gc` service is the backstop for everything else — a
manual `docker compose pull`, a half-finished pull, an image left by a container
Watchtower does not manage — and prunes dangling images daily.

It prunes **dangling only**, never `-a`: `docker image prune -a` removes any
image without a *running* container, which would delete `node:20-alpine`,
`python:3.12-alpine` and `eclipse-temurin:21-alpine` between code runs and force
a re-pull on every execution.

It mounts the Docker socket, which is root-equivalent on the host. The app
container already mounts it for the code runner, so this adds no new class of
access — but if you would rather not have a second container holding it, delete
the service and add `0 4 * * * docker image prune -f` to the host crontab
instead. Set `IMAGE_GC_INTERVAL_SECONDS` to change the cadence.

### Clerk + Convex Auth

Convex validates Clerk JWTs against the issuer configured in `convex/auth.config.ts`. Set this on the Convex deployment itself, not only in `.env.local` or your Docker/Portainer environment:

```bash
npx convex env set CLERK_ISSUER_URL https://your-clerk-issuer
npx convex deploy
```

Use the issuer from the Clerk JWT template used for Convex, and keep the JWT template audience/application ID as `convex`. If this value points at a development Clerk instance while the deployed frontend uses production Clerk keys, Convex will reject browser tokens with `No auth provider found matching the given token`.

---

## 📊 Monitoring (optional)

Host metrics run behind a Compose profile, so the default stack is unchanged:

```bash
# App + backup worker only (unchanged)
docker compose up -d

# Add node-exporter, cAdvisor, Prometheus and Grafana
GRAFANA_ADMIN_PASSWORD=... docker compose --profile monitoring up -d
```

Everything binds to `127.0.0.1` — Grafana on `:3001`, Prometheus on `:9090` — so
put Grafana behind the host nginx if you want to reach it remotely, and do not
expose Prometheus. Prometheus retains 30 days or 10 GB, whichever comes first.

**Set `GRAFANA_ADMIN_PASSWORD` before exposing Grafana.** It falls back to
`changeme`; a plain default is used rather than a required-variable marker
because Compose interpolates every variable regardless of the active profile, so
a `:?` marker there would break the base stack too.

cAdvisor is the one worth watching on a small box: it shows the `commit`
container against the short-lived code-runner containers competing for the same
cores. User inflow — signups, active users, meetings, code-run volume — lives
in-app under **Dashboard → Developer → Growth and capacity**, rolled up daily by
a Convex cron.

### Resource budget

The host is 4 cores / 24 GB. Runner containers are siblings on the host daemon,
so they are *not* covered by the app container's limit and get their own caps in
`src/lib/docker-runner.ts`:

| Component | CPU | Memory |
| --- | --- | --- |
| `app` | 2.0 | 4 GB |
| code runners (3 × 0.5) | 1.5 | 384 MB |
| `backup` | 0.5 | 1 GB |
| monitoring profile | ~1.1 | ~2 GB |

The practical ceilings are external before they are local: Stream
participant-minutes first, then Convex function calls and bandwidth, then Clerk
MAU.

---

## ✅ Before opening public signup

- [ ] Rotate `STREAM_SECRET_KEY` and `CLERK_WEBHOOK_SECRET`. An earlier version
      of `convex/observability.ts` logged both to Convex function logs on every
      developer-dashboard load, so treat the old values as compromised. Update
      them in the Portainer stack env and in GitHub Actions secrets.
- [ ] Use a **production** Clerk instance, with the domain, redirect URLs and
      webhook endpoint pointing at the public origin, and **email verification
      required at signup** — the code runner refuses unverified accounts.
- [ ] Confirm `CLERK_ISSUER_URL` on the Convex deployment matches that instance.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the public origin so invitation links resolve.
- [ ] Restore-test one backup zip from the `backup-data` volume.
- [ ] Set `OWNER_EMAILS` on the Convex deployment to your own address, then sign
      in and promote yourself to `admin` from the UI. Until this is set, any
      admin can grant and revoke admin — including demoting you. See
      **Deployment owner** above.
