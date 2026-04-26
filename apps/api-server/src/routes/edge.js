import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import pool from '../db/pool.js';
import config from '../config.js';
import { authenticateEdge } from '../middleware/edgeApiKey.js';
import { getValidAccessToken } from '../services/fitbitClient.js';

const router = Router();

// Edge 등록 (device_id + api_key 발급)
router.post('/register', async (req, res) => {
  try {
    const { device_id, user_id } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id 필수' });

    const apiKey = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(apiKey + config.edgeApiKeyPepper, 10);

    await pool.query(
      `INSERT INTO edge_devices (device_id, api_key_hash, user_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE api_key_hash = VALUES(api_key_hash), user_id = VALUES(user_id)`,
      [device_id, hash, user_id || null]
    );

    res.status(201).json({ device_id, api_key: apiKey, message: '.env에 저장하세요' });
  } catch (err) {
    console.error('[edge/register]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// Edge heartbeat
router.post('/heartbeat', authenticateEdge, async (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Edge가 사용자 Fitbit access_token 조회 (자동 refresh)
router.get('/fitbit-token/:userId', authenticateEdge, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return res.status(404).json({ error: 'Fitbit 토큰 없음' });
    }

    const [rows] = await pool.query('SELECT expires_at FROM fitbit_tokens WHERE user_id = ?', [userId]);
    res.json({
      access_token: accessToken,
      expires_at: rows[0]?.expires_at,
    });
  } catch (err) {
    console.error('[edge/fitbit-token]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

export default router;
