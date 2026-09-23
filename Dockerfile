# syntax=docker/dockerfile:1

# The Roster web app, as one image. Built for Railway, but nothing here is
# Railway-specific: the container listens on $PORT and needs only the
# environment variables listed in .env.example.
#
# The build runs from the repository root — pnpm workspace packages are
# consumed as TypeScript source, so `apps/web` alone cannot be built.

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app


# ---------------------------------------------------------------- dependencies
# Manifests only, so a source edit does not re-resolve the dependency tree.
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
# The desktop shell builds nothing here, but --frozen-lockfile compares the
# lockfile against every workspace member, so its manifest has to be present.
COPY apps/tauri/package.json apps/tauri/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/cli/package.json packages/cli/
COPY packages/db/package.json packages/db/
COPY packages/superset/package.json packages/superset/
COPY packages/ui/package.json packages/ui/

# No BuildKit cache mount on purpose: Railway rejects a mount whose id is not
# scoped to the service, and pinning this file to one platform's cache key
# buys less than the layer cache above already does — an unchanged manifest
# skips the install outright.
RUN pnpm install --frozen-lockfile


# --------------------------------------------------------------------- builder
FROM base AS builder

# `NEXT_PUBLIC_*` is inlined into the browser bundle at build time, so the
# public URL has to be known here — not at `docker run`. On Railway, service
# variables are passed to the build as arguments, so setting
# NEXT_PUBLIC_APP_URL on the service is enough.
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# `@roster/db` reads DATABASE_URL when it is imported, which Next does while
# collecting routes. Nothing connects during a build, so a placeholder is
# enough — and keeps a real connection string out of the image layers.
ARG DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV DATABASE_URL=$DATABASE_URL

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/cli/node_modules ./packages/cli/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/superset/node_modules ./packages/superset/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY . .

RUN pnpm --filter @roster/web build

# The worker, bundled to one self-contained file. It ships in this same image
# and the worker service just starts it instead of the web server — no second
# Dockerfile, and no node_modules needed at runtime.
RUN pnpm --filter @roster/worker build


# ---------------------------------------------------------------------- runner
FROM base AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# su-exec drops privileges in the entrypoint, after the volume is mounted.
RUN apk add --no-cache su-exec \
    && addgroup -g 1001 -S nodejs \
    && adduser -u 1001 -S nextjs -G nodejs

# `.next-build` rather than `.next`: the app's build script puts its output
# there so a build never stomps a running `next dev`. The standalone server
# carries that path inside it, so the image has to match.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next-build/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next-build/static ./apps/web/.next-build/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# The generated SQL, which the server applies on boot. Next traces JavaScript
# imports; `.sql` files are data and have to be carried across by hand.
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle ./packages/db/drizzle

# The worker. One bundled file with nothing to resolve at runtime, so the
# background tier runs from this image either as its own service:
#   node apps/worker/dist/worker.js
# or alongside the web server in this container, with ROSTER_RUN_WORKER=1.
COPY --from=builder --chown=nextjs:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --chown=nextjs:nodejs docker/start.mjs ./docker/start.mjs

# Message attachments. Ephemeral unless a volume is mounted here — see the
# deployment notes in the README.
ENV UPLOADS_DIR=/app/uploads
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# A volume mounted over that directory arrives owned by root, so the entrypoint
# re-owns it after the mount and then drops to `nextjs` with su-exec. Staying
# root here is what makes that possible; the server itself never runs as root.
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "docker/start.mjs"]
