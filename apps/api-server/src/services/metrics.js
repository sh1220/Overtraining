import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const heartRateGauge = new client.Gauge({
  name: 'heart_rate_bpm',
  help: 'Current heart rate in BPM',
  labelNames: ['user_id', 'session_id'],
  registers: [register],
});

export const wbgtGauge = new client.Gauge({
  name: 'wbgt_celsius',
  help: 'WBGT temperature in Celsius',
  labelNames: ['device_id'],
  registers: [register],
});

export const envTempGauge = new client.Gauge({
  name: 'env_temperature_celsius',
  help: 'Environment temperature in Celsius',
  labelNames: ['device_id'],
  registers: [register],
});

export const envHumGauge = new client.Gauge({
  name: 'env_humidity_percent',
  help: 'Environment humidity percentage',
  labelNames: ['device_id'],
  registers: [register],
});

export const riskScoreGauge = new client.Gauge({
  name: 'risk_score',
  help: 'Current risk score',
  labelNames: ['user_id', 'session_id'],
  registers: [register],
});

export const alertsCounter = new client.Counter({
  name: 'alerts_total',
  help: 'Total alerts by level',
  labelNames: ['level'],
  registers: [register],
});

export const kafkaMessagesCounter = new client.Counter({
  name: 'kafka_messages_consumed_total',
  help: 'Total Kafka messages consumed',
  labelNames: ['topic'],
  registers: [register],
});

export const fitbitApiCounter = new client.Counter({
  name: 'fitbit_api_calls_total',
  help: 'Total Fitbit API calls',
  labelNames: ['endpoint', 'status'],
  registers: [register],
});

export function metricsMiddleware(req, res, next) {
  next();
}

export async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
