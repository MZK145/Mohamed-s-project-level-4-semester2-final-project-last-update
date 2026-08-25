const mongoose = require('mongoose');

const journeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  line: { type: String, required: true },
  trainTime: { type: Date, required: true },
  status: { type: String, enum: ['planned', 'completed', 'cancelled'], default: 'planned' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Journey', journeySchema);