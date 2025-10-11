const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/authMiddleware');

// Simple in-memory conversation store for dev/testing.
// Maps userId -> { history: Array<{ role, content, timestamp }>, language: 'English' }
const conversationStore = new Map();
let persistentStore = null;
try {
  persistentStore = require('../lib/persistentConversationStore');
} catch (e) {
  persistentStore = null;
}

// Simple PII detectors (email + Indian phone numbers)
function detectPIIInText(text) {
  if (!text || typeof text !== 'string') return [];
  const findings = [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+91|91|0)?[6-9]\d{9}/g; // basic India mobile pattern

  const emails = text.match(emailRegex) || [];
  const phones = text.match(phoneRegex) || [];

  for (const e of emails) findings.push({ type: 'email', match: e });
  for (const p of phones) findings.push({ type: 'phone', match: p });

  return findings;
}

function detectPIIInMessages(messages) {
  const allFindings = [];
  if (!messages) return allFindings;
  for (const m of messages) {
    const text = m?.content || m;
    const f = detectPIIInText(text);
    if (f.length) {
      allFindings.push(...f.map(x => ({ ...x, source: text })));
    }
  }
  return allFindings;
}

// Try to load GeminiService if running with API key available
let GeminiService = null;
try {
  // require lazily; the service constructor can throw if API key missing
  GeminiService = require('../services/GeminiService');
} catch (e) {
  GeminiService = null;
}

const PromptTemplates = require('../services/PromptTemplates');
const { detectLanguage } = require('../lib/languageDetector');
const TemplateTranslations = require('../services/TemplateTranslations');

