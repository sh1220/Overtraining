import { Kafka } from 'kafkajs';
import config from '../config.js';

const kafka = new Kafka({ clientId: 'api-server', brokers: config.kafka.brokers });

const TOPICS = ['sensors.wbgt', 'fitbit.heartrate', 'alerts.risk'];

export async function initKafkaAdmin() {
  const admin = kafka.admin();
  await admin.connect();
  const existing = await admin.listTopics();
  const toCreate = TOPICS.filter(t => !existing.includes(t)).map(topic => ({
    topic,
    numPartitions: 1,
    replicationFactor: 1,
  }));
  if (toCreate.length > 0) {
    await admin.createTopics({ topics: toCreate });
    console.log('[kafka] 토픽 생성:', toCreate.map(t => t.topic).join(', '));
  } else {
    console.log('[kafka] 토픽 이미 존재');
  }
  await admin.disconnect();
}

export { kafka };
