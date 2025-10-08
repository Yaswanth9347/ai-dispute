// backend/src/routes/evidenceSigned.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const crypto = require('crypto');
const { requireAuth } = require('../lib/authMiddleware');

const SECRET = process.env.DOWNLOAD_TOKEN_SECRET;
const DEFAULT_EXP = Number(process.env.DOWNLOAD_TOKEN_EXP_SECONDS || '300');

if (!SECRET) {
  console.warn('WARNING: DOWNLOAD_TOKEN_SECRET not set — signed downloads will fail.');
}

function createToken(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SECRET || 'fallback-secret');
  hmac.update(payload);
  const sig = hmac.digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return { ok: false, reason: 'bad_format' };
    const hmac = crypto.createHmac('sha256', SECRET || 'fallback-secret');
    hmac.update(payloadB64);
    const expected = hmac.digest('base64url');
    if (expected !== sig) return { ok: false, reason: 'bad_sig' };
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Date.now() > payload.exp) return { ok: false, reason: 'expired' };
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, reason: 'exception', error: e.message };
  }
}

// POST /api/evidence/:id/signed
// requires Authorization: Bearer <auth-jwt>
// only allows token issuance if the requesting user is uploader or case party
router.post('/:id/signed', requireAuth, async (req, res) => {
  const evidenceId = req.params.id;
  const authUserId = req.user && req.user.sub;

  try {
    // fetch evidence record
    const { data: ev, error: evErr } = await supabase
      .from('evidence')
      .select('id, file_path, metadata, uploader_id, case_id')
      .eq('id', evidenceId)
      .single();

    if (evErr || !ev) {
      return res.status(404).json({ error: 'evidence not found' });
    }

    // check if authUserId === uploader_id
    if (ev.uploader_id === authUserId) {
      // allowed
    } else {
      // otherwise check case_parties table for membership
      const { data: parties, error: pErr } = await supabase
        .from('case_parties')
        .select('user_id, role')
        .eq('case_id', ev.case_id);

      if (pErr) {
        console.warn('case_parties lookup failed', pErr);
      }

      const isParty = Array.isArray(parties) && parties.some(p => p.user_id === authUserId);
      if (!isParty) {
        return res.status(403).json({ error: 'forbidden: not uploader or case participant' });
      }
    }

    const now = Date.now();
    const exp = now + (Number(process.env.DOWNLOAD_TOKEN_EXP_SECONDS || DEFAULT_EXP) * 1000);
    const payload = {
      evidence_id: evidenceId,
      exp,
      iat: now,
      issued_by: authUserId
    };

    const token = createToken(payload);
    return res.json({ token, expires_at: new Date(exp).toISOString() });
  } catch (e) {
    console.error('signed token err', e);
    return res.status(500).json({ error: e.message || 'internal error' });
  }
});

router.verifyToken = verifyToken;

module.exports = router;
