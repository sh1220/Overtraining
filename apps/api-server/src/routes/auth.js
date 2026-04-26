import { Router } from 'express';
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken';
import pool from '../db/pool.js';
import config from '../config.js';
import { authenticateJwt } from '../middleware/jwt.js';

const router = Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, age } = req.body;
    if (!username || !password || !age) {
      return res.status(400).json({ error: 'username, password, age 필수' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password_hash, age) VALUES (?, ?, ?)', [username, hash, age]);
    res.status(201).json({ message: '가입 완료' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '이미 존재하는 사용자' });
    }
    console.error('[auth/register]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: '사용자 없음' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: '비밀번호 불일치' });

    const token = jsonwebtoken.sign(
      { id: user.id, username: user.username, age: user.age },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, age: user.age },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 내 정보
router.get('/me', authenticateJwt, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, age, created_at FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: '사용자 없음' });

    // Fitbit 연동 여부
    const [fitbit] = await pool.query('SELECT fitbit_user_id FROM fitbit_tokens WHERE user_id = ?', [req.user.id]);
    res.json({ ...rows[0], fitbit_connected: fitbit.length > 0 });
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

export default router;
