import type { MongoTestGlobal } from './mongo.setup';

export default async function stopTestMongo() {
  await (globalThis as MongoTestGlobal).workerTestMongo?.stop();
  delete process.env.SITEGATE_WORKER_TEST_MONGO_URI;
}
