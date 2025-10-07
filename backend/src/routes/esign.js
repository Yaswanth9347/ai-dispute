// backend/src/routes/esign.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const supabase = require('../lib/supabaseClient');
const { requireAuth } = require('../lib/authMiddleware');
const docusign = require('docusign-esign');
const fetch = require('node-fetch');

const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const USER_ID = process.env.DOCUSIGN_USER_ID;
const AUTH_SERVER = process.env.DOCUSIGN_AUTH_SERVER || 'https://account-d.docusign.com';
const BASE_PATH = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
const PRIVATE_KEY_PATH = process.env.DOCUSIGN_PRIVATE_KEY_PATH || './keys/docusign_private_key.pem';

// helper: get JWT access token from DocuSign via JWT Grant
async function obtainAccessToken() {
  const jwtLifeSec = 3600; // 1 hour
  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath(AUTH_SERVER.replace(/^https?:\/\//, '')); // hostname part
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH);
  const scopes = ['signature', 'impersonation'];
  return new Promise((resolve, reject) => {
    apiClient.requestJWTUserToken(INTEGRATION_KEY, USER_ID, scopes, privateKey, jwtLifeSec)
      .then(tokenResponse => {
        const accessToken = tokenResponse.body.access_token;
        resolve({ accessToken, apiClient });
      })
      .catch(err => reject(err));
  });
}

// helper: download settlement pdf from supabase storage into buffer
async function downloadSettlementFile(filePath) {
  const bucket = process.env.SUPABASE_BUCKET || 'evidence';
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error || !data) throw new Error('failed to download settlement file: ' + JSON.stringify(error));
  const buf = Buffer.from(await data.arrayBuffer());
  return buf;
}

// POST /api/cases/:id/esign/send
// body: { settlement_id }  -- sends envelope to case parties (uses contact_email in case_parties)
router.post('/:id/esign/send', requireAuth, async (req, res) => {
  const caseId = req.params.id;
  const { settlement_id } = req.body;
  if (!settlement_id) return res.status(400).json({ error: 'missing settlement_id' });

  try {
    // fetch settlement row
    const { data: settlement } = await supabase.from('case_settlements').select('id, case_id, file_path').eq('id', settlement_id).single();
    if (!settlement) return res.status(404).json({ error: 'settlement not found' });

    // fetch case parties & emails
    const { data: parties } = await supabase.from('case_parties').select('user_id, contact_email, role').eq('case_id', caseId);
    const recipients = (parties || []).filter(p => p.contact_email).map((p, idx) => ({ ...p, recipientId: idx + 1, routingOrder: idx + 1 }));

    if (recipients.length === 0) return res.status(400).json({ error: 'no recipient emails found for case' });

    // obtain DocuSign access token and accountId
    const { accessToken, apiClient } = await obtainAccessToken();
    apiClient.setBasePath(BASE_PATH);
    const userInfo = await apiClient.getUserInfo(accessToken);
    const accountId = userInfo && userInfo.accounts && userInfo.accounts[0] && userInfo.accounts[0].accountId;
    if (!accountId) throw new Error('failed to determine DocuSign accountId');

    // download PDF bytes
    const pdfBytes = await downloadSettlementFile(settlement.file_path);

    // create envelope definition
    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    apiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);

    const docBase64 = pdfBytes.toString('base64');
    const doc = docusign.Document.constructFromObject({
      documentBase64: docBase64,
      name: `settlement_${settlement_id}.pdf`,
      fileExtension: 'pdf',
      documentId: '1'
    });

    // create recipients (signers)
    const signers = recipients.map(r => docusign.Signer.constructFromObject({
      email: r.contact_email,
      name: `Party ${r.user_id}`,
      recipientId: String(r.recipientId),
      routingOrder: String(r.routingOrder)
    }));

    // create a signHere tab near bottom-right on first page (simple)
    const signTabs = signers.map((s, idx) => {
      const tab = docusign.SignHere.constructFromObject({
        anchorString: '/sn' + (idx+1),
        anchorYOffset: '0',
        anchorUnits: 'pixels'
      });
      return [tab];
    });

    // Because we can't reliably place by coordinates, simplest approach: create a signing tab at bottom-left coordinates
    const tabsForSigners = signers.map((s, i) => {
      return docusign.Tabs.constructFromObject({
        signHereTabs: [
          docusign.SignHere.constructFromObject({
            pageNumber: '1',
            xPosition: '400',
            yPosition: String(500 - (i * 120)), // stack vertically
            documentId: '1'
          })
        ]
      });
    });

    // attach tabs to each signer
    signers.forEach((s, i) => s.tabs = tabsForSigners[i]);

    const recipientsDef = docusign.Recipients.constructFromObject({ signers });

    const envDef = new docusign.EnvelopeDefinition();
    envDef.emailSubject = `Settlement for case ${caseId} — please sign`;
    envDef.documents = [doc];
    envDef.recipients = recipientsDef;
    envDef.status = 'sent'; // send immediately

    // create envelope
    const result = await envelopesApi.createEnvelope(accountId, { envelopeDefinition: envDef });
    const envelopeId = result.envelopeId;

    // save envelopeId into a table for tracking
    await supabase.from('case_esign').insert([{
      case_id: caseId,
      settlement_id,
      provider: 'docusign',
      envelope_id: envelopeId,
      status: 'sent',
      created_at: new Date().toISOString()
    }]);

    // return envelopeId to UI
    return res.json({ ok: true, envelopeId, accountId });
  } catch (e) {
    console.error('esign send err', e);
    return res.status(500).json({ error: e.message || e });
  }
});



