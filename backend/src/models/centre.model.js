const mongoose = require('mongoose');
const { Schema } = mongoose;

const centreSchema = new Schema(
  {
    name: String,
    code: { type: String, unique: true },
    districtId: String,
  },
  { timestamps: true, strict: 'throw' },
);

module.exports = mongoose.model('Centre', centreSchema);
