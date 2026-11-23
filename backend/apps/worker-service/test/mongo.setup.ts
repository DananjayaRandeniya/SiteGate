import { MongoMemoryServer } from 'mongodb-memory-server-core';

export type MongoTestGlobal = typeof globalThis & {
  workerTestMongo?: MongoMemoryServer;
};

export default async function startTestMongo() {
  const mongo = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
  });
  (globalThis as MongoTestGlobal).workerTestMongo = mongo;
  process.env.SITEGATE_WORKER_TEST_MONGO_URI = mongo.getUri('workers_db');
}
