export interface PlatformStats {
  totalCases: number;
  newCases: number;
  activeNegotiations: number;
  totalNegotiations: number;
  completedNegotiations: number;
  settlementRate: number;
  totalSettlements: number;
  totalUsers: number;
  newUsers: number;
  timeframe: string;
}

export interface NegotiationAnalytics {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  successRate: number;
  averageRounds: number;
  statusDistribution: {
    status: string;
    count: number;
  }[];
  timeline: {
    date: string;
    count: number;
  }[];
}

export interface AIPerformanceMetrics {
  totalAnalyses: number;
  averageConfidence: number;
  averageProcessingTime: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface CourtFilingAnalytics {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  successRate: number;
  expeditedCount: number;
  averageProcessingTime: number;
  byStatus: {
    status: string;
    count: number;
  }[];
}

export interface CaseResolutionMetrics {
  total: number;
  resolved: number;
  resolutionRate: number;
  averageResolutionTime: number;
  totalDisputeValue: number;
  averageDisputeValue: number;
  timeline: {
    date: string;
    resolved: number;
    pending: number;
  }[];
}

export interface DashboardData {
  platform: PlatformStats;
  negotiations: NegotiationAnalytics;
  aiPerformance: AIPerformanceMetrics;
  courtFilings: CourtFilingAnalytics;
  caseResolution: CaseResolutionMetrics;
  timeframe: string;
}
