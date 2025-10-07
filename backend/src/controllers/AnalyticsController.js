// Analytics Controller - Dashboard metrics and insights API
const analyticsService = require('../services/AnalyticsService');

class AnalyticsController {
  /**
   * GET /api/analytics/dashboard
   * Get comprehensive dashboard overview
   */
  async getDashboardOverview(req, res) {
    try {
      const { timeframe = '30d' } = req.query;

      const [
        platformStats,
        negotiationAnalytics,
        aiMetrics,
        courtFilingAnalytics,
        caseResolutionMetrics
      ] = await Promise.all([
        analyticsService.getPlatformStats(timeframe),
        analyticsService.getNegotiationAnalytics(timeframe),
        analyticsService.getAIPerformanceMetrics(timeframe),
        analyticsService.getCourtFilingAnalytics(timeframe),
        analyticsService.getCaseResolutionMetrics(timeframe)
      ]);

      res.json({
        success: true,
        data: {
          platform: platformStats,
          negotiations: negotiationAnalytics,
          aiPerformance: aiMetrics,
          courtFilings: courtFilingAnalytics,
          caseResolution: caseResolutionMetrics,
          timeframe
        }
      });
    } catch (error) {
      console.error('Dashboard overview error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data'
      });
    }
  }

  /**
   * GET /api/analytics/platform
   * Get platform-wide statistics
   */
  async getPlatformStats(req, res) {
    try {
      const { timeframe = '30d' } = req.query;
      const stats = await analyticsService.getPlatformStats(timeframe);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Platform stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch platform statistics'
      });
    }
  }

  /**
   * GET /api/analytics/negotiations
   * Get negotiation analytics
   */
  async getNegotiationAnalytics(req, res) {
    try {
      const { timeframe = '30d', caseId } = req.query;
      const analytics = await analyticsService.getNegotiationAnalytics(timeframe, caseId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Negotiation analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch negotiation analytics'
      });
    }
  }

  /**
   * GET /api/analytics/ai-performance
   * Get AI performance metrics
   */
  async getAIPerformance(req, res) {
    try {
      const { timeframe = '30d' } = req.query;
      const metrics = await analyticsService.getAIPerformanceMetrics(timeframe);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('AI performance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch AI performance metrics'
      });
    }
  }

  /**
   * GET /api/analytics/court-filings
   * Get court filing analytics
   */
  async getCourtFilingAnalytics(req, res) {
    try {
      const { timeframe = '30d' } = req.query;
      const analytics = await analyticsService.getCourtFilingAnalytics(timeframe);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Court filing analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch court filing analytics'
      });
    }
  }

  /**
   * GET /api/analytics/case-resolution
   * Get case resolution metrics
   */
  async getCaseResolutionMetrics(req, res) {
    try {
      const { timeframe = '30d' } = req.query;
      const metrics = await analyticsService.getCaseResolutionMetrics(timeframe);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Case resolution metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch case resolution metrics'
      });
    }
  }

  /**
   * GET /api/analytics/user-activity
   * Get user activity analytics
   */
  async getUserActivity(req, res) {
    try {
      const { timeframe = '30d' } = req.query;
      const userId = req.user?.sub; // Current user from auth
      
      const analytics = await analyticsService.getUserActivityAnalytics(userId, timeframe);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('User activity error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user activity data'
      });
    }
  }

  /**
   * POST /api/analytics/clear-cache
   * Clear analytics cache (admin only)
   */
  async clearCache(req, res) {
    try {
      analyticsService.clearCache();

      res.json({
        success: true,
        message: 'Analytics cache cleared successfully'
      });
    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache'
      });
    }
  }
}

module.exports = new AnalyticsController();
