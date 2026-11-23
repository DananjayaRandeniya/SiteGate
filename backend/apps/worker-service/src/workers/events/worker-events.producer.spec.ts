import { Topics } from '@app/contracts';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { WorkerEventsProducer } from './worker-events.producer';

const brokers = 'localhost:9092';
const correlationId = 'd17f3a9a-efea-4ddd-959a-2ce8128871c5';
const payload = {
  workerId: '669f2a62d20bae6882af1871',
  credentialNumber: 'C-1001',
};

function setup() {
  const kafkaProducer = new Kafka({ brokers: [brokers] }).producer();
  const connect = jest.spyOn(kafkaProducer, 'connect').mockResolvedValue();
  const send = jest.spyOn(kafkaProducer, 'send').mockResolvedValue([]);
  const disconnect = jest
    .spyOn(kafkaProducer, 'disconnect')
    .mockResolvedValue();
  jest.spyOn(Kafka.prototype, 'producer').mockReturnValue(kafkaProducer);
  const producer = new WorkerEventsProducer(
    new ConfigService({ KAFKA_BROKERS: brokers }),
  );
  return { producer, connect, send, disconnect };
}

describe('WorkerEventsProducer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the worker ID as the key and preserves the correlation ID', async () => {
    const { producer, connect, send, disconnect } = setup();
    expect(connect).not.toHaveBeenCalled();

    await Promise.all([
      producer.publish(Topics.CREDENTIAL_ISSUED, payload, correlationId),
      producer.publish(Topics.CREDENTIAL_ISSUED, payload, correlationId),
    ]);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    const [record] = send.mock.calls[0];
    expect(record.topic).toBe(Topics.CREDENTIAL_ISSUED);
    expect(record.messages[0].key).toBe(payload.workerId);
    expect(JSON.parse(String(record.messages[0].value))).toEqual({
      eventId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      eventType: Topics.CREDENTIAL_ISSUED,
      version: 1,
      occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      source: 'worker-service',
      correlationId,
      payload,
    });

    await producer.onApplicationShutdown();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('tries a new connection on the next publish after a failed connection', async () => {
    const { producer, connect, send } = setup();
    connect.mockRejectedValueOnce(new Error('Kafka unavailable'));

    await expect(
      producer.publish(Topics.CREDENTIAL_ISSUED, payload, correlationId),
    ).rejects.toThrow('Kafka unavailable');
    expect(send).not.toHaveBeenCalled();

    await producer.publish(Topics.CREDENTIAL_ISSUED, payload, correlationId);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
