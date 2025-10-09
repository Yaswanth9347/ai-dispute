// backend/src/lib/mediaWorker.js
// Simple in-memory queue + worker loop. Not for production (use a real queue then).
const supabase = require('./supabaseClient');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const queue = [];
let running = false;

async function processEvidence(evidenceId) {
  // fetch evidence record
  const { data: ev, error: evErr } = await supabase.from('evidence').select('*').eq('id', evidenceId).single();
  if (evErr || !ev) {
    console.warn('processEvidence: evidence not found', evidenceId, evErr);
    return { ok: false, reason: 'not found' };
  }
  // skip if already processed (has ocr_text or transcription)
  if (ev.ocr_text || ev.transcription) {
    return { ok: true, skipped: true };
  }

  const bucket = process.env.SUPABASE_BUCKET || 'evidence';
  const filename = ev.file_path;

  // download to /tmp
  const localPath = path.join('/tmp', 'evidence_' + Date.now() + '_' + path.basename(filename));
  try {
    const { data, error } = await supabase.storage.from(bucket).download(filename);
    if (error) {
      console.warn('download error', error);
      return { ok: false, reason: 'download error' };
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
  } catch (e) {
    console.error('download->write fail', e);
    return { ok: false, reason: e.message || e };
  }

  let ocrText = null;
  let transcription = null;

  try {
    // Run tesseract for OCR (works for images/pdf)
    // If tesseract is not applicable, it may error — catch and continue.
    const out = execSync(`tesseract "${localPath}" stdout 2>/dev/null`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (out && out.trim()) ocrText = out.trim();
  } catch (e) {
    // ignored if not an image or tesseract failed
  }

  // only run ASR for audio/video mime types
  const mime = (ev.metadata && ev.metadata.mime) ? ev.metadata.mime : '';
  if (mime.startsWith('audio/') || mime.startsWith('video/')) {
    try {
      const pyOut = execSync(`python3 ./src/lib/whisper_helper.py "${localPath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      try {
        const parsed = JSON.parse(pyOut);
        if (parsed && parsed.transcript) transcription = parsed.transcript;
      } catch (pe) {
        // ignore parse fail
      }
    } catch (e) {
      // asr may fail — ignore and continue
      console.warn('[mediaWorker] ASR call failed or not applicable', evidenceId, e && e.message ? e.message : e);
    }
  } else {
    console.log('[mediaWorker] skipping ASR for non-audio file', evidenceId, mime);
  }

  // update evidence row with results (ocr/transcript) and add processed_at in metadata
  try {
    await supabase
      .from('evidence')
      .update({
        ocr_text: ocrText,
        transcription,
        metadata: Object.assign({}, ev.metadata || {}, { processed_at: new Date().toISOString() })
      })
      .eq('id', evidenceId);
  } catch (e) {
    console.warn('update evidence failed', e);
  }

  // MARK THE ROW AS PROCESSED (ensure DB reflects completion)
  try {
    await supabase
      .from('evidence')
      .update({
        processed: true,
        updated_at: new Date().toISOString(),
        metadata: Object.assign({}, ev.metadata || {}, { processed_at: new Date().toISOString() })
      })
      .eq('id', evidenceId);
    console.log('[mediaWorker] marked processed', evidenceId);
  } catch (dbErr) {
    console.error('[mediaWorker] failed to mark processed', evidenceId, dbErr);
  }

  // cleanup local file
  try { fs.unlinkSync(localPath); } catch (e) {}

  // fetch updated row and return it (so manual runs show final DB record)
  try {
    const { data: updatedRow, error: fetchErr } = await supabase
      .from('evidence')
      .select('*')
      .eq('id', evidenceId)
      .single();
    if (fetchErr) {
      return { ok: true, ocrTextPresent: !!ocrText, transcriptionPresent: !!transcription };
    }
    return { ok: true, row: updatedRow };
  } catch (e) {
    return { ok: true, ocrTextPresent: !!ocrText, transcriptionPresent: !!transcription };
  }
}

async function workerLoop() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const id = queue.shift();
    try {
      console.log('[mediaWorker] processing', id);
      // small delay to avoid burst
      await processEvidence(id);
    } catch (e) {
      console.error('[mediaWorker] processing error', e);
    }
    // brief cooldown
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  running = false;
}

function enqueueEvidence(evidenceId) {
  if (!evidenceId) return;
  queue.push(evidenceId);
  // kick worker
  setImmediate(() => workerLoop().catch(err => console.error('workerLoop err', err)));
}

module.exports = {
  enqueueEvidence,
  processEvidence
};
