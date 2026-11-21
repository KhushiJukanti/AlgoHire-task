const mongoose = require('mongoose');
const { Batch, Escalation, Audit } = require('../models');

async function escalateOverdue() {
  const batches = await Batch.find({
    status: { $in: ['district_review', 'quality_review', 'state_review'] },
    dueAt: { $lte: new Date() },
  }).limit(500);
  for (const item of batches) {
    try {
      await mongoose.connection.transaction(async (session) => {
        const batch = await Batch.findOne({
          _id: item._id,
          status: item.status,
          revision: item.revision,
          dueAt: { $lte: new Date() },
        }).session(session);
        if (!batch) return;
        const key = { batchId: batch._id, revision: batch.revision, stage: batch.status };
        if (await Escalation.exists(key).session(session)) return;
        // Serialize escalation creation against stage advancement.
        batch.version++;
        await batch.save({ session });
        await Escalation.create([{ ...key, dueAt: batch.dueAt }], { session });
        await Audit.create(
          [
            {
              batchId: batch._id,
              actorName: 'sla-worker',
              action: 'batch.escalated',
              revision: batch.revision,
              details: { stage: batch.status },
            },
          ],
          { session },
        );
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
}
module.exports = { escalateOverdue };
