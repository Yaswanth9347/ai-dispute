import { apiRequest } from '@/lib/api';
import { ApiResponse } from '@/types';

// AI Integration Service Types
export interface AIAnalysisResult {
  id: string;
  case_id: string;
  analysis_type: 'case_analysis' | 'settlement_options' | 'combined_solution';
  model: string;
  analysis: {
    summary: string;
    keyIssues: string[];
    strengths: {
      complainer: string[];
      defender: string[];
    };
    weaknesses: {
      complainer: string[];
      defender: string[];
    };
    riskAssessment: {
      complainerWinProbability: number;
      defenderWinProbability: number;
      likelyOutcome: string;
      potentialDamages: {
        minimum: number;
        maximum: number;
        mostLikely: number;
      };
    };
    recommendations: {
      forComplainer: string;
      forDefender: string;
      forBothParties: string;
    };
    legalPrecedents?: string[];
  };
  confidence_score: number;
  processing_time_ms: number;
  tokens_used: number;
  created_at: string;
}

export interface SettlementOption {
  id: string;
  title: string;
  description: string;
  terms: {
    financialSettlement?: number;
    paymentSchedule?: string;
    nonFinancialTerms?: string[];
    timeline: string;
    conditions?: string[];
  };
  pros: string[];
  cons: string[];
  riskLevel: 'low' | 'medium' | 'high';
  acceptanceProbability: number;
  legalBinding: boolean;
}

export interface SettlementOptionsResult {
  options: SettlementOption[];
  aiInsights: {
    recommendedOption: string;
    reasoning: string;
    alternativeApproaches: string[];
  };
  metadata: {
    generatedAt: string;
    expiresAt: string;
    model: string;
  };
}

export interface OptionSelection {
  options_id: string;
  case_id: string;
  user_id: string;
  party_type: 'complainer' | 'defender';
  selected_option_id: string;
  selection_reasoning?: string;
  selected_at: string;
}

export interface SelectionStatus {
  bothSelected: boolean;
  sameOption: boolean;
  selections: {
    complainer?: OptionSelection;
    defender?: OptionSelection;
  };
}

export interface CombinedSolution {
  combinedSolution: {
    title: string;
    description: string;
    mergedTerms: {
      financialAspects: any;
      timeline: string;
      conditions: string[];
    };
    compromises: {
      complainerConcessions: string[];
      defenderConcessions: string[];
    };
    benefits: string[];
    implementation: {
      steps: string[];
      timeline: string;
      responsibleParties: string[];
    };
  };
  acceptanceProbability: number;
  reasoning: string;
  alternativeOptions: string[];
}

export interface AIStatus {
  analysis: AIAnalysisResult | null;
  settlementOptions: SettlementOptionsResult | null;
  activeOptions: any;
  selections: {
    complainer?: OptionSelection;
    defender?: OptionSelection;
  } | null;
  selectionStatus: SelectionStatus | null;
  caseStatus: string;
}

export const aiIntegrationService = {
  // Analyze a case for dispute resolution
  analyzeCase: async (caseId: string): Promise<ApiResponse<{
    analysis: AIAnalysisResult['analysis'];
    analysisId: string;
    processingTime: number;
    cached: boolean;
  }>> => {
    return apiRequest.post(`/ai-integration/analyze-case/${caseId}`, {});
  },

  // Generate settlement options
  generateSettlementOptions: async (caseId: string): Promise<ApiResponse<{
    options: SettlementOptionsResult;
    optionsId: string;
    processingTime: number;
  }>> => {
    return apiRequest.post(`/ai-integration/settlement-options/${caseId}`, {});
  },

  // Select a settlement option
  selectOption: async (
    caseId: string,
    optionId: string,
    reasoning?: string
  ): Promise<ApiResponse<{
    selection: OptionSelection;
    bothSelected: boolean;
    sameOption: boolean;
  }>> => {
    return apiRequest.post(`/ai-integration/select-option/${caseId}/${optionId}`, {
      reasoning
    });
  },

  // Get AI status for a case
  getAIStatus: async (caseId: string): Promise<ApiResponse<AIStatus>> => {
    return apiRequest.get(`/ai-integration/status/${caseId}`);
  },

  // Format currency for display
  formatCurrency: (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  },

  // Format percentage for display
  formatPercentage: (value: number): string => {
    return `${Math.round(value * 100)}%`;
  },

  // Get risk level color
  getRiskLevelColor: (level: 'low' | 'medium' | 'high'): string => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  },

  // Get confidence level description
  getConfidenceDescription: (score: number): string => {
    if (score >= 0.8) return 'High Confidence';
    if (score >= 0.6) return 'Medium Confidence';
    if (score >= 0.4) return 'Low Confidence';
    return 'Very Low Confidence';
  },

  // Calculate processing time display
  formatProcessingTime: (timeMs: number): string => {
    if (timeMs < 1000) return `${timeMs}ms`;
    const seconds = Math.round(timeMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }
};