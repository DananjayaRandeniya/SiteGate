FROM node:26-alpine3.24 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN mkdir -p public && SITEGATE_STANDALONE=1 npm run build

FROM node:26-alpine3.24 AS node-runtime
RUN apk add --no-cache binutils \
    && strip --strip-unneeded -o /web-node /usr/local/bin/node

FROM alpine:3.24 AS runtime
RUN apk add --no-cache ca-certificates libatomic libstdc++ \
    && addgroup -g 1000 node \
    && adduser -D -u 1000 -G node node
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=node-runtime /web-node /usr/local/bin/node
COPY --from=build --chown=node:node /app/.next/standalone/ ./
COPY --from=build --chown=node:node /app/.next/static/ ./.next/static/
COPY --from=build --chown=node:node /app/public/ ./public/
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
