import 'dotenv/config';
import readline from 'readline';
import { initProducer, sendWbgt } from './kafka/producer.js';
import { readSensor, initMockSensor } from './sensors/wbgt.js';
import { getFitbitToken } from './api/tokenFetcher.js';
import { pollFitbitHr, pollMockHr, setMockHr } from './fitbit/poller.js';
import { setLiveWbgt, logLive } from './liveStatus.js';
import axios from 'axios';

const {
  KAFKA_BROKERS: kafkaBrokersEnv = 'localhost:9094',
  EC2_API_BASE = 'http://localhost:3000',
  EDGE_API_KEY = '',
  DEVICE_ID = 'pi-01',
  USER_ID = '1',
  MOCK_SENSOR = 'true',
  MOCK_FITBIT = 'true',
  MOCK_RISK_DEMO = 'false',
} = process.env;

const defaultHrPollMs = MOCK_FITBIT === 'true' ? 3000 : 60_000;
const rawHrPoll = process.env.HR_POLL_INTERVAL_MS;
const HR_POLL_INTERVAL_MS =
  rawHrPoll == null || rawHrPoll === ''
    ? defaultHrPollMs
    : (() => {
        const n = parseInt(rawHrPoll, 10);
        return Number.isFinite(n) && n >= 1000 ? n : defaultHrPollMs;
      })();

if (!process.env.KAFKA_BROKERS) {
  console.warn(
    '[edge] KAFKA_BROKERS 없음 — .env에 `KAFKA_BROKERS=your-ec2-host:9094` 설정(지금은 localhost:9094 임시값)'
  );
}
const KAFKA_BROKERS = kafkaBrokersEnv;

const userId = parseInt(USER_ID);
let lastNoTokenHrLog = 0;
const NO_TOKEN_HR_LOG_MS = 15_000;

async function main() {
  console.log(`[edge] 디바이스: ${DEVICE_ID}, 사용자: ${userId}`);
  console.log(`[edge] Kafka: ${KAFKA_BROKERS}`);
  console.log(`[edge] Mock 센서: ${MOCK_SENSOR}, Mock Fitbit: ${MOCK_FITBIT}`);
  if (MOCK_RISK_DEMO === 'true' && (MOCK_SENSOR === 'true' || MOCK_FITBIT === 'true')) {
    console.log(
      '[edge] MOCK_RISK_DEMO: WBGT·심박이 EC2 risk 임계를 넘나듦(대시보드·활성 운동 세션·Kafka·USER_ID 일치 필요)'
    );
  }
  console.log(
    `[edge] HR 폴링: ${HR_POLL_INTERVAL_MS}ms` +
      (rawHrPoll == null || rawHrPoll === '' ? ` (기본, MOCK_FITBIT=${MOCK_FITBIT})` : '')
  );

  // Kafka producer 초기화
  await initProducer(KAFKA_BROKERS.split(','));

  // Mock 센서 모드 — readline 입력 처리
  if (MOCK_SENSOR === 'true') {
    initMockSensor();

    // hr 명령도 같은 stdin에서 처리
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      const parts = line.trim().split(/\s+/);
      if (parts[0]?.toLowerCase() === 'hr') {
        const val = parseInt(parts[1]);
        if (!isNaN(val)) setMockHr(val);
      }
    });
  }

  {
    const d0 = readSensor();
    setLiveWbgt({
      wbgt: d0.wbgt,
      temperature: d0.temperature,
      humidity: d0.humidity,
    });
    console.log('[edge] 터미널 요약: 심박·WBGT·기온·습도 한 줄');
    logLive();
  }

  const tickHr = async () => {
    try {
      if (MOCK_FITBIT === 'true') {
        await pollMockHr(userId);
      } else {
        const token = await getFitbitToken(EC2_API_BASE, EDGE_API_KEY, userId);
        if (token) {
          await pollFitbitHr(token, userId);
        } else {
          const t = Date.now();
          if (t - lastNoTokenHrLog >= NO_TOKEN_HR_LOG_MS) {
            lastNoTokenHrLog = t;
            console.warn(
              '[hr] Fitbit 폴링 생략: access token 없음 ([fitbit-token] 로그 참고)'
            );
          }
        }
      }
    } catch (err) {
      console.error('[hr]', err.message);
    }
  };
  await tickHr();

  // 5초마다 WBGT 센서 데이터 전송
  setInterval(async () => {
    try {
      const data = readSensor();
      const payload = {
        device_id: DEVICE_ID,
        temperature: data.temperature,
        humidity: data.humidity,
        black_globe: data.black_globe,
        wbgt: data.wbgt,
        ts: new Date().toISOString(),
      };
      await sendWbgt(payload);
      setLiveWbgt({
        wbgt: payload.wbgt,
        temperature: payload.temperature,
        humidity: payload.humidity,
      });
      logLive();
    } catch (err) {
      console.error('[wbgt]', err.message);
    }
  }, 5000);

  setInterval(tickHr, HR_POLL_INTERVAL_MS);

  // 1분마다 heartbeat
  setInterval(async () => {
    try {
      await axios.post(`${EC2_API_BASE}/api/edge/heartbeat`, {}, {
        headers: { 'X-Edge-Api-Key': EDGE_API_KEY },
      });
    } catch (err) {
      console.error('[heartbeat]', err.message);
    }
  }, 60000);

  const hrLabel =
    HR_POLL_INTERVAL_MS >= 1000
      ? `${Math.round(HR_POLL_INTERVAL_MS / 1000)}초`
      : `${HR_POLL_INTERVAL_MS}ms`;
  console.log(`[edge] 시작 완료 — 센서 5초, HR ${hrLabel}, heartbeat 1분 간격`);
}

main().catch(err => {
  console.error('[edge] 시작 실패:', err);
  process.exit(1);
});
