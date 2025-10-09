// backend/src/routes/caseDecisions.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { requireAuth } = require('../lib/authMiddleware');

// POST /api/cases/:id/decision
// body: { analysis_id, option_id, decision: "accept"|"decline"|"propose", note? }
router.post('/:id/decision', requireAuth, async (req, res) => {
  const caseId = req.params.id;
  const userId = req.user && req.user.sub;
  const { analysis_id, option_id, decision, note } = req.body;
  if (!analysis_id || !option_id || !decision) return res.status(400).json({ error: 'missing fields' });
  if (!['accept','decline','propose'].includes(decision)) return res.status(400).json({ error: 'invalid decision' });

  try {
    // ensure case exists
    const { data: c, error: cErr } = await supabase.from('cases').select('id').eq('id', caseId).limit(1).single();
    if (cErr || !c) return res.status(404).json({ error: 'case not found' });

    // --- Permission check: allow only case uploader(s) (your schema has no case_parties) ---
    // If you later add case participants table, you can expand this check.
    const { data: evidenceRows, error: evidenceErr } = await supabase
      .from('evidence')
      .select('uploader_id')
      .eq('case_id', caseId);

    if (evidenceErr) {
      console.error('evidence lookup err', evidenceErr);
      return res.status(500).json({ error: 'internal' });
    }

    const isUploader = Array.isArray(evidenceRows) && evidenceRows.some(e => e.uploader_id === userId);

    if (!isUploader) {
      return res.status(403).json({ error: 'forbidden: not a case uploader' });
    }

    // Upsert decision (one vote per analysis_id + option_id + user_id)
    const insertObj = {
      case_id: caseId,
      analysis_id,
      option_id: String(option_id),
      decision,
      user_id: userId,
      note: note || null
    };

    const { data: saved, error: saveErr } = await supabase
      .from('case_decisions')
      .upsert(insertObj, { onConflict: 'analysis_id,option_id,user_id' })
      .select()
      .single();

    if (saveErr) {
      console.error('upsert err', saveErr);
      return res.status(500).json({ error: saveErr });
    }

    // return updated tally for the analysis using the latest-vote RPC
    let tally = null;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_latest_case_decision_tally', { p_case_id: caseId, p_analysis_id: analysis_id });
      if (!rpcErr && Array.isArray(rpcData)) {
        // rpcData expected as array of { option_id, accepts, declines, proposes }
        tally = {};
        rpcData.forEach(r => {
          tally[String(r.option_id)] = {
            accepts: Number(r.accepts || 0),
            declines: Number(r.declines || 0),
            proposes: Number(r.proposes || 0)
          };
        });
      }
    } catch (e) {
      console.warn('rpc tally err', e);
    }

    if (!tally) {
      // simple fallback tally (counts all rows) - kept for compatibility
      const { data: allDecisions, error: allErr } = await supabase.from('case_decisions').select('option_id, decision').eq('case_id', caseId);
      if (allErr) {
        console.error('tally fetch err', allErr);
        return res.status(500).json({ error: allErr });
      }
      const simple = {};
      (allDecisions || []).forEach(d => {
        simple[d.option_id] = simple[d.option_id] || { accepts: 0, declines: 0, proposes: 0 };
        if (d.decision === 'accept') simple[d.option_id].accepts += 1;
        if (d.decision === 'decline') simple[d.option_id].declines += 1;
        if (d.decision === 'propose') simple[d.option_id].proposes += 1;
      });
      tally = simple;
    }

    res.json({ ok: true, saved, tally });
  } catch (e) {
    console.error('decision err', e);
    return res.status(500).json({ error: e.message || e });
  }
});

// GET /api/cases/:id/decisions?analysis_id=<id>
router.get('/:id/decisions', requireAuth, async (req, res) => {
  const caseId = req.params.id;
  const { analysis_id } = req.query;
  try {
    const q = supabase.from('case_decisions')
      .select('id, case_id, analysis_id, option_id, decision, user_id, note, created_at')
      .eq('case_id', caseId);
    if (analysis_id) q.eq('analysis_id', analysis_id);
    const { data, error } = await q.order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error });

    // Try RPC to get latest-vote tally first
    let tally = null;
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_latest_case_decision_tally', { p_case_id: caseId, p_analysis_id: analysis_id || null });
      if (!rpcErr && Array.isArray(rpcData)) {
        tally = {};
        rpcData.forEach(r => {
          tally[String(r.option_id)] = {
            accepts: Number(r.accepts || 0),
            declines: Number(r.declines || 0),
            proposes: Number(r.proposes || 0)
          };
        });
      }
    } catch (e) {
      console.warn('rpc tally err', e);
    }

    // Fallback: simple tally computed from returned rows
    if (!tally) {
      const simple = {};
      (data || []).forEach(d => {
        simple[d.option_id] = simple[d.option_id] || { accepts: 0, declines: 0, proposes: 0 };
        if (d.decision === 'accept') simple[d.option_id].accepts += 1;
        if (d.decision === 'decline') simple[d.option_id].declines += 1;
        if (d.decision === 'propose') simple[d.option_id].proposes += 1;
      });
      tally = simple;
    }

    res.json({ count: data.length, items: data, tally });
  } catch (e) {
    console.error('decisions get err', e);
    return res.status(500).json({ error: e.message || e });
  }
});

module.exports = router;
