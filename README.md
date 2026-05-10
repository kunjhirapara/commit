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

For deeper architecture details, see our explicit [Roles Documentation](docs/roles.md), [Database Schema](docs/database.md), and [Platform Architecture](docs/architecture.md).

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
