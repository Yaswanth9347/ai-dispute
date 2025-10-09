// AI Dispute Resolver Backend - Phase 3 Implementation with Real-Time Features
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

// Use the existing app configuration
const app = require('./app');
const server = http.createServer(app);
const port = process.env.PORT || 8080;

// Routes are configured in app.js

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // In production you might want to exit process or notify monitoring
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3001",
    credentials: true,
    methods: ["GET", "POST"]
  },
  path: '/socket.io/'
});

// Initialize Real-Time Service with Socket.IO
const realTimeService = require('./services/RealTimeService');

// Pass the io instance to RealTimeService
realTimeService.initialize(io);

// Socket.IO connection handling is managed by RealTimeService.initialize
// RealTimeService sets up its own io.on('connection') and event handlers
// to avoid duplicated listeners and naming mismatches.

// Start server
server.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
  console.log(`Socket.IO server initialized for real-time communication`);
  
  // Initialize cleanup tasks
  setInterval(() => {
    // Clean up expired sessions and notifications every hour
    const NotificationService = require('./services/NotificationService');
    const notificationService = new NotificationService();
    
    notificationService.cleanupExpiredNotifications().catch(console.error);
    notificationService.sendDeadlineReminders().catch(console.error);
  }, 60 * 60 * 1000); // 1 hour
});
