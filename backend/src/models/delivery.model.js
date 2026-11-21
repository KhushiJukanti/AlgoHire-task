const mongoose = require('mongoose');
const { Schema } = mongoose;

const deliverySchema = new Schema(
  {
    certificateId: { type: Schema.Types.ObjectId, unique: true },
    batchId: Schema.Types.ObjectId,
    status: {
      type: String,
      enum: ['pending', 'retrying', 'sent', 'failed', 'cancelled'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    lastError: String,
    sentAt: Date,
    providerMessageId: String,
  },
  { timestamps: true, strict: 'throw' },
);

module.exports = mongoose.model('Delivery', deliverySchema);
