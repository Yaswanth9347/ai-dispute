// Analytics Service - Comprehensive metrics and insights
const { supabase } = require('../lib/supabaseClient');

class AnalyticsService {
  constructor() {
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.metricsCache = new Map();
  }

  /**
   * Get overall platform statistics
   */
  async getPlatformStats(timeframe = '30d') {
    const cacheKey = `platform_stats_${timeframe}`;
    const cached = this.getCachedMetric(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = this.getDateRange(timeframe);

    try {
      // Total cases
      const { count: totalCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true });

      // Cases created in timeframe
      const { count: newCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Active negotiations
      const { count: activeNegotiations } = await supabase
        .from('negotiation_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Completed settlements
      const { count: completedSettlements } = await supabase
        .from('negotiation_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed_accepted')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Court filings
      const { count: courtFilings } = await supabase
        .from('court_filings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Active users (users with activity in timeframe)
      const { data: activeUsers } = await supabase
        .from('cases')
        .select('created_by')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const uniqueUsers = new Set(activeUsers?.map(c => c.created_by) || []).size;

      const stats = {
        totalCases,
        newCases,
        activeNegotiations,
        completedSettlements,
        courtFilings,
        activeUsers: uniqueUsers,
        settlementRate: newCases > 0 ? ((completedSettlements / newCases) * 100).toFixed(1) : 0,
        timeframe,
        generatedAt: new Date().toISOString()
      };

      this.setCachedMetric(cacheKey, stats);
      return stats;

    } catch (error) {
      console.error('Error getting platform stats:', error);
      throw new Error('Failed to fetch platform statistics');
    }
  }

  /**
   * Get negotiation analytics
   */
  async getNegotiationAnalytics(timeframe = '30d', caseId = null) {
    const cacheKey = `negotiation_analytics_${timeframe}_${caseId || 'all'}`;
    const cached = this.getCachedMetric(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = this.getDateRange(timeframe);

    try {
      let query = supabase
        .from('negotiation_sessions')
        .select(`
          id,
          status,
          current_round,
          max_rounds,
          created_at,
          updated_at,
          initial_offer,
          case_id,
          cases(title, dispute_amount, currency)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (caseId) {
        query = query.eq('case_id', caseId);
      }

      const { data: sessions, error } = await query;
      if (error) throw error;

      const analytics = {
        total: sessions.length,
        byStatus: {},
        averageRounds: 0,
        averageSettlementAmount: 0,
        successRate: 0,
        timeline: [],
        topPerformers: []
      };

      // Group by status
      const statusGroups = sessions.reduce((acc, session) => {
        acc[session.status] = (acc[session.status] || 0) + 1;
        return acc;
      }, {});
      analytics.byStatus = statusGroups;

      // Calculate success rate
      const successful = sessions.filter(s => s.status === 'completed_accepted').length;
      analytics.successRate = sessions.length > 0 
        ? ((successful / sessions.length) * 100).toFixed(1) 
        : 0;

      // Average rounds
      const totalRounds = sessions.reduce((sum, s) => sum + (s.current_round || 0), 0);
      analytics.averageRounds = sessions.length > 0 
        ? (totalRounds / sessions.length).toFixed(1) 
        : 0;

      // Timeline data (group by day)
      const timelineMap = new Map();
      sessions.forEach(session => {
        const day = new Date(session.created_at).toISOString().split('T')[0];
        if (!timelineMap.has(day)) {
          timelineMap.set(day, { date: day, started: 0, completed: 0, failed: 0 });
        }
        const dayData = timelineMap.get(day);
        dayData.started++;
        if (session.status === 'completed_accepted') dayData.completed++;
        if (session.status === 'completed_failed' || session.status === 'cancelled') dayData.failed++;
      });
      analytics.timeline = Array.from(timelineMap.values()).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      this.setCachedMetric(cacheKey, analytics);
      return analytics;

    } catch (error) {
      console.error('Error getting negotiation analytics:', error);
      throw new Error('Failed to fetch negotiation analytics');
    }
  }

  /**
   * Get AI performance metrics
   */
  async getAIPerformanceMetrics(timeframe = '30d') {
    const cacheKey = `ai_performance_${timeframe}`;
    const cached = this.getCachedMetric(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = this.getDateRange(timeframe);

    try {
      // Get AI analyses
      const { data: analyses, error: analysisError } = await supabase
        .from('ai_analysis')
        .select('id, confidence_score, analysis_type, created_at, processing_time_ms')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (analysisError) throw analysisError;

      // Get AI-generated compromises
      const { data: compromises, error: compromiseError } = await supabase
        .from('negotiation_compromises')
        .select('id, confidence_score, generated_at')
        .gte('generated_at', startDate)
        .lte('generated_at', endDate);

      if (compromiseError) throw compromiseError;

      const metrics = {
        totalAnalyses: analyses?.length || 0,
        totalCompromises: compromises?.length || 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        confidenceDistribution: {
          high: 0,    // > 0.8
          medium: 0,  // 0.5 - 0.8
          low: 0      // < 0.5
        },
        byAnalysisType: {},
        timeline: []
      };

      if (analyses && analyses.length > 0) {
        // Average confidence
        const totalConfidence = analyses.reduce((sum, a) => 
          sum + (parseFloat(a.confidence_score) || 0), 0
        );
        metrics.averageConfidence = (totalConfidence / analyses.length).toFixed(3);

        // Average processing time
        const totalTime = analyses.reduce((sum, a) => 
          sum + (a.processing_time_ms || 0), 0
        );
        metrics.averageProcessingTime = Math.round(totalTime / analyses.length);

        // Confidence distribution
        analyses.forEach(a => {
          const conf = parseFloat(a.confidence_score) || 0;
          if (conf > 0.8) metrics.confidenceDistribution.high++;
          else if (conf >= 0.5) metrics.confidenceDistribution.medium++;
          else metrics.confidenceDistribution.low++;
        });

        // By analysis type
        metrics.byAnalysisType = analyses.reduce((acc, a) => {
          const type = a.analysis_type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});

        // Timeline
        const timelineMap = new Map();
        analyses.forEach(analysis => {
          const day = new Date(analysis.created_at).toISOString().split('T')[0];
          if (!timelineMap.has(day)) {
            timelineMap.set(day, { date: day, count: 0, avgConfidence: [] });
          }
          const dayData = timelineMap.get(day);
          dayData.count++;
          dayData.avgConfidence.push(parseFloat(analysis.confidence_score) || 0);
        });

        metrics.timeline = Array.from(timelineMap.values()).map(day => ({
          date: day.date,
          count: day.count,
          averageConfidence: (day.avgConfidence.reduce((a, b) => a + b, 0) / day.avgConfidence.length).toFixed(3)
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      this.setCachedMetric(cacheKey, metrics);
      return metrics;

    } catch (error) {
      console.error('Error getting AI performance metrics:', error);
      throw new Error('Failed to fetch AI performance metrics');
    }
  }

  /**
   * Get court filing analytics
   */
  async getCourtFilingAnalytics(timeframe = '30d') {
    const cacheKey = `court_filing_${timeframe}`;
    const cached = this.getCachedMetric(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = this.getDateRange(timeframe);

    try {
      const { data: filings, error } = await supabase
        .from('court_filings')
        .select(`
          id,
          status,
          filing_type,
          created_at,
          submitted_at,
          court_system_id,
          expedited,
          metadata
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const analytics = {
        total: filings?.length || 0,
        byStatus: {},
        byFilingType: {},
        expeditedCount: 0,
        averageProcessingTime: 0,
        successRate: 0,
        timeline: []
      };

      if (filings && filings.length > 0) {
        // Group by status
        analytics.byStatus = filings.reduce((acc, f) => {
          acc[f.status] = (acc[f.status] || 0) + 1;
          return acc;
        }, {});

        // Group by filing type
        analytics.byFilingType = filings.reduce((acc, f) => {
          acc[f.filing_type] = (acc[f.filing_type] || 0) + 1;
          return acc;
        }, {});

        // Expedited count
        analytics.expeditedCount = filings.filter(f => f.expedited).length;

        // Success rate
        const successful = filings.filter(f => 
          f.status === 'processed' || f.status === 'submitted'
        ).length;
        analytics.successRate = ((successful / filings.length) * 100).toFixed(1);

        // Average processing time (in hours)
        const processedFilings = filings.filter(f => f.submitted_at && f.created_at);
        if (processedFilings.length > 0) {
          const totalTime = processedFilings.reduce((sum, f) => {
            const diff = new Date(f.submitted_at) - new Date(f.created_at);
            return sum + diff;
          }, 0);
          analytics.averageProcessingTime = (totalTime / processedFilings.length / (1000 * 60 * 60)).toFixed(1);
        }

        // Timeline
        const timelineMap = new Map();
        filings.forEach(filing => {
          const day = new Date(filing.created_at).toISOString().split('T')[0];
          if (!timelineMap.has(day)) {
            timelineMap.set(day, { date: day, total: 0, successful: 0, failed: 0 });
          }
          const dayData = timelineMap.get(day);
          dayData.total++;
          if (filing.status === 'processed' || filing.status === 'submitted') {
            dayData.successful++;
          } else if (filing.status === 'failed' || filing.status === 'rejected') {
            dayData.failed++;
          }
        });

        analytics.timeline = Array.from(timelineMap.values()).sort((a, b) => 
          new Date(a.date) - new Date(b.date)
        );
      }

      this.setCachedMetric(cacheKey, analytics);
      return analytics;

    } catch (error) {
      console.error('Error getting court filing analytics:', error);
      throw new Error('Failed to fetch court filing analytics');
    }
  }

  /**
   * Get case resolution metrics
   */
  async getCaseResolutionMetrics(timeframe = '30d') {
    const cacheKey = `case_resolution_${timeframe}`;
    const cached = this.getCachedMetric(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = this.getDateRange(timeframe);

    try {
      const { data: cases, error } = await supabase
        .from('cases')
        .select('id, status, created_at, updated_at, dispute_amount, currency')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const metrics = {
        total: cases?.length || 0,
        byStatus: {},
        resolvedCount: 0,
        averageResolutionTime: 0,
        totalDisputeValue: 0,
        resolutionRate: 0,
        timeline: []
      };

      if (cases && cases.length > 0) {
        // Group by status
        metrics.byStatus = cases.reduce((acc, c) => {
          acc[c.status] = (acc[c.status] || 0) + 1;
          return acc;
        }, {});

        // Resolved cases
        const resolved = cases.filter(c => 
          c.status === 'settled' || c.status === 'closed'
        );
        metrics.resolvedCount = resolved.length;
        metrics.resolutionRate = ((resolved.length / cases.length) * 100).toFixed(1);

        // Average resolution time (in days)
        if (resolved.length > 0) {
          const totalTime = resolved.reduce((sum, c) => {
            const diff = new Date(c.updated_at) - new Date(c.created_at);
            return sum + diff;
          }, 0);
          metrics.averageResolutionTime = (totalTime / resolved.length / (1000 * 60 * 60 * 24)).toFixed(1);
        }

        // Total dispute value
        metrics.totalDisputeValue = cases.reduce((sum, c) => 
          sum + (parseFloat(c.dispute_amount) || 0), 0
        );

        // Timeline
        const timelineMap = new Map();
        cases.forEach(caseItem => {
          const day = new Date(caseItem.created_at).toISOString().split('T')[0];
          if (!timelineMap.has(day)) {
            timelineMap.set(day, { date: day, created: 0, resolved: 0 });
          }
          const dayData = timelineMap.get(day);
          dayData.created++;
          if (caseItem.status === 'settled' || caseItem.status === 'closed') {
            dayData.resolved++;
          }
        });

        metrics.timeline = Array.from(timelineMap.values()).sort((a, b) => 
          new Date(a.date) - new Date(b.date)
        );
      }

      this.setCachedMetric(cacheKey, metrics);
      return metrics;

    } catch (error) {
      console.error('Error getting case resolution metrics:', error);
      throw new Error('Failed to fetch case resolution metrics');
    }
  }

  /**
   * Get user activity analytics
   */
  async getUserActivityAnalytics(userId = null, timeframe = '30d') {
    const { startDate, endDate } = this.getDateRange(timeframe);

    try {
      let query = supabase
        .from('cases')
        .select('id, created_by, created_at, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (userId) {
        query = query.eq('created_by', userId);
      }

      const { data: cases, error } = await query;
      if (error) throw error;

      const analytics = {
        totalCases: cases?.length || 0,
        activeCases: 0,
        resolvedCases: 0,
        activityTimeline: []
      };

      if (cases && cases.length > 0) {
        analytics.activeCases = cases.filter(c => 
          c.status === 'active' || c.status === 'pending'
        ).length;

        analytics.resolvedCases = cases.filter(c => 
          c.status === 'settled' || c.status === 'closed'
        ).length;

        // Timeline
        const timelineMap = new Map();
        cases.forEach(caseItem => {
          const day = new Date(caseItem.created_at).toISOString().split('T')[0];
          timelineMap.set(day, (timelineMap.get(day) || 0) + 1);
        });

        analytics.activityTimeline = Array.from(timelineMap.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
      }

      return analytics;

    } catch (error) {
      console.error('Error getting user activity analytics:', error);
      throw new Error('Failed to fetch user activity analytics');
    }
  }

  // Helper methods
  getDateRange(timeframe) {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  getCachedMetric(key) {
    const cached = this.metricsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedMetric(key, data) {
    this.metricsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.metricsCache.clear();
  }
}

module.exports = new AnalyticsService();
