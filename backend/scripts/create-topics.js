// Creates every SiteGate topic and its .dlq topic (3 partitions each).
// Safe to run many times: topics that already exist are skipped.
const { Kafka } = require('kafkajs');

const TOPICS = [
  'worker.created',
  'worker.updated',
  'worker.deactivated',
  'credential.issued',
  'credential.revoked',
  'access.granted',
  'access.denied',
  'alert.raised',
];

async function main() {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
  const kafka = new Kafka({ clientId: 'topic-creator', brokers });
  const admin = kafka.admin();

  await admin.connect();
  const names = TOPICS.flatMap((t) => [t, `${t}.dlq`]);
  const created = await admin.createTopics({
    waitForLeaders: true,
    topics: names.map((topic) => ({
      topic,
      numPartitions: 3,
      replicationFactor: 1, // we only have one local broker
    })),
  });
  console.log(created ? `Created topics (${names.length} total)` : 'All topics already exist');
  await admin.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});