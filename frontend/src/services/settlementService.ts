import { apiRequest } from '@/lib/api';
import { ApiResponse } from '@/types';

export interface SettlementProposal {
  id: string;
  caseId: string;
  proposedBy: string;
  amount: number;
  terms: string;
  status: 'pending' | 'accepted' | 'rejected' | 'counter-proposed';
  createdAt: string;
  updatedAt: string;
  responses?: SettlementResponse[];
}

export interface SettlementResponse {
  id: string;
  proposalId: string;
  respondedBy: string;
  response: 'accept' | 'reject' | 'counter';
  counterAmount?: number;
  counterTerms?: string;
  notes?: string;
  createdAt: string;
}

export interface NegotiationSession {
  id: string;
  caseId: string;
  participants: string[];
  status: 'active' | 'completed' | 'paused';
  currentProposal?: SettlementProposal;
  messages: NegotiationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface NegotiationMessage {
  id: string;
  sessionId: string;
  senderId: string;
  message: string;
  type: 'text' | 'proposal' | 'system';
  timestamp: string;
}

export interface CreateProposalData {
  caseId: string;
  amount: number;
  terms: string;
  conditions?: string[];
  deadlineDate?: string;
}

export interface RespondToProposalData {
  response: 'accept' | 'reject' | 'counter';
  counterAmount?: number;
  counterTerms?: string;
  notes?: string;
}

export const settlementService = {
  // Get all settlement proposals for a case
  getProposals: async (caseId: string): Promise<ApiResponse<SettlementProposal[]>> => {
    return apiRequest.get<SettlementProposal[]>(`/active-negotiations/proposals/${caseId}`);
  },

  // Create a new settlement proposal
  createProposal: async (data: CreateProposalData): Promise<ApiResponse<SettlementProposal>> => {
    return apiRequest.post<SettlementProposal>('/active-negotiations/proposals', data);
  },

  // Respond to a settlement proposal
  respondToProposal: async (proposalId: string, data: RespondToProposalData): Promise<ApiResponse<SettlementResponse>> => {
    return apiRequest.post<SettlementResponse>(`/active-negotiations/proposals/${proposalId}/respond`, data);
  },

  // Get negotiation session for a case
  getNegotiationSession: async (caseId: string): Promise<ApiResponse<NegotiationSession>> => {
    return apiRequest.get<NegotiationSession>(`/active-negotiations/sessions/${caseId}`);
  },

  // Start a new negotiation session
  startNegotiation: async (caseId: string, participants: string[]): Promise<ApiResponse<NegotiationSession>> => {
    return apiRequest.post<NegotiationSession>('/active-negotiations/sessions', {
      caseId,
      participants
    });
  },

  // Send message in negotiation session
  sendMessage: async (sessionId: string, message: string): Promise<ApiResponse<NegotiationMessage>> => {
    return apiRequest.post<NegotiationMessage>(`/active-negotiations/sessions/${sessionId}/messages`, {
      message
    });
  },

  // Get negotiation analytics
  getAnalytics: async (caseId: string): Promise<ApiResponse<any>> => {
    return apiRequest.get(`/active-negotiations/analytics/${caseId}`);
  },

  // Get settlement templates
  getTemplates: async (): Promise<ApiResponse<any[]>> => {
    return apiRequest.get('/active-negotiations/templates');
  },

  // Generate AI settlement suggestion
  getAISuggestion: async (caseId: string): Promise<ApiResponse<any>> => {
    return apiRequest.post(`/active-negotiations/ai-suggest/${caseId}`, {});
  }
};