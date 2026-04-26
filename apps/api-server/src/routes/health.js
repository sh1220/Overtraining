import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticateJwt } from '../middleware/jwt.js';
import { calculateRisk } from '../services/riskEngine.js';
import { getAllDeviceData } from '../services/liveCache.js';

const router = Router();

// 즉석 위험도 평가 (운동 시작 전)
router.get('/risk', authenticateJwt, async (req, res) => {
  try {
    // 수면점수
    const [snapRows] = await pool.query(
      'SELECT sleep_score FROM daily_fitbit_snapshot WHERE user_id = ? ORDER BY date DESC LIMIT 1',
      [req.user.id]
    );
    const sleepScore = snapRows[0]?.sleep_score ?? null;

    // 현재 WBGT (첫 번째 디바이스)
    const devices = getAllDeviceData();
    const deviceData = Object.values(devices)[0] || {};

    const result = calculateRisk({
      sleep_score: sleepScore,
      current_hr: null,  // 운동 시작 전이므로 HR 없음
      age: req.user.age,
      wbgt: deviceData.wbgt ?? null,
    });

    res.json(result);
  } catch (err) {
    console.error('[health/risk]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

export default router;
