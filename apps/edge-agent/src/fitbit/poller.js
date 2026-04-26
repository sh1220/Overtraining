import axios from 'axios';
import { sendHeartRate } from '../kafka/producer.js';
import { setLiveHr, logLive } from '../liveStatus.js';

const DEVICE_ID = process.env.DEVICE_ID || 'pi-01';
const MOCK_RISK_DEMO = process.env.MOCK_RISK_DEMO === 'true';

const HR_FLOOR = 90;

let mockHr = HR_FLOOR;

/**
 * 일반 mock: mockHr(또는 stdin) 기준 ±4 BPM, 최소 90.
 * MOCK_RISK_DEMO: 90~180대로 흔들며 riskEngine 90/120/150을 넘나듦.
 */
function nextMockHrSample() {
  if (MOCK_RISK_DEMO) {
    const t = Date.now() / 50000;
    const wave = 0.5 + 0.5 * Math.sin(t);
    return Math.min(200, Math.max(HR_FLOOR, Math.round(HR_FLOOR + 90 * wave)));
  }
  const spread = 9; // -4..+4 정도
  const delta = Math.floor(Math.random() * spread) - Math.floor(spread / 2);
  return Math.min(200, Math.max(HR_FLOOR, mockHr + delta));
}
let lastEmptyIntradayLog = 0;
const EMPTY_LOG_INTERVAL_MS = 15_000;

// readline에서 hr 값 변경 가능
export function setMockHr(val) {
  mockHr = Math.min(200, Math.max(HR_FLOOR, val));
  setLiveHr(mockHr);
  logLive();
  if (val !== mockHr) {
    console.log(`[mock] stdin HR ${val} → ${HR_FLOOR} 이상으로 맞춤 → ${mockHr} BPM`);
  } else {
    console.log(`[mock] stdin HR → ${mockHr} BPM`);
  }
}

export async function pollFitbitHr(accessToken, userId) {
  if (!accessToken) {
    console.warn('[fitbit] pollFitbitHr: accessToken 없음 — 스킵');
    return;
  }

  const base =
    'https://api.fitbit.com/1/user/-/activities/heart/date/today/1d';
  // 1sec는 데이터가 늦게 들어오거나 비는 경우가 많고, 1min이 더 잘 찍힌다.
  const tryUrls = [
    { resolution: '1sec', url: `${base}/1sec.json` },
    { resolution: '1min', url: `${base}/1min.json` },
  ];

  try {
    let used = null;
    let dataset = null;
    for (const { resolution, url } of tryUrls) {
      try {
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const ds = res.data?.['activities-heart-intraday']?.dataset;
        const n = ds?.length ?? 0;
        if (ds && n > 0) {
          used = resolution;
          dataset = ds;
          break;
        }
        if (resolution === '1sec' && n === 0) {
          console.log('[fitbit] 1sec intraday 비어 있음 → 1min intraday로 재시도');
        }
      } catch (inner) {
        const s = inner.response?.status;
        if (resolution === '1sec') {
          console.warn(
            `[fitbit] 1sec 요청 실패 status=${s ?? 'n/a'} — 1min 재시도 (${inner.message})`
          );
        } else {
          throw inner;
        }
      }
    }

    const n = dataset?.length ?? 0;
    if (dataset && n > 0) {
      const latest = dataset[n - 1];
      const hr = latest.value;
      const t = latest.time != null ? String(latest.time) : '?';
      console.log(
        `[fitbit] intraday OK [${used}] n=${n} lastHr=${hr} time=${t} (userId=${userId} → Kafka)`
      );
      setLiveHr(hr);
      logLive();
      await sendHeartRate({
        user_id: userId,
        device_id: DEVICE_ID,
        hr,
        ts: new Date().toISOString(),
        source: 'fitbit',
      });
    } else {
      const now = Date.now();
      if (now - lastEmptyIntradayLog >= EMPTY_LOG_INTERVAL_MS) {
        lastEmptyIntradayLog = now;
        console.warn(
          `[fitbit] intraday(1sec·1min) 모두 n=0 — Watch 착용·휴대폰 앱에서 동기화, Fitbit 웹 프로필 시간대(오늘 기준) 확인. base=${base}`
        );
      }
    }
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const detail =
      data != null
        ? (typeof data === 'string' ? data : JSON.stringify(data))
        : err.message;
    console.error(
      `[fitbit] API 오류 status=${status ?? 'n/a'} — ${detail}`
    );
  }
}

export async function pollMockHr(userId) {
  const hr = nextMockHrSample();
  setLiveHr(hr);
  logLive();
  await sendHeartRate({
    user_id: userId,
    device_id: DEVICE_ID,
    hr,
    ts: new Date().toISOString(),
    source: 'mock',
  });
}
