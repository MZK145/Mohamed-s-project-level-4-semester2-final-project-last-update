const mongoose = require('mongoose');

function normalizeLocationValue(value) {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
  if (cleaned.toLowerCase() === 'giza') return 'Giza';
  if (cleaned.toLowerCase() === 'cairo') return 'Cairo';
  if (cleaned.toLowerCase() === 'qalyubia') return 'Qalyubia';
  return cleaned;
}

const stationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  line: { type: String, required: true, trim: true },
  order: { type: Number, required: true },
  governorate: {
    type: String,
    required: true,
    set: normalizeLocationValue
  },
  city: {
    type: String,
    required: true,
    set: (value) => String(value || '').trim().replace(/\s+/g, ' ')
  },
  arrivalTime: { type: String, default: '00:00', trim: true },
  departureTime: { type: String, default: '00:05', trim: true },
  createdAt: { type: Date, default: Date.now }
});

stationSchema.index({ name: 1, line: 1 }, { unique: true });

module.exports = mongoose.model('Station', stationSchema);
