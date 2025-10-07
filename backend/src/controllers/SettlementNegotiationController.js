// Settlement Negotiation Controller - Phase 4.2 API Layer
// Multi-party negotiation system with AI-assisted compromise generation

const SettlementNegotiationService = require('../services/SettlementNegotiationService');
const asyncHandler = require('../lib/asyncHandler');
const { z } = require('zod');

class SettlementNegotiationController {
  // Start negotiation session
  startNegotiation = asyncHandler(async (req, res) => {
    const startNegotiationSchema = z.object({
      caseId: z.string().uuid('Invalid case ID format'),
      initialSettlement: z.object({
        amount: z.number().min(0, 'Settlement amount must be non-negative'),
        terms: z.object({}).passthrough().optional(),
        message: z.string().optional()
      }),
      maxRounds: z.number().int().min(1).max(20).optional().default(10),
      timeoutHours: z.number().min(1).max(168).optional().default(72)
    });

    const validatedData = startNegotiationSchema.parse(req.body);

    const result = await SettlementNegotiationService.startNegotiation(
      validatedData.caseId,
      validatedData.initialSettlement,
      req.user.id
    );

    res.status(201).json(result);
  });

  // Submit negotiation response
  submitResponse = asyncHandler(async (req, res) => {
    const { negotiationId } = req.params;
    
    const responseSchema = z.object({
      type: z.enum(['accept', 'reject', 'counter'], {
        errorMap: () => ({ message: 'Response type must be accept, reject, or counter' })
      }),
      amount: z.number().min(0).optional(),
      terms: z.object({}).passthrough().optional(),
      message: z.string().max(1000, 'Message too long').optional(),
      counterOffer: z.object({
        amount: z.number().min(0),
        terms: z.object({}).passthrough().optional(),
        reasoning: z.string().max(500).optional()
      }).optional()
    }).refine(data => {
      if (data.type === 'counter' && !data.counterOffer) {
        return false;
      }
      return true;
    }, {
      message: 'Counter offers must include counterOffer details',
      path: ['counterOffer']
    });

    const validatedData = responseSchema.parse(req.body);

    const result = await SettlementNegotiationService.submitNegotiationResponse(
      negotiationId,
      req.user.id,
      validatedData
    );

    res.json(result);
  });

  // Get negotiation status
  getNegotiationStatus = asyncHandler(async (req, res) => {
    const { negotiationId } = req.params;

    const result = await SettlementNegotiationService.getNegotiationStatus(negotiationId);
    res.json(result);
  });

  // Generate AI compromise
  generateCompromise = asyncHandler(async (req, res) => {
    const { negotiationId } = req.params;

    const result = await SettlementNegotiationService.generateCompromise(negotiationId);
    res.json(result);
  });

  // Get user's negotiations
  getUserNegotiations = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;

    let query = req.supabase
      .from('settlement_negotiations')
      .select(`
        *,
        cases!inner(
          title,
          case_type,
          jurisdiction
        )
      `)
      .contains('parties', JSON.stringify([{ userId: req.user.id }]))
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: negotiations, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch negotiations: ${error.message}`);
    }

    res.json({
      success: true,
      data: {
        negotiations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  });

  // Get case negotiations
  getCaseNegotiations = asyncHandler(async (req, res) => {
    const { caseId } = req.params;

    const { data: negotiations, error } = await req.supabase
      .from('settlement_negotiations')
      .select(`
        *,
        negotiation_responses(
          user_id,
          response_type,
          settlement_amount,
          message,
          submitted_at
        )
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch case negotiations: ${error.message}`);
    }

    res.json({
      success: true,
      data: { negotiations }
    });
  });

  // Cancel negotiation
  cancelNegotiation = asyncHandler(async (req, res) => {
    const { negotiationId } = req.params;
    const { reason } = req.body;

    // Verify user is a party or case owner
    const { data: negotiation, error } = await req.supabase
      .from('settlement_negotiations')
      .select('*')
      .eq('id', negotiationId)
      .single();

    if (error || !negotiation) {
      return res.status(404).json({
        success: false,
        message: 'Negotiation not found'
      });
    }

    const isParty = negotiation.parties.some(p => p.userId === req.user.id);
    const isInitiator = negotiation.initiated_by === req.user.id;

    if (!isParty && !isInitiator) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { error: updateError } = await req.supabase
      .from('settlement_negotiations')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || 'Cancelled by user',
        cancelled_by: req.user.id,
        cancelled_at: new Date().toISOString()
      })
      .eq('id', negotiationId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Negotiation cancelled successfully'
    });
  });

  // Get negotiation analytics
  getNegotiationAnalytics = asyncHandler(async (req, res) => {
    const { timeframe = '30d' } = req.query;
    
    const days = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    }[timeframe] || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: negotiations, error } = await req.supabase
      .from('settlement_negotiations')
      .select('*')
      .contains('parties', JSON.stringify([{ userId: req.user.id }]))
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw new Error(`Failed to fetch analytics: ${error.message}`);
    }

    const analytics = {
      totalNegotiations: negotiations.length,
      successfulNegotiations: negotiations.filter(n => n.status === 'completed').length,
      failedNegotiations: negotiations.filter(n => n.status === 'failed').length,
      activeNegotiations: negotiations.filter(n => n.status === 'active').length,
      averageRounds: negotiations.length > 0
        ? negotiations.reduce((sum, n) => sum + (n.current_round || 0), 0) / negotiations.length
        : 0,
      successRate: negotiations.length > 0
        ? (negotiations.filter(n => n.status === 'completed').length / negotiations.length) * 100
        : 0,
      statusDistribution: negotiations.reduce((acc, n) => {
        acc[n.status] = (acc[n.status] || 0) + 1;
        return acc;
      }, {}),
      recentActivity: negotiations
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .map(n => ({
          negotiationId: n.id,
          caseId: n.case_id,
          status: n.status,
          currentRound: n.current_round,
          createdAt: n.created_at
        }))
    };

    res.json({
      success: true,
      data: { analytics }
    });
  });

  // Get round history
  getRoundHistory = asyncHandler(async (req, res) => {
    const { negotiationId } = req.params;

    const { data: responses, error } = await req.supabase
      .from('negotiation_responses')
      .select(`
        *,
        users!inner(name, email)
      `)
      .eq('negotiation_id', negotiationId)
      .order('round_number', { ascending: true })
      .order('submitted_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch round history: ${error.message}`);
    }

    // Group by rounds
    const rounds = {};
    responses.forEach(response => {
      if (!rounds[response.round_number]) {
        rounds[response.round_number] = [];
      }
      rounds[response.round_number].push({
        ...response,
        userName: response.users.name
      });
    });

    res.json({
      success: true,
      data: { rounds }
    });
  });

  // Health check
  healthCheck = asyncHandler(async (req, res) => {
    const health = await SettlementNegotiationService.healthCheck();
    res.json(health);
  });
}

module.exports = SettlementNegotiationController;