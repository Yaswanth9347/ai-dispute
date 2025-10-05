// backend/src/routes/analyze.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// init client (single instance)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

// --- Helpers ---------------------------------------------------------------

// defensive helper: call model and return plain text output
async function callModel(prompt, modelName = process.env.GENAI_MODEL || 'gemini-1.5-pro', maxTokens = 900) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });

    // Some SDKs accept an object, others accept (prompt, opts) - we standardize to generateContent
    const result = await model.generateContent(prompt, { maxOutputTokens: maxTokens }).catch(e => {
      throw new Error(`model.generateContent error: ${String(e?.message || e)}`);
    });

    const resp = result?.response ?? result;

    // extract text robustly
    if (typeof resp?.text === 'function') {
      const t = resp.text();
      if (t) return t;
    }
    if (resp?.output_text) return resp.output_text;
    if (Array.isArray(resp?.output)) {
      const parts = [];
      resp.output.forEach(block => {
        if (block?.content && Array.isArray(block.content)) {
          block.content.forEach(c => {
            if (typeof c === 'string') parts.push(c);
            else if (c?.text) parts.push(c.text);
          });
        } else if (block?.text) {
          parts.push(block.text);
        }
      });
      if (parts.length) return parts.join('\n');
    }
    // last resort
    return JSON.stringify(resp);
  } catch (e) {
    // bubble up
    throw e;
  }
}

// try strict parse then more forgiving extracts
function tryParseJSON(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    // try first full JSON object
    const firstMatch = text.match(/\{[\s\S]*\}/);
    if (firstMatch) {
      try {
        return JSON.parse(firstMatch[0]);
      } catch (e2) {
        // try trailing object
        const trailing = text.match(/\{[\s\S]*\}$/);
        if (trailing) {
          try {
            return JSON.parse(trailing[0]);
          } catch (e3) {
            return null;
          }
        }
      }
    }
    return null;
  }
}

// normalize confidence values to integer 0-100
function normalizeConfidence(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value <= 1) return Math.round(value * 100);
    return Math.min(100, Math.max(0, Math.round(value)));
  }
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === 'high') return 90;
    if (s === 'medium' || s === 'moderate') return 60;
    if (s === 'low') return 30;
    // try parse numeric string
    const n = parseFloat(s.replace('%', ''));
    if (!Number.isNaN(n)) {
      return n <= 1 ? Math.round(n * 100) : Math.round(Math.min(100, Math.max(0, n)));
    }
  }
  return null;
}

// format option id into opt_001 style
function formatOptionId(rawId, idx) {
  if (!rawId) return `opt_${String(idx + 1).padStart(3, '0')}`;
  const s = String(rawId).trim();
  // if it's already opt_xxx return as-is
  if (/^opt_\d+$/i.test(s)) return s.toLowerCase();
  // try to extract numeric part
  const num = s.match(/\d+/);
  if (num) return `opt_${String(num[0]).padStart(3, '0')}`;
  // fallback: sanitized string with prefix
  return `opt_${String(idx + 1).padStart(3, '0')}`;
}

// validate & coerce parsed object to required schema
function validateAndCoerce(parsed, evidenceMap) {
  const errors = [];
  const out = {};

  // summary
  out.summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

  // options
  out.options = Array.isArray(parsed.options) ? parsed.options.map((opt, idx) => {
    const coerced = {};
    coerced.id = formatOptionId(opt && (opt.id || opt.title), idx);
    coerced.title = opt && opt.title ? String(opt.title).trim() : '';
    coerced.rationale = opt && opt.rationale ? String(opt.rationale).trim() : '';
    // normalize confidence; if missing or unparsable, fallback to conservative default 40
    coerced.confidence = normalizeConfidence(opt && opt.confidence);
    if (coerced.confidence === null) coerced.confidence = 40;
    // related evidence -> ensure array of strings
    coerced.related_evidence = Array.isArray(opt?.related_evidence) ? opt.related_evidence.map(String) : [];
    // attach metadata
    coerced.related_evidence_metadata = coerced.related_evidence.map(id => evidenceMap[id] || { id });
    // recommended_terms if present
    if (opt && opt.recommended_terms) coerced.recommended_terms = String(opt.recommended_terms);
    return coerced;
  }) : [];

  // legal_basis
  out.legal_basis = Array.isArray(parsed.legal_basis) ? parsed.legal_basis.map(String) : (parsed.legal_basis ? [String(parsed.legal_basis)] : []);

  // recommended_action - coerce to allowed set
  const allowedActions = new Set(['close', 'escalate', 'mediate']);
  const ra = parsed.recommended_action ? String(parsed.recommended_action).toLowerCase().trim() : '';
  out.recommended_action = allowedActions.has(ra) ? ra : (parsed.final_recommendation ? String(parsed.final_recommendation).toLowerCase().trim() : null);
  if (!allowedActions.has(out.recommended_action)) out.recommended_action = null;

  // notes (optional)
  if (parsed.notes_for_human_reviewer) out.notes_for_human_reviewer = String(parsed.notes_for_human_reviewer);

  // Basic checks, push validation errors if important things missing
  if (!out.summary) errors.push('missing summary');
  if (!Array.isArray(out.options) || out.options.length === 0) errors.push('no options provided');
  // confidence missing isn't fatal (we set fallback), allow inspection
  return { coerced: out, errors };
}

