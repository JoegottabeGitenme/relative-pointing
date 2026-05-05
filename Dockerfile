# syntax=docker/dockerfile:1.7

# ---- Stage 1: build client + compile native deps ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Build tooling for sqlite3 native module
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install workspace deps using lockfile
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --workspaces --include-workspace-root

# Copy source and build the Vue client
COPY client ./client
COPY server ./server
RUN npm run build -w client

# Drop devDependencies so we can copy a lean node_modules tree to runtime
RUN npm prune --omit=dev --workspaces --include-workspace-root

# ---- Stage 2: runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5001 \
    DB_PATH=/data/app.db

# Pull pruned deps + server source + built client from the builder.
# Copying the workspace dirs whole brings along any per-workspace
# node_modules that npm didn't hoist to the root.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/package.json ./client/package.json
COPY --from=builder /app/client/dist ./client/dist

# SQLite data lives outside the app tree so it can be a clean volume mount.
# Owned by `node` so the unprivileged process can create app.db on first run.
RUN mkdir -p /data \
 && chown -R node:node /app /data
VOLUME ["/data"]

USER node

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.js"]
