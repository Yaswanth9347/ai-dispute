import { apiRequest, uploadFile } from '@/lib/api';
import { 
  DisputeCase, 
  CaseFilingForm,
  Statement,
  StatementForm,
  Evidence,
  EvidenceUploadForm,
  AIAnalysis,
  SettlementOption,
  FinalDecision,
  CaseDocument,
  ApiResponse,
  PaginatedResponse,
  CaseActivity,
  DashboardStats 
} from '@/types';

export const caseService = {
  // Get all cases for current user
  getCases: async (page = 1, limit = 10): Promise<PaginatedResponse<DisputeCase>> => {
    return apiRequest.getPaginated<DisputeCase>('/cases', { page, limit });
  },

  // Get single case by ID
  getCase: async (caseId: string): Promise<ApiResponse<DisputeCase>> => {
    return apiRequest.get<DisputeCase>(`/cases/${caseId}`);
  },

  // File a new case
  fileCase: async (data: CaseFilingForm): Promise<ApiResponse<DisputeCase>> => {
    return apiRequest.post<DisputeCase>('/cases', data);
  },

  // Update case details (only for plaintiff)
  updateCase: async (caseId: string, data: Partial<DisputeCase>): Promise<ApiResponse<DisputeCase>> => {
    return apiRequest.put<DisputeCase>(`/cases/${caseId}`, data);
  },

  // Delete case (only for plaintiff, and only if no responses)
  deleteCase: async (caseId: string): Promise<ApiResponse<null>> => {
    return apiRequest.delete<null>(`/cases/${caseId}`);
  },

  // Get case activity/timeline
  getCaseActivity: async (caseId: string): Promise<ApiResponse<CaseActivity[]>> => {
    return apiRequest.get<CaseActivity[]>(`/cases/${caseId}/activity`);
  },

  // Forward case to court
  forwardToeCourt: async (caseId: string): Promise<ApiResponse<null>> => {
    return apiRequest.post<null>(`/cases/${caseId}/forward-to-court`, {});
  },
};

export const statementService = {
  // Get statements for a case
  getStatements: async (caseId: string): Promise<ApiResponse<Statement[]>> => {
    return apiRequest.get<Statement[]>(`/cases/${caseId}/statements`);
  },

  // Submit a statement
  submitStatement: async (caseId: string, data: StatementForm): Promise<ApiResponse<Statement>> => {
    return apiRequest.post<Statement>(`/cases/${caseId}/statements`, data);
  },

  // Update a statement (only if editable)
  updateStatement: async (caseId: string, statementId: string, data: Partial<StatementForm>): Promise<ApiResponse<Statement>> => {
    return apiRequest.put<Statement>(`/cases/${caseId}/statements/${statementId}`, data);
  },

  // Delete a statement (only if editable)
  deleteStatement: async (caseId: string, statementId: string): Promise<ApiResponse<null>> => {
    return apiRequest.delete<null>(`/cases/${caseId}/statements/${statementId}`);
  },
};

export const evidenceService = {
  // Get evidence for a case
  getEvidence: async (caseId: string): Promise<ApiResponse<Evidence[]>> => {
    return apiRequest.get<Evidence[]>(`/cases/${caseId}/evidence`);
  },

  // Upload evidence
  uploadEvidence: async (caseId: string, data: EvidenceUploadForm): Promise<ApiResponse<Evidence[]>> => {
    const uploadedFiles = await Promise.all(
      data.files.map(file => uploadFile(file, 'evidence'))
    );

    const evidenceData = {
      description: data.description,
      files: uploadedFiles.map((fileUrl, index) => ({
        fileName: data.files[index].name,
        fileType: data.files[index].type.startsWith('image/') ? 'image' : 
                 data.files[index].type.startsWith('video/') ? 'video' :
                 data.files[index].type.startsWith('audio/') ? 'audio' : 'document',
        fileUrl: fileUrl,
      }))
    };

    return apiRequest.post<Evidence[]>(`/cases/${caseId}/evidence`, evidenceData);
  },

  // Delete evidence
  deleteEvidence: async (caseId: string, evidenceId: string): Promise<ApiResponse<null>> => {
    return apiRequest.delete<null>(`/cases/${caseId}/evidence/${evidenceId}`);
  },

  // Update evidence description
  updateEvidence: async (caseId: string, evidenceId: string, description: string): Promise<ApiResponse<Evidence>> => {
    return apiRequest.put<Evidence>(`/cases/${caseId}/evidence/${evidenceId}`, { description });
  },
};

export const aiService = {
  // Request AI analysis for a case
  requestAnalysis: async (caseId: string): Promise<ApiResponse<AIAnalysis>> => {
    return apiRequest.post<AIAnalysis>(`/cases/${caseId}/ai-analysis`, {});
  },

  // Get AI analysis for a case
  getAnalysis: async (caseId: string): Promise<ApiResponse<AIAnalysis>> => {
    return apiRequest.get<AIAnalysis>(`/cases/${caseId}/ai-analysis`);
  },

  // Get settlement options
  getSettlementOptions: async (caseId: string): Promise<ApiResponse<SettlementOption[]>> => {
    return apiRequest.get<SettlementOption[]>(`/cases/${caseId}/settlement-options`);
  },

  // Accept a settlement option
  acceptSettlement: async (caseId: string, optionId: string): Promise<ApiResponse<null>> => {
    return apiRequest.post<null>(`/cases/${caseId}/settlement-options/${optionId}/accept`, {});
  },

  // Reject a settlement option
  rejectSettlement: async (caseId: string, optionId: string): Promise<ApiResponse<null>> => {
    return apiRequest.post<null>(`/cases/${caseId}/settlement-options/${optionId}/reject`, {});
  },

  // Request re-analysis with preferences
  requestReanalysis: async (caseId: string, preferences: string[]): Promise<ApiResponse<SettlementOption[]>> => {
    return apiRequest.post<SettlementOption[]>(`/cases/${caseId}/reanalyze`, { preferences });
  },
};

export const settlementService = {
  // Get final decision for a case
  getFinalDecision: async (caseId: string): Promise<ApiResponse<FinalDecision>> => {
    return apiRequest.get<FinalDecision>(`/cases/${caseId}/final-decision`);
  },

  // Sign settlement agreement
  signSettlement: async (caseId: string, signatureData: string): Promise<ApiResponse<null>> => {
    return apiRequest.post<null>(`/cases/${caseId}/sign`, { signatureData });
  },

  // Generate settlement document
  generateDocument: async (caseId: string): Promise<ApiResponse<CaseDocument>> => {
    return apiRequest.post<CaseDocument>(`/cases/${caseId}/generate-document`, {});
  },

  // Download document
  downloadDocument: async (documentId: string): Promise<Blob> => {
    const response = await fetch(`/api/documents/${documentId}/download`);
    return response.blob();
  },
};

export const dashboardService = {
  // Get dashboard statistics
  getStats: async (): Promise<ApiResponse<DashboardStats>> => {
    return apiRequest.get<DashboardStats>('/dashboard/stats');
  },

  // Get recent activity
  getRecentActivity: async (limit = 10): Promise<ApiResponse<CaseActivity[]>> => {
    return apiRequest.get<CaseActivity[]>(`/dashboard/activity?limit=${limit}`);
  },
};