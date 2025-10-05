// backend/src/routes/settlementSign.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { requireAuth } = require('../lib/authMiddleware');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const fetch = require('node-fetch'); // if needed for URL fetch
const path = require('path');

const BUCKET = process.env.SUPABASE_BUCKET || 'evidence';

/*
POST /api/cases/:id/settlement/:sid/sign
Headers: Authorization: Bearer <auth_jwt>
Body (multipart/form-data):
  - signature_type = image | text
  - signature_image file (if image) OR signature_text string (if text)
Returns: { ok, saved_signature_row, signed_pdf: { id, file_path, download_endpoint } }
*/
const multer = require('multer');
const upload = multer({ dest: '/tmp' });
const fs = require('fs');

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

    let signature_data = null;

    if (sigType === 'image') {
      if (!req.file) return res.status(400).json({ error: 'no signature image uploaded' });
      // read file and convert to base64
      const buf = fs.readFileSync(req.file.path);
      const ext = path.extname(req.file.originalname).replace('.', '').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
      signature_data = `data:${mime};base64,${buf.toString('base64')}`;
      // remove temp file
      fs.unlinkSync(req.file.path);
    } else {
      // text signature
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

    if (sigErr) {
      console.warn('save signature err', sigErr);
      return res.status(500).json({ error: 'failed to save signature' });
    }

    // after saving, check if all parties have signed
    const { data: parties } = await supabase.from('case_parties').select('user_id').eq('case_id', caseId);
    const partyIds = (parties || []).map(p => p.user_id);
    const { data: sigs } = await supabase.from('case_settlement_signatures').select('user_id').eq('settlement_id', settlementId);
    const signedBy = (sigs || []).map(s => s.user_id);

    // embed signatures into PDF when all parties have signed OR if you want immediate signed copy, we create the signed PDF now (mock)
    const allSigned = partyIds.length > 0 && partyIds.every(pid => signedBy.includes(pid));

    // Load original settlement PDF from storage
    const { data: fileData, error: dlErr } = await supabase.storage.from(BUCKET).download(s.file_path);
    if (dlErr || !fileData) {
      return res.status(500).json({ error: 'failed to download settlement pdf' });
    }
    const origBuffer = Buffer.from(await fileData.arrayBuffer());
    const pdfDoc = await PDFDocument.load(origBuffer);
    const pages = pdfDoc.getPages();

    // for each signature, create a small signature block and put on last page
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // gather signature entries (we'll display all)
    const { data: allSigs } = await supabase.from('case_settlement_signatures').select('id, user_id, signature_type, signature_data, uploaded_at').eq('settlement_id', settlementId);

    let y = 120; // start height for signature blocks from bottom
    for (const sEntry of (allSigs || [])) {
      if (sEntry.signature_type === 'image' && sEntry.signature_data && sEntry.signature_data.startsWith('data:')) {
        // embed image
        const base64 = sEntry.signature_data.split(',')[1];
        const imgBytes = Buffer.from(base64, 'base64');
        let img;
        if (sEntry.signature_data.indexOf('image/png') >= 0) {
          img = await pdfDoc.embedPng(imgBytes);
        } else {
          img = await pdfDoc.embedJpg(imgBytes);
        }
        const imgDims = img.scale(0.5);
        const imgW = 160;
        const imgH = (imgDims.height / imgDims.width) * imgW;
        lastPage.drawText(`Signed by: ${sEntry.user_id}`, { x: 40, y, size: 10, font });
        lastPage.drawImage(img, { x: 200, y: y - 10, width: imgW, height: imgH });
        y += imgH + 40;
      } else {
        // text signature
        lastPage.drawText(`Signed by: ${sEntry.user_id}`, { x: 40, y, size: 10, font });
        lastPage.drawText(`Signature (text): ${String(sEntry.signature_data)}`, { x: 40, y: y - 14, size: 10, font, maxWidth: width - 80 });
        y += 36;
      }

      // if y grows too big, stop adding (simple)
      if (y > height - 200) break;
    }

    const signedPdfBytes = await pdfDoc.save();
    const signedFilePath = `cases/${caseId}/settlement_${settlementId}_signed_${Date.now()}.pdf`;

    // upload signed PDF
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(signedFilePath, Buffer.from(signedPdfBytes), { contentType: 'application/pdf' });
    if (upErr) {
      console.error('upload signed pdf failed', upErr);
      return res.status(500).json({ error: 'failed to upload signed pdf' });
    }

    // store signed file path: update case_settlements with last_signed_file_path (optional column) — we will insert a small metadata row into case_settlements if needed
    const { data: updateSet, error: updateErr } = await supabase
      .from('case_settlements')
      .update({ file_path: signedFilePath })
      .eq('id', settlementId);

    // return result
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
