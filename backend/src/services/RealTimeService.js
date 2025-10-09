// Real-Time Communication Service - WebSocket-based messaging for cases
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Case = require('../models/Case');
const CaseCommunication = require('../models/CaseCommunication');
const logger = require('../lib/logger');

class RealTimeService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socket info
    this.caseRooms = new Map(); // caseId -> Set of userIds
  }

  // Initialize Socket.IO server
  initialize(server) {
    // If a Server instance is passed (from index.js), use it. Otherwise, expect an http.Server
    if (server && typeof server.on === 'function' && server.of) {
      // server looks like a Socket.IO Server
      this.io = server;
    } else {
      // fall back: create a new Server bound to the http server
      this.io = new Server(server, {
        cors: {
          origin: process.env.FRONTEND_URL || "http://localhost:3001",
          credentials: true
        },
        transports: ['websocket', 'polling']
      });
    }

    // Attach authentication middleware
    this.io.use(async (socket, next) => {
      try {
        // Support token via handshake.auth.token or handshake.query.token for backwards compatibility
        const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // normalize decoded IDs - support common claim names
        socket.userId = decoded.id || decoded.sub || decoded.userId;
        socket.userEmail = decoded.email || decoded.user_email || decoded.username;

        logger.info(`User ${socket.userEmail || 'unknown'} connecting via WebSocket`);
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('Real-time communication service initialized');
    return this.io;
  }

  // Handle new socket connection
  handleConnection(socket) {
    const userId = socket.userId;
    const userEmail = socket.userEmail;

    // Store connection
    this.connectedUsers.set(userId, {
      socket,
      email: userEmail,
      connectedAt: new Date(),
      activeCases: new Set()
    });

    logger.info(`User ${userEmail} connected`, { userId, socketId: socket.id });

    // Join user to their cases
    this.joinUserCases(socket, userId);

    // Handle events
    socket.on('join-case', (data) => this.handleJoinCase(socket, data));
    socket.on('leave-case', (data) => this.handleLeaveCase(socket, data));
    socket.on('send-message', (data) => this.handleSendMessage(socket, data));
    socket.on('typing', (data) => this.handleTyping(socket, data));
    socket.on('stop-typing', (data) => this.handleStopTyping(socket, data));
    socket.on('case-update', (data) => this.handleCaseUpdate(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));

    // Send connection confirmation
    socket.emit('connected', {
      userId,
      timestamp: new Date().toISOString(),
      message: 'Real-time communication established'
    });
  }

  // Join user to all their cases
  async joinUserCases(socket, userId) {
    try {
      // Get all cases user has access to
      const userCases = await Case.findAll({ 
        include: ['parties'],
        where: {
          'parties.user_id': userId
        }
      });

      for (const caseData of userCases) {
        await this.joinCaseRoom(socket, caseData.id, userId);
      }

    } catch (error) {
      logger.error(`Failed to join user cases for ${userId}:`, error);
    }
  }

  // Handle joining a case room
  async handleJoinCase(socket, data) {
    try {
      const { case_id } = data;
      const userId = socket.userId;

      // Verify access to case
      if (!await Case.hasAccess(case_id, userId)) {
        socket.emit('error', { message: 'Access denied to case' });
        return;
      }

      await this.joinCaseRoom(socket, case_id, userId);
      
      socket.emit('joined-case', { 
        case_id, 
        timestamp: new Date().toISOString() 
      });

    } catch (error) {
      logger.error('Error joining case:', error);
      socket.emit('error', { message: 'Failed to join case' });
    }
  }

  // Join case room
  async joinCaseRoom(socket, caseId, userId) {
    const roomName = `case-${caseId}`;
    
    await socket.join(roomName);
    
    // Track user in case room
    if (!this.caseRooms.has(caseId)) {
      this.caseRooms.set(caseId, new Set());
    }
    this.caseRooms.get(caseId).add(userId);

    // Update user's active cases
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      userConnection.activeCases.add(caseId);
    }

    // Notify others in the room
    socket.to(roomName).emit('user-joined', {
      case_id: caseId,
      user_id: userId,
      user_email: socket.userEmail,
      timestamp: new Date().toISOString()
    });

    logger.info(`User ${userId} joined case room ${caseId}`);
  }

  // Handle leaving a case room
  async handleLeaveCase(socket, data) {
    try {
      const { case_id } = data;
      const userId = socket.userId;

      await this.leaveCaseRoom(socket, case_id, userId);
      
      socket.emit('left-case', { 
        case_id, 
        timestamp: new Date().toISOString() 
      });

    } catch (error) {
      logger.error('Error leaving case:', error);
      socket.emit('error', { message: 'Failed to leave case' });
    }
  }

  // Leave case room
  async leaveCaseRoom(socket, caseId, userId) {
    const roomName = `case-${caseId}`;
    
    await socket.leave(roomName);
    
    // Remove user from case room tracking
    if (this.caseRooms.has(caseId)) {
      this.caseRooms.get(caseId).delete(userId);
      if (this.caseRooms.get(caseId).size === 0) {
        this.caseRooms.delete(caseId);
      }
    }

    // Update user's active cases
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      userConnection.activeCases.delete(caseId);
    }

    // Notify others in the room
    socket.to(roomName).emit('user-left', {
      case_id: caseId,
      user_id: userId,
      user_email: socket.userEmail,
      timestamp: new Date().toISOString()
    });

    logger.info(`User ${userId} left case room ${caseId}`);
  }

  // Handle sending a message
  async handleSendMessage(socket, data) {
    try {
      const { case_id, message, message_type = 'text' } = data;
      const userId = socket.userId;

      // Verify access
      if (!await Case.hasAccess(case_id, userId)) {
        socket.emit('error', { message: 'Access denied to case' });
        return;
      }

      // Save message to database
      const messageData = await CaseCommunication.create({
        case_id,
        user_id: userId,
        message_type,
        message_content: message,
        sender_email: socket.userEmail,
        is_system_message: false
      });

      // Broadcast to case room
      const roomName = `case-${case_id}`;
      this.io.to(roomName).emit('new-message', {
        id: messageData.id,
        case_id,
        user_id: userId,
        sender_email: socket.userEmail,
        message_type,
        message_content: message,
        created_at: messageData.created_at,
        timestamp: new Date().toISOString()
      });

      // Send confirmation to sender
      socket.emit('message-sent', {
        message_id: messageData.id,
        timestamp: messageData.created_at
      });

      logger.info(`Message sent in case ${case_id} by user ${userId}`);

    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  // Handle typing indicator
  handleTyping(socket, data) {
    const { case_id } = data;
    const roomName = `case-${case_id}`;
    
    socket.to(roomName).emit('user-typing', {
      case_id,
      user_id: socket.userId,
      user_email: socket.userEmail,
      timestamp: new Date().toISOString()
    });
  }

  // Handle stop typing
  handleStopTyping(socket, data) {
    const { case_id } = data;
    const roomName = `case-${case_id}`;
    
    socket.to(roomName).emit('user-stopped-typing', {
      case_id,
      user_id: socket.userId,
      user_email: socket.userEmail,
      timestamp: new Date().toISOString()
    });
  }

  // Handle case updates
  async handleCaseUpdate(socket, data) {
    try {
      const { case_id, update_type, update_data } = data;
      const userId = socket.userId;

      // Verify access
      if (!await Case.hasAccess(case_id, userId)) {
        socket.emit('error', { message: 'Access denied to case' });
        return;
      }

      // Broadcast update to case room
      const roomName = `case-${case_id}`;
      socket.to(roomName).emit('case-updated', {
        case_id,
        update_type,
        update_data,
        updated_by: userId,
        updated_by_email: socket.userEmail,
        timestamp: new Date().toISOString()
      });

      logger.info(`Case ${case_id} updated by user ${userId}: ${update_type}`);

    } catch (error) {
      logger.error('Error handling case update:', error);
      socket.emit('error', { message: 'Failed to process case update' });
    }
  }

  // Handle disconnect
  handleDisconnect(socket) {
    const userId = socket.userId;
    const userEmail = socket.userEmail;

    // Remove from all case rooms
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      userConnection.activeCases.forEach(caseId => {
        const roomName = `case-${caseId}`;
        socket.to(roomName).emit('user-disconnected', {
          case_id: caseId,
          user_id: userId,
          user_email: userEmail,
          timestamp: new Date().toISOString()
        });

        // Remove from case room tracking
        if (this.caseRooms.has(caseId)) {
          this.caseRooms.get(caseId).delete(userId);
          if (this.caseRooms.get(caseId).size === 0) {
            this.caseRooms.delete(caseId);
          }
        }
      });
    }

    // Remove user connection
    this.connectedUsers.delete(userId);

    logger.info(`User ${userEmail} disconnected`, { userId, socketId: socket.id });
  }

  // Broadcast system message to case
  async broadcastSystemMessage(caseId, message, messageType = 'system') {
    try {
      // Save system message to database
      const messageData = await CaseCommunication.create({
        case_id: caseId,
        message_type: messageType,
        message_content: message,
        is_system_message: true
      });

      // Broadcast to case room
      const roomName = `case-${caseId}`;
      this.io.to(roomName).emit('system-message', {
        id: messageData.id,
        case_id: caseId,
        message_type: messageType,
        message_content: message,
        created_at: messageData.created_at,
        timestamp: new Date().toISOString()
      });

      logger.info(`System message broadcast to case ${caseId}: ${message}`);

    } catch (error) {
      logger.error('Error broadcasting system message:', error);
    }
  }

  // Send notification to specific user
  async sendUserNotification(userId, notification) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      userConnection.socket.emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Get online users for a case
  getOnlineUsersForCase(caseId) {
    const onlineUsers = [];
    const caseUsers = this.caseRooms.get(caseId);
    
    if (caseUsers) {
      caseUsers.forEach(userId => {
        const userConnection = this.connectedUsers.get(userId);
        if (userConnection) {
          onlineUsers.push({
            user_id: userId,
            email: userConnection.email,
            connected_at: userConnection.connectedAt
          });
        }
      });
    }

    return onlineUsers;
  }

  // Send notification to specific user
  sendNotification(userId, notification) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection && userConnection.socket) {
      userConnection.socket.emit('notification', notification);
      logger.info(`Notification sent to user ${userId}`, { notificationId: notification.id });
      return true;
    }
    return false;
  }

  // Broadcast notification to all users in a case
  broadcastToCaseRoom(caseId, eventName, data) {
    if (this.io) {
      this.io.to(`case-${caseId}`).emit(eventName, data);
      logger.info(`Broadcast to case ${caseId}: ${eventName}`);
      return true;
    }
    return false;
  }

  // Emit event to specific user
  emitToUser(userId, eventName, data) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection && userConnection.socket) {
      userConnection.socket.emit(eventName, data);
      return true;
    }
    return false;
  }

  // Get service statistics
  getStats() {
    return {
      connected_users: this.connectedUsers.size,
      active_case_rooms: this.caseRooms.size,
      total_connections: Array.from(this.connectedUsers.values()).length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new RealTimeService();