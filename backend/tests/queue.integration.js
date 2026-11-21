const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
process.env.DEMO_MODE = 'true'; process.env.NODE_ENV = 'test'; process.env.MOCK_FAILURES = 'true';
process.env.QUEUE_NAME = `certiflow-test-${process.pid}`;
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { config } = require('../src/config/env');
const { startWorker, dispatchOutbox } = require('../src/jobs/worker');
const { getQueue, closeQueue } = require('../src/jobs/queue');
const { seed } = require('../scripts/seed');
const { decide } = require('../src/services/batch.service');
const { User, Batch, Certificate, Delivery, MockMessage, Outbox } = require('../src/models');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) { if (await check()) return; await delay(200); }
  throw new Error(message);
}
test('real Redis worker issues and delivers all 60 certificates through provider failures and timeouts', { timeout: 120000 }, async () => {
  let replica, running;
  try {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    config.mongoUri = replica.getUri('certiflow_queue_test');
    running = await startWorker(); await seed();
    const batch = await Batch.findOne({ candidateCount: 60 });
    const actor = async name => { const user = await User.findOne({ name }); return { id: String(user._id), name, role: user.role, districtId: user.districtId }; };
    await Promise.all(['Dev', 'Meera'].map(async name => decide(String(batch._id), { action: 'approve', revision: 1 }, await actor(name))));
    await decide(String(batch._id), { action: 'approve', revision: 1 }, await actor('Neha'));
    await decide(String(batch._id), { action: 'approve', revision: 1 }, await actor('Farah'));
    await until(async () => await Delivery.countDocuments({ batchId: batch._id, status: 'sent' }) === 60, 'The queue did not deliver all 60 certificates');
    assert.equal(await Certificate.countDocuments({ batchId: batch._id }), 60);
    assert.equal(await MockMessage.countDocuments(), 60);
    assert.equal(await Delivery.countDocuments({ attempts: 3 }), 60);
    // Replaying a committed outbox event must not duplicate certificates or messages.
    await Outbox.updateMany({}, { $unset: { dispatchedAt: 1 } });
    await dispatchOutbox(); await delay(300);
    assert.equal(await Certificate.countDocuments({ batchId: batch._id }), 60);
    assert.equal(await MockMessage.countDocuments(), 60);
    console.log('Verified: 60 certificates, 60 provider messages, three attempts each, safe outbox replay');
  } finally {
    if (running) { clearInterval(running.timer); await running.worker.close(); running.connection.disconnect(); }
    // Only this test's randomly named queue is removed.
    if (running) await getQueue().obliterate({ force: true });
    await closeQueue(); await mongoose.disconnect(); if (replica) await replica.stop();
  }
});
