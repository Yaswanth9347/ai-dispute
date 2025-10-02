// backend/src/routes/cases.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const multer = require('multer');
const upload = multer({ dest: '/tmp/uploads' });
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// 1) create case
router.post('/', async (req, res) => {
  const { title, filed_by, case_type, jurisdiction } = req.body;
  if (!title || !filed_by) return res.status(400).json({ error: 'missing' });

  const { data, error } = await supabase
    .from('cases')
    .insert([{ title, filed_by, case_type, jurisdiction }])
    .select()
    .single();

  if (error) return res.status(500).json({ error });
  return res.json(data);
});

// 2) upload evidence: multipart (file + uploader_id)
router.post('/:id/evidence', upload.single('file'), async (req, res) => {
  const { id: caseId } = req.params;
  const { uploader_id } = req.body;
  if (!req.file) return res.status(400).json({ error: 'no file' });

  try {
    const localPath = req.file.path;
    const fileBuffer = fs.readFileSync(localPath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const ext = req.file.originalname.split('.').pop();
    const filename = `${caseId}/${uuidv4()}.${ext}`;

    // upload to supabase storage
    const bucket = process.env.SUPABASE_BUCKET || 'evidence';
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(filename, fileBuffer, { contentType: req.file.mimetype, upsert: false });

    if (uploadErr) throw uploadErr;

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(filename)}`;

    // insert record to evidence table
    const { data, error } = await supabase
      .from('evidence')
      .insert([{
        case_id: caseId,
        uploader_id,
        file_path: filename,
        sha256,
        metadata: { original_name: req.file.originalname, mime: req.file.mimetype },
      }])
      .select()
      .single();

    // cleanup local file
    fs.unlinkSync(localPath);

    if (error) return res.status(500).json({ error });
    // return evidence record + public url
    res.json({ ...data, publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || err });
  }
});

module.exports = router;
