const jwt = require('jsonwebtoken');

const onlineUsers = new Map();
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
    if (roomSocket && roomSocket.data.role !== 'admin') count += 1;
  }
  return count;
}

function emitPresence(io, stationId) {
  if (!stationId) return;
  io.to(stationRoom(stationId)).emit('presenceUpdate', {
    stationId,
    count: getRoomPassengerCount(io, stationId)
  });
}

function registerPassengerSocket(socket) {
  if (socket.data.role !== 'user' || !socket.data.userId) return;
  const userId = String(socket.data.userId);
  onlineUsers.set(userId, onlineUsers.get(userId) || new Set());
  onlineUsers.get(userId).add(socket.id);
}

function unregisterSocket(socketId) {
  for (const [userId, sockets] of onlineUsers) {
    if (!sockets.has(socketId)) continue;
    sockets.delete(socketId);
    if (sockets.size === 0) onlineUsers.delete(userId);
    return userId;
  }
  return null;
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
    registerPassengerSocket(socket);
    console.log(`🔌 ${socket.data.role} connected: ${socket.id}`);
    socket.emit('onlineCount', getOnlineCount());
    io.emit('onlineCount', getOnlineCount());

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
        return;
      }

      if (oldStationId) leaveStation(io, socket);

      socket.join(stationRoom(stationId));
      socketStations.set(socket.id, stationId);
      console.log(`🚉 ${socket.id} joined station room ${stationId} as ${socket.data.role}`);
      emitPresence(io, stationId);
    });

    socket.on('leaveStation', () => {
      const stationId = leaveStation(io, socket);
      if (stationId) console.log(`🚉 ${socket.id} left station room ${stationId}`);
    });

    socket.on('disconnect', (reason) => {
      const stationId = leaveStation(io, socket);
      const userId = unregisterSocket(socket.id);

      if (stationId) emitPresence(io, stationId);
      if (userId) io.emit('onlineCount', getOnlineCount());

      console.log(`🔌 Socket ${socket.id} disconnected (${reason})`);
    });
  });
}

function getOnlineCount() {
  return onlineUsers.size;
}

function getStationPresence(io, stationId) {
  return getRoomPassengerCount(io, stationId);
}

module.exports = {
  socketHandler,
  getOnlineCount,
  getStationPresence
};
