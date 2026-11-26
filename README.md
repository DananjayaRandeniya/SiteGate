# SiteGate

SiteGate helps construction sites manage worker credentials and decide who can enter. This repository contains the three backend services and their shared Kafka event definitions.

| Service | What it does | Port |
| --- | --- | --- |
| Worker Service | Registers workers and manages credentials and site assignments | 3001 |
| Access Service | Keeps local copies of worker and credential records for gate access | 3002 |
| Audit & Alert Service | Records activity and raises alerts | 3003 |

## Run Worker Service on Windows

Open the SiteGate folder in VS Code. You need Node.js 26 and Docker Desktop running.

### 1. Start MongoDB and Kafka

Run these commands in the PowerShell terminal from the SiteGate folder:

```powershell
cd backend
docker compose -p sitegate up -d kafka mongo kafka-ui mongo-express
npm.cmd ci
npm.cmd run topics:create
```

Kafka carries messages between services. MongoDB stores their records. `npm.cmd ci` installs the exact packages listed in the lockfile.

### 2. Set up Worker Service

From `backend`, copy the example settings if you do not have a local file yet:

```powershell
if (!(Test-Path apps/worker-service/.env)) {
    Copy-Item apps/worker-service/.env.example apps/worker-service/.env
}
```

To register workers, open `apps/worker-service/.env` and set `WORKER_ADMIN_TOKEN` to a private value of at least 32 characters with no spaces. Keep the value in your local `.env` file.

### 3. Start Worker Service

```powershell
npm.cmd run start:dev worker-service
```

Keep that terminal open while you use the service. Open [Swagger](http://localhost:3001/docs) to try the API. Select **Authorize** and enter your token before using **POST /workers**. Use **GET /contractors** to find an existing contractor ID, or create one with **POST /contractors**.

| Page | What to look for |
| --- | --- |
| [Worker health](http://localhost:3001/health) | `status: ok` when Worker Service can reach MongoDB |
| [Kafka UI](http://localhost:8080) | Topics and messages |
| [Mongo Express](http://localhost:8081) | Local MongoDB databases |

## Run Worker Service in Docker

From `backend`, use this command in place of the `start:dev` command:

```powershell
docker compose -p sitegate up -d --build worker-service
```

Worker Service uses port 3001 in either setup. Press **Ctrl+C** in the terminal to stop the PowerShell version before starting the Docker version. To stop just the Docker version, run `docker compose -p sitegate --profile worker stop worker-service`.

## If Mongo Express says Unauthorized

From `backend`, recreate just the Mongo Express container:

```powershell
docker compose -p sitegate up -d --no-deps --force-recreate mongo-express
```

Reload [Mongo Express](http://localhost:8081/). The command keeps MongoDB and its data volume running.

## Working with the team

Create a branch for your story. Keep related changes in one pull request and get one teammate approval before squash merging.
