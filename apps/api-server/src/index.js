import express from 'express';
import cors from 'cors';
import config from './config.js';
import pool from './db/pool.js';
import { seed } from './seed.js';
import { initKafkaAdmin } from './services/kafkaAdmin.js';
import { startConsumer } from './services/kafkaConsumer.js';
import { metricsMiddleware, metricsHandler } from './services/metrics.js';
import authRouter from './routes/auth.js';
import fitbitOAuthRouter from './routes/fitbitOAuth.js';
import sessionsRouter from './routes/sessions.js';
import edgeRouter from './routes/edge.js';
import healthRouter from './routes/health.js';
import fitbitRouter from './routes/fitbit.js';

const app = express();

// 미들웨어
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(metricsMiddleware);

// 라우트
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/metrics', metricsHandler);
app.use('/auth', authRouter);
app.use('/auth/fitbit', fitbitOAuthRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/edge', edgeRouter);
app.use('/api/health', healthRouter);
app.use('/api/fitbit', fitbitRouter);

// Swagger UI (옵션)
try {
  const swaggerUi = await import('swagger-ui-express');
  const YAML = await import('yamljs');
  const doc = YAML.default.load(new URL('../swagger.yaml', import.meta.url).pathname);
  app.use('/api-docs', swaggerUi.default.serve, swaggerUi.default.setup(doc));
} catch (e) {
  console.warn('[swagger] swagger.yaml 없음, /api-docs 비활성');
}

// 서버 시작
async function start() {
  // MySQL 연결 대기 (최대 30초)
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] MySQL 연결 성공');
      break;
    } catch {
      console.log('[db] MySQL 연결 대기중...');
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await seed();
  await initKafkaAdmin();
  await startConsumer();

  app.listen(config.port, () => {
    console.log(`[server] http://localhost:${config.port} 에서 실행중`);
  });
}

start().catch(err => {
  console.error('[server] 시작 실패:', err);
  process.exit(1);
});