// build prompt with a strict JSON schema + example
function buildStrictPrompt(caseTitle, facts, evidenceList) {
  const schemaExample = `Example JSON output (must return ONLY this JSON object, no surrounding text):
{
  "summary": "One-paragraph neutral summary of dispute.",
  "options": [
    {
      "id": "1",
      "title": "Monetary settlement: defendant pays INR 50,000",
      "rationale": "Short rationale 1-2 lines.",
      "confidence": 82,
      "related_evidence": ["evidence-id-1"],
      "recommended_terms": "Pay INR 50,000 in 30 days; sign settlement"
    }
  ],
  "legal_basis": ["short citation or principle"],
  "recommended_action": "mediate"
}`;

  const promptParts = [
    `You are a concise legal-advisor assistant for low-value civil disputes in India.`,
    `IMPORTANT: Return ONLY a single valid JSON object that exactly follows the schema shown in the example. Do NOT include any additional text, commentary, or explanation.`,
    `Case title: ${caseTitle}`,
    `Facts:\n${facts}`,
    `Evidence list:\n${evidenceList}`,
    `Task: Produce JSON with keys: summary (one paragraph string), options (array of objects with id,title,rationale,confidence (integer number 0-100),related_evidence (array of evidence ids), recommended_terms (optional string)), legal_basis (array of strings), recommended_action (one of "close","escalate","mediate").`,
    '',
    `Important: EVERY option must include a numeric field "confidence" which is an integer between 0 and 100. Do NOT return strings like "low" or "medium".`,
    '',
    schemaExample
  ];

  return promptParts.join('\n\n');
}

// clamp confidence conservatively when statements missing
function clampConfidenceIfNoStatements(coerced, hasStatements) {
  if (!Array.isArray(coerced?.options)) return coerced;
  if (hasStatements) return coerced;
  // no statements: prevent overconfidence — cap at 75 and enforce a conservative minimum of 40
  coerced.options = coerced.options.map(opt => {
    // normalize any incoming value to number first
    let c = normalizeConfidence(opt.confidence);
    if (c === null || c === undefined) {
      c = 40; // default conservative
    }
    // enforce bounds
    if (c > 75) c = 75;
    if (c < 40) c = 40; // convert zeros/low numbers to conservative min
    return Object.assign({}, opt, { confidence: c });
  });
  return coerced;
}

