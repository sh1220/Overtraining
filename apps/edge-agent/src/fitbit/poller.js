import axios from 'axios';
import { sendHeartRate } from '../kafka/producer.js';
import { setLiveHr, logLive } from '../liveStatus.js';

const DEVICE_ID = process.env.DEVICE_ID || 'pi-01';

let mockHr = 72;

// readline에서 hr 값 변경 가능
export function setMockHr(val) {
  mockHr = val;
  setLiveHr(val);
  logLive();
  console.log(`[mock] stdin HR → ${val} BPM`);
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
      const hr = latest.value;
      await sendHeartRate({
        user_id: userId,
        device_id: DEVICE_ID,
        hr,
        ts: new Date().toISOString(),
        source: 'fitbit',
      });
      setLiveHr(hr);
      logLive();
    }
  } catch (err) {
    console.error('[fitbit/poller]', err.message);
  }
}

export async function pollMockHr(userId) {
  await sendHeartRate({
    user_id: userId,
    device_id: DEVICE_ID,
    hr: mockHr,
    ts: new Date().toISOString(),
    source: 'mock',
  });
  setLiveHr(mockHr);
  logLive();
}
