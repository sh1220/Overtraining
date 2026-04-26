import jsonwebtoken from 'jsonwebtoken';
import config from '../config.js';

export function authenticateJwt(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: '토큰 없음' });

  try {
    req.user = jsonwebtoken.verify(token, config.jwt.secret);
    next();
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰' });
  }
}
