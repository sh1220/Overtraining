import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticateJwt } from '../middleware/jwt.js';
import { getValidAccessToken, getSleepData, getHrvData } from '../services/fitbitClient.js';

const router = Router();

// 오늘자 sleep_score / RHR / HRV (Fitbit API 조회 + 캐시)
router.get('/snapshot', authenticateJwt, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 캐시 확인
    const [cached] = await pool.query(
      'SELECT * FROM daily_fitbit_snapshot WHERE user_id = ? AND date = ?',
      [req.user.id, today]
    );
    if (cached.length > 0) {
      return res.json(cached[0]);
    }

    // Fitbit API 조회
    const accessToken = await getValidAccessToken(req.user.id);
    if (!accessToken) {
      return res.status(404).json({ error: 'Fitbit 연동 필요' });
    }

    let sleepScore = null;
    let restingHr = null;
    let hrvMs = null;

    // Sleep
    const sleepData = await getSleepData(accessToken, today);
    if (sleepData?.sleep?.length > 0) {
      sleepScore = sleepData.sleep[0].efficiency || null;
    }

    // HRV
    const hrvData = await getHrvData(accessToken, today);
    if (hrvData?.hrv?.length > 0) {
      hrvMs = hrvData.hrv[0].value?.dailyRmssd ? Math.round(hrvData.hrv[0].value.dailyRmssd) : null;
    }

    // 캐시 저장
    await pool.query(
      `INSERT INTO daily_fitbit_snapshot (user_id, date, sleep_score, resting_hr, hrv_ms)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE sleep_score=VALUES(sleep_score), resting_hr=VALUES(resting_hr), hrv_ms=VALUES(hrv_ms)`,
      [req.user.id, today, sleepScore, restingHr, hrvMs]
    );

    res.json({ user_id: req.user.id, date: today, sleep_score: sleepScore, resting_hr: restingHr, hrv_ms: hrvMs });
  } catch (err) {
    console.error('[fitbit/snapshot]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

export default router;
