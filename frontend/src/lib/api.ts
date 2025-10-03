const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export async function getEvidenceStatus(evidenceId: string) {
  const res = await fetch(`${API_BASE}/api/evidence/${evidenceId}/status`);
  if (!res.ok) throw new Error("Failed to fetch evidence status");
  return res.json();
}
