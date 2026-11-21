const asyncHandler = require('../middlewares/asyncHandler');
const Batch = require('../models/batch.model');
const Audit = require('../models/audit.model');
const User = require('../models/user.model');
const { batchScope } = require('../services/access.service');
// Events contain no personal data. The client refetches authorized APIs on each notification.
exports.streamEvents = asyncHandler(async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('event: ready\ndata: {"refetch":true}\n\n');
  let cursor = new Date();
  let busy = false;
  let closed = false;
  const interval = setInterval(async () => {
    if (busy || closed) return;
    busy = true;
    try {
      if (!(await User.exists({ _id: req.user.id, active: true }))) {
        res.end();
        return;
      }
      const batchIds = await Batch.find(batchScope(req.user)).distinct('_id');
      const changes = await Audit.find({ batchId: { $in: batchIds }, createdAt: { $gte: cursor } })
        .sort({ createdAt: 1 })
        .limit(100);
      if (changes.length) {
        cursor = new Date(changes.at(-1).createdAt.getTime() + 1);
        res.write(
          `event: change\ndata: ${JSON.stringify({ refetch: true, batchIds: [...new Set(changes.map((event) => String(event.batchId)))] })}\n\n`,
        );
      } else res.write(': heartbeat\n\n');
    } catch {
      res.write('event: reconnect\ndata: {"refetch":true}\n\n');
    } finally {
      busy = false;
    }
  }, 2000);
  const timeout = setTimeout(() => res.end(), 5 * 60 * 1000);
  res.on('close', () => {
    closed = true;
    clearInterval(interval);
    clearTimeout(timeout);
  });
});
