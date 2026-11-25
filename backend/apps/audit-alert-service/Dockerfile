# ---- Build stage: has dev dependencies, compiles the service ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx nest build audit-alert-service

# ---- Runtime stage: production dependencies only ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/apps/audit-alert-service ./dist

USER node
EXPOSE 3003
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:3003/health > /dev/null || exit 1

CMD ["node", "dist/main.js"]