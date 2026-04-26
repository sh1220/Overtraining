import pool from '../db/pool.js';
import config from '../config.js';
import { fitbitApiCounter } from './metrics.js';

const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const FITBIT_API_BASE = 'https://api.fitbit.com';

// Basic auth header for Fitbit token requests
function basicAuth() {
  return 'Basic ' + Buffer.from(`${config.fitbit.clientId}:${config.fitbit.clientSecret}`).toString('base64');
}

// 유효한 access_token 반환 (만료 5분 전이면 자동 refresh)
export async function getValidAccessToken(userId) {
  const [rows] = await pool.query('SELECT * FROM fitbit_tokens WHERE user_id = ?', [userId]);
  if (rows.length === 0) return null;

  const token = rows[0];
  const now = new Date();
  const expiresAt = new Date(token.expires_at);
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > fiveMinutes) {
    return token.access_token;
  }

  // refresh
  try {
    const res = await fetch(FITBIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      }),
    });

    fitbitApiCounter.inc({ endpoint: 'token_refresh', status: String(res.status) });
    if (!res.ok) throw new Error(`Fitbit refresh failed: ${res.status}`);

    const data = await res.json();
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    await pool.query(
      'UPDATE fitbit_tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ?',
      [data.access_token, data.refresh_token, newExpiresAt, userId]
    );

    console.log(`[fitbit] 토큰 갱신 완료: user ${userId}`);
    return data.access_token;
  } catch (err) {
    console.error('[fitbit/refresh]', err);
    return null;
  }
}

// Fitbit Intraday HR 조회
export async function getIntradayHr(accessToken) {
  const res = await fetch(
    `${FITBIT_API_BASE}/1/user/-/activities/heart/date/today/1d/1sec.json`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  fitbitApiCounter.inc({ endpoint: 'intraday_hr', status: String(res.status) });
  if (!res.ok) return null;
  return res.json();
}

// Fitbit Sleep Score 조회
export async function getSleepData(accessToken, date) {
  const res = await fetch(
    `${FITBIT_API_BASE}/1.2/user/-/sleep/date/${date}.json`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  fitbitApiCounter.inc({ endpoint: 'sleep', status: String(res.status) });
  if (!res.ok) return null;
  return res.json();
}

// Fitbit HRV 조회
export async function getHrvData(accessToken, date) {
  const res = await fetch(
    `${FITBIT_API_BASE}/1/user/-/hrv/date/${date}.json`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  fitbitApiCounter.inc({ endpoint: 'hrv', status: String(res.status) });
  if (!res.ok) return null;
  return res.json();
}
