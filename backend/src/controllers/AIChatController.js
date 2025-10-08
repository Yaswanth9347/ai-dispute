const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/authMiddleware');

// Simple in-memory conversation store for dev/testing.
// Maps userId -> Array<{ role: 'user'|'assistant', content: string, timestamp: string }>
const conversationStore = new Map();

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

// AI Chat endpoint
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message, caseId, conversationHistory } = req.body;
    
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
    
    // Persist conversation in memory (dev only)
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const history = conversationStore.get(userId) || [];
      history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
      // merge any provided conversationHistory
      if (Array.isArray(conversationHistory) && conversationHistory.length) {
        for (const h of conversationHistory) {
          if (!h.role || !h.content) continue;
          history.push({ role: h.role, content: h.content, timestamp: new Date().toISOString() });
        }
      }
      // keep last 40 messages
      conversationStore.set(userId, history.slice(-40));
    } catch (e) {
      // don't fail if store update fails
      console.warn('Conversation store update failed', e.message || e);
    }

    // Simple keyword matching for demo
    const lowerMessage = message.toLowerCase();
    let response;
    
    if (lowerMessage.includes('strength')) {
      response = responses.strengths;
    } else if (lowerMessage.includes('precedent') || lowerMessage.includes('legal')) {
      response = responses.precedents;
    } else if (lowerMessage.includes('settlement') || lowerMessage.includes('option')) {
      response = responses.settlement;
    } else if (lowerMessage.includes('long') || lowerMessage.includes('timeline') || lowerMessage.includes('time')) {
      response = responses.timeline;
    } else {
      response = responses.default;
    }
    
    // Save assistant response to conversation store
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const history = conversationStore.get(userId) || [];
      history.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
      conversationStore.set(userId, history.slice(-40));
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

    if (lowerMessage.includes('strength')) {
      responseText = responses.strengths;
    } else if (lowerMessage.includes('precedent') || lowerMessage.includes('legal')) {
      responseText = responses.precedents;
    } else if (lowerMessage.includes('settlement') || lowerMessage.includes('option')) {
      responseText = responses.settlement;
    } else if (lowerMessage.includes('long') || lowerMessage.includes('timeline') || lowerMessage.includes('time')) {
      responseText = responses.timeline;
    } else {
      responseText = responses.default;
    }

    // Persist conversation in memory (dev only)
    try {
      const userId = req.user?.sub || req.user?.id || 'anon';
      const history = conversationStore.get(userId) || [];
      history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
      history.push({ role: 'assistant', content: responseText, timestamp: new Date().toISOString() });
      conversationStore.set(userId, history.slice(-40));
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

module.exports = router;
