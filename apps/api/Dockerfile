# ─── Build stage ────────────────────────────────────────
FROM oven/bun:latest AS builder
WORKDIR /app

COPY package.json bun.lock pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

RUN bun install && cd apps/api && bun run build

# ─── Production stage ──────────────────────────────────
FROM oven/bun:latest AS runner
WORKDIR /app

# @repo/* are TypeScript-SOURCE workspace packages (package.json main =
# src/index.ts) resolved via the ROOT package.json "workspaces" field — there
# is NO node_modules/@repo; bun points straight at packages/*. tsup externalizes
# them (dist does `import { repos } from "@repo/db"`), so the runner MUST ship
# the whole workspace, not just apps/api/dist:
#   • root manifests (the "workspaces" field is what resolves @repo/*)
#   • packages/ — incl. packages/db/drizzle, which the DB client auto-migrates
#     from on boot (MIGRATIONS_DIR = resolve(packages/db/src, "../drizzle"))
#   • node_modules (bun-installed on this same linux base)
#   • the compiled apps/api/dist (+ apps/api/package.json)
# Copying only apps/api/dist + node_modules (the previous version) made
# @repo/db unresolvable and the API crashed on startup.
COPY --from=builder /app/package.json /app/bun.lock /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api

ENV NODE_ENV=production
EXPOSE 4000
CMD ["bun", "run", "apps/api/dist/index.js"]
