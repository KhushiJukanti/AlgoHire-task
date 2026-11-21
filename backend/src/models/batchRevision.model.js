const mongoose = require('mongoose');
const { Schema } = mongoose;

const batchRevisionSchema = new Schema(
  {
    batchId: Schema.Types.ObjectId,
    revision: Number,
    title: String,
    course: String,
    submittedBy: Schema.Types.ObjectId,
    candidates: [Schema.Types.Mixed],
  },
  { timestamps: true, strict: 'throw' },
);

batchRevisionSchema.index({ batchId: 1, revision: 1 }, { unique: true });

module.exports = mongoose.model('BatchRevision', batchRevisionSchema);
