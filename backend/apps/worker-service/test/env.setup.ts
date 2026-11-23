// Nest reads these settings as soon as the application module is imported.
const mongoUri = process.env.SITEGATE_WORKER_TEST_MONGO_URI;
if (!mongoUri)
  throw new Error('The temporary Worker Service database did not start');

process.env.PORT = '3001';
process.env.MONGO_URI = mongoUri;
process.env.KAFKA_BROKERS = 'localhost:9092';
