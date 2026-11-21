const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const file = path.resolve(__dirname, '../.env');
let env = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fs.readFileSync(path.resolve(__dirname, '../.env.example'), 'utf8');
const defaults = { JWT_SECRET: randomBytes(48).toString('hex'), REDIS_URL: 'redis://127.0.0.1:6379', PUBLIC_API_URL: 'http://localhost:7000', CORS_ORIGIN: 'http://localhost:5173', DEMO_MODE: 'true', SLA_HOURS: '24', MOCK_FAILURES: 'true' };
for (const [key, value] of Object.entries(defaults)) {
  if (!new RegExp(`^${key}=`, 'm').test(env)) env += `\n${key}=${value}`;
}
env = env.replace(/^JWT_SECRET=replace-with-a-random-secret-at-least-32-characters$/m, `JWT_SECRET=${defaults.JWT_SECRET}`);
fs.writeFileSync(file, env.trimEnd() + '\n');
console.log('Local .env configured; existing MongoDB URI preserved');
