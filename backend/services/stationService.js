const Station = require('../models/Station');

function normalizeGovernorate(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'giza') return 'Giza';
  if (normalized === 'cairo') return 'Cairo';
  if (normalized === 'qalyubia') return 'Qalyubia';
  return String(value || '').trim();
}

async function listStations() {
  const stations = await Station.find().sort({ line: 1, order: 1 }).lean();
  return stations.map((station) => ({
    ...station,
    governorate: normalizeGovernorate(station.governorate)
  }));
}

module.exports = { listStations };
