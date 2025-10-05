// frontend/pages/case/[id]/analysis.tsx
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

type Analysis = {
  id?: string;
  summary?: string;
  options?: any[];
  legal_basis?: string[];
  final_recommendation?: string;
};

export default function CaseAnalysisPage() {
  const router = useRouter();
  const { id: caseId } = router.query;
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string>('');
  const [tally, setTally] = useState<any>({});
  const [message, setMessage] = useState<string | null>(null);

  // restore token from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dev_auth_token');
      if (stored) setAuthToken(stored);
    } catch (e) { /* ignore */ }
  }, []);

  // persist token as it changes
  useEffect(() => {
    try {
      if (authToken) localStorage.setItem('dev_auth_token', authToken);
      else localStorage.removeItem('dev_auth_token');
    } catch (e) { /* ignore */ }
  }, [authToken]);

  useEffect(() => {
    if (!caseId) return;
    (async () => {
      setMessage('Running analysis — contacting backend...');
      setAnalysis(null);
      setAnalysisId(null);
      try {
        const r = await fetch(`${API_BASE}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_id: caseId, template: 'evidence_first' })
        });

        const text = await r.text();

        // try parsing JSON; if it fails, show the raw text for debugging
        let j: any = null;
        try {
          j = JSON.parse(text);
        } catch (parseErr) {
          console.warn('analyze returned non-json:', text);
          setMessage('Analyze: response was not JSON. Check backend logs. See console for raw response.');
          console.error('analyze raw response:', text);
          return;
        }

        if (!r.ok) {
          setMessage('Analyze failed: ' + (j.error || r.status));
          console.error('analyze error', j);
          return;
        }

        if (j.ok && j.analysis) {
          setAnalysis(j.analysis);
          setAnalysisId(j.saved_id || null);
          setMessage(null);
          if (j.saved_id) fetchTally(j.saved_id);
        } else {
          // sometimes analysis may be in j.analysis even if ok false — handle gracefully
          setAnalysis(j.analysis || null);
          setAnalysisId(j.saved_id || null);
          setMessage(j.error || 'Analyze returned no structured analysis.');
          if (j.saved_id) fetchTally(j.saved_id);
        }
      } catch (e: any) {
        console.warn('analyze call failed', e);
        setMessage('analyze call failed: ' + (e.message || String(e)));
      }
    })();
  }, [caseId]);

  async function fetchTally(savedAnalysisId?: string) {
    if (!caseId) return;
    try {
      const authHeader = authToken ? (authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`) : '';
      const url = savedAnalysisId
        ? `${API_BASE}/api/cases/${caseId}/decisions?analysis_id=${savedAnalysisId}`
        : `${API_BASE}/api/cases/${caseId}/decisions`;
      const r = await fetch(url, { headers: authHeader ? { Authorization: authHeader } : undefined });
      if (!r.ok) {
        setMessage(`Failed to fetch tally: ${r.status}`);
        return;
      }
      const j = await r.json();
      // If rpc_tally present, normalize it; otherwise use j.tally
      if (j.rpc_tally) {
        const normalized: Record<string, any> = {};
        (j.rpc_tally || []).forEach((o:any) => {
          normalized[String(o.option_id)] = o;
        });
        setTally(normalized);
      } else if (j.tally) {
        // backend might return "opt::decision" keyed tally — normalize it for UI
        const tObj: Record<string, any> = {};
        Object.entries(j.tally || {}).forEach(([k, v]: any) => {
          if (typeof k === 'string' && k.includes('::')) {
            const [opt, dec] = k.split('::');
            tObj[opt] = tObj[opt] || { accepts: 0, declines: 0, proposes: 0 };
            if (dec === 'accept') tObj[opt].accepts = v;
            if (dec === 'decline') tObj[opt].declines = v;
            if (dec === 'propose') tObj[opt].proposes = v;
          } else {
            tObj[k] = v;
          }
        });
        setTally(tObj);
      } else {
        setTally({});
      }
      setMessage(null);
    } catch (e: any) {
      console.warn(e);
      setMessage('tally fetch error: ' + (e.message || String(e)));
    }
  }

  async function vote(optionId: any, decision: 'accept' | 'decline' | 'propose') {
    if (!analysisId) { setMessage('No analysis_id found'); return; }
    if (!authToken) { setMessage('Paste auth token at top to vote'); return; }
    setLoading(true);
    try {
      const authHeader = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
      const r = await fetch(`${API_BASE}/api/cases/${caseId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ analysis_id: analysisId, option_id: optionId, decision })
      });
      const j = await r.json();
      if (!j.ok) {
        setMessage('Vote failed: ' + (j.error || JSON.stringify(j)));
      } else {
        setMessage('Vote recorded');
        // prefer returned tally, else refetch
        if (j.tally) {
          // if RPC array result
          if (Array.isArray(j.tally)) {
            const norm: Record<string, any> = {};
            j.tally.forEach((o:any)=> { norm[String(o.option_id)] = o; });
            setTally(norm);
          } else {
            setTally(j.tally);
          }
        } else {
          await fetchTally(analysisId);
        }
      }
    } catch (e: any) {
      setMessage('vote error: ' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', fontFamily: 'Inter,system-ui' }}>
      <h1>Case Analysis — {String(caseId || '')}</h1>

      <div style={{ marginBottom: 12 }}>
        <label>Paste Auth Token (Supabase or dev JWT):</label><br/>
        <input
          style={{ width: '100%' }}
          value={authToken}
          onChange={e => setAuthToken(e.target.value)}
          placeholder="Paste token (either 'abc...' or 'Bearer abc...')"
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => { setMessage(null); window.location.reload(); }}>Refresh</button>
        <button onClick={() => fetchTally(analysisId)} style={{ marginLeft: 8 }}>Refresh tally</button>
        <span style={{ marginLeft: 12 }}>{message}</span>
      </div>

      {!analysis && <div>Loading analysis (runs Gemini) — if long, check backend logs.</div>}

      {analysis && (
        <>
          <section style={{ marginBottom: 20 }}>
            <h2>Summary</h2>
            <div>{analysis.summary}</div>
          </section>

          <section style={{ marginBottom: 20 }}>
            <h2>Options</h2>
            {analysis.options?.map((opt:any) => {
              const optId = String(opt.id);
              const t = tally[optId] || { accepts: 0, declines: 0, proposes: 0 };
              const consensus = (t as any).consensus_unanimous ? '✅ Consensus reached' : '';
              return (
                <div key={optId} style={{ border: '1px solid #eee', padding: 12, marginBottom: 12, borderRadius: 6 }}>
                  <h3>{opt.title || `Option ${optId}`}</h3>
                  <div><strong>Rationale:</strong> {opt.rationale}</div>
                  <div><strong>Confidence:</strong> {opt.confidence ?? 'N/A'}</div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => vote(optId, 'accept')} disabled={loading}>Accept</button>
                    <button onClick={() => vote(optId, 'decline')} disabled={loading} style={{ marginLeft: 8 }}>Decline</button>
                    <button onClick={() => vote(optId, 'propose')} disabled={loading} style={{ marginLeft: 8 }}>Propose change</button>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <strong>Tally:</strong>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(t, null, 2)}</pre>
                    <div>{consensus}</div>
                  </div>
                </div>
              );
            })}
          </section>

          <section>
            <h2>Legal basis</h2>
            <ul>{(analysis.legal_basis || []).map((l:any,i:number)=>(<li key={i}>{l}</li>))}</ul>
          </section>
        </>
      )}
    </div>
  );
}
