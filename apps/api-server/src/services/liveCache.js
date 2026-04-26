// 사용자별 최신 HR/WBGT 실시간 캐시
const cache = new Map();

export function updateHr(userId, hr, ts) {
  const entry = cache.get(userId) || {};
  entry.hr = hr;
  entry.hrTs = ts;
  cache.set(userId, entry);
}

export function updateWbgt(deviceId, wbgt, temperature, humidity, ts) {
  // deviceId → userId 매핑은 간단하게 전역 저장
  const key = `device:${deviceId}`;
  const entry = cache.get(key) || {};
  entry.wbgt = wbgt;
  entry.temperature = temperature;
  entry.humidity = humidity;
  entry.wbgtTs = ts;
  cache.set(key, entry);
}

export function getLatest(userId) {
  return cache.get(userId) || {};
}

export function getDeviceData(deviceId) {
  return cache.get(`device:${deviceId}`) || {};
}

export function getAllDeviceData() {
  const result = {};
  for (const [key, value] of cache.entries()) {
    const k = String(key);
    if (k.startsWith('device:')) {
      result[k.slice(7)] = value;
    }
  }
  return result;
}
