const mongoose = require('mongoose');
const { Schema } = mongoose;

const outboxSchema = new Schema(
  {
    key: { type: String, unique: true },
    type: { type: String, enum: ['issue', 'deliver'] },
    entityId: Schema.Types.ObjectId,
    dispatchedAt: Date,
  },
  { timestamps: true, strict: 'throw' },
);

// Undispatched events are retried by the background worker.
outboxSchema.index({ dispatchedAt: 1, createdAt: 1 });

module.exports = mongoose.model('Outbox', outboxSchema);
