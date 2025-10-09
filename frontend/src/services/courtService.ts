import { apiRequest } from '@/lib/api';
import { ApiResponse } from '@/types';

export interface CourtSystem {
  code: string;
  name: string;
  baseURL: string;
  filingTypes: string[];
  maxFileSize: number;
  supportedFormats: string[];
  status?: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
}

export interface FilingData {
  caseId: string;
  courtSystem: string;
  filingType: string;
  urgency: 'low' | 'medium' | 'high';
  documents: {
    documentId: string;
    filename: string;
    type: string;
  }[];
  metadata?: {
    jurisdiction?: string;
    caseNumber?: string;
    partyType?: string;
  };
}

export interface FilingResponse {
  success: boolean;
  filingId: string;
  courtSystem: string;
  status: 'submitted' | 'processing' | 'processed' | 'failed';
  submittedAt: string;
  confirmation: string;
  documents: {
    documentId: string;
    status: string;
    filename: string;
  }[];
}

export interface FilingStatus {
  filingId: string;
  status: 'submitted' | 'processing' | 'processed' | 'failed';
  lastUpdated: string;
  courtConfirmation: string;
  nextSteps?: string[];
  estimatedCompletion?: string;
}

export interface CourtAnalytics {
  totalFilings: number;
  successfulFilings: number;
  failedFilings: number;
  averageProcessingTime: number;
  courtSystemBreakdown: Record<string, number>;
  recentFilings: {
    filingId: string;
    courtSystem: string;
    status: string;
    submittedAt: string;
  }[];
}

export interface ServiceHealth {
  overall: string;
  services: Record<string, {
    status: string;
    name: string;
    lastCheck: string;
    responseTime: number;
  }>;
  activeConnections: number;
  lastChecked: string;
  supportedCourtCount: number;
  healthyCourtCount: number;
}

export const courtService = {
  // Get supported court systems
  getSupportedCourts: async (): Promise<ApiResponse<{ courts: CourtSystem[] }>> => {
    return apiRequest.get<{ courts: CourtSystem[] }>('/enhanced-court/supported-courts');
  },

  // File with court system - connects to your RealCourtAPIService.js
  fileWithCourt: async (data: FilingData): Promise<ApiResponse<FilingResponse>> => {
    return apiRequest.post<FilingResponse>('/enhanced-court/file', data);
  },

  // Check filing status
  getFilingStatus: async (filingId: string): Promise<ApiResponse<FilingStatus>> => {
    return apiRequest.get<FilingStatus>(`/enhanced-court/status/${filingId}`);
  },

  // Update filing status
  updateFilingStatus: async (filingId: string, data: { status: string; notes?: string }): Promise<ApiResponse<FilingStatus>> => {
    return apiRequest.put<FilingStatus>(`/enhanced-court/status/${filingId}`, data);
  },

  // Get court analytics
  getAnalytics: async (filters?: { timeframe?: string; courtSystem?: string }): Promise<ApiResponse<CourtAnalytics>> => {
    const params = new URLSearchParams();
    if (filters?.timeframe) params.append('timeframe', filters.timeframe);
    if (filters?.courtSystem) params.append('courtSystem', filters.courtSystem);
    
    const url = `/enhanced-court/analytics${params.toString() ? `?${params.toString()}` : ''}`;
    return apiRequest.get<CourtAnalytics>(url);
  },

  // Get service health - connects to your RealCourtAPIService.getServiceHealth()
  getServiceHealth: async (): Promise<ApiResponse<ServiceHealth>> => {
    return apiRequest.get<ServiceHealth>('/enhanced-court/health');
  },

  // Get court systems with enhanced data
  getCourtSystems: async (filters?: { jurisdiction?: string; type?: string; state?: string }): Promise<ApiResponse<{ courts: CourtSystem[] }>> => {
    const params = new URLSearchParams();
    if (filters?.jurisdiction) params.append('jurisdiction', filters.jurisdiction);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.state) params.append('state', filters.state);
    
    const url = `/enhanced-court/systems${params.toString() ? `?${params.toString()}` : ''}`;
    return apiRequest.get<{ courts: CourtSystem[] }>(url);
  },

  // Refresh all filing statuses
  refreshAllStatuses: async (): Promise<ApiResponse<{ refreshed: number; updated: number }>> => {
    return apiRequest.post<{ refreshed: number; updated: number }>('/enhanced-court/refresh-statuses', {});
  },

  // Validate filing data before submission
  validateFiling: async (data: FilingData): Promise<ApiResponse<{ valid: boolean; errors?: string[] }>> => {
    return apiRequest.post<{ valid: boolean; errors?: string[] }>('/enhanced-court/validate', data);
  }
};