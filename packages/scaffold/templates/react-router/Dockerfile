# React Router v7 (framework SSR) image for __PROJECT_NAME__.
#
# Build on Bun (HyperDown's writer is a `bun` subprocess), but RUN on Node:
# react-router-serve needs Node's `renderToPipeableStream`, which Bun's
# `react-dom/server.bun.js` doesn't export. HyperDown then reads SQLite via
# `node:sqlite` (Node ≥ 22).

# ── Stage 1: install + build ─────────────────────────────────
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .
# Emits the client + SSR server under ./build and the content SQLite DBs.
RUN bun run build

# ── Stage 2: run the SSR server (Node, not Bun) ──────────────
FROM node:24-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000
CMD ["npx", "react-router-serve", "./build/server/index.js"]
