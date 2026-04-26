import axios from 'axios';
import { sendHeartRate } from '../kafka/producer.js';
import { setLiveHr, logLive } from '../liveStatus.js';

const DEVICE_ID = process.env.DEVICE_ID || 'pi-01';

let mockHr = 72;
let lastEmptyIntradayLog = 0;
const EMPTY_LOG_INTERVAL_MS = 15_000;

// readline에서 hr 값 변경 가능
export function setMockHr(val) {
  mockHr = val;
  setLiveHr(val);
  logLive();
  console.log(`[mock] stdin HR → ${val} BPM`);
}

export async function pollFitbitHr(accessToken, userId) {
  if (!accessToken) {
    console.warn('[fitbit] pollFitbitHr: accessToken 없음 — 스킵');
    return;
  }

  const intradayUrl =
    'https://api.fitbit.com/1/user/-/activities/heart/date/today/1d/1sec.json';

  try {
    const res = await axios.get(intradayUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const dataset = res.data?.['activities-heart-intraday']?.dataset;
    const n = dataset?.length ?? 0;

    if (dataset && n > 0) {
      const latest = dataset[n - 1];
      const hr = latest.value;
      const t = latest.time != null ? String(latest.time) : '?';
      console.log(
        `[fitbit] intraday OK n=${n} lastHr=${hr} time=${t} (userId=${userId} → Kafka)`
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
          `[fitbit] intraday dataset 비어 있음 (n=0) — Watch 동기화·착용·시간대 확인, URL=${intradayUrl}`
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
  setLiveHr(mockHr);
  logLive();
  await sendHeartRate({
    user_id: userId,
    device_id: DEVICE_ID,
    hr: mockHr,
    ts: new Date().toISOString(),
    source: 'mock',
  });
}
