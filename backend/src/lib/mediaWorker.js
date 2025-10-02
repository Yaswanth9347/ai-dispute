// backend/src/lib/mediaWorker.js
// simple synchronous worker you can call per-evidence id to extract OCR/transcription
const supabase = require('./supabaseClient');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

// For ASR we will call a Python helper (faster-whisper) - see python snippet below

async function processEvidence(evidenceId) {
  // fetch evidence record
  const { data: ev } = await supabase.from('evidence').select('*').eq('id', evidenceId).single();
  if (!ev) throw new Error('evidence not found');

  const bucket = process.env.SUPABASE_BUCKET || 'evidence';
  const filename = ev.file_path;

  // download to /tmp
  const localPath = path.join('/tmp', 'evidence_' + Date.now() + '_' + path.basename(filename));
  const { data, error } = await supabase.storage.from(bucket).download(filename);
  if (error) throw error;

  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(localPath, buffer);

  // if image/pdf: run tesseract OCR (assumes tesseract installed)
  let ocrText = null;
  try {
    const outTxt = localPath + '.ocr.txt';
    // tesseract will create a file without extension param; use stdout via - option
    execSync(`tesseract "${localPath}" stdout > "${outTxt}" 2>/dev/null`);
    ocrText = fs.readFileSync(outTxt, 'utf8');
  } catch (e) {
    console.warn('ocr failed or not applicable', e.message || e);
  }

  // if audio/video: call Python ASR helper (faster-whisper) - see below
  let transcription = null;
  try {
    // call python script with path, returns JSON with {transcript: "..."}
    const pyOut = execSync(`python3 ./src/lib/whisper_helper.py "${localPath}"`, { encoding: 'utf8', stdio: 'pipe' });
    transcription = JSON.parse(pyOut).transcript;
  } catch (e) {
    console.warn('asr may have failed or not applicable', e.message || e);
  }

  // update evidence row
  await supabase.from('evidence').update({ ocr_text: ocrText, transcription }).eq('id', evidenceId);

  // cleanup
  try { fs.unlinkSync(localPath); } catch {}
  return { ocrText, transcription };
}

module.exports = { processEvidence };
