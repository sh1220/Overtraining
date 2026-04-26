import axios from 'axios';

let cachedToken = null;
let expiresAt = null;

export async function getFitbitToken(apiBase, edgeApiKey, userId) {
  // 캐시된 토큰이 아직 유효하면 재사용
  if (cachedToken && expiresAt && new Date(expiresAt).getTime() - Date.now() > 60000) {
    return cachedToken;
  }

  try {
    const res = await axios.get(`${apiBase}/api/edge/fitbit-token/${userId}`, {
      headers: { 'X-Edge-Api-Key': edgeApiKey },
    });
    cachedToken = res.data.access_token;
    expiresAt = res.data.expires_at;
    return cachedToken;
  } catch (err) {
    if (err.response?.status === 404) return null; // Fitbit 미연동
    console.error('[tokenFetcher]', err.message);
    return null;
  }
}
