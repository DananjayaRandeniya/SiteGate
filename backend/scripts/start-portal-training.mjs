import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const projectLabel = 'com.docker.compose.project';
const directoryLabel = 'com.docker.compose.project.working_dir';

function dockerOutput(args) {
  const result = spawnSync('docker', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      'Could not read the Docker stack. Open Docker Desktop and try again.',
    );
  }
  return result.stdout.trim();
}

function inspect(ids) {
  return ids.length
    ? JSON.parse(dockerOutput(['inspect', '--type', 'container', ...ids]))
    : [];
}

function listContainers(filters, runningOnly = false) {
  const args = ['ps', '-q'];
  if (!runningOnly) args.push('-a');
  for (const filter of filters) args.push('--filter', filter);
  return dockerOutput(args).split(/\s+/).filter(Boolean);
}

function findProject() {
  const shared = inspect(listContainers(['name=^/(kafka|kafka-init|mongo)$']));
  const projects = new Set();
  for (const { Name, Config } of shared) {
    const project = Config.Labels?.[projectLabel];
    const directory = Config.Labels?.[directoryLabel];
    if (
      !project ||
      !directory ||
      (relative(projectRoot, directory) !== '' &&
        relative(backendRoot, directory) !== '')
    ) {
      throw new Error(
        `Docker container ${Name} belongs to another setup. Check which Docker project owns it before starting SiteGate.`,
      );
    }
    projects.add(project);
  }
  if (projects.size > 1) {
    throw new Error(
      `Kafka and MongoDB are split across Docker projects (${[...projects].join(', ')}). Use a single SiteGate stack so its data stays together.`,
    );
  }
  return projects.values().next().value ?? 'sitegate';
}

function findService(project, service, runningOnly = false) {
  const containers = inspect(
    listContainers(
      [
        `label=${projectLabel}=${project}`,
        `label=com.docker.compose.service=${service}`,
      ],
      runningOnly,
    ),
  );
  return (
    containers.find((container) => container.State.Running) ?? containers[0]
  );
}

function readKey(container, name) {
  const prefix = `${name}=`;
  const value = container?.Config.Env?.find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  return value && Buffer.byteLength(value) >= 32 && !/\s/.test(value)
    ? value
    : undefined;
}

const key = () => randomBytes(32).toString('base64url');

function run() {
  const option = process.argv[2];
  if (process.argv.length > 3 || (option && option !== '--postman-token')) {
    throw new Error(
      'Usage: node backend/scripts/start-portal-training.mjs [--postman-token]',
    );
  }

  const project = findProject();
  const worker = findService(
    project,
    'worker-service',
    option === '--postman-token',
  );
  const workerToken = readKey(worker, 'WORKER_ADMIN_TOKEN');

  if (option === '--postman-token') {
    if (!workerToken) {
      throw new Error(
        'Start the SiteGate training stack before copying its Worker token.',
      );
    }
    process.stdout.write(workerToken);
    return;
  }

  const web = findService(project, 'web');
  const hostPort =
    process.env.WEB_HOST_PORT ||
    web?.NetworkSettings.Ports?.['3000/tcp']?.[0]?.HostPort ||
    '3000';
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-p',
      project,
      '-f',
      'backend/docker-compose.yml',
      '-f',
      'backend/compose.training.yml',
      'up',
      '-d',
      '--build',
      '--wait',
      'web',
      'access-service',
      'audit-alert-service',
    ],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        WEB_HOST_PORT: hostPort,
        SITEGATE_TRAINING_SESSION_SECRET:
          readKey(web, 'SITEGATE_MOCK_SESSION_SECRET') ?? key(),
        SITEGATE_TRAINING_WORKER_TOKEN:
          workerToken ?? readKey(web, 'WORKER_ADMIN_TOKEN') ?? key(),
      },
    },
  );

  if (result.status !== 0) {
    throw new Error(
      'SiteGate did not start. Check the Docker error above. If the web port is busy, set WEB_HOST_PORT to 3100 and retry.',
    );
  }
  console.log(
    `Sign in at http://localhost:${hostPort}/login (Docker project: ${project}).`,
  );
  console.log(
    'For Postman, run the same script with --postman-token to get this machine’s Worker token.',
  );
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
