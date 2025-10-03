import { useRouter } from 'next/router';
import React, { useEffect, useState, useRef } from 'react';
import { casesUploadUrl, evidenceStatusUrl, processCaseUrl } from '../../lib/api';

type EvidenceLocal = {
  id: string;
  fileName: string;
  publicUrl?: string;
  sha256?: string;
  status?: any;
};

export default function CasePage() {
  const router = useRouter();
  const { id: caseId } = router.query;
  const [file, setFile] = useState<File | null>(null);
  const [uploaderId, setUploaderId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [evidences, setEvidences] = useState<EvidenceLocal[]>([]);
  const pollersRef = useRef<Record<string, boolean>>({});
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});

  // cleanup on unmount - stop pollers
  useEffect(() => {
    return () => {
      Object.keys(pollersRef.current).forEach(k => (pollersRef.current[k] = false));
    };
  }, []);

  // when caseId appears, fetch existing evidence from server
  useEffect(() => {
    if (!caseId) return;

    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
        const r = await fetch(`${base}/api/cases/${caseId}/evidence`);
        if (!r.ok) throw new Error('fetch list failed ' + r.status);
        const j = await r.json();
        if (j && j.items) {
          const list = j.items.map((it: any) => ({
            id: it.id,
            fileName: it.metadata?.original_name || it.file_path,
            publicUrl: it.publicUrl,
            sha256: it.sha256,
            status: {
              processed: !!it.metadata?.processed_at,
              processed_at: it.metadata?.processed_at,
              has_ocr: !!it.has_ocr,
              has_transcription: !!it.has_transcription
            }
          }));

          setEvidences(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const merged = [...list.filter((l: any) => !existingIds.has(l.id)), ...prev];
            return merged;
          });

          // start polling unprocessed
          (j.items || []).forEach((it: any) => {
            if (!it.metadata || !it.metadata.processed_at) {
              pollEvidence(it.id);
            }
          });
        }
      } catch (e) {
        console.warn('load existing evidence failed', e);
      }
    })();
  }, [caseId]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !caseId || !uploaderId) {
      alert('provide case id, uploader id and file');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('uploader_id', uploaderId);

      const resp = await fetch(casesUploadUrl(String(caseId)), {
        method: 'POST',
        body: form,
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'upload failed');
      }
      const data = await resp.json();
      const ev: EvidenceLocal = {
        id: data.id,
        fileName: data.metadata?.original_name || data.file_path,
        publicUrl: data.publicUrl,
        sha256: data.sha256,
        status: null
      };
      setEvidences(prev => [ev, ...prev]);

      // start polling this evidence
      pollEvidence(ev.id);
    } catch (err: any) {
      console.error('upload err', err);
      alert('upload error: ' + (err.message || err));
    } finally {
      setUploading(false);
      setFile(null);
      const el = document.getElementById('fileinput') as HTMLInputElement | null;
      if (el) el.value = '';
    }
  }

  async function pollEvidence(evidenceId: string, timeoutMs = 120000, intervalMs = 2000) {
    pollersRef.current[evidenceId] = true;
    const start = Date.now();
    while (pollersRef.current[evidenceId] && Date.now() - start < timeoutMs) {
      try {
        const r = await fetch(evidenceStatusUrl(evidenceId));
        if (!r.ok) {
          console.warn('status fetch failed', r.status);
        } else {
          const json = await r.json();
          const s = json.status;
          setEvidences(prev => prev.map(ev => ev.id === evidenceId ? { ...ev, status: s } : ev));
          if (s.processed) {
            pollersRef.current[evidenceId] = false;
            return s;
          }
        }
      } catch (e) {
        console.warn('poll error', e);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    pollersRef.current[evidenceId] = false;
    return null;
  }

  async function triggerProcessAll() {
    if (!caseId) return;
    try {
      const r = await fetch(processCaseUrl(String(caseId)), { method: 'POST' });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || 'process trigger failed');
      }
      const j = await r.json();
      (j.ids || []).forEach((eid: string) => {
        if (!evidences.find(x => x.id === eid)) {
          setEvidences(prev => [{ id: eid, fileName: eid, status: null }, ...prev]);
        }
        pollEvidence(eid);
      });
      alert(`Enqueued ${j.enqueued} items for processing`);
    } catch (err: any) {
      console.error(err);
      alert('trigger process error: ' + (err.message || err));
    }
  }

  // ------------------------
  // NEW: download via signed token (where and how)
  // ------------------------
  async function onDownloadClick(evidenceId: string, openInNewTab = true) {
    if (downloadingIds[evidenceId]) return;
    setDownloadingIds(prev => ({ ...prev, [evidenceId]: true }));
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
      const resp = await fetch(`${base}/api/evidence/${evidenceId}/signed`, { method: 'POST' });
      if (!resp.ok) {
        const t = await resp.text().catch(()=>null);
        console.error('token request failed', resp.status, t);
        alert('token request failed');
        return;
      }
      const j = await resp.json();
      if (!j?.token) { alert('token not returned'); return; }
      const url = `${base}/api/evidence/${evidenceId}/download?token=${encodeURIComponent(j.token)}`;

      if (openInNewTab) {
        const w = window.open('', '_blank');
        if (!w) {
          window.location.href = url;
        } else {
          w.location.href = url;
        }
      } else {
        window.location.href = url;
      }
    } catch (e) {
      console.error('download failed', e);
      alert('download failed');
    } finally {
      setDownloadingIds(prev => { const c = { ...prev }; delete c[evidenceId]; return c; });
    }
  }

  // ------------------------
  // end of download helper
  // ------------------------

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Case: {String(caseId || '')}</h1>

      <form onSubmit={onUpload} style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 8 }}>
          <label>Uploader ID (test user UUID):</label><br/>
          <input value={uploaderId} onChange={e => setUploaderId(e.target.value)} style={{ width: '100%' }} placeholder="paste user uuid" />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label>Choose file:</label><br/>
          <input id="fileinput" type="file" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} />
        </div>

        <div>
          <button type="submit" disabled={uploading || !file || !uploaderId}>
            {uploading ? 'Uploading...' : 'Upload & Enqueue'}
          </button>
          <button type="button" onClick={triggerProcessAll} style={{ marginLeft: 12 }}>
            Enqueue all unprocessed
          </button>
        </div>
      </form>

      <section>
        <h2>Uploaded evidence (recent first)</h2>
        {evidences.length === 0 && <div>No evidence uploaded in this session. Upload one to start.</div>}
        <ul>
          {evidences.map(ev => (
            <li key={ev.id} style={{ marginBottom: 12, padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
              <div><strong>{ev.fileName}</strong> — <small>{ev.id}</small></div>
              <div>
                {/* Replaced publicUrl anchor with signed-token download button */}
                <button
                  onClick={() => onDownloadClick(ev.id)}
                  disabled={!!downloadingIds[ev.id]}
                  style={{ cursor: 'pointer' }}
                >
                  {downloadingIds[ev.id] ? 'Preparing...' : 'Download file'}
                </button>
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Status:</strong>
                {ev.status ? (
                  <span> {ev.status.processed ? 'processed' : 'processing'} {ev.status.processed_at ? `@ ${new Date(ev.status.processed_at).toLocaleString()}` : ''}</span>
                ) : <span> pending / not started</span>}
              </div>

              {ev.status && ev.status.has_ocr && (
                <details style={{ marginTop: 6 }}>
                  <summary>OCR excerpt</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>{ev.status.ocr_excerpt}</pre>
                </details>
              )}

              {ev.status && ev.status.has_transcription && (
                <details style={{ marginTop: 6 }}>
                  <summary>Transcription excerpt</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>{ev.status.transcription_excerpt}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
