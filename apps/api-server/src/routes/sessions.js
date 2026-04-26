import { Router } from 'express';
import pool from '../db/pool.js';
import { authenticateJwt } from '../middleware/jwt.js';
import { addClient, closeSessionStream } from '../sse/broker.js';

const router = Router();

// 세션 시작
router.post('/', authenticateJwt, async (req, res) => {
  try {
    // 이미 활성 세션 있는지 확인
    const [active] = await pool.query(
      'SELECT id FROM workout_sessions WHERE user_id = ? AND status = "active"',
      [req.user.id]
    );
    if (active.length > 0) {
      return res.status(409).json({ error: '이미 활성 세션이 있습니다', session_id: active[0].id });
    }

    const [result] = await pool.query(
      'INSERT INTO workout_sessions (user_id, started_at) VALUES (?, NOW())',
      [req.user.id]
    );
    const [rows] = await pool.query('SELECT * FROM workout_sessions WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[sessions/create]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 내 세션 히스토리
router.get('/', authenticateJwt, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[sessions/list]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 세션 상세 (alerts 포함)
router.get('/:id', authenticateJwt, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (sessions.length === 0) return res.status(404).json({ error: '세션 없음' });

    const [alerts] = await pool.query(
      'SELECT * FROM alerts WHERE session_id = ? ORDER BY ts ASC',
      [req.params.id]
    );
    res.json({ ...sessions[0], alerts });
  } catch (err) {
    console.error('[sessions/detail]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 세션 종료
router.post('/:id/end', authenticateJwt, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ? AND status = "active"',
      [req.params.id, req.user.id]
    );
    if (sessions.length === 0) return res.status(404).json({ error: '활성 세션 없음' });

    const session = sessions[0];
    closeSessionStream(session.id);
    const verdict = session.max_risk_score >= 70 ? 'STOP' : session.max_risk_score >= 40 ? 'CAUTION' : 'OK';
    await pool.query(
      'UPDATE workout_sessions SET status = "ended", ended_at = NOW(), final_verdict = ? WHERE id = ?',
      [verdict, session.id]
    );
    const [updated] = await pool.query('SELECT * FROM workout_sessions WHERE id = ?', [session.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('[sessions/end]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// SSE 실시간 스트림
router.get('/:id/stream', async (req, res) => {
  // JWT는 query param으로 (EventSource 헤더 미지원)
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: '토큰 없음' });

  let user;
  try {
    const jwt = await import('jsonwebtoken');
    const config = (await import('../config.js')).default;
    user = jwt.default.verify(token, config.jwt.secret);
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰' });
  }

  const sessionId = parseInt(req.params.id);
  const [sessions] = await pool.query(
    'SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?',
    [sessionId, user.id]
  );
  if (sessions.length === 0) return res.status(404).json({ error: '세션 없음' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx 가 SSE 를 버퍼에 묶지 않게
  });
  res.write('event: connected\ndata: {}\n\n');

  addClient(sessionId, res);
});

export default router;
