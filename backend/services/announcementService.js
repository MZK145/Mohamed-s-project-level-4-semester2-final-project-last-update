const Announcement = require('../models/Announcement');

async function fetchAnnouncements(stationId, { page = 1, limit = 10, q } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));
  const filter = { stationId };

  if (q && String(q).trim()) {
    filter.message = { $regex: String(q).trim(), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Announcement.countDocuments(filter)
  ]);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit)
    }
  };
}

async function createAnnouncement(stationId, data) {
  const announcement = new Announcement({ stationId, message: data.message });
  return announcement.save();
}

module.exports = { fetchAnnouncements, createAnnouncement };
