require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const { socketHandler } = require('./sockets/socketHandler');

const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not configured');
  process.exit(1);
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket']
});

app.locals.io = io;

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected successfully to ${mongoose.connection.host}`);
    socketHandler(io);

    server.listen(PORT, () => {
      console.log(`🚀 MetroSync API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB/API startup failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { server, startServer };
