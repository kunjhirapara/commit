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

- **Practice Sandbox:** Any signed-in user can work through coding problems solo at `/practice`, without needing a scheduled interview.

Roles and permissions are defined in one place — `convex/lib/permissions.ts` — and shared by the Convex functions and the browser. The database schema lives in `convex/schema.ts`.

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
```

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
- [ ] Promote your own account to `admin` (Convex dashboard). There is no
      bootstrap admin: signups are always `candidate`, and roles are granted only
      by invitation or by an existing admin.
