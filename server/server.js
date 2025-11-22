const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('./db'); // Initialize database

const sessionsRouter = require('./routes/sessions');
const tasksRouter = require('./routes/tasks');
const chatRouter = require('./routes/chat');
const turnsRouter = require('./routes/turns');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/sessions/:roomCode/tasks', tasksRouter);
app.use('/api/sessions/:roomCode/chat', chatRouter);
app.use('/api/sessions/:roomCode/turns', turnsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User joins a room
  socket.on('join-room', (data) => {
    const { roomCode } = data;
    socket.join(roomCode);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  Relative Pointing App - Backend       ║
╚════════════════════════════════════════╝

  Server running at http://localhost:${PORT}
  API available at http://localhost:${PORT}/api
  WebSocket available at ws://localhost:${PORT}

  Health check: http://localhost:${PORT}/api/health

  Press Ctrl+C to stop
  `);
});
