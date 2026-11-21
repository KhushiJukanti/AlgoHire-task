const dotenv = require('dotenv');
const path = require('node:path');
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
});
const config = {
  showVerificationToken: process.env.NODE_ENV !== 'production',
  queueName: process.env.QUEUE_NAME || 'certiflow',
  mongoUri: process.env.MONGO_URI || '',
  port: Number(process.env.PORT || 7000),
  jwtSecret: process.env.JWT_SECRET || '',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  publicUrl: (process.env.PUBLIC_API_URL || 'http://localhost:7000').replace(/\/$/, ''),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  demo: process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production',
  slaHours: Number(process.env.SLA_HOURS || 24),
  mockFailures: process.env.MOCK_FAILURES !== 'false',
};
function validateConfig() {
  if (!config.mongoUri) throw new Error('MONGO_URI is required');
  if (config.jwtSecret.length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters');
  if (!Number.isFinite(config.slaHours) || config.slaHours <= 0)
    throw new Error('Invalid SLA_HOURS');
}

module.exports = { config, validateConfig };
