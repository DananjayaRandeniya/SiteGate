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

To try the requests in a browser, open [Worker Service Swagger](http://localhost:3001/docs).
Select **Authorize**, enter the token, and use an existing contractor ID in
the registration example.

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

From `backend`, start Kafka and MongoDB:

```bash
docker compose up -d kafka mongo kafka-ui mongo-express
```

- Kafka UI: http://localhost:8080
- Mongo Express: http://localhost:8081 (local development, no browser login)

If an existing Mongo Express container asks for a password, recreate just that
container from `backend`. This keeps MongoDB and its data volume running:

```bash
docker compose -p sitegate up -d --no-deps --force-recreate mongo-express
```

Stop everything with `docker compose down`.

## Run Worker Service in Docker

From `backend`, build and start Worker Service with its Kafka and MongoDB
containers:

```powershell
docker compose up -d --build worker-service
```

Open [Worker Service health](http://localhost:3001/health) or
[Worker Service Swagger](http://localhost:3001/docs). If port 3001 is already
in use, set `$env:WORKER_HOST_PORT = '3101'` before starting, then open port 3101.
Compose reads the local Worker Service `.env` for admin credentials.
MongoDB keeps its data in the `mongo_data` volume across normal restarts.
To stop Worker Service and its dependencies, run `docker compose --profile worker down`.
