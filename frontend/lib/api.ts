export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

export function casesUploadUrl(caseId: string) {
  return `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/evidence`;
}

export function evidenceStatusUrl(evidenceId: string) {
  return `${API_BASE}/api/evidence/${encodeURIComponent(evidenceId)}/status`;
}

export function processCaseUrl(caseId: string) {
  return `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/process`;
}

export function analyzeUrl() {
  return `${API_BASE}/api/analyze`;
}
