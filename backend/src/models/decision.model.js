const mongoose = require('mongoose');
const { Schema } = mongoose;

const decisionSchema = new Schema(
  {
    batchId: Schema.Types.ObjectId,
    revision: Number,
    stage: String,
    actorId: Schema.Types.ObjectId,
    actorName: String,
    action: String,
    reason: String,
  },
  { timestamps: true, strict: 'throw' },
);

// An officer can decide only once per stage of a submitted revision.
decisionSchema.index({ batchId: 1, revision: 1, stage: 1, actorId: 1 }, { unique: true });

module.exports = mongoose.model('Decision', decisionSchema);
