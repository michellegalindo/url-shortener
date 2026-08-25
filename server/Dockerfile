# node:22-alpine (LTS), não a versão local — a imagem precisa ser
# reprodutível independente da máquina de quem builda
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --filter server
COPY server server
RUN pnpm --filter server build

FROM base AS runtime
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN pnpm install --prod --frozen-lockfile --filter server

COPY --from=builder /app/server/dist ./server/dist
COPY server/src/infra/db/migrations ./server/src/infra/db/migrations
COPY server/drizzle.config.ts ./server/drizzle.config.ts

# usuário non-root: a imagem funciona sem isso, e é o item de "boas
# práticas" mais fácil de esquecer
RUN chown -R node:node /app
USER node

WORKDIR /app/server
EXPOSE 3333
CMD ["node", "dist/infra/http/server.js"]
