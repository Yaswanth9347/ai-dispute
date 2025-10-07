const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../lib/authMiddleware');

// Mock user profiles (in production, this would come from database)
let userProfiles = new Map();

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    
    // Get or create profile
    let profile = userProfiles.get(userId);
    if (!profile) {
      profile = {
        id: userId,
        name: req.user.name || 'User',
        email: req.user.email,
        phone: '',
        organization: '',
        role: req.user.role || 'user',
        avatar: '',
        bio: '',
        createdAt: new Date().toISOString()
      };
      userProfiles.set(userId, profile);
    }
    
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    const updates = req.body;
    
    let profile = userProfiles.get(userId) || {
      id: userId,
      email: req.user.email,
      createdAt: new Date().toISOString()
    };
    
    // Update allowed fields
    const allowedFields = ['name', 'phone', 'organization', 'bio'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        profile[field] = updates[field];
      }
    });
    
    userProfiles.set(userId, profile);
    
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload avatar
router.post('/avatar', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    
    // In production, handle file upload to storage (S3, etc.)
    // For now, return a placeholder URL
    const avatarUrl = `https://ui-avatars.com/api/?name=${req.user.name}&size=200&background=random`;
    
    let profile = userProfiles.get(userId) || {
      id: userId,
      email: req.user.email
    };
    profile.avatar = avatarUrl;
    userProfiles.set(userId, profile);
    
    res.json({ success: true, data: { avatarUrl } });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update security settings
router.put('/settings/security', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    const settings = req.body;
    
    // Store settings (in production, save to database)
    let profile = userProfiles.get(userId) || {};
    profile.securitySettings = settings;
    userProfiles.set(userId, profile);
    
    res.json({ success: true, message: 'Security settings updated' });
  } catch (error) {
    console.error('Error updating security settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password
router.post('/password/change', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // In production, verify current password and update
    // For now, just return success
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete account
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    
    // In production, soft delete or permanently delete user data
    userProfiles.delete(userId);
    
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
