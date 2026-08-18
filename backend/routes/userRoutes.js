const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Station = require('../models/Station');
const requireAdmin = require('../middleware/requireAdmin');
const { getOnlineCount, getStationPresence } = require('../sockets/socketHandler');

// GET total number of registered users (admin only)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
});

// GET online passenger count (admin sockets are intentionally excluded).
router.get('/online', requireAdmin, (req, res) => {
  res.status(200).json({ count: getOnlineCount(), type: 'passengers' });
});

// GET all station waiting rooms with their live passenger count.
// Admins can use this to choose a room to monitor.
router.get('/waiting-rooms', requireAdmin, async (req, res, next) => {
  try {
    const io = req.app.locals.io;
    if (!io) {
      return res.status(503).json({ error: 'Real-time service is not ready' });
    }

    const stations = await Station.find({})
      .sort({ line: 1, order: 1 })
      .lean();

    const rooms = stations.map((station) => ({
      stationId: String(station._id),
      name: station.name,
      line: station.line,
      governorate: station.governorate,
      city: station.city,
      onlinePassengers: getStationPresence(io, station._id),
      active: getStationPresence(io, station._id) > 0
    }));

    res.status(200).json({
      totalRooms: rooms.length,
      activeRooms: rooms.filter((room) => room.active).length,
      rooms
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
