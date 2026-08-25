const mongoose = require('mongoose');
const announcementService = require('../services/announcementService');

exports.getAnnouncements = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid station id' });
    }
    const result = await announcementService.fetchAnnouncements(req.params.id, req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.createAnnouncement = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid station id' });
    }
    const announcement = await announcementService.createAnnouncement(req.params.id, req.body);

    // Broadcast only to passengers currently viewing this station.
    const io = req.app.locals.io;
    if (io) {
      io.to(`station:${req.params.id}`).emit('announcement', announcement);
    }

    res.status(201).json(announcement);
  } catch (err) {
    next(err);
  }
};
