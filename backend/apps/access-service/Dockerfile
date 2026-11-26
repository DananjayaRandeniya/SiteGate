FROM node:26-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY nest-cli.json tsconfig.json ./
COPY apps/access-service/ ./apps/access-service/
COPY libs/contracts/ ./libs/contracts/
RUN npm run build -- access-service

FROM node:26-alpine3.24 AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && rm -rf node_modules/typescript \
    && find node_modules -type f \( -name '*.map' -o -name '*.ts' -o -name '*.cts' -o -name '*.mts' \
      -o -iname 'readme*' -o -iname 'changelog*' \) -delete

FROM node:26-alpine3.24 AS node-runtime
RUN apk add --no-cache binutils \
    && strip --strip-unneeded -o /access-node /usr/local/bin/node

FROM alpine:3.24 AS runtime
RUN apk add --no-cache ca-certificates libatomic libstdc++ \
    && addgroup -g 1000 node \
    && adduser -D -u 1000 -G node node
WORKDIR /app
ENV NODE_ENV=production PORT=3002
COPY --from=node-runtime /access-node /usr/local/bin/node
COPY --chown=node:node package.json ./
COPY --from=production-dependencies --chown=node:node /app/node_modules/ ./node_modules/
COPY --from=build --chown=node:node /app/dist/apps/access-service/ ./dist/apps/access-service/
USER node
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/apps/access-service/main.js"]
