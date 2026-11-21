const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const { config } = require('./config/env');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errors');
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.get('/', (_req, res) => res.json({ service: 'CertiFlow API', health: '/health' }));
app.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res
    .status(connected ? 200 : 503)
    .json({
      status: connected ? 'ok' : 'unavailable',
      database: connected ? 'connected' : 'disconnected',
    });
});
app.use('/api', routes);
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);
module.exports = app;
