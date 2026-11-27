import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { cp, mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("../../", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const tempParent = await realpath(tmpdir());
const preview = await mkdtemp(join(tempParent, "sitegate-worker-e2e-"));
const project = `sitegate-worker-e2e-${randomBytes(6).toString("hex")}`;
const secret = () => randomBytes(32).toString("base64url");
const workerToken = secret();
const interrupted = new AbortController();
let next;

process.once("SIGINT", () => interrupted.abort());
process.once("SIGTERM", () => interrupted.abort());

const compose = [
  "compose",
  "-p",
  project,
  "-f",
  "backend/docker-compose.yml",
  "-f",
  "frontend/tests/e2e/worker-compose.override.yml",
];
const dockerEnv = { ...process.env, SITEGATE_E2E_WORKER_TOKEN: workerToken };

function run(
  command,
  args,
  {
    cwd = frontend,
    env = process.env,
    capture = false,
    signal = interrupted.signal,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      signal: signal ?? undefined,
      stdio: ["ignore", capture ? "pipe" : "inherit", "inherit"],
    });
    let stdout = "";
    child.stdout?.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${command} exited with status ${code}`));
    });
  });
}

const docker = (args, options = {}) =>
  run("docker", [...compose, ...args], {
    cwd: root,
    env: dockerEnv,
    ...options,
  });

async function availablePort() {
  const socket = createServer().listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function waitForPortal(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (next.exitCode !== null || next.signalCode !== null) break;
    interrupted.signal.throwIfAborted();
    const ready = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(1000),
    }).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) return;
    await delay(500, undefined, { signal: interrupted.signal });
  }
  throw new Error("The isolated Worker portal did not start.");
}

try {
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Start this test with npm run test:e2e:worker.");

  await cp(frontend, preview, {
    recursive: true,
    filter(source) {
      const top = relative(frontend, source).split(/[/\\]/)[0];
      return (
        ![
          "node_modules",
          ".next",
          "out",
          "coverage",
          "test-results",
          "playwright-report",
          "next-env.d.ts",
          "tsconfig.tsbuildinfo",
          "tests",
        ].includes(top) && !top.startsWith(".env")
      );
    },
  });

  console.log(
    "Building a disposable portal and starting isolated Worker containers.",
  );
  const preparation = await Promise.allSettled([
    run(process.execPath, [npm, "ci", "--no-audit", "--no-fund"], {
      cwd: preview,
    }).then(() =>
      run(process.execPath, [npm, "run", "build"], { cwd: preview }),
    ),
    docker([
      "up",
      "-d",
      "--build",
      "--wait",
      "--wait-timeout",
      "150",
      "worker-service",
    ]),
  ]);
  for (const result of preparation) {
    if (result.status === "rejected") throw result.reason;
  }

  const workerAddress = await docker(["port", "worker-service", "3001"], {
    capture: true,
  });
  if (!/^127\.0\.0\.1:\d+$/.test(workerAddress))
    throw new Error("Unexpected Worker test address.");
  const port = await availablePort();
  const testEnv = {
    ...process.env,
    WORKER_SERVICE_URL: `http://${workerAddress}`,
    WORKER_ADMIN_TOKEN: workerToken,
    SITEGATE_E2E_PORTAL_URL: `http://127.0.0.1:${port}`,
    SITEGATE_MOCK_SESSION_SECRET: secret(),
  };
  next = spawn(
    process.execPath,
    [
      join(preview, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: preview, env: testEnv, stdio: "inherit" },
  );
  next.on("error", (error) => console.error(error.message));
  await waitForPortal(testEnv.SITEGATE_E2E_PORTAL_URL);
  await run(
    process.execPath,
    [
      npm,
      "exec",
      "--",
      "playwright",
      "test",
      "--config",
      "playwright.worker.config.mts",
    ],
    { env: testEnv },
  );
} finally {
  if (next?.pid && next.exitCode === null && next.signalCode === null) {
    const closed = once(next, "close");
    next.kill();
    await closed;
  }
  try {
    await docker(["down", "--volumes", "--rmi", "local"], { signal: null });
  } finally {
    const resolved = await realpath(preview);
    if (
      /^sitegate-worker-e2e-[a-zA-Z0-9]+$/.test(relative(tempParent, resolved))
    ) {
      await rm(resolved, { recursive: true, force: true });
    }
  }
}
