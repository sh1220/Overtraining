import { kafka } from './kafkaAdmin.js';
import { updateHr, updateWbgt } from './liveCache.js';
import { heartRateGauge, wbgtGauge, envTempGauge, envHumGauge, riskScoreGauge, alertsCounter, kafkaMessagesCounter } from './metrics.js';
import { calculateRisk } from './riskEngine.js';
import { broadcast, getActiveSessionIds } from '../sse/broker.js';
import pool from '../db/pool.js';

const consumer = kafka.consumer({ groupId: 'api-server-group' });
const producer = kafka.producer();

export async function startConsumer() {
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topics: ['sensors.wbgt', 'fitbit.heartrate'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      kafkaMessagesCounter.inc({ topic });
      const data = JSON.parse(message.value.toString());

      if (topic === 'sensors.wbgt') {
        await handleWbgt(data);
      } else if (topic === 'fitbit.heartrate') {
        await handleHeartRate(data);
      }
    },
  });

  console.log('[kafka] consumer 시작');
}

async function handleWbgt(data) {
  const { device_id, temperature, humidity, wbgt, ts } = data;
  updateWbgt(device_id, wbgt, temperature, humidity, ts);
  wbgtGauge.set({ device_id }, wbgt);
  if (temperature != null) envTempGauge.set({ device_id }, temperature);
  if (humidity != null) envHumGauge.set({ device_id }, humidity);

  // 활성 세션들에 WBGT 데이터 + 리스크 평가 전파
  await evaluateAndBroadcast(null, device_id);
}

async function handleHeartRate(data) {
  const { user_id, hr, ts, device_id: deviceId } = data;
  // device_id가 있으면 edge_devices.user_id 를 우선( .env USER_ID 와 로그인 유저 불일치 시에도 대시보드와 맞춤 )
  let uid = user_id;
  if (deviceId) {
    const [rows] = await pool.query('SELECT user_id FROM edge_devices WHERE device_id = ?', [deviceId]);
    if (rows.length > 0 && rows[0].user_id != null) {
      uid = rows[0].user_id;
    }
  }
  updateHr(uid, hr, ts);

  await evaluateAndBroadcast(uid, null);
}

async function evaluateAndBroadcast(userId, deviceId) {
  try {
    // 활성 세션 조회
    let query = 'SELECT ws.*, u.age FROM workout_sessions ws JOIN users u ON ws.user_id = u.id WHERE ws.status = "active"';
    const params = [];
    if (userId) { query += ' AND ws.user_id = ?'; params.push(userId); }
    const [sessions] = await pool.query(query, params);

    for (const session of sessions) {
      // liveCache에서 최신 데이터 가져오기
      const { getLatest, getAllDeviceData } = await import('./liveCache.js');
      const userCache = getLatest(session.user_id);
      const devices = getAllDeviceData();

      // 첫 번째 디바이스의 WBGT 사용 (시연에서는 pi-01 하나)
      const deviceData = Object.values(devices)[0] || {};

      // 수면점수 (daily_fitbit_snapshot에서)
      const [snapRows] = await pool.query(
        'SELECT sleep_score FROM daily_fitbit_snapshot WHERE user_id = ? ORDER BY date DESC LIMIT 1',
        [session.user_id]
      );
      const sleepScore = snapRows[0]?.sleep_score ?? null;

      const result = calculateRisk({
        sleep_score: sleepScore,
        current_hr: userCache.hr,
        age: session.age,
        wbgt: deviceData.wbgt,
      });

      // Prometheus 업데이트
      if (userCache.hr) heartRateGauge.set({ user_id: String(session.user_id), session_id: String(session.id) }, userCache.hr);
      riskScoreGauge.set({ user_id: String(session.user_id), session_id: String(session.id) }, result.risk_score);

      // SSE 브로드캐스트
      broadcast(session.id, 'update', {
        hr: userCache.hr,
        wbgt: deviceData.wbgt,
        temperature: deviceData.temperature,
        humidity: deviceData.humidity,
        ...result,
        ts: new Date().toISOString(),
      });

      // WARNING/CRITICAL이면 알림 저장
      if (result.level !== 'INFO') {
        await pool.query(
          'INSERT INTO alerts (session_id, level, risk_score, message) VALUES (?, ?, ?, ?)',
          [session.id, result.level, result.risk_score, result.recommendation]
        );
        alertsCounter.inc({ level: result.level });

        // max_risk_score 갱신
        if (result.risk_score > session.max_risk_score) {
          await pool.query('UPDATE workout_sessions SET max_risk_score = ? WHERE id = ?', [result.risk_score, session.id]);
        }

        // alerts.risk 토픽에 발행
        await producer.send({
          topic: 'alerts.risk',
          messages: [{
            value: JSON.stringify({
              session_id: session.id,
              user_id: session.user_id,
              level: result.level,
              risk_score: result.risk_score,
              message: result.recommendation,
              ts: new Date().toISOString(),
            }),
          }],
        });

        // SSE alert 이벤트
        broadcast(session.id, 'alert', {
          level: result.level,
          risk_score: result.risk_score,
          message: result.recommendation,
        });
      }
    }
  } catch (err) {
    console.error('[kafka/evaluate]', err);
  }
}
