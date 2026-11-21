const mongoose = require('mongoose');
const { Schema } = mongoose;

const mockMessageSchema = new Schema(
  {
    key: { type: String, unique: true },
    phone: String,
    downloadUrl: String,
    acceptedAt: Date,
  },
  { timestamps: true, strict: 'throw' },
);

module.exports = mongoose.model('MockMessage', mockMessageSchema);
