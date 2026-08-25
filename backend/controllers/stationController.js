const stationService = require('../services/stationService');

async function getStations(req, res, next) {
  try {
    const stations = await stationService.listStations();
    res.status(200).json(stations);
  } catch (error) {
    next(error);
  }
}

module.exports = { getStations };
