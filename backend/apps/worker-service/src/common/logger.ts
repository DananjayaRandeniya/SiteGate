import pino from 'pino';

export const workerLogger = pino({ name: 'worker-service' });
