// PromptTemplates.js
// Small library of prompt templates and intent detection for AI chat

function detectIntent(message = '') {
  if (!message) return 'default';
  const m = message.toLowerCase();
  if (/summary|summarize|brief|overview/.test(m)) return 'summary';
  if (/settle|settlement|negotiate|offer|proposal|proposal(s)?/.test(m)) return 'settlement';
  if (/timeline|time|duration|how long|estimate/.test(m)) return 'timeline';
  if (/preceden|case law|case-law|case law|legal precedent|precedent(s)?/.test(m)) return 'precedent';
  if (/strength|strengths|weakness|weaknesses|risk|risks/.test(m)) return 'assessment';
  return 'default';
}

function _recentHistoryText(conversationHistory = []) {
  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) return '';
  // include last 6 messages to keep prompt compact
  const recent = conversationHistory.slice(-6).map((h) => `${h.role.toUpperCase()}: ${h.content}`).join('\n');
  return `Conversation history:\n${recent}\n\n`;
}

function buildSummaryPrompt(message, conversationHistory = [], caseId = null, language = 'en') {
  const langNote = language && language.toLowerCase() !== 'english'
    ? `Respond ONLY in ${language}. If you cannot respond in ${language}, reply in English. Do not include English translations or transliterations.\n\n`
    : '';
  return `${langNote}You are an expert legal analyst. Provide a concise summary and clear next steps for the user's request.\n\n${_recentHistoryText(conversationHistory)}User question: ${message}\n\nRespond with:\n- A 2-3 sentence summary\n- 3 practical next steps (numbered)\n- Any clarifying question if needed (prefixed with \"Q:\")\n\nKeep the tone professional and concise.`;
}

function buildSettlementPrompt(message, conversationHistory = [], caseId = null, language = 'en') {
  const langNote = language && language.toLowerCase() !== 'english'
    ? `Respond ONLY in ${language}. If you cannot respond in ${language}, reply in English. Do not include English translations or transliterations.\n\n`
    : '';
  return `${langNote}You are a negotiation specialist. Using the information below, propose 3 settlement options (Conservative, Balanced, Aggressive). For each option include:\n- Settlement amount (currency if known)\n- Payment terms\n- Non-monetary terms if applicable\n- Rationale and likelihood of acceptance (percentage)\n\n${_recentHistoryText(conversationHistory)}User context: ${message}\n\nFormat the response with numbered proposals and a short recommendation.`;
}

function buildTimelinePrompt(message, conversationHistory = [], caseId = null, language = 'en') {
  const langNote = language && language.toLowerCase() !== 'english'
    ? `Respond ONLY in ${language}. If you cannot respond in ${language}, reply in English. Do not include English translations or transliterations.\n\n`
    : '';
  return `${langNote}You are a legal process analyst. Provide a realistic timeline for the user's matter and explain each stage briefly.\n\n${_recentHistoryText(conversationHistory)}User question: ${message}\n\nReturn a concise timeline with estimated durations for each stage and a short recommendation.`;
}

function buildPrecedentPrompt(message, conversationHistory = [], caseId = null, language = 'en') {
  const langNote = language && language.toLowerCase() !== 'english'
    ? `Respond ONLY in ${language}. If you cannot respond in ${language}, reply in English. Do not include English translations or transliterations.\n\n`
    : '';
  return `${langNote}You are a legal researcher. Identify relevant precedents, statutes, or case law snippets that match the user's query.\n\n${_recentHistoryText(conversationHistory)}User request: ${message}\n\nIf you cannot find specific case names, provide guidance on search terms and jurisdictions to check. Keep answers concise and actionable.`;
}

function buildDefaultPrompt(message, conversationHistory = [], caseId = null, language = 'en') {
  const langNote = language && language.toLowerCase() !== 'english'
    ? `Respond ONLY in ${language}. If you cannot respond in ${language}, reply in English. Do not include English translations or transliterations.\n\n`
    : '';
  return `${langNote}You are an AI legal assistant. Help the user with clear, practical guidance.\n\n${_recentHistoryText(conversationHistory)}User: ${message}\n\nProvide a focused answer, suggested next steps, and ask any clarifying question if necessary.`;
}

module.exports = {
  detectIntent,
  buildSummaryPrompt,
  buildSettlementPrompt,
  buildTimelinePrompt,
  buildPrecedentPrompt,
  buildDefaultPrompt
};
