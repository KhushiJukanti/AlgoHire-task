const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const mongoose = require('mongoose');
const { config, validateConfig } = require('../config/env');
const { connectDatabase } = require('../config/database');
const { getQueue, closeQueue } = require('./queue');
const { Outbox, Delivery } = require('../models');
const { issueCertificates } = require('../services/certificate.service');
const { deliverCertificate } = require('../services/delivery.service');
const { escalateOverdue } = require('../services/escalation.service');

async function dispatchOutbox() {
  const events = await Outbox.find({ dispatchedAt: null }).sort({ createdAt: 1 }).limit(100);
  const queue = getQueue();
  for (const event of events) {
    await queue.add(
      event.type,
      { entityId: String(event.entityId) },
      {
        jobId: event.key,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400, count: 5000 },
        removeOnFail: false,
      },
    );
    await Outbox.updateOne({ _id: event._id }, { $set: { dispatchedAt: new Date() } });
  }
}
async function startWorker() {
  validateConfig();
  await connectDatabase();
  const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  connection.on('error', () => {});
  const worker = new Worker(
    config.queueName,
    async (job) => {
      if (job.name === 'issue') return issueCertificates(job.data.entityId);
      if (job.name === 'deliver') return deliverCertificate(job.data.entityId);
      throw new Error('Unknown job type');
    },
    { connection, concurrency: 5 },
  );
  worker.on('error', (error) => console.error('Worker error:', error.message));
  worker.on('failed', (job, error) => {
    if (job?.name === 'deliver' && job.attemptsMade >= job.opts.attempts) {
      Delivery.updateOne(
        { certificateId: job.data.entityId, status: { $nin: ['sent', 'cancelled'] } },
        { $set: { status: 'failed', lastError: error.message } },
      ).catch(() => {});
    }
  });
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const results = await Promise.allSettled([dispatchOutbox(), escalateOverdue()]);
      for (const result of results)
        if (result.status === 'rejected')
          console.error('Background reconciliation failed:', result.reason.message);
    } catch (error) {
      console.error('Background reconciliation failed:', error.message);
    } finally {
      busy = false;
    }
  };
  await worker.waitUntilReady();
  const timer = setInterval(tick, 2000);
  await tick();
  console.log('CertiFlow worker ready (issuance, mock WhatsApp, SLA escalation)');
  const shutdown = async () => {
    clearInterval(timer);
    await worker.close();
    connection.disconnect();
    await closeQueue();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { worker, timer, connection };
}
if (require.main === module)
  startWorker().catch((error) => {
    console.error('Worker startup failed:', error.message);
    process.exit(1);
  });
module.exports = { dispatchOutbox, startWorker };
