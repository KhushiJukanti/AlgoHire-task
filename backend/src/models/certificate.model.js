const mongoose = require('mongoose');
const { Schema } = mongoose;

const certificateSchema = new Schema(
  {
    batchId: Schema.Types.ObjectId,
    candidateId: Schema.Types.ObjectId,
    number: { type: String, unique: true },
    verificationToken: { type: String, unique: true },
    name: String,
    course: String,
    centreName: String,
    courseCompletedOn: String,
    issuedAt: Date,
    status: { type: String, enum: ['valid', 'revoked'], default: 'valid' },
    revokedAt: Date,
    revokedBy: Schema.Types.ObjectId,
    revokeReason: String,
  },
  { timestamps: true, strict: 'throw' },
);

// Retries must never issue a second certificate for the same enrollment.
certificateSchema.index({ candidateId: 1 }, { unique: true });
certificateSchema.index({ batchId: 1 });

module.exports = mongoose.model('Certificate', certificateSchema);
