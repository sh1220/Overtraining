import axios from 'axios';

let cachedToken = null;
let expiresAt = null;
let lastCacheLog = 0;
let lastNotFoundLog = 0;
const CACHE_LOG_INTERVAL_MS = 15_000;
const NOT_FOUND_LOG_INTERVAL_MS = 15_000;

export async function getFitbitToken(apiBase, edgeApiKey, userId) {
  // 캐시된 토큰이 아직 유효하면 재사용
  if (cachedToken && expiresAt && new Date(expiresAt).getTime() - Date.now() > 60000) {
    const now = Date.now();
    if (now - lastCacheLog >= CACHE_LOG_INTERVAL_MS) {
      lastCacheLog = now;
      const leftSec = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      console.log(`[fitbit-token] 캐시 사용 (만료까지 약 ${leftSec}s, userId=${userId})`);
    }
    return cachedToken;
  }

  const url = `${apiBase}/api/edge/fitbit-token/${userId}`;
  console.log(`[fitbit-token] 서버에서 토큰 요청: ${url}`);

  try {
    const res = await axios.get(url, {
      headers: { 'X-Edge-Api-Key': edgeApiKey },
    });
    cachedToken = res.data.access_token;
    expiresAt = res.data.expires_at;
    const exp = expiresAt ? new Date(expiresAt).toISOString() : '(없음)';
    console.log(`[fitbit-token] OK — expires_at=${exp} (userId=${userId})`);
    return cachedToken;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;
    if (status === 404) {
      const now = Date.now();
      if (now - lastNotFoundLog >= NOT_FOUND_LOG_INTERVAL_MS) {
        lastNotFoundLog = now;
        console.warn(
          `[fitbit-token] 404 — 이 userId에 Fitbit 토큰 없음 (대시보드 연동·USER_ID=${userId} 확인)`
        );
      }
      return null;
    }
    console.error(
      `[fitbit-token] 실패 status=${status ?? 'n/a'} message=${err.message}`,
      body != null ? ` body=${JSON.stringify(body)}` : ''
    );
    return null;
  }
}
