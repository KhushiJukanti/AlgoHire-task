const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditSchema = new Schema(
  {
    batchId: Schema.Types.ObjectId,
    actorId: Schema.Types.ObjectId,
    actorName: String,
    action: String,
    revision: Number,
    details: Schema.Types.Mixed,
  },
  { timestamps: true, strict: 'throw' },
);

auditSchema.index({ batchId: 1, createdAt: 1 });

module.exports = mongoose.model('Audit', auditSchema);
