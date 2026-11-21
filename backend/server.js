const mongoose = require('mongoose');
const http = require('node:http');
const { config, validateConfig } = require('./src/config/env');
const { connectDatabase } = require('./src/config/database');
const { closeQueue } = require('./src/jobs/queue');
const app = require('./src/app');

async function startServer() {
  validateConfig();
  await connectDatabase();
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
  const server = http.createServer(app);
  server.on('error', error => { console.error('Server failed:', error.message); process.exit(1); });
  server.listen(config.port, () => console.log(`CertiFlow API running on port ${config.port}`));
  const shutdown = () => server.close(async () => {
    await closeQueue(); await mongoose.disconnect(); process.exit(0);
  });
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  return server;
}
if (require.main === module) startServer().catch(error => { console.error('Backend startup failed:', error.message); process.exit(1); });
module.exports = { startServer };
