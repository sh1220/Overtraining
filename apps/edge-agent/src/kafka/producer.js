import { Kafka } from 'kafkajs';

let producer;

export async function initProducer(brokers) {
  const kafka = new Kafka({ clientId: 'edge-agent', brokers });
  producer = kafka.producer();
  await producer.connect();
  console.log('[kafka] producer 연결 완료');
}

export async function sendWbgt(data) {
  await producer.send({
    topic: 'sensors.wbgt',
    messages: [{ value: JSON.stringify(data) }],
  });
}

export async function sendHeartRate(data) {
  await producer.send({
    topic: 'fitbit.heartrate',
    messages: [{ value: JSON.stringify(data) }],
  });
}