// AI Chat endpoint
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, caseId, conversationHistory } = req.body;
    console.info('[AIChat] /chat received message:', message?.slice?.(0,200));
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // In production, integrate with OpenAI/Claude/other AI service
    // For now, return a mock response
    
    const responses = {
      "strengths": "Based on my analysis, your case has several strong points:\n\n1. **Clear Documentation**: You have substantial evidence supporting your claims.\n2. **Legal Precedent**: Similar cases have ruled in favor of plaintiffs in this jurisdiction.\n3. **Timeline**: Your prompt action strengthens your position.\n4. **Witness Testimony**: Multiple witnesses corroborate your account.\n\nI recommend proceeding with settlement negotiations while maintaining this strong position.",
      
      "precedents": "Relevant legal precedents for your case include:\n\n1. **Smith v. Jones (2022)**: Established similar liability standards\n2. **Brown v. County (2021)**: Set damages framework for comparable cases\n3. **State v. Corporation (2020)**: Clarified duty of care requirements\n\nThese precedents generally favor your position and could strengthen settlement negotiations.",
      
      "settlement": "Settlement options to consider:\n\n1. **Full Compensation**: Demand 100% of claimed damages ($50,000)\n2. **Reduced Settlement**: Accept 75% ($37,500) for quicker resolution\n3. **Structured Payment**: Monthly payments over 12-24 months\n4. **Non-Monetary Terms**: Include future preventive measures\n\nGiven the strength of your case, I'd recommend starting with option 1 and being willing to negotiate to option 2.",
      
      "timeline": "Expected timeline for your case:\n\n1. **Discovery Phase**: 2-3 months for evidence exchange\n2. **Mediation**: 1-2 months for settlement discussions\n3. **Trial Preparation**: 2-3 months if settlement fails\n4. **Trial**: 1-2 weeks of court time\n5. **Appeals**: 6-12 months if either party appeals\n\n**Total Estimate**: 6-8 months for settlement, 12-18 months for full trial.\n\nI recommend pursuing settlement to save time and costs.",
      
      "default": `I understand your question about "${message}". Based on the ${caseId ? 'case details' : 'information provided'}, here's my analysis:\n\nYour situation involves important legal considerations that require careful examination. ${conversationHistory && conversationHistory.length > 2 ? 'Building on our previous discussion, ' : ''}I recommend:\n\n1. **Document Everything**: Keep detailed records of all interactions\n2. **Consider Mediation**: Often faster and less costly than litigation\n3. **Know Your Rights**: Familiarize yourself with relevant laws\n4. **Seek Resolution**: Focus on practical solutions\n\nWould you like me to elaborate on any specific aspect?`
    };
    
    // Persist conversation in memory (dev only) and manage per-user language
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      // prefer persistent store if available
      const store = conversationStore.get(userId) || (persistentStore ? persistentStore.get(userId) : null) || { history: [], language: 'English' };

      // push user message
      store.history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

      // merge any provided conversationHistory
      if (Array.isArray(conversationHistory) && conversationHistory.length) {
        for (const h of conversationHistory) {
          if (!h.role || !h.content) continue;
          store.history.push({ role: h.role, content: h.content, timestamp: new Date().toISOString() });
        }
      }

      // If user language not set and message is non-English, set conversation language
      try {
        const detected = detectLanguage(message);
        if (detected && detected.name && detected.name.toLowerCase() !== 'english') {
          // set language if the conversation is still default English
          if (!store.language || store.language === 'English') {
            store.language = detected.name;
          }
        }
      } catch (e) {
        // ignore detection errors
      }

      // keep last 40 messages
      store.history = store.history.slice(-40);
      conversationStore.set(userId, store);
      if (persistentStore) persistentStore.set(userId, store);
    } catch (e) {
      // don't fail if store update fails
      console.warn('Conversation store update failed', e.message || e);
    }

    // Prefer real AI if available
    let response = responses.default;
    const lowerMessage = (message || '').toLowerCase();

    // If GeminiService is configured, build a templated prompt with detected intent
    // determine conversation language: prefer stored language, else detect from message
    let lang;
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const store = conversationStore.get(userId) || (persistentStore ? persistentStore.get(userId) : null) || { history: [], language: 'English' };
      if (store.language) {
        lang = { name: store.language, code: store.language.slice(0,2).toLowerCase() };
      } else {
        lang = detectLanguage(message) || { code: 'en', name: 'English' };
        if (lang && lang.name && lang.name.toLowerCase() !== 'english') {
          store.language = lang.name;
          conversationStore.set(userId, store);
          if (persistentStore) persistentStore.set(userId, store);
        }
      }
    } catch (e) {
      console.warn('[AIChat] language detection failed, defaulting to English', e?.message || e);
      lang = { code: 'en', name: 'English' };
    }

    if (GeminiService && process.env.GOOGLE_API_KEY) {
      try {
        const intent = PromptTemplates.detectIntent(message);
        let prompt;
        switch (intent) {
          case 'summary':
            prompt = PromptTemplates.buildSummaryPrompt(message, conversationHistory, caseId, lang?.name || 'English');
            break;
          case 'settlement':
            prompt = PromptTemplates.buildSettlementPrompt(message, conversationHistory, caseId, lang?.name || 'English');
            break;
          case 'timeline':
            prompt = PromptTemplates.buildTimelinePrompt(message, conversationHistory, caseId, lang?.name || 'English');
            break;
          case 'precedent':
            prompt = PromptTemplates.buildPrecedentPrompt(message, conversationHistory, caseId, lang?.name || 'English');
            break;
          default:
            prompt = PromptTemplates.buildDefaultPrompt(message, conversationHistory, caseId, lang?.name || 'English');
        }

        console.debug('[AIChat] prompt built for intent', intent, 'lang', lang?.name);
        console.info('[AIChat] invoking GeminiService.generateResponse...');
        const aiResp = await GeminiService.generateResponse(prompt, { temperature: 0.3, maxOutputTokens: 1500 });
        console.info('[AIChat] GeminiService response:', { success: aiResp?.success, length: aiResp?.content?.length || 0 });
        if (aiResp && aiResp.success && aiResp.content) {
          // show a short snippet in debug logs to inspect language
          console.debug('[AIChat] aiResp snippet:', aiResp.content.slice?.(0,200));
          response = aiResp.content;
        }
      } catch (e) {
        // fall back to keyword responder below
        console.warn('GeminiService failed, falling back to rule-based responder', e?.message || e);
      }
    }

    // If response still default or Gemini not available, use enhanced keyword matching
    if (!response || response === responses.default) {
      if (lowerMessage.includes('strength')) {
        response = responses.strengths;
      } else if (lowerMessage.includes('precedent') || lowerMessage.includes('legal') || lowerMessage.includes('case law')) {
        response = responses.precedents;
      } else if (lowerMessage.includes('settlement') || lowerMessage.includes('option') || lowerMessage.includes('negotiate')) {
        response = responses.settlement;
      } else if (lowerMessage.includes('long') || lowerMessage.includes('timeline') || lowerMessage.includes('time') || lowerMessage.includes('duration')) {
        response = responses.timeline;
      }
    }

    // If we still don't have a response and conversation language is non-English,
    // try to return a translated template as a fallback.
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const store = conversationStore.get(userId) || { history: [], language: 'English' };
      const langCode = (store.language || 'English').toLowerCase().startsWith('hi') ? 'hi'
        : (store.language || 'English').toLowerCase().startsWith('te') ? 'te' : null;
      if (langCode && TemplateTranslations[langCode]) {
        // Map which template to use
        let key = 'default';
        if (response === responses.strengths) key = 'strengths';
        else if (response === responses.precedents) key = 'precedents';
        else if (response === responses.settlement) key = 'settlement';
        else if (response === responses.timeline) key = 'timeline';
        // interpolate message into default template
        let t = TemplateTranslations[langCode][key] || TemplateTranslations[langCode].default;
        t = t.replace('{message}', message || '');
        response = t;
      }
    } catch (e) {
      // ignore translation errors
    }
    
      // Save assistant response to conversation store
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const store = conversationStore.get(userId) || (persistentStore ? persistentStore.get(userId) : null) || { history: [], language: 'English' };
      store.history.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
      store.history = store.history.slice(-200);
      conversationStore.set(userId, store);
      if (persistentStore) persistentStore.set(userId, store);
    } catch (e) {
      // ignore
    }

    res.json({
      success: true,
      data: {
        response,
        confidence: 0.87,
        sources: [
          'Legal precedent database',
          'Case law analysis',
          'Settlement statistics'
        ]
      }
    });
    
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Streaming chat endpoint (SSE) with lightweight PII detection.
// POST /api/ai/stream
router.post('/stream', requireAuth, async (req, res) => {
  try {
    const { message, caseId, conversationHistory, allowPII } = req.body || {};
    console.info('[AIChat] /stream received message:', message?.slice?.(0,200));

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Detect PII across the user message and conversation history
    const findings = detectPIIInMessages([message].concat(conversationHistory || []));
    if (findings.length && !allowPII) {
      return res.status(400).json({ success: false, error: 'PII_DETECTED', data: { findings } });
    }

  // Reuse same lightweight responder logic from /chat
  const lowerMessage = (message || '').toLowerCase();
  let responseText = '';
  // copy of the responses map from /chat
  const responses = {
      "strengths": "Based on my analysis, your case has several strong points:\n\n1. **Clear Documentation**: You have substantial evidence supporting your claims.\n2. **Legal Precedent**: Similar cases have ruled in favor of plaintiffs in this jurisdiction.\n3. **Timeline**: Your prompt action strengthens your position.\n4. **Witness Testimony**: Multiple witnesses corroborate your account.\n\nI recommend proceeding with settlement negotiations while maintaining this strong position.",
      
      "precedents": "Relevant legal precedents for your case include:\n\n1. **Smith v. Jones (2022)**: Established similar liability standards\n2. **Brown v. County (2021)**: Set damages framework for comparable cases\n3. **State v. Corporation (2020)**: Clarified duty of care requirements\n\nThese precedents generally favor your position and could strengthen settlement negotiations.",
      
      "settlement": "Settlement options to consider:\n\n1. **Full Compensation**: Demand 100% of claimed damages ($50,000)\n2. **Reduced Settlement**: Accept 75% ($37,500) for quicker resolution\n3. **Structured Payment**: Monthly payments over 12-24 months\n4. **Non-Monetary Terms**: Include future preventive measures\n\nGiven the strength of your case, I'd recommend starting with option 1 and being willing to negotiate to option 2.",
      
  "timeline": "Expected timeline for your case:\n\n1. **Discovery Phase**: 2-3 months for evidence exchange\n2. **Mediation**: 1-2 months for settlement discussions\n3. **Trial Preparation**: 2-3 months if settlement fails\n4. **Trial**: 1-2 weeks of court time\n5. **Appeals**: 6-12 months if either party appeals\n\n**Total Estimate**: 6-8 months for settlement, 12-18 months for full trial.\n\nI recommend pursuing settlement to save time and costs.",
      
      "default": `I understand your question about "${message}". Based on the ${caseId ? 'case details' : 'information provided'}, here's my analysis:\n\nYour situation involves important legal considerations that require careful examination. ${conversationHistory && conversationHistory.length > 2 ? 'Building on our previous discussion, ' : ''}I recommend:\n\n1. **Document Everything**: Keep detailed records of all interactions\n2. **Consider Mediation**: Often faster and less costly than litigation\n3. **Know Your Rights**: Familiarize yourself with relevant laws\n4. **Seek Resolution**: Focus on practical solutions\n\nWould you like me to elaborate on any specific aspect?`
    };

    // If GeminiService is configured, ask it for a contextual reply, else use keyword responder
    // determine conversation language: prefer stored language, else detect from message
    let lang;
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const store = conversationStore.get(userId) || (persistentStore ? persistentStore.get(userId) : null) || { history: [], language: 'English' };
      if (store.language) {
        lang = { name: store.language, code: store.language.slice(0,2).toLowerCase() };
      } else {
        lang = detectLanguage(message) || { code: 'en', name: 'English' };
        if (lang && lang.name && lang.name.toLowerCase() !== 'english') {
          store.language = lang.name;
          conversationStore.set(userId, store);
          if (persistentStore) persistentStore.set(userId, store);
        }
      }
    } catch (e) {
      console.warn('[AIChat] language detection failed (stream), defaulting to English', e?.message || e);
      lang = { code: 'en', name: 'English' };
    }

    if (GeminiService && process.env.GOOGLE_API_KEY) {
      try {
        const intent = PromptTemplates.detectIntent(message);
        let prompt;
        switch (intent) {
          case 'summary':
            prompt = PromptTemplates.buildSummaryPrompt(message, conversationHistory, caseId, lang?.name || 'English');
            break;
          case 'settlement':
            prompt = PromptTemplates.buildSettlementPrompt(message, conversationHistory, caseId, lang?.name || 'English');
            break;
          case 'timeline':
            prompt = PromptTemplates.buildTimelinePrompt(message, conversationHistory, caseId, lang?.name || 'English');
            break;
          case 'precedent':
            prompt = PromptTemplates.buildPrecedentPrompt(message, conversationHistory, caseId, lang?.name || 'English');
            break;
          default:
            prompt = PromptTemplates.buildDefaultPrompt(message, conversationHistory, caseId, lang?.name || 'English');
        }

        console.debug('[AIChat] prompt built for intent', intent, 'lang', lang?.name);
        console.info('[AIChat] invoking GeminiService.generateResponse (stream)...');
        const aiResp = await GeminiService.generateResponse(prompt, { temperature: 0.3, maxOutputTokens: 2500 });
        console.info('[AIChat] GeminiService (stream) response:', { success: aiResp?.success, length: aiResp?.content?.length || 0 });
        if (aiResp && aiResp.success && aiResp.content) {
          console.debug('[AIChat] aiResp (stream) snippet:', aiResp.content.slice?.(0,200));
          responseText = aiResp.content;
        }
      } catch (e) {
        console.warn('GeminiService streaming failed, falling back to rule-based responder', e?.message || e);
      }
    }

    if (!responseText) {
      if (lowerMessage.includes('strength')) {
        responseText = responses.strengths;
      } else if (lowerMessage.includes('precedent') || lowerMessage.includes('legal') || lowerMessage.includes('case law')) {
        responseText = responses.precedents;
      } else if (lowerMessage.includes('settlement') || lowerMessage.includes('option') || lowerMessage.includes('negotiate')) {
        responseText = responses.settlement;
      } else if (lowerMessage.includes('long') || lowerMessage.includes('timeline') || lowerMessage.includes('time') || lowerMessage.includes('duration')) {
        responseText = responses.timeline;
      } else {
        responseText = responses.default;
      }
    }

    // Try translated fallback if conversation language is non-English
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const store = conversationStore.get(userId) || { history: [], language: 'English' };
      const langCode = (store.language || 'English').toLowerCase().startsWith('hi') ? 'hi'
        : (store.language || 'English').toLowerCase().startsWith('te') ? 'te' : null;
      if (langCode && TemplateTranslations[langCode]) {
        let key = 'default';
        if (responseText === responses.strengths) key = 'strengths';
        else if (responseText === responses.precedents) key = 'precedents';
        else if (responseText === responses.settlement) key = 'settlement';
        else if (responseText === responses.timeline) key = 'timeline';
        let t = TemplateTranslations[langCode][key] || TemplateTranslations[langCode].default;
        t = t.replace('{message}', message || '');
        responseText = t;
      }
    } catch (e) {
      // ignore
    }

    // Persist conversation in memory (dev only)
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const store = conversationStore.get(userId) || (persistentStore ? persistentStore.get(userId) : null) || { history: [], language: 'English' };
      store.history = store.history || [];
      store.history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
      store.history.push({ role: 'assistant', content: responseText, timestamp: new Date().toISOString() });
      store.history = store.history.slice(-200);
      conversationStore.set(userId, store);
      if (persistentStore) persistentStore.set(userId, store);
    } catch (e) {
      // don't fail if store update fails
      console.warn('Conversation store update failed', e.message || e);
    }

    // Stream the response using SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    // Helper to sleep
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Break responseText into manageable chunks (by sentences or by length)
    const chunks = [];
    // split by sentences heuristically
    const sentenceParts = responseText.split(/(?<=[\.\?\!])\s+/);
    for (const s of sentenceParts) {
      if (!s) continue;
      // further split long sentences
      if (s.length > 300) {
        for (let i = 0; i < s.length; i += 200) {
          chunks.push(s.slice(i, i + 200));
        }
      } else {
        chunks.push(s);
      }
    }

    // Send chunks with a small delay to emulate streaming tokens
    (async () => {
      for (const chunk of chunks) {
        // SSE data: <chunk>\n\n
        try {
          res.write(`data: ${chunk.replace(/\n/g, '\\n')}\n\n`);
        } catch (e) {
          // client disconnected
          break;
        }
        await sleep(60);
      }

      // final event
      try {
        res.write('event: done\n\n');
      } catch (e) {
        // ignore
      }
      try {
        res.end();
      } catch (e) {
        // ignore
      }
    })();

  } catch (error) {
    console.error('Error in AI chat stream:', error);
    // If headers already sent, just end
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      try { res.end(); } catch (e) {}
    }
  }
});

