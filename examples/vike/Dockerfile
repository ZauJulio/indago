# Vike (Hono) SSR image for vike.
#
# HyperDown's build-time writer is spawned as a `bun` subprocess and the SSR
# server reads SQLite via bun:sqlite, so we build AND run on the Bun image.

# ── Stage 1: install + build ─────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .
# Emits prerendered HTML (dist/client), the SSR server (dist/server) and the
# content SQLite DBs (dist/metadata).
RUN bun run build

# ── Stage 2: run the SSR server ──────────────────────────────
FROM oven/bun:1-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000
CMD ["bun", "dist/server/index.mjs"]
