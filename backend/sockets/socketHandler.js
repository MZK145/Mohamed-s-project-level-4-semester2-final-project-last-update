// sockets/socketHandler.js
// Tracks authenticated passengers and station-room presence.
// Admin sockets may join rooms to monitor them, but they are never counted as passengers.
const onlineUsers = new Map(); // passenger userId -> Set(socket ids)
const socketStations = new Map(); // socket id -> stationId

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
  io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);
    socket.data.role = 'user';
    socket.emit('onlineCount', getOnlineCount());

    socket.on('register', (payload) => {
      // Backwards compatible with older clients that send only the user id.
      const rawUserId = typeof payload === 'string' ? payload : payload?.userId;
      const role = typeof payload === 'object' && payload?.role === 'admin' ? 'admin' : 'user';
      const userId = normalizeId(rawUserId);

      if (!userId) {
        socket.emit('registerError', { message: 'A valid user id is required' });
        return;
      }

      unregisterSocket(socket.id);
      socket.data.userId = userId;
      socket.data.role = role;

      // Admin sockets can observe rooms, but do not enter the passenger count.
      if (role === 'user') {
        onlineUsers.set(userId, onlineUsers.get(userId) || new Set());
        onlineUsers.get(userId).add(socket.id);
      }

      socket.emit('registered', { userId, role });
      io.emit('onlineCount', getOnlineCount());
      console.log(`👤 ${role === 'admin' ? 'Admin' : 'Passenger'} ${userId} online`);
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
