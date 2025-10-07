// backend/src/routes/settlementSign.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { requireAuth } = require('../lib/authMiddleware');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: '/tmp' });

const BUCKET = process.env.SUPABASE_BUCKET || 'evidence';

router.post('/:id/settlement/:sid/sign', requireAuth, upload.single('signature_image'), async (req, res) => {
  const caseId = req.params.id;
  const settlementId = req.params.sid;
  const userId = req.user && req.user.sub;
  const sigType = req.body.signature_type || (req.file ? 'image' : 'text');

  try {
    // fetch settlement
    const { data: s, error: sErr } = await supabase.from('case_settlements').select('*').eq('id', settlementId).single();
    if (sErr || !s) return res.status(404).json({ error: 'settlement not found' });
    if (String(s.case_id) !== String(caseId)) return res.status(400).json({ error: 'case id mismatch' });

    // process signature
    let signature_data;
    if (sigType === 'image') {
      if (!req.file) return res.status(400).json({ error: 'no signature image uploaded' });
      const buf = fs.readFileSync(req.file.path);
      const ext = path.extname(req.file.originalname).replace('.', '').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
      signature_data = `data:${mime};base64,${buf.toString('base64')}`;
      fs.unlinkSync(req.file.path); // cleanup temp file
    } else {
      signature_data = req.body.signature_text || null;
      if (!signature_data) return res.status(400).json({ error: 'no signature_text provided' });
    }

    // save signature row
    const { data: savedSig, error: sigErr } = await supabase.from('case_settlement_signatures').insert([{
      settlement_id: settlementId,
      case_id: caseId,
      user_id: userId,
      signature_type: sigType,
      signature_data
    }]).select().single();

    if (sigErr) return res.status(500).json({ error: 'failed to save signature' });

    // gather all parties and signatures
    const { data: parties } = await supabase.from('case_parties').select('user_id').eq('case_id', caseId);
    const partyIds = (parties || []).map(p => p.user_id);
    const { data: sigs } = await supabase.from('case_settlement_signatures').select('user_id').eq('settlement_id', settlementId);
    const signedBy = (sigs || []).map(s => s.user_id);
    const allSigned = partyIds.length > 0 && partyIds.every(pid => signedBy.includes(pid));

    // load original PDF
    const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(s.file_path);
    if (dlErr || !fileData) return res.status(500).json({ error: 'failed to download settlement pdf' });
    const origBuffer = Buffer.from(await fileData.arrayBuffer());
    const pdfDoc = await PDFDocument.load(origBuffer);

    // embed signatures on last page
    const pages = pdfDoc.getPages();
    let lastPage = pages[pages.length - 1];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const { width, height } = lastPage.getSize();
    let y = 120;

    const { data: allSigs } = await supabase.from('case_settlement_signatures').select('id, user_id, signature_type, signature_data').eq('settlement_id', settlementId);
    for (const sEntry of (allSigs || [])) {
      if (sEntry.signature_type === 'image' && sEntry.signature_data?.startsWith('data:')) {
        const base64 = sEntry.signature_data.split(',')[1];
        const imgBytes = Buffer.from(base64, 'base64');
        let img;
        img = sEntry.signature_data.includes('image/png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
        const imgDims = img.scale(0.5);
        const imgW = 160;
        const imgH = (imgDims.height / imgDims.width) * imgW;
        lastPage.drawText(`Signed by: ${sEntry.user_id}`, { x: 40, y, size: 10, font });
        lastPage.drawImage(img, { x: 200, y: y - 10, width: imgW, height: imgH });
        y += imgH + 40;
      } else {
        lastPage.drawText(`Signed by: ${sEntry.user_id}`, { x: 40, y, size: 10, font });
        lastPage.drawText(`Signature (text): ${String(sEntry.signature_data)}`, { x: 40, y: y - 14, size: 10, font, maxWidth: width - 80 });
        y += 36;
      }
      if (y > height - 200) break;
    }

    const signedPdfBytes = await pdfDoc.save();
    const signedFilePath = `cases/${caseId}/settlement_${settlementId}_signed_${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(signedFilePath, Buffer.from(signedPdfBytes), { contentType: 'application/pdf' });
    if (upErr) return res.status(500).json({ error: 'failed to upload signed pdf' });

    // update settlement record
    await supabase.from('case_settlements').update({ file_path: signedFilePath }).eq('id', settlementId);

    // notify parties about signature
    try {
      const { data: notifyParties } = await supabase.from('case_parties').select('user_id, contact_email').eq('case_id', caseId);
      const emails = (notifyParties || []).map(p => p.contact_email).filter(Boolean);
      if (emails.length) {
        const { sendMail } = require('../lib/mailer');
        const subject = `Signature uploaded for settlement ${settlementId}`;
        const text = `User ${userId} uploaded a signature for settlement ${settlementId} (case ${caseId}).\nAll parties signed: ${allSigned}\nDownload (authenticated): /api/cases/${caseId}/settlement/${settlementId}/download`;
        await sendMail({ to: emails[0], bcc: emails.slice(1), subject, text });
      }
    } catch (mailErr) {
      console.warn('notify sign mail err', mailErr);
    }

    return res.json({
      ok: true,
      saved_signature: savedSig,
      all_signed: allSigned,
      signed_pdf: {
        file_path: signedFilePath,
        download_endpoint: `/api/cases/${caseId}/settlement/${settlementId}/download`
      }
    });

  } catch (e) {
    console.error('sign err', e);
    return res.status(500).json({ error: e.message || e });
  }
});

module.exports = router;
