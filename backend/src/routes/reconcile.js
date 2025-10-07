// backend/src/routes/reconcile.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { requireAuth } = require('../lib/authMiddleware');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// helper: get latest analysis for case
async function getLatestAnalysis(caseId) {
  const { data } = await supabase
    .from('ai_analysis')
    .select('id, case_id, model, analysis, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

// helper: get decisions for analysis
async function getDecisions(caseId, analysisId) {
  const { data } = await supabase
    .from('case_decisions')
    .select('id, user_id, option_id, decision, created_at')
    .eq('case_id', caseId)
    .eq('analysis_id', analysisId);
  return data || [];
}

// build prompt for reconciliation
function buildReconcilePrompt(caseTitle, statements, analysis, decisions) {
  // collect chosen options and party mapping
  const optionMap = {};
  (analysis.options || []).forEach(o => {
    optionMap[String(o.id)] = o;
  });

  const picks = {};
  decisions.forEach(d => {
    if (d.decision === 'accept') {
      picks[d.user_id] = d.option_id;
    }
  });

  const picksText = Object.entries(picks).map(([user, opt]) => {
    const optObj = optionMap[String(opt)];
    const optTitle = optObj ? (optObj.title || `Option ${optObj.id}`) : String(opt);
    const optRationale = optObj ? (optObj.rationale || '') : '';
    return `- User ${user} accepted option ${String(opt)}: ${optTitle}\n  Rationale: ${optRationale}`;
  }).join('\n') || 'No accepts found.';

  // compact prompt
  return `
You are a mediation-focused legal assistant for low-value civil disputes in India. Two or more parties have each accepted different settlement options produced earlier by an AI. Your job: propose a fair compromise or reworked option(s) that aligns with the parties' chosen preferences and the case facts.

Case title:
${caseTitle}

Concise facts:
${statements}

Prior AI analysis (selected options & rationale):
${picksText}

Original options (for reference):
${(analysis.options || []).map(o => `- ${o.id}: ${o.title || ''} — ${o.rationale || ''}`).join('\n')}

Task:
Produce JSON only with schema:
{
  "summary":"<short neutral summary>",
  "compromise_options":[
    {"id":1,"title":"","rationale":"","confidence":0-100,"recommended_terms":""}
  ],
  "legal_basis":["brief citations or principles"],
  "final_recommendation":"<id or 'further-mediation'|'escalate'>"
}

Prefer fair, enforceable, low-cost options. Keep JSON valid. Return no extra text outside JSON.
  `.trim();
}

// POST /api/cases/:id/reconcile  (requires auth)
router.post('/:id/reconcile', requireAuth, async (req, res) => {
  const caseId = req.params.id;
  const { analysis_id } = req.body; // optional; if missing, use latest
  try {
    // find analysis
    let analysisRow = null;
    if (analysis_id) {
      const { data } = await supabase.from('ai_analysis').select('id, analysis, created_at').eq('id', analysis_id).single();
      analysisRow = data;
    } else {
      analysisRow = await getLatestAnalysis(caseId);
    }
    if (!analysisRow) return res.status(404).json({ error: 'analysis not found' });

    const analysis = analysisRow.analysis || {};
    const analysisId = analysisRow.id;

    // fetch decisions
    const decisions = await getDecisions(caseId, analysisId);
    if (!decisions || decisions.length === 0) {
      return res.status(400).json({ error: 'no decisions found for analysis' });
    }

    // compute accept counts per option
    const acceptCounts = {};
    decisions.forEach(d => {
      if (d.decision === 'accept') {
        acceptCounts[String(d.option_id)] = (acceptCounts[String(d.option_id)] || 0) + 1;
      }
    });

    // if all accepts same option and every party accepted that, return early
    const { data: parties } = await supabase.from('case_parties').select('user_id').eq('case_id', caseId);
    const partyCount = (parties || []).length;
    const uniqueAcceptedOptions = Object.keys(acceptCounts);
    if (uniqueAcceptedOptions.length === 1 && acceptCounts[uniqueAcceptedOptions[0]] >= partyCount) {
      // consensus achieved, return that option
      const chosenId = uniqueAcceptedOptions[0];
      return res.json({ ok: true, reason: 'consensus', chosen_option_id: chosenId });
    }

    // collect concise statements for prompt
    const { data: statements } = await supabase.from('statements').select('id, user_id, text').eq('case_id', caseId);
    const statementsText = (statements || []).map(s => `(${s.user_id}) ${s.text}`).join('\n') || 'No statements';

    // build prompt and call Gemini
    const prompt = buildReconcilePrompt(analysisRow.case_id || `Case ${caseId}`, statementsText, analysis, decisions);

    const model = genAI.getGenerativeModel({ model: process.env.GENAI_MODEL || 'gemini-1.5-pro' });
    const result = await model.generateContent(prompt);
    const response = await result.response;

    // extract text (robust)
    let textOut = null;
    try {
      textOut = response.text();
    } catch (e) {
      console.error('Error extracting text from Gemini response:', e);
      textOut = JSON.stringify(response);
    }

    // try parse JSON
    let parsed = null;
    try { parsed = JSON.parse(textOut); } catch (e) {
      // attempt to find JSON block
      const m = textOut.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (e2) { parsed = null; }
      }
    }

    // if parse failed, save raw and return a helpful message
    if (!parsed) {
      await supabase.from('ai_analysis').insert([{
        case_id: caseId,
        model: process.env.GENAI_MODEL || 'gemini-1.5-pro',
        analysis: { raw_reconcile: textOut, decisions, created_at: new Date().toISOString() }
      }]);
      return res.status(200).json({ ok: false, message: 'reconcile returned non-JSON; raw saved', raw: textOut });
    }

    // persist reconciled analysis
    const { data: saved, error: saveErr } = await supabase.from('ai_analysis').insert([{
      case_id: caseId,
      model: process.env.GENAI_MODEL || 'gemini-1.5-pro',
      analysis: parsed
    }]).select().single();

    if (saveErr) console.warn('save reconcile analysis err', saveErr);

    return res.json({ ok: true, analysis: parsed, saved_id: saved?.id || null });

  } catch (e) {
    console.error('reconcile err', e);
    return res.status(500).json({ error: e.message || e });
  }
});

module.exports = router;
