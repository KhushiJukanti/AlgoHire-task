const mongoose = require('mongoose');
const { Schema } = mongoose;

const candidateSchema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, required: true },
    candidateId: String,
    name: String,
    phone: String,
    courseCompletedOn: String,
  },
  { timestamps: true, strict: 'throw' },
);

candidateSchema.index({ batchId: 1, candidateId: 1 }, { unique: true });

module.exports = mongoose.model('Candidate', candidateSchema);
