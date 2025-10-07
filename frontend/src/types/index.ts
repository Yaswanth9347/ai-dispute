// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  role: 'plaintiff' | 'defendant' | 'admin' | 'lawyer';
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Case Types
export interface DisputeCase {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  category: CaseCategory;
  status: CaseStatus;
  plaintiff: User;
  defendants: User[];
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  statements: Statement[];
  evidence: Evidence[];
  aiAnalysis?: AIAnalysis;
  settlementOptions?: SettlementOption[];
  finalDecision?: FinalDecision;
  documents: CaseDocument[];
}

export type CaseStatus = 
  | 'filed'
  | 'invitations_sent'
  | 'awaiting_defendant_response'
  | 'statements_complete'
  | 'ai_analyzing'
  | 'settlement_options_available'
  | 'parties_deciding'
  | 'settlement_agreed'
  | 'document_generation'
  | 'awaiting_signatures'
  | 'closed'
  | 'compromise_needed'
  | 'forwarded_to_court';

export type CaseCategory = 
  | 'property_dispute'
  | 'contract_breach'
  | 'family_dispute'
  | 'consumer_complaint'
  | 'employment_issue'
  | 'neighbor_dispute'
  | 'financial_dispute'
  | 'other';

// Statement Types
export interface Statement {
  id: string;
  caseId: string;
  userId: string;
  user: User;
  content: string;
  type: 'initial' | 'response' | 'rebuttal' | 'final';
  submittedAt: string;
  isEditable: boolean;
}

// Evidence Types
export interface Evidence {
  id: string;
  caseId: string;
  userId: string;
  user: User;
  fileName: string;
  fileType: 'image' | 'video' | 'audio' | 'document';
  fileUrl: string;
  description: string;
  uploadedAt: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

// AI Analysis Types
export interface AIAnalysis {
  id: string;
  caseId: string;
  analysis: string;
  confidence: number;
  legalPrecedents: LegalPrecedent[];
  recommendations: string[];
  evidenceAnalysis: EvidenceAnalysis[];
  indianLawReferences: IndianLawReference[];
  strengthAssessment: StrengthAssessment;
  createdAt: string;
}

export interface LegalPrecedent {
  caseTitle: string;
  court: string;
  year: number;
  relevance: number;
  summary: string;
  citation: string;
}

export interface EvidenceAnalysis {
  evidenceId: string;
  type: 'document' | 'image' | 'audio' | 'video';
  relevanceScore: number;
  keyFindings: string[];
  authenticityScore: number;
}

export interface IndianLawReference {
  act: string;
  section: string;
  description: string;
  applicability: string;
}

export interface StrengthAssessment {
  plaintiffStrength: number;
  defendantStrength: number;
  keyFactors: string[];
  winProbability: number;
}

export interface LegalReference {
  act: string;
  section: string;
  description: string;
  relevance: string;
}

// Settlement Types
export interface SettlementOption {
  id: string;
  rank: 1 | 2 | 3;
  title: string;
  description: string;
  terms: string[];
  monetaryAmount?: string;
  timeframe: string;
  legalBasis: string;
  recommendedFor: 'plaintiff' | 'defendant' | 'both';
  probability: number;
  pros: string[];
  cons: string[];
  precedentSupport: string[];
  plaintiffChoice?: 'accepted' | 'rejected' | 'pending';
  defendantChoice?: 'accepted' | 'rejected' | 'pending';
}

export interface SettlementTerm {
  party: 'plaintiff' | 'defendant' | 'both';
  action: string;
  timeline?: string;
  amount?: number;
  description: string;
}

// Final Decision Types
export interface FinalDecision {
  id: string;
  caseId: string;
  selectedOptionId: string;
  decisionText: string;
  terms: SettlementTerm[];
  documentUrl?: string;
  signatures: Signature[];
  decidedAt: string;
  status: 'pending_signatures' | 'signed' | 'completed';
}

export interface Signature {
  userId: string;
  user: User;
  signatureData: string; // Base64 signature image
  signedAt: string;
  ipAddress: string;
}

// Document Types
export interface CaseDocument {
  id: string;
  caseId: string;
  type: 'case_file' | 'settlement_agreement' | 'court_forward' | 'evidence';
  title: string;
  fileUrl: string;
  generatedAt: string;
  downloadCount: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Form Types
export interface CaseFilingForm {
  title: string;
  description: string;
  category: CaseCategory;
  defendants: {
    email: string;
    name: string;
    phone?: string;
  }[];
  initialStatement: string;
}

export interface StatementForm {
  content: string;
  type: Statement['type'];
}

export interface EvidenceUploadForm {
  description: string;
  files: File[];
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'case_update' | 'statement_required' | 'settlement_proposed' | 'signature_required';
  title: string;
  message: string;
  caseId?: string;
  read: boolean;
  createdAt: string;
}

// Dashboard Types
export interface DashboardStats {
  totalCases: number;
  activeCases: number;
  closedCases: number;
  pendingActions: number;
}

export interface CaseActivity {
  id: string;
  caseId: string;
  type: 'case_filed' | 'statement_submitted' | 'evidence_uploaded' | 'ai_analysis' | 'settlement_proposed' | 'case_closed';
  description: string;
  userId: string;
  user: User;
  timestamp: string;
}