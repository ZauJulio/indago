# Next.js (App Router, SSR) image for __PROJECT_NAME__.
#
# The content codegen prebuild spawns HyperDown's `bun` writer subprocess and the
# SSR server reads SQLite (bun:sqlite under Bun), so we build AND run on Bun.

# ── Stage 1: install + build ─────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .
# `prebuild` runs the engines' codegen (.hyper-down, metadata/*.db), then next build.
RUN bun run build

# ── Stage 2: run ─────────────────────────────────────────────
FROM oven/bun:1-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000
CMD ["bun", "run", "start"]
