# SiteGate Backend

Three NestJS services in one monorepo.

| Service | Port |
|---|---|
| worker-service | 3001 |
| access-service | 3002 |
| audit-alert-service | 3003 |

Shared code lives in `libs/contracts`.

## Setup

Requires Node.js 26.

```bash
cd backend
npm install
npm run start:dev access-service
```

Replace `access-service` with the service you want to run, then open its port in the browser (for example `http://localhost:3002`).

## Register a worker

For local development, set a private `WORKER_ADMIN_TOKEN` (at least 32 characters)
in `apps/worker-service/.env` before starting Worker Service. Call
`POST /workers` with `Authorization: Bearer <token>`. The portal's server
should forward this token only after verifying the Site Admin role.

A successful request returns `201` and the new worker's `id`. A credential
that is already assigned returns `409 CREDENTIAL_IN_USE`.

If the API returns `503 REGISTRATION_EVENT_UNCONFIRMED`, the worker was saved.
Use the response's `correlationId` to find the worker ID and unconfirmed topic
in the service logs. Before replaying anything, check the corresponding Kafka
topics for that worker and correlation ID. Reconcile missing events with the
team using the saved worker record.

## List workers

`GET /workers?page=1&limit=20` returns `items`, `page`, `limit`, `total`, and
`totalPages`. Add `search` for a name or active credential number, or filter by
`status`, `contractorId`, and `siteId`. Archived workers are excluded.

## Tests

```bash
npm run test       # unit tests
npm run test:e2e   # end-to-end tests
```

## Infrastructure

From the repo root, start Kafka and MongoDB:

```bash
docker compose up -d
```

- Kafka UI: http://localhost:8080
- Mongo Express: http://localhost:8081

Stop everything with `docker compose down`.
