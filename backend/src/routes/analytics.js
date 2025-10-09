// Analytics Routes - Dashboard and metrics API endpoints
const express = require('express');
const analyticsController = require('../controllers/AnalyticsController');
const { requireAuth } = require('../lib/authMiddleware');
const { query } = require('express-validator');

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

// Validation
const timeframeValidation = [
  query('timeframe')
    .optional()
    .isIn(['7d', '30d', '90d', '1y'])
    .withMessage('Timeframe must be 7d, 30d, 90d, or 1y')
];

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard overview
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *         description: Time range for analytics
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/dashboard', timeframeValidation, analyticsController.getDashboardOverview.bind(analyticsController));

/**
 * @swagger
 * /api/analytics/platform:
 *   get:
 *     summary: Get platform-wide statistics
 *     tags: [Analytics]
 */
router.get('/platform', timeframeValidation, analyticsController.getPlatformStats.bind(analyticsController));

/**
 * @swagger
 * /api/analytics/negotiations:
 *   get:
 *     summary: Get negotiation analytics
 *     tags: [Analytics]
 */
router.get('/negotiations', timeframeValidation, analyticsController.getNegotiationAnalytics.bind(analyticsController));

/**
 * @swagger
 * /api/analytics/ai-performance:
 *   get:
 *     summary: Get AI performance metrics
 *     tags: [Analytics]
 */
router.get('/ai-performance', timeframeValidation, analyticsController.getAIPerformance.bind(analyticsController));

/**
 * @swagger
 * /api/analytics/court-filings:
 *   get:
 *     summary: Get court filing analytics
 *     tags: [Analytics]
 */
router.get('/court-filings', timeframeValidation, analyticsController.getCourtFilingAnalytics.bind(analyticsController));

/**
 * @swagger
 * /api/analytics/case-resolution:
 *   get:
 *     summary: Get case resolution metrics
 *     tags: [Analytics]
 */
router.get('/case-resolution', timeframeValidation, analyticsController.getCaseResolutionMetrics.bind(analyticsController));

/**
 * @swagger
 * /api/analytics/user-activity:
 *   get:
 *     summary: Get current user activity analytics
 *     tags: [Analytics]
 */
router.get('/user-activity', timeframeValidation, analyticsController.getUserActivity.bind(analyticsController));

/**
 * @swagger
 * /api/analytics/clear-cache:
 *   post:
 *     summary: Clear analytics cache
 *     tags: [Analytics]
 */
router.post('/clear-cache', analyticsController.clearCache.bind(analyticsController));

module.exports = router;
