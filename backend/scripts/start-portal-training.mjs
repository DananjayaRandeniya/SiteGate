import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const key = () => randomBytes(32).toString('base64url');
const result = spawnSync(
  'docker',
  [
    'compose',
    '-p',
    'sitegate',
    '-f',
    'backend/docker-compose.yml',
    '-f',
    'backend/compose.training.yml',
    'up',
    '-d',
    '--build',
    'web',
    'access-service',
    'audit-alert-service',
  ],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      SITEGATE_TRAINING_SESSION_SECRET: key(),
      SITEGATE_TRAINING_WORKER_TOKEN: key(),
    },
  },
);

if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
