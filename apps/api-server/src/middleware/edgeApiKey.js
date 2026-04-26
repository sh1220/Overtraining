import bcrypt from 'bcrypt';
import pool from '../db/pool.js';
import config from '../config.js';

export async function authenticateEdge(req, res, next) {
  const apiKey = req.headers['x-edge-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'API 키 없음' });

  try {
    const [devices] = await pool.query('SELECT * FROM edge_devices');
    for (const device of devices) {
      const match = await bcrypt.compare(apiKey + config.edgeApiKeyPepper, device.api_key_hash);
      if (match) {
        req.edge = device;
        // last_seen 업데이트
        pool.query('UPDATE edge_devices SET last_seen = NOW() WHERE id = ?', [device.id]);
        return next();
      }
    }
    res.status(403).json({ error: '유효하지 않은 API 키' });
  } catch (err) {
    console.error('[edgeAuth]', err);
    res.status(500).json({ error: '인증 오류' });
  }
}
