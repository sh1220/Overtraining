import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db/pool.js';
import config from '../config.js';
import { authenticateJwt } from '../middleware/jwt.js';
import { fitbitApiCounter } from '../services/metrics.js';

const router = Router();

// base64url 인코딩
function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Fitbit OAuth 시작 → authorize URL 반환
router.get('/start', authenticateJwt, async (req, res) => {
  try {
    const codeVerifier = base64url(crypto.randomBytes(48));
    const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
    const state = crypto.randomBytes(16).toString('hex');

    await pool.query(
      'INSERT INTO oauth_states (state, user_id, code_verifier) VALUES (?, ?, ?)',
      [state, req.user.id, codeVerifier]
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.fitbit.clientId,
      scope: 'heartrate sleep activity profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      redirect_uri: config.fitbit.redirectUri,
    });

    res.json({ authorize_url: `https://www.fitbit.com/oauth2/authorize?${params}` });
  } catch (err) {
    console.error('[fitbit/start]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// Fitbit OAuth callback (Fitbit이 호출)
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('code, state 필수');

    // state 검증
    const [stateRows] = await pool.query('SELECT * FROM oauth_states WHERE state = ?', [state]);
    if (stateRows.length === 0) return res.status(400).send('유효하지 않은 state');

    const { user_id, code_verifier } = stateRows[0];

    // 만료 체크 (10분)
    const created = new Date(stateRows[0].created_at);
    if (Date.now() - created.getTime() > 10 * 60 * 1000) {
      await pool.query('DELETE FROM oauth_states WHERE state = ?', [state]);
      return res.status(400).send('state 만료');
    }

    // 토큰 교환
    const basicAuth = 'Basic ' + Buffer.from(`${config.fitbit.clientId}:${config.fitbit.clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.fitbit.redirectUri,
        code_verifier,
      }),
    });

    fitbitApiCounter.inc({ endpoint: 'token_exchange', status: String(tokenRes.status) });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[fitbit/callback] 토큰 교환 실패:', err);
      return res.status(502).send('Fitbit 토큰 교환 실패');
    }

    const data = await tokenRes.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // fitbit_tokens upsert
    await pool.query(
      `INSERT INTO fitbit_tokens (user_id, access_token, refresh_token, fitbit_user_id, scope, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE access_token=VALUES(access_token), refresh_token=VALUES(refresh_token),
         fitbit_user_id=VALUES(fitbit_user_id), scope=VALUES(scope), expires_at=VALUES(expires_at)`,
      [user_id, data.access_token, data.refresh_token, data.user_id, data.scope, expiresAt]
    );

    // state 삭제
    await pool.query('DELETE FROM oauth_states WHERE state = ?', [state]);

    console.log(`[fitbit/callback] 연동 완료: user ${user_id}`);
    res.redirect(`${config.frontendRedirectUri}?fitbit=connected`);
  } catch (err) {
    console.error('[fitbit/callback]', err);
    res.status(500).send('서버 오류');
  }
});

// Fitbit 연동 해제
router.post('/disconnect', authenticateJwt, async (req, res) => {
  try {
    await pool.query('DELETE FROM fitbit_tokens WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Fitbit 연동 해제 완료' });
  } catch (err) {
    console.error('[fitbit/disconnect]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

export default router;
