const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');
const _supabaseModule = require('../lib/supabaseClient');
const supabase = (_supabaseModule && _supabaseModule.supabase) ? _supabaseModule.supabase : _supabaseModule;

/**
 * Get dashboard statistics
 * @route GET /api/dashboard/stats
 */
exports.getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get case statistics
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('id, status, created_at, resolved_at')
    .eq('created_by', userId);

  if (casesError) {
    throw new HttpError(500, 'Failed to fetch case statistics');
  }

  const totalCases = cases.length;
  const activeCases = cases.filter(c => 
    ['filed', 'awaiting_response', 'under_review', 'ai_analysis', 'settlement_options'].includes(c.status)
  ).length;
  const closedCases = cases.filter(c => c.status === 'closed').length;
  const pendingActions = cases.filter(c => 
    ['awaiting_response', 'settlement_options'].includes(c.status)
  ).length;

  // Calculate average resolution time (in days)
  const resolvedCases = cases.filter(c => c.resolved_at);
  let avgResolutionDays = 0;
  if (resolvedCases.length > 0) {
    const totalDays = resolvedCases.reduce((sum, c) => {
      const created = new Date(c.created_at);
      const resolved = new Date(c.resolved_at);
      const days = Math.floor((resolved - created) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    avgResolutionDays = Math.round(totalDays / resolvedCases.length);
  }

  // Calculate success rate
  const successRate = totalCases > 0 
    ? Math.round((closedCases / totalCases) * 100) 
    : 0;

  res.json({
    success: true,
    data: {
      totalCases,
      activeCases,
      closedCases,
      pendingActions,
      avgResolutionDays,
      successRate,
    },
  });
});

/**
 * Get recent activity
 * @route GET /api/dashboard/recent-activity
 */
exports.getRecentActivity = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 10;

  // Get recent case updates
  const { data: recentCases, error: casesError } = await supabase
    .from('cases')
    .select('id, case_number, title, status, created_at, updated_at')
    .eq('created_by', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (casesError) {
    throw new HttpError(500, 'Failed to fetch recent activity');
  }

  // Transform to activity format
  const activities = recentCases.map(c => ({
    id: c.id,
    type: c.created_at === c.updated_at ? 'dispute_created' : 'dispute_updated',
    title: c.created_at === c.updated_at 
      ? `New dispute filed: ${c.title}`
      : `Dispute updated: ${c.title}`,
    description: `Case #${c.case_number}`,
    timestamp: c.updated_at,
    status: c.status,
  }));

  res.json({
    success: true,
    data: activities,
  });
});

/**
 * Get dispute trends (for charts)
 * @route GET /api/dashboard/trends
 */
exports.getTrends = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const period = req.query.period || 'month'; // month, quarter, year

  // Get cases created in the last period
  let startDate = new Date();
  if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  } else if (period === 'quarter') {
    startDate.setMonth(startDate.getMonth() - 3);
  } else if (period === 'year') {
    startDate.setFullYear(startDate.getFullYear() - 1);
  }

  const { data: cases, error } = await supabase
    .from('cases')
    .select('id, status, created_at, dispute_type')
    .eq('created_by', userId)
    .gte('created_at', startDate.toISOString());

  if (error) {
    throw new HttpError(500, 'Failed to fetch trends');
  }

  // Group by month
  const trendsByMonth = {};
  cases.forEach(c => {
    const month = new Date(c.created_at).toISOString().slice(0, 7); // YYYY-MM
    if (!trendsByMonth[month]) {
      trendsByMonth[month] = { total: 0, resolved: 0, active: 0 };
    }
    trendsByMonth[month].total++;
    if (c.status === 'closed') {
      trendsByMonth[month].resolved++;
    } else {
      trendsByMonth[month].active++;
    }
  });

  // Group by dispute type
  const typeDistribution = {};
  cases.forEach(c => {
    const type = c.dispute_type || 'other';
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
  });

  res.json({
    success: true,
    data: {
      trendsByMonth,
      typeDistribution,
      totalCases: cases.length,
    },
  });
});
