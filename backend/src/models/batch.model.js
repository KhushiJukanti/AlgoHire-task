const mongoose = require('mongoose');
const { Schema } = mongoose;

const batchSchema = new Schema(
  {
    title: String,
    course: String,
    centreId: { type: Schema.Types.ObjectId, required: true },
    districtId: String,
    createdBy: Schema.Types.ObjectId,
    status: {
      type: String,
      enum: [
        'draft',
        'district_review',
        'quality_review',
        'state_review',
        'returned',
        'rejected',
        'approved',
      ],
      default: 'draft',
    },
    revision: { type: Number, default: 0 },
    candidateCount: { type: Number, default: 0 },
    districtApprovals: { type: [String], default: [] },
    version: { type: Number, default: 0 },
    stageEnteredAt: Date,
    dueAt: Date,
    submittedAt: Date,
    approvedAt: Date,
    returnReason: String,
  },
  { timestamps: true, strict: 'throw' },
);

batchSchema.index({ centreId: 1, createdAt: -1 });
batchSchema.index({ status: 1, districtId: 1, dueAt: 1 });

module.exports = mongoose.model('Batch', batchSchema);
