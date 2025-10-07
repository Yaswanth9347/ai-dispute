const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/authMiddleware');

// Mock notifications data (in production, this would come from database)
let notifications = [];

// Get all notifications for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Filter notifications for this user
    const userNotifications = notifications.filter(n => n.userId === userId);
    
    res.json({
      success: true,
      data: userNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    notification.read = true;
    
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all notifications as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    notifications.forEach(n => {
      if (n.userId === userId) {
        n.read = true;
      }
    });
    
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete notification
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const index = notifications.findIndex(n => n.id === notificationId);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    notifications.splice(index, 1);
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to send notification (called by other services)
function sendNotification(userId, notification) {
  const newNotification = {
    id: Date.now().toString() + Math.random(),
    userId,
    ...notification,
    timestamp: new Date().toISOString(),
    read: false
  };
  
  notifications.push(newNotification);
  
  // Emit via Socket.IO if available
  const realTimeService = require('../services/RealTimeService');
  realTimeService.sendNotification(userId, newNotification);
  
  return newNotification;
}

// Export router and helper function separately
router.sendNotification = sendNotification;
module.exports = router;