// POST /api/analyze
// body: { case_id: "uuid", template?: "concise|detailed|evidence_first" }
router.post('/', async (req, res) => {
  const { case_id } = req.body;
  if (!case_id) return res.status(400).json({ error: 'missing case_id' });

  try {
    // fetch case, statements, evidence
    const { data: caseRow, error: caseErr } = await supabase.from('cases').select('id, title, case_type, jurisdiction').eq('id', case_id).single();
    if (caseErr) console.warn('case fetch err', caseErr);

    const { data: statements } = await supabase.from('statements').select('id, user_id, text').eq('case_id', case_id);
    const { data: evidence } = await supabase.from('evidence').select('id, file_path, sha256, metadata').eq('case_id', case_id);

    const hasStatements = Array.isArray(statements) && statements.length > 0;
    const facts = (statements || []).map(s => `(${s.user_id}) ${s.text}`).join('\n') || 'No statements provided.';
    const evidenceList = (evidence || []).map(e => `${e.id} : ${e.metadata?.original_name || e.file_path} (${e.metadata?.mime || 'unknown'})`).join('\n') || 'No evidence';

    const prompt = buildStrictPrompt(caseRow?.title || `Case ${case_id}`, facts, evidenceList);

    // primary model call
    let rawText = await callModel(prompt);

    // try parse
    let parsed = tryParseJSON(rawText);

    // if not parsed, attempt a second pass that asks the model to extract JSON only from its prior text
    if (!parsed) {
      try {
        const extractorPrompt = `You previously returned text that may contain a JSON object. Extract and return ONLY the JSON object (no commentary). Here is the original text:\n\n${rawText}`;
        const secondRaw = await callModel(extractorPrompt);
        parsed = tryParseJSON(secondRaw) || tryParseJSON(rawText); // try the second result then fallback
        // if parsed via extractor, replace rawText with secondRaw (so DB stores extractor output too)
        if (parsed) rawText = secondRaw;
      } catch (e) {
        console.warn('second-pass extractor error', e);
      }
    }

    // prepare evidence map for metadata enrichment
    const evidenceMap = {};
    (evidence || []).forEach(e => { evidenceMap[e.id] = { id: e.id, file_path: e.file_path, metadata: e.metadata }; });

    // If parsed, coerce and normalize
    let coerced = null;
    let validationErrors = [];
    if (parsed) {
      const { coerced: c, errors } = validateAndCoerce(parsed, evidenceMap);
      coerced = c;
      validationErrors = errors;
      // apply conservative clamp if there are no statements
      coerced = clampConfidenceIfNoStatements(coerced, hasStatements);
    }

    // Build insert row (always save rawText; save parsed/coerced if present)
    const timestamp = new Date().toISOString();
    const insertRow = {
      case_id,
      model: process.env.GENAI_MODEL || 'gemini-1.5-pro',
      raw_text: rawText,
      analysis: coerced || parsed || null,
      validation_errors: validationErrors.length ? validationErrors : null,
      created_at: timestamp
    };

    // ---------------------------
    // Insert and return only id (avoids schema cache column mismatch)
    // ---------------------------
    let savedId = null;
    let dbError = null;
    try {
      const { data: saved, error: saveError } = await supabase
        .from('ai_analysis')
        .insert([insertRow])
        .select('id')
        .single();

      if (saveError) {
        console.error('ai_analysis save error (detailed):', saveError);
        dbError = saveError;
        // Try insert without select as fallback (some RLS/permission setups don't allow select after insert)
        const { data: savedNoSelect, error: saveError2 } = await supabase.from('ai_analysis').insert([insertRow]);
        if (saveError2) {
          console.error('ai_analysis insert (no select) error:', saveError2);
          dbError = dbError || saveError2;
        } else {
          // try recover id by querying by created_at
          try {
            const { data: fetched, error: fetchErr } = await supabase.from('ai_analysis').select('id').eq('created_at', timestamp).limit(1).single();
            if (!fetchErr && fetched) savedId = fetched.id;
            if (fetchErr) {
              console.error('ai_analysis fetch by created_at error:', fetchErr);
              dbError = dbError || fetchErr;
            }
          } catch (qe) {
            console.error('ai_analysis fetch exception:', qe);
          }
        }
      } else {
        savedId = saved?.id || null;
      }
    } catch (errSave) {
      console.error('ai_analysis unexpected save exception:', errSave);
      dbError = dbError || errSave;
    }

    // Decide success
    // Relaxed: consider success if we have parsed/coerced analysis and savedId.
    const pipelineOk = !!((coerced || parsed) && savedId);

    // Return rich debug info during dev. If you want stricter production behavior, remove db_error and validation_errors.
    const responseObj = {
      ok: pipelineOk,
      analysis: coerced || parsed || null,
      saved_id: savedId,
      validation_errors: validationErrors.length ? validationErrors : null,
      db_error: dbError ? (dbError.message || dbError) : null
    };

    // If not pipelineOk, include raw_text for debugging and be explicit
    if (!pipelineOk) {
      responseObj.message = 'Pipeline incomplete: either parsing/validation failed or DB save failed. See validation_errors/db_error.';
      responseObj.raw = rawText;
      return res.status(200).json(responseObj);
    }

    return res.status(200).json(responseObj);

  } catch (err) {
    console.error('analyze err', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

module.exports = router;
