import 'dotenv/config';

export default {
  port: parseInt(process.env.PORT || '3000'),
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: '24h',
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DB || 'overtraining',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  fitbit: {
    clientId: process.env.FITBIT_CLIENT_ID || '',
    clientSecret: process.env.FITBIT_CLIENT_SECRET || '',
    redirectUri: process.env.FITBIT_REDIRECT_URI || '',
  },
  frontendRedirectUri: process.env.FRONTEND_REDIRECT_URI || 'http://localhost:3001/dashboard',
  edgeApiKeyPepper: process.env.EDGE_API_KEY_PEPPER || 'dev-pepper',
  seedEdgeApiKey: process.env.SEED_EDGE_API_KEY || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
};
