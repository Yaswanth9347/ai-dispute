// backend/src/routes/analyze.js
const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabaseClient');
const { GoogleGenAI } = require('@google/genai'); // correct package / class
require('dotenv').config();

// init client (single instance)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
});

async function callModel(prompt) {
  // ai.models.generateContent is the usual method for text generation
  const resp = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    // config: { maxOutputTokens: 800 } // optional config depending on SDK version
  });
  // defensive extraction of text (SDK versions vary)
  return (
    resp?.text ??
    (resp?.output && resp.output[0] && resp.output[0].content && resp.output[0].content[0] && resp.output[0].content[0].text) ??
    JSON.stringify(resp)
  );
}

// POST /api/analyze
// body: { case_id: "uuid" }
router.post('/', async (req, res) => {
  const { case_id } = req.body;
  if (!case_id) return res.status(400).json({ error: 'missing case_id' });

  try {
    // fetch statements / evidence / case row
    const { data: statements } = await supabase.from('statements').select('*').eq('case_id', case_id);
    const { data: evidence } = await supabase.from('evidence').select('*').eq('case_id', case_id);
    const { data: caseRow } = await supabase.from('cases').select('*').eq('id', case_id).single();

    const promptBase = [
      `You are a legal-aid assistant for low-value civil disputes in India.`,
      `Case title: ${caseRow?.title || 'Untitled'}`,
      `Facts (from parties):\n${(statements || []).map(s => `- ${s.user_id}: ${s.text}`).join('\n')}`,
      `Evidence summary (filenames & sha256):\n${(evidence || []).map(e => `- ${e.file_path} (sha256:${e.sha256})`).join('\n')}`,
      `Task: Provide top 3 fair settlement options, each with short rationale (2-3 lines), and a 'confidence' score (0-100). Keep answers concise.`
    ].join('\n\n');

    const text = await callModel(promptBase);

    // persist analysis into ai_analysis table
    const { data, error } = await supabase
      .from('ai_analysis')
      .insert([{ case_id, model: 'gemini-1.5-pro', analysis: { text } }])
      .select()
      .single();

    if (error) console.warn('save analysis error', error);

    res.json({ analysis: text });
  } catch (err) {
    console.error('genai err', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

module.exports = router;
