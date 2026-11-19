# SiteGate Backend

Three NestJS services in one monorepo.

| Service | Port |
|---|---|
| worker-service | 3001 |
| access-service | 3002 |
| audit-alert-service | 3003 |

Shared code lives in `libs/contracts`.

## Setup

Requires Node.js 20.

```bash
cd backend
npm install
npm run start:dev access-service
```

Replace `access-service` with the service you want to run, then open its port in the browser (for example `http://localhost:3002`).

## Tests

```bash
npm run test       # unit tests
npm run test:e2e   # end-to-end tests
```