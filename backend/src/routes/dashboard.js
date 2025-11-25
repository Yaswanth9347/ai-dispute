const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const DashboardController = require('../controllers/DashboardController');

// All routes require authentication
router.use(authenticate);

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', DashboardController.getStats);

// GET /api/dashboard/recent-activity - Get recent activity
router.get('/recent-activity', DashboardController.getRecentActivity);

// GET /api/dashboard/trends - Get dispute trends
router.get('/trends', DashboardController.getTrends);

module.exports = router;
