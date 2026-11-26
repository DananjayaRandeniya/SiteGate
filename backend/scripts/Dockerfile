# One-shot job that creates all Kafka topics, then exits.
   FROM node:26-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY libs ./libs
   COPY scripts ./scripts
   CMD ["npx", "tsx", "scripts/create-topics.ts"]