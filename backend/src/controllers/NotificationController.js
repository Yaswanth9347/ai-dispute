const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/authMiddleware');

const NotificationService = require('../services/NotificationService');

// Get all notifications for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    const { limit = 50, offset = 0 } = req.query;

    const notifications = await NotificationService.getUserNotifications(userId, {
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });

    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id || req.user.sub;

    const updated = await NotificationService.markAsRead(notificationId, userId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all notifications as read
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    const { caseId = null } = req.body || {};

    const updated = await NotificationService.markAllAsRead(userId, caseId);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete notification
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id || req.user.sub;

    const { supabaseAdmin } = require('../lib/supabaseClient');
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Expose router
module.exports = router;
