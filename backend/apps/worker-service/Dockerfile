FROM node:26-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY nest-cli.json tsconfig.json ./
COPY apps/worker-service/ ./apps/worker-service/
COPY libs/contracts/ ./libs/contracts/
RUN npm run build -- worker-service

FROM node:26-alpine3.24 AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# Swagger's optional TypeScript peer is for its build-time plugin.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && rm -rf node_modules/typescript \
    && find node_modules -type f \( -name '*.map' -o -name '*.ts' -o -name '*.cts' -o -name '*.mts' \
      -o -iname 'readme*' -o -iname 'changelog*' \) -delete

FROM node:26-alpine3.24 AS node-runtime
RUN apk add --no-cache binutils \
    && strip --strip-unneeded -o /worker-node /usr/local/bin/node

FROM alpine:3.24 AS runtime
RUN apk add --no-cache ca-certificates libatomic libstdc++ \
    && addgroup -g 1000 node \
    && adduser -D -u 1000 -G node node
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=node-runtime /worker-node /usr/local/bin/node
COPY --chown=node:node package.json ./
COPY --from=production-dependencies --chown=node:node /app/node_modules/ ./node_modules/
COPY --from=build --chown=node:node /app/dist/apps/worker-service/ ./dist/apps/worker-service/
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(response => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/apps/worker-service/main.js"]
