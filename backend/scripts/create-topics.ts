// Creates every SiteGate topic and its .dlq topic (3 partitions each).
// Safe to run many times: topics that already exist are skipped.
import { Kafka, logLevel } from 'kafkajs';
import { Topics, dlqTopic } from '../libs/contracts/src';

async function main() {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  const kafka = new Kafka({ clientId: 'topic-creator', brokers, logLevel: logLevel.NOTHING });
  const admin = kafka.admin();

  await admin.connect();

  const names = Object.values(Topics).flatMap((t) => [t, dlqTopic(t)]);

  const created = await admin.createTopics({
    waitForLeaders: true,
    topics: names.map((topic) => ({
      topic,
      numPartitions: 3,
      replicationFactor: 1, // we only have one local broker
    })),
  });

  console.log(
    created ? `Created topics (${names.length} total)` : 'All topics already exist',
  );
  await admin.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});