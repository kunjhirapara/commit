FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are embedded into the client bundle at build time
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_STREAM_API_KEY
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL \
    NEXT_PUBLIC_STREAM_API_KEY=$NEXT_PUBLIC_STREAM_API_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Required so /api/execute can spawn ephemeral runtime containers via the
# mounted /var/run/docker.sock. Without this the spawn fails with ENOENT.
RUN apk add --no-cache docker-cli

# DOCKER_GID must match the host's docker group GID; the nextjs user is added
# to that group so it can write to the mounted docker socket without root.
# If the GID is already claimed by another Alpine system group (e.g. `ping`
# at 999), reuse that group rather than failing the build.
ARG DOCKER_GID=999
RUN set -eux; \
    addgroup --system --gid 1001 nodejs; \
    adduser  --system --uid 1001 --ingroup nodejs nextjs; \
    if getent group "${DOCKER_GID}" >/dev/null; then \
        existing="$(getent group "${DOCKER_GID}" | cut -d: -f1)"; \
        addgroup nextjs "$existing"; \
    else \
        addgroup --system --gid "${DOCKER_GID}" docker; \
        addgroup nextjs docker; \
    fi

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