// Analyze evidence (used by Evidence Upload component)
router.post('/analyze-evidence', requireAuth, async (req, res) => {
  try {
    const { evidenceId, fileUrl, fileName } = req.body;
    
    // In production, integrate with AI service for actual analysis
    // For now, return mock analysis
    
    const analysisResults = {
      relevanceScore: Math.floor(Math.random() * 30) + 70, // 70-100
      summary: `Document "${fileName}" contains important information relevant to the case. Key points have been extracted and categorized.`,
      keyPoints: [
        'Document establishes timeline of events',
        'Contains statements from involved parties',
        'Provides supporting evidence for claims',
        'Identifies potential witnesses'
      ],
      extractedText: `This is a sample of extracted text from ${fileName}. In production, this would contain actual OCR results and document content analysis.`,
      categories: ['Evidence', 'Testimony', 'Documentation'],
      confidence: 0.92
    };
    
    res.json({
      success: true,
      data: analysisResults
    });
    
  } catch (error) {
    console.error('Error analyzing evidence:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current conversation for the authenticated user
router.get('/conversation', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.sub || req.user?.id || 'anon';
    const store = conversationStore.get(userId) || (persistentStore ? persistentStore.get(userId) : null) || { history: [], language: 'English' };
    res.json({ success: true, data: store });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || e });
  }
});

// Clear conversation for the authenticated user (reset memory)
router.delete('/conversation', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.sub || req.user?.id || 'anon';
    conversationStore.delete(userId);
    if (persistentStore) persistentStore.clear(userId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e?.message || e });
  }
});

module.exports = router;

