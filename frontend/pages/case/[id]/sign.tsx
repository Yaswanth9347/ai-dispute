// frontend/pages/case/[id]/sign.tsx
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import { signSettlementUrl, settlementDownloadUrl } from '../../lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

export default function CaseSignPage() {
  const router = useRouter();
  const { id: caseId } = router.query as { id?: string };
  const [authToken, setAuthToken] = useState('');
  const [settlementId, setSettlementId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [signatureText, setSignatureText] = useState('');
  const [signatureType, setSignatureType] = useState<'image'|'text'>('image');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;
    // If you want to auto-fill settlementId from latest settlement in DB, implement endpoint.
    // For now user can paste settlement id manually.
  }, [caseId]);

  async function submitSignature(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setDownloadUrl(null);

    if (!authToken) { setError('Paste auth token first'); return; }
    if (!settlementId) { setError('Enter settlement id'); return; }
    if (signatureType === 'image' && !file) { setError('Select an image file'); return; }
    if (signatureType === 'text' && !signatureText.trim()) { setError('Enter signature text'); return; }

    setBusy(true);
    try {
      const url = `${API_BASE}/api/cases/${encodeURIComponent(caseId || '')}/settlement/${encodeURIComponent(settlementId)}/sign`;
      const form = new FormData();
      form.append('signature_type', signatureType);
      if (signatureType === 'image' && file) {
        form.append('signature_image', file, file.name);
      } else {
        form.append('signature_text', signatureText);
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: form
      });

      const j = await resp.json();
      if (!resp.ok) {
        setError(JSON.stringify(j));
      } else {
        setResult(j);
        // set download url (signed PDF endpoint requires auth)
        setDownloadUrl(`${API_BASE}${j.signed_pdf?.download_endpoint}?_dummy=1`);
      }
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function downloadSigned() {
    if (!downloadUrl) return;
    // open in new tab with auth — browser won't send auth header; we'll open endpoint which requires auth.
    // For convenience the easiest test is to curl with the token — but we also implement a fetch that includes the header and downloads blob.
    try {
      setBusy(true);
      const resp = await fetch(`${API_BASE}${`/api/cases/${encodeURIComponent(caseId || '')}/settlement/${encodeURIComponent(settlementId)}/download`}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!resp.ok) {
        const txt = await resp.text();
        setError(`Download failed: ${txt}`);
        return;
      }
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `settlement_${settlementId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'Inter, system-ui' }}>
      <h1>Sign Settlement — Case {String(caseId || '')}</h1>

      <div style={{ marginBottom: 12 }}>
        <label>Auth Token (Supabase or dev JWT)</label><br/>
        <input value={authToken} onChange={e => setAuthToken(e.target.value)} style={{ width: '100%' }} placeholder="Paste token here" />
      </div>

      <form onSubmit={submitSignature} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
        <div style={{ marginBottom: 10 }}>
          <label>Settlement ID</label><br/>
          <input value={settlementId} onChange={e => setSettlementId(e.target.value)} style={{ width: '100%' }} placeholder="paste settlement id (from generate_settlement result)" />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Signature type</label><br/>
          <select value={signatureType} onChange={e => setSignatureType(e.target.value as any)}>
            <option value="image">Image</option>
            <option value="text">Text</option>
          </select>
        </div>

        {signatureType === 'image' ? (
          <div style={{ marginBottom: 10 }}>
            <label>Upload signature image (png/jpg)</label><br/>
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} />
          </div>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <label>Type signature text</label><br/>
            <input value={signatureText} onChange={e => setSignatureText(e.target.value)} style={{ width: '100%' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={busy}>{busy ? 'Signing...' : 'Submit signature'}</button>
          <button type="button" onClick={downloadSigned} disabled={!result || busy}>Download signed PDF</button>
          <button type="button" onClick={() => { setResult(null); setError(null); }}>Clear</button>
        </div>
      </form>

      <div style={{ marginTop: 16 }}>
        {error && <div style={{ color: 'crimson' }}><strong>Error: </strong>{error}</div>}
        {result && (
          <div style={{ border: '1px solid #ddd', padding: 10, marginTop: 8 }}>
            <div><strong>Signature saved:</strong></div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result.saved_signature || result, null, 2)}</pre>
            <div style={{ marginTop: 8 }}>
              <em>All signed:</em> {String(result.all_signed)}
            </div>
            <div style={{ marginTop: 8 }}>
              <em>Signed PDF endpoint:</em> <code>{result.signed_pdf?.download_endpoint}</code>
            </div>
            <div style={{ marginTop: 8 }}>
              Click **Download signed PDF** to fetch and save the signed PDF (it will request the download endpoint with auth).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
