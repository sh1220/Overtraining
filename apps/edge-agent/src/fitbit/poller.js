import axios from 'axios';
import { sendHeartRate } from '../kafka/producer.js';

let mockHr = 72;

// readline에서 hr 값 변경 가능
export function setMockHr(val) {
  mockHr = val;
  console.log(`[mock] HR 설정: ${val}`);
}

export async function pollFitbitHr(accessToken, userId) {
  if (!accessToken) return;

  try {
    const res = await axios.get(
      'https://api.fitbit.com/1/user/-/activities/heart/date/today/1d/1sec.json',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const dataset = res.data?.['activities-heart-intraday']?.dataset;
    if (dataset && dataset.length > 0) {
      const latest = dataset[dataset.length - 1];
      await sendHeartRate({
        user_id: userId,
        hr: latest.value,
        ts: new Date().toISOString(),
        source: 'fitbit',
      });
    }
  } catch (err) {
    console.error('[fitbit/poller]', err.message);
  }
}

export async function pollMockHr(userId) {
  await sendHeartRate({
    user_id: userId,
    hr: mockHr,
    ts: new Date().toISOString(),
    source: 'mock',
  });
}
