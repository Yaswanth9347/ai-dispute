// Multi-Party Controller - API endpoints for Phase 3 multi-party workflows
const InvitationService = require('../services/InvitationService');
const SettlementNegotiationService = require('../services/SettlementNegotiationService');
const SignatureService = require('../services/SignatureService');
const RealTimeService = require('../services/RealTimeService');
const asyncHandler = require('../lib/asyncHandler');
const HttpError = require('../lib/HttpError');

class MultiPartyController {
  // POST /api/multi-party/invitations
  createInvitation = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      case_id,
      invitee_email,
      invitee_name,
      party_role,
      invitation_message
    } = req.body;

    if (!case_id || !invitee_email || !invitee_name) {
      throw new HttpError(400, 'case_id, invitee_email, and invitee_name are required');
    }

    const result = await InvitationService.inviteParty(case_id, userId, {
      email: invitee_email,
      name: invitee_name,
      role: party_role || 'respondent',
      message: invitation_message
    });

    if (!result.success) {
      throw new HttpError(500, result.error || 'Failed to create invitation');
    }

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        invitation: result.invitation,
        invitation_token: result.invitation_token,
        expires_at: result.expires_at
      }
    });
  });

  // POST /api/multi-party/invitations/:token/accept
  acceptInvitation = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const userId = req.user?.id; // May be null for new users

    if (!token) {
      throw new HttpError(400, 'Invitation token is required');
    }

    const result = await InvitationService.acceptInvitation(token, userId);

    if (!result.success) {
      throw new HttpError(400, result.error || 'Failed to accept invitation');
    }

    res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        party: result.party,
        user: result.user,
        case_id: result.case_id
      }
    });
  });

  // POST /api/multi-party/invitations/:token/decline
  declineInvitation = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { reason } = req.body;

    if (!token) {
      throw new HttpError(400, 'Invitation token is required');
    }

    const result = await InvitationService.declineInvitation(token, reason);

    if (!result.success) {
      throw new HttpError(400, result.error || 'Failed to decline invitation');
    }

    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  // GET /api/multi-party/invitations/:token
  getInvitation = asyncHandler(async (req, res) => {
    const { token } = req.params;

    if (!token) {
      throw new HttpError(400, 'Invitation token is required');
    }

    const invitation = await InvitationService.getInvitationByToken(token);

    if (!invitation) {
      throw new HttpError(404, 'Invitation not found or expired');
    }

    res.status(200).json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          case_title: invitation.case_title,
          case_type: invitation.cases?.case_type,
          invitee_name: invitation.invitee_name,
          party_role: invitation.party_role,
          invitation_message: invitation.invitation_message,
          expires_at: invitation.expires_at,
          status: invitation.status
        }
      }
    });
  });

  // GET /api/multi-party/cases/:caseId/invitations
  getCaseInvitations = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    const result = await InvitationService.getCaseInvitations(caseId, userId);

    if (!result.success) {
      throw new HttpError(403, result.error || 'Access denied to case invitations');
    }

    res.status(200).json({
      success: true,
      data: {
        invitations: result.invitations
      }
    });
  });

  // POST /api/multi-party/invitations/:invitationId/resend
  resendInvitation = asyncHandler(async (req, res) => {
    const { invitationId } = req.params;
    const userId = req.user.id;

    if (!invitationId) {
      throw new HttpError(400, 'Invitation ID is required');
    }

    const result = await InvitationService.resendInvitation(invitationId, userId);

    if (!result.success) {
      throw new HttpError(403, result.error || 'Failed to resend invitation');
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        expires_at: result.expires_at
      }
    });
  });

  // DELETE /api/multi-party/invitations/:invitationId
  cancelInvitation = asyncHandler(async (req, res) => {
    const { invitationId } = req.params;
    const userId = req.user.id;

    if (!invitationId) {
      throw new HttpError(400, 'Invitation ID is required');
    }

    const result = await InvitationService.cancelInvitation(invitationId, userId);

    if (!result.success) {
      throw new HttpError(403, result.error || 'Failed to cancel invitation');
    }

    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  // POST /api/multi-party/negotiations
  startNegotiation = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      case_id,
      negotiation_type,
      initial_proposals,
      negotiation_deadline,
      negotiation_message
    } = req.body;

    if (!case_id) {
      throw new HttpError(400, 'case_id is required');
    }

    const result = await SettlementNegotiationService.startSettlementNegotiation(
      case_id,
      userId,
      {
        negotiation_type,
        initial_proposals,
        negotiation_deadline,
        negotiation_message
      }
    );

    if (!result.success) {
      throw new HttpError(500, result.error || 'Failed to start negotiation');
    }

    res.status(201).json({
      success: true,
      message: 'Settlement negotiation started successfully',
      data: {
        negotiation_session: result.negotiation_session,
        initial_proposals: result.initial_proposals,
        parties: result.parties
      }
    });
  });

  // POST /api/multi-party/negotiations/:negotiationId/proposals
  submitNegotiationProposal = asyncHandler(async (req, res) => {
    const { negotiationId } = req.params;
    const userId = req.user.id;
    const proposalData = req.body;

    if (!negotiationId) {
      throw new HttpError(400, 'Negotiation ID is required');
    }

    const result = await SettlementNegotiationService.submitNegotiationProposal(
      negotiationId,
      userId,
      proposalData
    );

    if (!result.success) {
      throw new HttpError(400, result.error || 'Failed to submit proposal');
    }

    res.status(201).json({
      success: true,
      message: 'Negotiation proposal submitted successfully',
      data: {
        proposal: result.proposal,
        negotiation_status: result.negotiation_status,
        responses_received: result.responses_received,
        total_parties: result.total_parties
      }
    });
  });

  // GET /api/multi-party/negotiations/:negotiationId
  getNegotiationStatus = asyncHandler(async (req, res) => {
    const { negotiationId } = req.params;
    const userId = req.user.id;

    if (!negotiationId) {
      throw new HttpError(400, 'Negotiation ID is required');
    }

    const result = await SettlementNegotiationService.getNegotiationStatus(
      negotiationId,
      userId
    );

    if (!result.success) {
      throw new HttpError(403, result.error || 'Access denied to negotiation');
    }

    res.status(200).json({
      success: true,
      data: {
        negotiation: result.negotiation
      }
    });
  });

  // POST /api/multi-party/settlements/:proposalId/accept
  acceptSettlement = asyncHandler(async (req, res) => {
    const { proposalId } = req.params;
    const userId = req.user.id;

    if (!proposalId) {
      throw new HttpError(400, 'Proposal ID is required');
    }

    const result = await SettlementNegotiationService.acceptSettlementProposal(
      proposalId,
      userId
    );

    if (!result.success) {
      throw new HttpError(400, result.error || 'Failed to accept settlement');
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        proposal: result.proposal
      }
    });
  });

  // GET /api/multi-party/cases/:caseId/negotiations
  getCaseNegotiations = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    const result = await SettlementNegotiationService.getCaseNegotiations(caseId, userId);

    if (!result.success) {
      throw new HttpError(403, result.error || 'Access denied to case negotiations');
    }

    res.status(200).json({
      success: true,
      data: {
        negotiations: result.negotiations
      }
    });
  });

  // POST /api/multi-party/signatures
  createSignatureRequest = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const signatureRequestData = req.body;

    const result = await SignatureService.createSignatureRequest(
      signatureRequestData,
      userId
    );

    if (!result.success) {
      throw new HttpError(500, result.error || 'Failed to create signature request');
    }

    res.status(201).json({
      success: true,
      message: 'Signature request created successfully',
      data: {
        signature_request: result.signature_request,
        signers: result.signers
      }
    });
  });

  // POST /api/multi-party/signatures/:token/sign
  signDocument = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const userId = req.user.id;
    const signatureData = req.body;

    if (!token) {
      throw new HttpError(400, 'Signature token is required');
    }

    const result = await SignatureService.signDocument(token, signatureData, userId);

    if (!result.success) {
      throw new HttpError(400, result.error || 'Failed to sign document');
    }

    res.status(200).json({
      success: true,
      message: 'Document signed successfully',
      data: {
        signature_request_id: result.signature_request_id,
        signer_id: result.signer_id,
        status: result.status,
        completed_signatures: result.completed_signatures,
        total_signers: result.total_signers
      }
    });
  });

  // GET /api/multi-party/signatures/:requestId
  getSignatureRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const userId = req.user.id;

    if (!requestId) {
      throw new HttpError(400, 'Signature request ID is required');
    }

    const result = await SignatureService.getSignatureRequest(requestId, userId);

    if (!result.success) {
      throw new HttpError(403, result.error || 'Access denied to signature request');
    }

    res.status(200).json({
      success: true,
      data: {
        signature_request: result.signature_request,
        signers: result.signers
      }
    });
  });

  // GET /api/multi-party/cases/:caseId/signatures
  getCaseSignatureRequests = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;

    if (!caseId) {
      throw new HttpError(400, 'Case ID is required');
    }

    const result = await SignatureService.getCaseSignatureRequests(caseId, userId);

    if (!result.success) {
      throw new HttpError(403, result.error || 'Access denied to case signature requests');
    }

    res.status(200).json({
      success: true,
      data: {
        signature_requests: result.signature_requests
      }
    });
  });

  // DELETE /api/multi-party/signatures/:requestId
  cancelSignatureRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const userId = req.user.id;

    if (!requestId) {
      throw new HttpError(400, 'Signature request ID is required');
    }

    const result = await SignatureService.cancelSignatureRequest(requestId, userId);

    if (!result.success) {
      throw new HttpError(403, result.error || 'Failed to cancel signature request');
    }

    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  // GET /api/multi-party/users/:userId/signatures/pending
  getUserPendingSignatures = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const requestingUserId = req.user.id;

    // Users can only get their own pending signatures
    if (userId !== requestingUserId) {
      throw new HttpError(403, 'Access denied to user signatures');
    }

    const result = await SignatureService.getUserPendingSignatures(userId);

    if (!result.success) {
      throw new HttpError(500, result.error || 'Failed to get pending signatures');
    }

    res.status(200).json({
      success: true,
      data: {
        pending_signatures: result.pending_signatures
      }
    });
  });

  // GET /api/multi-party/realtime/stats
  getRealTimeStats = asyncHandler(async (req, res) => {
    const stats = RealTimeService.getStats();

    res.status(200).json({
      success: true,
      data: {
        realtime_stats: stats
      }
    });
  });

  // GET /api/multi-party/cases/:caseId/online-users
  getCaseOnlineUsers = asyncHandler(async (req, res) => {
    const { caseId } = req.params;
    const userId = req.user.id;

    // Verify access to case (implementation would check Case.hasAccess)
    // For now, just get online users
    const onlineUsers = RealTimeService.getOnlineUsersForCase(caseId);

    res.status(200).json({
      success: true,
      data: {
        case_id: caseId,
        online_users: onlineUsers,
        total_online: onlineUsers.length
      }
    });
  });
}

module.exports = new MultiPartyController();