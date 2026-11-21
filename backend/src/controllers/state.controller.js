const asyncHandler = require('../middlewares/asyncHandler');
const Batch = require('../models/batch.model');
const Certificate = require('../models/certificate.model');
const Delivery = require('../models/delivery.model');
const Escalation = require('../models/escalation.model');
const Outbox = require('../models/outbox.model');
const Audit = require('../models/audit.model');
const { getQueue } = require('../jobs/queue');
const { pagination } = require('../utils/pagination');
const { assert, ApiError } = require('../utils/errors');
exports.getDashboard = asyncHandler(async (_req, res) => {
  const [batches, certificates, overdue, failedDeliveries] = await Promise.all([
    Batch.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Certificate.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Escalation.countDocuments({ resolvedAt: null }),
    Delivery.countDocuments({ status: 'failed' }),
  ]);
  res.json({ batches, certificates, overdue, failedDeliveries });
});

exports.listEscalations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = req.query.includeResolved === 'true' ? {} : { resolvedAt: null };
  res.json({
    escalations: await Escalation.find(filter).sort({ dueAt: 1 }).skip(skip).limit(limit),
    total: await Escalation.countDocuments(filter),
    page,
  });
});

exports.getQueueStatus = asyncHandler(async (_req, res) => {
  try {
    const queue = getQueue();
    const failed = await queue.getFailed(0, 49);
    res.json({
      counts: await queue.getJobCounts('waiting', 'active', 'failed', 'completed', 'delayed'),
      failed: failed.map((job) => ({
        id: job.id,
        type: job.name,
        entityId: job.data.entityId,
        attempts: job.attemptsMade,
        error: job.failedReason,
      })),
    });
  } catch {
    throw new ApiError(503, 'Queue unavailable');
  }
});

exports.retryIssuance = asyncHandler(async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  assert(batch?.status === 'approved', 409, 'Batch is not approved');
  try {
    const job = await getQueue().getJob(`issue-${batch._id}`);
    if (job) {
      assert((await job.getState()) === 'failed', 409, 'Issuance is not in a failed state');
      await job.retry('failed', { resetAttemptsMade: true });
    } else await Outbox.updateOne({ key: `issue-${batch._id}` }, { $unset: { dispatchedAt: 1 } });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'Queue unavailable');
  }
  await Audit.create({
    batchId: batch._id,
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'issuance.retry-requested',
  });
  res.status(202).json({ message: 'Issuance retry requested' });
});
