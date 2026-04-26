import bcrypt from 'bcrypt';
import pool from './db/pool.js';
import config from './config.js';

export async function seed() {
  const conn = await pool.getConnection();
  try {
    // 시드 사용자: demo (age 30), senior (age 68)
    const users = [
      { username: 'demo', password: 'demo', age: 30 },
      { username: 'senior', password: 'senior', age: 68 },
    ];

    for (const u of users) {
      const [exists] = await conn.query('SELECT id FROM users WHERE username = ?', [u.username]);
      if (exists.length === 0) {
        const hash = await bcrypt.hash(u.password, 10);
        await conn.query('INSERT INTO users (username, password_hash, age) VALUES (?, ?, ?)', [u.username, hash, u.age]);
        console.log(`[seed] 사용자 생성: ${u.username}`);
      }
    }

    // 시드 엣지 디바이스: pi-01
    if (config.seedEdgeApiKey) {
      const [exists] = await conn.query('SELECT id FROM edge_devices WHERE device_id = ?', ['pi-01']);
      if (exists.length === 0) {
        const hash = await bcrypt.hash(config.seedEdgeApiKey + config.edgeApiKeyPepper, 10);
        const [demoUser] = await conn.query('SELECT id FROM users WHERE username = ?', ['demo']);
        const userId = demoUser.length > 0 ? demoUser[0].id : null;
        await conn.query(
          'INSERT INTO edge_devices (device_id, api_key_hash, user_id) VALUES (?, ?, ?)',
          ['pi-01', hash, userId]
        );
        console.log('[seed] 엣지 디바이스 생성: pi-01');
      }
    }
  } finally {
    conn.release();
  }
}
