const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['centre', 'district', 'quality', 'state'], required: true },
    centreId: Schema.Types.ObjectId,
    districtId: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true, strict: 'throw' },
);

module.exports = mongoose.model('User', userSchema);
