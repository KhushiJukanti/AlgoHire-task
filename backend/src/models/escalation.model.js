const mongoose = require('mongoose');
const { Schema } = mongoose;

const escalationSchema = new Schema(
  {
    batchId: Schema.Types.ObjectId,
    revision: Number,
    stage: String,
    dueAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true, strict: 'throw' },
);

escalationSchema.index({ batchId: 1, revision: 1, stage: 1 }, { unique: true });

module.exports = mongoose.model('Escalation', escalationSchema);
