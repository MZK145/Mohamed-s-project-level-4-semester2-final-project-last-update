const jwt = require('jsonwebtoken');

const socketStations = new Map();

function normalizeId(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function stationRoom(stationId) {
  return `station:${stationId}`;
}

function getRoomPassengerCount(io, stationId) {
  const room = io.sockets.adapter.rooms.get(stationRoom(stationId));
  if (!room) return 0;

  let count = 0;
  for (const socketId of room) {
    const roomSocket = io.sockets.sockets.get(socketId);
    if (roomSocket?.data.role === 'user') count += 1;
  }
  return count;
}

function getOnlineCount(io) {
  if (!io) return 0;

  const userIds = new Set();
  for (const socketId of socketStations.keys()) {
    const roomSocket = io.sockets.sockets.get(socketId);
    if (roomSocket?.data.role === 'user' && roomSocket.data.userId) {
      userIds.add(String(roomSocket.data.userId));
    }
  }
  return userIds.size;
}

function emitPresence(io, stationId) {
  if (!stationId) return;
  io.to(stationRoom(stationId)).emit('presenceUpdate', {
    stationId,
    count: getRoomPassengerCount(io, stationId)
  });
}

function leaveStation(io, socket) {
  const oldStationId = socketStations.get(socket.id);
  if (!oldStationId) return null;

  socket.leave(stationRoom(oldStationId));
  socketStations.delete(socket.id);
  emitPresence(io, oldStationId);
  return oldStationId;
}

function socketHandler(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Socket authentication required'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!payload?.id || !['admin', 'user'].includes(payload.role)) {
        return next(new Error('Invalid socket identity'));
      }

      socket.data.userId = normalizeId(payload.id);
      socket.data.role = payload.role;
      next();
    } catch (error) {
      next(new Error('Invalid or expired socket token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 ${socket.data.role} connected: ${socket.id}`);
    socket.emit('onlineCount', getOnlineCount(io));

    socket.on('register', (rawUserId) => {
      const requestedId = normalizeId(
        typeof rawUserId === 'object' ? rawUserId?.userId : rawUserId
      );

      if (requestedId && requestedId !== String(socket.data.userId)) {
        socket.emit('registerError', { message: 'Socket identity does not match the logged-in account' });
        return;
      }

      socket.emit('registered', {
        userId: String(socket.data.userId),
        role: socket.data.role
      });
    });

    socket.on('joinStation', (rawStationId) => {
      const stationId = normalizeId(rawStationId);
      if (!stationId) {
        socket.emit('stationError', { message: 'A valid station id is required' });
        return;
      }

      const oldStationId = socketStations.get(socket.id);
      if (oldStationId === stationId) {
        emitPresence(io, stationId);
        io.emit('onlineCount', getOnlineCount(io));
        return;
      }

      if (oldStationId) leaveStation(io, socket);

      socket.join(stationRoom(stationId));
      socketStations.set(socket.id, stationId);
      console.log(`🚉 ${socket.id} joined station room ${stationId} as ${socket.data.role}`);
      emitPresence(io, stationId);
      io.emit('onlineCount', getOnlineCount(io));
    });

    socket.on('leaveStation', () => {
      const stationId = leaveStation(io, socket);
      if (stationId) console.log(`🚉 ${socket.id} left station room ${stationId}`);
      io.emit('onlineCount', getOnlineCount(io));
    });

    socket.on('disconnect', (reason) => {
      const stationId = leaveStation(io, socket);
      if (stationId) emitPresence(io, stationId);
      io.emit('onlineCount', getOnlineCount(io));
      console.log(`🔌 Socket ${socket.id} disconnected (${reason})`);
    });
  });
}

function getStationPresence(io, stationId) {
  return getRoomPassengerCount(io, stationId);
}

module.exports = {
  socketHandler,
  getOnlineCount,
  getStationPresence
};
