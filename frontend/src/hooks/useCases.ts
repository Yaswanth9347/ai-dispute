import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  caseService, 
  statementService, 
  evidenceService, 
  aiService, 
  settlementService,
  dashboardService
} from '@/services/caseService';
import { 
  DisputeCase, 
  CaseFilingForm, 
  StatementForm, 
  EvidenceUploadForm 
} from '@/types';

// Case Query Keys
export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters?: any) => [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
  statements: (caseId: string) => [...caseKeys.detail(caseId), 'statements'] as const,
  evidence: (caseId: string) => [...caseKeys.detail(caseId), 'evidence'] as const,
  analysis: (caseId: string) => [...caseKeys.detail(caseId), 'analysis'] as const,
  settlement: (caseId: string) => [...caseKeys.detail(caseId), 'settlement'] as const,
  activity: (caseId: string) => [...caseKeys.detail(caseId), 'activity'] as const,
};

// Dashboard Query Keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  activity: () => [...dashboardKeys.all, 'activity'] as const,
};

// Get all cases
export const useCases = (page = 1, limit = 10) => {
  return useQuery({
    queryKey: caseKeys.list({ page, limit }),
    queryFn: () => caseService.getCases(page, limit),
  });
};

// Get single case
export const useCase = (caseId: string) => {
  return useQuery({
    queryKey: caseKeys.detail(caseId),
    queryFn: () => caseService.getCase(caseId),
    enabled: !!caseId,
    select: (data) => data.data,
  });
};

// File new case
export const useFileCase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CaseFilingForm) => caseService.fileCase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
  });
};

// Update case
export const useUpdateCase = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<DisputeCase>) => caseService.updateCase(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() });
    },
  });
};

// Delete case
export const useDeleteCase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (caseId: string) => caseService.deleteCase(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
  });
};

// Get case activity
export const useCaseActivity = (caseId: string) => {
  return useQuery({
    queryKey: caseKeys.activity(caseId),
    queryFn: () => caseService.getCaseActivity(caseId),
    enabled: !!caseId,
    select: (data) => data.data,
  });
};

// Forward case to court
export const useForwardToeCourt = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (caseId: string) => caseService.forwardToeCourt(caseId),
    onSuccess: (_, caseId) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() });
    },
  });
};

// Statement hooks
export const useStatements = (caseId: string) => {
  return useQuery({
    queryKey: caseKeys.statements(caseId),
    queryFn: () => statementService.getStatements(caseId),
    enabled: !!caseId,
    select: (data) => data.data,
  });
};

export const useSubmitStatement = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: StatementForm) => statementService.submitStatement(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.statements(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.activity(caseId) });
    },
  });
};

export const useUpdateStatement = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ statementId, data }: { statementId: string; data: Partial<StatementForm> }) => 
      statementService.updateStatement(caseId, statementId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.statements(caseId) });
    },
  });
};

export const useDeleteStatement = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (statementId: string) => statementService.deleteStatement(caseId, statementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.statements(caseId) });
    },
  });
};

// Evidence hooks
export const useEvidence = (caseId: string) => {
  return useQuery({
    queryKey: caseKeys.evidence(caseId),
    queryFn: () => evidenceService.getEvidence(caseId),
    enabled: !!caseId,
    select: (data) => data.data,
  });
};

export const useUploadEvidence = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: EvidenceUploadForm) => evidenceService.uploadEvidence(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.evidence(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.activity(caseId) });
    },
  });
};

export const useDeleteEvidence = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (evidenceId: string) => evidenceService.deleteEvidence(caseId, evidenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.evidence(caseId) });
    },
  });
};

// AI Analysis hooks
export const useRequestAnalysis = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => aiService.requestAnalysis(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.analysis(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
    },
  });
};

export const useAIAnalysis = (caseId: string) => {
  return useQuery({
    queryKey: caseKeys.analysis(caseId),
    queryFn: () => aiService.getAnalysis(caseId),
    enabled: !!caseId,
    select: (data) => data.data,
  });
};

export const useSettlementOptions = (caseId: string) => {
  return useQuery({
    queryKey: caseKeys.settlement(caseId),
    queryFn: () => aiService.getSettlementOptions(caseId),
    enabled: !!caseId,
    select: (data) => data.data,
  });
};

export const useAcceptSettlement = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (optionId: string) => aiService.acceptSettlement(caseId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.settlement(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
    },
  });
};

export const useRejectSettlement = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (optionId: string) => aiService.rejectSettlement(caseId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.settlement(caseId) });
    },
  });
};

export const useRequestReanalysis = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (preferences: string[]) => aiService.requestReanalysis(caseId, preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.settlement(caseId) });
      queryClient.invalidateQueries({ queryKey: caseKeys.analysis(caseId) });
    },
  });
};

// Settlement hooks
export const useFinalDecision = (caseId: string) => {
  return useQuery({
    queryKey: [...caseKeys.detail(caseId), 'final-decision'],
    queryFn: () => settlementService.getFinalDecision(caseId),
    enabled: !!caseId,
    select: (data) => data.data,
  });
};

export const useSignSettlement = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (signatureData: string) => settlementService.signSettlement(caseId, signatureData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
  });
};

export const useGenerateDocument = (caseId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => settlementService.generateDocument(caseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
    },
  });
};

// Dashboard hooks
export const useDashboardStats = () => {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => dashboardService.getStats(),
    select: (data) => data.data,
  });
};

export const useRecentActivity = (limit = 10) => {
  return useQuery({
    queryKey: [...dashboardKeys.activity(), limit],
    queryFn: () => dashboardService.getRecentActivity(limit),
    select: (data) => data.data,
  });
};