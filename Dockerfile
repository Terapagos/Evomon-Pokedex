FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@10
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server ./artifacts/api-server
COPY lib/api-zod ./lib/api-zod
COPY lib/db ./lib/db
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
# The backend build bundles its dependencies and logging workers.
COPY --from=build --chown=node:node /app/artifacts/api-server/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
