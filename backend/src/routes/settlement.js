const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { requireAuth } = require('../lib/authMiddleware');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');

const BUCKET = process.env.SUPABASE_BUCKET || 'evidence';
const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// util: get latest ai_analysis row
async function getLatestAnalysis(caseId) {
  const { data, error } = await supabase
    .from('ai_analysis')
    .select('id, case_id, model, analysis, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

// util: count parties
async function getCasePartiesCount(caseId) {
  const { data: parties } = await supabase.from('case_parties').select('user_id').eq('case_id', caseId);
  return Array.isArray(parties) ? parties.length : 0;
}

// util: count accepts
async function countAccepts(caseId, analysisId, optionId) {
  const { data } = await supabase
    .from('case_decisions')
    .select('id', { count: 'exact' })
    .eq('case_id', caseId)
    .eq('analysis_id', analysisId)
    .eq('option_id', String(optionId))
    .eq('decision', 'accept');
  if (data && data.length !== undefined) return data.length;
  return 0;
}

// ------------------------------
// POST /sign endpoint
router.post('/:case_id/settlement/:settlement_id/sign', requireAuth, upload.single('signature_image'), async (req, res) => {
  const caseId = req.params.case_id;
  const settlementId = req.params.settlement_id;
  const userId = req.user?.sub;
  const signature_type = req.body.signature_type;

  if (!['image', 'text'].includes(signature_type)) {
    return res.status(400).json({ error: 'signature_type must be image or text' });
  }

  try {
    // ensure settlement exists
    const settlementResp = await supabase
      .from('case_settlements')
      .select('*')
      .eq('id', settlementId)
      .eq('case_id', caseId)
      .limit(1)
      .single();

    if (settlementResp.error || !settlementResp.data) return res.status(404).json({ error: 'settlement not found' });
    const settlement = settlementResp.data;

    // get signature data
    let signature_data;
    if (signature_type === 'image') {
      if (!req.file) return res.status(400).json({ error: 'signature_image file required' });
      const mime = req.file.mimetype || 'image/png';
      signature_data = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    } else {
      const text = (req.body.signature_text || '').trim();
      if (!text) return res.status(400).json({ error: 'signature_text required' });
      signature_data = text;
    }

    // save signature
    const { data: savedSig, error: saveErr } = await supabase
      .from('case_settlement_signatures')
      .insert([{
        settlement_id: settlementId,
        case_id: caseId,
        user_id: userId || null,
        signature_type,
        signature_data
      }])
      .select()
      .single();
    if (saveErr) return res.status(500).json({ error: 'failed to save signature' });

    // gather all signatures
    const { data: allSigs } = await supabase
      .from('case_settlement_signatures')
      .select('*')
      .eq('settlement_id', settlementId)
      .order('uploaded_at', { ascending: true });

    // attempt PDF append or stub creation
    let outPath = settlement.file_path || null;
    try {
      const origPath = settlement.file_path ? path.join(STORAGE_DIR, settlement.file_path) : null;
      if (!origPath || !(await fs.pathExists(origPath))) throw new Error('original-not-found');

      const origBytes = await fs.readFile(origPath);
      const pdfDoc = await PDFDocument.load(origBytes);

      let sigPage = pdfDoc.addPage([612, 792]);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      let y = 750;
      const marginLeft = 50;
      sigPage.drawText('Signatures', { x: marginLeft, y, size: 18, font: helvetica, color: rgb(0, 0, 0) });
      y -= 30;

      for (const s of allSigs || []) {
        if (s.signature_type === 'text') {
          sigPage.drawText(`User: ${s.user_id || 'unknown'} — ${s.signature_data}`, { x: marginLeft, y, size: 11, font: helvetica });
          y -= 18;
        } else if (s.signature_type === 'image') {
          try {
            const imgBytes = Buffer.from((s.signature_data || '').split(',')[1] || '', 'base64');
            let img; try { img = await pdfDoc.embedPng(imgBytes); } catch { img = await pdfDoc.embedJpg(imgBytes); }
            const dims = img.scale(0.5);
            if (y - dims.height < 40) { sigPage = pdfDoc.addPage([612, 792]); y = 750; }
            sigPage.drawImage(img, { x: marginLeft, y: y - dims.height, width: dims.width, height: dims.height });
            y -= dims.height + 12;
          } catch { sigPage.drawText(`User: ${s.user_id || 'unknown'} — [image failed]`, { x: marginLeft, y, size: 11, font: helvetica }); y -= 18; }
        }
        if (y < 80) { sigPage = pdfDoc.addPage([612, 792]); y = 750; }
      }

      const signedName = `cases/${caseId}/settlement_${settlementId}_signed_${Date.now()}.pdf`;
      const signedPath = path.join(STORAGE_DIR, signedName);
      await fs.ensureDir(path.dirname(signedPath));
      await fs.writeFile(signedPath, await pdfDoc.save());

      await supabase.from('case_settlements').update({ file_path: signedName, updated_at: new Date().toISOString() }).eq('id', settlementId);
      outPath = signedName;
    } catch {
      // fallback stub PDF
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([612, 792]);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      let y = 750;
      page.drawText('Settlement (generated) - Signatures', { x: 50, y, size: 16, font: helvetica });
      y -= 30;
      for (const s of allSigs || []) {
        const text = s.signature_type === 'text' ? s.signature_data : `[image signature for user ${s.user_id || 'unknown'}]`;
        page.drawText(`User ${s.user_id || 'unknown'}: ${text}`, { x: 50, y, size: 11, font: helvetica });
        y -= 18;
        if (y < 80) { page = pdfDoc.addPage([612, 792]); y = 750; }
      }
      const signedName = `cases/${caseId}/settlement_${settlementId}_signed_${Date.now()}.pdf`;
      const signedPath = path.join(STORAGE_DIR, signedName);
      await fs.ensureDir(path.dirname(signedPath));
      await fs.writeFile(signedPath, await pdfDoc.save());
      await supabase.from('case_settlements').update({ file_path: signedName, updated_at: new Date().toISOString() }).eq('id', settlementId);
      outPath = signedName;
    }

    // OPTIONAL: notify parties about signature
    try {
      const { data: parties } = await supabase.from('case_parties').select('user_id, contact_email').eq('case_id', caseId);
      const emails = (parties || []).map(p => p.contact_email).filter(Boolean);
      if (emails.length) {
        const { sendMail } = require('../lib/mailer');
        const subject = `Signature uploaded for settlement ${settlementId}`;
        const text = `User ${userId} uploaded a signature.\nDownload: /api/cases/${caseId}/settlement/${settlementId}/download`;
        await sendMail({ to: emails[0], bcc: emails.slice(1), subject, text });
      }
    } catch (mailErr) { console.warn('notify sign mail err', mailErr); }

    return res.json({
      ok: true,
      saved_signature: savedSig,
      all_signed: Array.isArray(allSigs) && allSigs.length > 0,
      signed_pdf: { file_path: outPath, download_endpoint: `/api/cases/${caseId}/settlement/${settlementId}/download` }
    });

  } catch (e) { console.error('sign err', e); return res.status(500).json({ error: e.message || e }); }
});

// ------------------------------
// POST /generate_settlement
router.post('/:id/generate_settlement', requireAuth, async (req, res) => {
  const caseId = req.params.id;
  const userId = req.user?.sub;
  const { analysis_id, option_id } = req.body;
  if (!analysis_id || !option_id) return res.status(400).json({ error: 'missing analysis_id or option_id' });

  try {
    const analysisRow = await getLatestAnalysis(caseId);
    if (!analysisRow || String(analysisRow.id) !== String(analysis_id)) {
      const { data: a2 } = await supabase.from('ai_analysis').select('id, analysis').eq('id', analysis_id).single();
      if (!a2) return res.status(404).json({ error: 'analysis not found' });
    }

    const { data: analysisData } = await supabase.from('ai_analysis').select('id, analysis').eq('id', analysis_id).single();
    const parsed = analysisData.analysis || {};
    const option = (parsed.options || []).find(o => String(o.id) === String(option_id) || String(o.id) === option_id);
    if (!option) return res.status(400).json({ error: 'option not found in analysis' });

    const partyCount = await getCasePartiesCount(caseId);
    if (partyCount <= 0) return res.status(400).json({ error: 'no parties found for case' });

    const accepts = await countAccepts(caseId, analysis_id, option_id);
    if (accepts < partyCount) return res.status(400).json({ error: 'consensus not reached', partyCount, accepts });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const title = `Settlement Agreement — Case ${caseId}`;
    page.drawText(title, { x: 40, y: 780, size: 16, font });
    page.drawText(`Generated at: ${new Date().toISOString()}`, { x: 40, y: 760, size: 10, font });
    page.drawText('Summary:', { x: 40, y: 730, size: 12, font });
    page.drawText(parsed.summary || 'No summary.', { x: 40, y: 710, size: 10, font, maxWidth: 515 });
    page.drawText('Chosen Option:', { x: 40, y: 660, size: 12, font });
    page.drawText(option.title || `Option ${option.id}`, { x: 40, y: 642, size: 11, font });
    page.drawText('Rationale:', { x: 40, y: 620, size: 11, font });
    page.drawText(option.rationale || '', { x: 40, y: 600, size: 10, font, maxWidth: 515 });
    page.drawText('Recommended Terms:', { x: 40, y: 560, size: 11, font });
    page.drawText(String(option.recommended_terms || option.recommendedTerms || '').slice(0, 1200), { x: 40, y: 540, size: 10, font, maxWidth: 515 });

    page.drawText('Signatures:', { x: 40, y: 480, size: 12, font });
    const { data: parties } = await supabase.from('case_parties').select('user_id, role').eq('case_id', caseId);
    let y = 460;
    for (const p of (parties || [])) {
      page.drawText(`Party (${p.role}): ${p.user_id}`, { x: 40, y, size: 10, font });
      page.drawText('Signature: ______________________', { x: 300, y, size: 10, font });
      y -= 24;
    }
    page.drawText('This settlement is generated by the AI Dispute Resolver and should be signed by both parties.', { x: 40, y: 80, size: 8, font });

    const pdfBytes = await pdfDoc.save();
    const fileName = `cases/${caseId}/settlement_${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(fileName, Buffer.from(pdfBytes), { contentType: 'application/pdf' });
    if (uploadErr) return res.status(500).json({ error: 'file upload failed' });

    const { data: saved } = await supabase.from('case_settlements').insert([{
      case_id: caseId,
      analysis_id,
      option_id: String(option_id),
      file_path: fileName,
      created_by: userId
    }]).select().single();

    // send notifications
    try {
      const { data: parties } = await supabase.from('case_parties').select('user_id, contact_email').eq('case_id', caseId);
      const emails = (parties || []).map(p => p.contact_email).filter(Boolean);
      if (emails.length) {
        const { sendMail } = require('../lib/mailer');
        const downloadEndpoint = `/api/cases/${caseId}/settlement/${saved?.id}/download`;
        const subject = `Settlement generated for case ${caseId}`;
        const text = `A settlement document has been generated.\nOption: ${option.title || option.id}\nDownload: ${downloadEndpoint}\nPlease sign the document.`;
        await sendMail({ to: emails[0], bcc: emails.slice(1), subject, text });
      }
    } catch (mailErr) { console.warn('notify generate settlement mail err', mailErr); }

    res.json({ ok: true, settlement: { id: saved?.id, case_id: caseId, file_path: fileName, download_endpoint: `/api/cases/${caseId}/settlement/${saved?.id}/download` } });

  } catch (e) { console.error('generate settlement err', e); return res.status(500).json({ error: e.message || e }); }
});

// ------------------------------
// GET /download
router.get('/:id/settlement/:sid/download', requireAuth, async (req, res) => {
  const caseId = req.params.id;
  const settlementId = req.params.sid;
  try {
    const { data: s, error } = await supabase.from('case_settlements').select('id, case_id, file_path').eq('id', settlementId).single();
    if (error || !s) return res.status(404).json({ error: 'settlement not found' });
    if (String(s.case_id) !== String(caseId)) return res.status(400).json({ error: 'case id mismatch' });

    const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(s.file_path);
    if (dlErr || !fileData) return res.status(500).json({ error: 'file download failed' });

    const buffer = Buffer.from(await fileData.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="settlement_${settlementId}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (e) { console.error('settlement download err', e); return res.status(500).json({ error: e.message || e }); }
});

// DEV ONLY: serve manual signed pdf
router.get('/:case_id/settlement/:settlement_id/_dev_download_manual', requireAuth, async (req,res)=>{
  const caseId = req.params.case_id;
  const fp = path.join(STORAGE_DIR, `cases/${caseId}/settlement_manual_signed.pdf`);
  try{
    await fs.access(fp);
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename="settlement_manual_signed.pdf"');
    fs.createReadStream(fp).pipe(res);
  }catch(e){
    console.error('dev download err', e);
    return res.status(500).json({ error:'dev download failed', detail: e.message });
  }
});

module.exports = router;