module.exports = router;







// --- replace existing /callback handler with this exact block ---
const crypto = require('crypto');

// POST /api/esign/callback  (DocuSign Connect webhook)  -- public endpoint to receive envelope events
// Body may be XML or JSON. We verify HMAC header 'X-DocuSign-Signature-1' using DOCUSIGN_CONNECT_SECRET.
router.post('/callback', express.text({ type: '*/*' }), async (req, res) => {
  try {
    const bodyText = req.body || '';
    // read header (DocuSign uses X-DocuSign-Signature-1). It may include "sha256=<base64>" or plain base64.
    const header = (req.headers['x-docusign-signature-1'] || req.headers['x-docusign-signature'] || '') + '';
    const secret = process.env.DOCUSIGN_CONNECT_SECRET || '';
    if (!secret) {
      console.warn('[DOCUSIGN CALLBACK] no DOCUSIGN_CONNECT_SECRET set - skipping verification (not recommended)');
    } else {
      if (!header) {
        console.warn('[DOCUSIGN CALLBACK] missing HMAC header; rejecting');
        return res.status(401).send('missing-signature');
      }
      // header may contain multiple comma-separated signatures; use the first token that looks like base64 or sha256=<b64>
      const tokenPart = header.split(',').map(s=>s.trim()).find(s=>s.length>0);
      let receivedB64 = tokenPart;
      if (tokenPart && tokenPart.toLowerCase().startsWith('sha256=')) {
        receivedB64 = tokenPart.split('=')[1];
      }

      // compute HMAC-SHA256 and base64 it
      const hmac = crypto.createHmac('sha256', secret).update(bodyText, 'utf8').digest('base64');

      // timing-safe compare
      const valid = crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(receivedB64 || '', 'utf8'));
      if (!valid) {
        console.warn('[DOCUSIGN CALLBACK] signature verification failed. computed:', hmac, 'received:', receivedB64);
        return res.status(401).send('invalid-signature');
      }
    }

    console.log('[DOCUSIGN CALLBACK] signature verified (or skipped). processing payload...');

    // same processing as before: attempt to find envelopeId and status
    const envMatch = bodyText.match(/<EnvelopeID>([^<]+)<\/EnvelopeID>/i) || bodyText.match(/"envelopeId":"([^"]+)"/i);
    const statusMatch = bodyText.match(/<EnvelopeStatus.*?>\s*<Status>([^<]+)<\/Status>/i) || bodyText.match(/"status":"([^"]+)"/i);

    const envelopeId = envMatch ? envMatch[1] : null;
    const status = statusMatch ? statusMatch[1] : null;

    if (envelopeId) {
      await supabase.from('case_esign').update({ status: status || 'unknown', last_webhook: bodyText }).eq('envelope_id', envelopeId);
      console.log('[DOCUSIGN CALLBACK] updated envelope', envelopeId, '->', status);
    } else {
      console.warn('[DOCUSIGN CALLBACK] envelopeId not found in payload');
    }

    if (envelopeId && (status && status.toLowerCase() === 'completed')) {
      // fetch signed docs and save (same logic as before)
      try {
        const { accessToken, apiClient } = await obtainAccessToken();
        apiClient.setBasePath(BASE_PATH);
        const userInfo = await apiClient.getUserInfo(accessToken);
        const accountId = userInfo.accounts[0].accountId;
        const envelopesApi = new docusign.EnvelopesApi(apiClient);
        const docBuf = await envelopesApi.getDocument(accountId, 'combined', envelopeId, null);
        const signedPdfBuffer = Buffer.from(docBuf, 'binary');
        const bucket = process.env.SUPABASE_BUCKET || 'evidence';
        const filePath = `cases/esign/${envelopeId}_signed.pdf`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, signedPdfBuffer, { contentType: 'application/pdf' });
        if (!upErr) {
          await supabase.from('case_esign').update({ signed_file_path: filePath }).eq('envelope_id', envelopeId);
          console.log('[DOCUSIGN CALLBACK] saved signed pdf to', filePath);
        } else {
          console.warn('[DOCUSIGN CALLBACK] upload error', upErr);
        }
      } catch (innerErr) {
        console.error('[DOCUSIGN CALLBACK] error fetching signed doc', innerErr);
      }
    }

    // Return 200 OK to DocuSign
    res.status(200).send('ok');
  } catch (e) {
    console.error('[DOCUSIGN CALLBACK] exception', e);
    return res.status(500).send('error');
  }
});
