# TanStack Start (SSR) image for tanstack.
#
# HyperDown's build-time writer is spawned as a `bun` subprocess, so we build on
# the Bun image; the SSR server reads SQLite via node:sqlite at runtime (works
# on Bun too).

# ── Stage 1: install + build ─────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .
# Emits the node SSR server under .output and the content SQLite DBs.
RUN bun run build

# ── Stage 2: run the SSR server ──────────────────────────────
FROM oven/bun:1-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000
CMD ["node", "serve.js"]
