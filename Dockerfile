# syntax=docker/dockerfile:1.7
#
# EngScroll production image. Multi-stage:
#   deps    → install ALL deps (dev incl. drizzle-kit) in a cached layer
#   builder → next build → .next/standalone bundle
#   tools   → full source + deps for one-off migrate / seed jobs (compose profile)
#   runner  → slim standalone runtime (node server.js) on PORT 3016
#
# PostgreSQL is host-installed (NOT a container); compose uses host networking
# so DATABASE_URL=...@localhost:5432 from inside the container reaches the host.

# --------- Stage 1: install deps (cached layer) -----------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Install ALL deps (incl. dev: drizzle-kit for migrations, tailwind for build).
RUN npm ci --no-audit --no-fund

# --------- Stage 2: build the Next standalone bundle ------------------------
FROM node:24-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* are inlined into the client bundle at build time → pass via ARG.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --------- Stage 3: tools (migrate / seed) ----------------------------------
# Full source + dev deps (drizzle-kit, postgres) for one-off jobs run via compose:
#   docker compose -f docker-compose.prod.yml --profile tools run --rm tools npm run db:migrate:deploy
#   docker compose -f docker-compose.prod.yml --profile tools run --rm tools npm run seed:banks:deploy
FROM node:24-alpine AS tools
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "db:migrate:deploy"]

# --------- Stage 4: runtime -------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Ho_Chi_Minh
ENV HOSTNAME=0.0.0.0
ENV PORT=3016

RUN apk add --no-cache curl tzdata \
  && cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime \
  && echo "Asia/Ho_Chi_Minh" > /etc/timezone \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next.js standalone bundle (server.js + traced node_modules incl. msedge-tts,
# postgres — kept external via serverExternalPackages, so tracing copies them).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# /api/tts caches generated MP3s under public/audio/tts (and /ex) at runtime →
# the nextjs user must own these writable dirs.
RUN mkdir -p ./public/audio/tts ./public/audio/ex \
  && chown -R nextjs:nodejs ./public/audio

USER nextjs
EXPOSE 3016

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3016/api/health > /dev/null || exit 1

CMD ["node", "server.js"]
