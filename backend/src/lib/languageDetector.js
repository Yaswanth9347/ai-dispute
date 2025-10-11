// Simple language detector using script ranges and common word heuristics.
// This is lightweight and meant to provide a best-effort language code for
// prompting the AI to respond in the user's language. For production, consider
// using a proper language detection library or model call.

const langMap = {
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  en: 'English'
};

function detectLanguage(text) {
  if (!text || typeof text !== 'string') return { code: 'en', name: 'English' };

  // Quick common-word checks for Hindi/Bengali etc.
  const lower = text.toLowerCase();
  if (/[\u0900-\u097F]/.test(text) || /\b(है|मैं|आप|नमस्ते|क्या)\b/.test(lower)) return { code: 'hi', name: langMap.hi };
  if (/[\u0980-\u09FF]/.test(text) || /\b(আমি|আপনি|কী|হ্যাঁ)\b/.test(lower)) return { code: 'bn', name: langMap.bn };
  if (/[\u0B80-\u0BFF]/.test(text) || /\b(வணக்கம்|நான்|நீங்கள்|எப்படி)\b/.test(lower)) return { code: 'ta', name: langMap.ta };
  if (/[\u0C00-\u0C7F]/.test(text) || /\b(నేను|మీరు|హలో|ఎలా)\b/.test(lower)) return { code: 'te', name: langMap.te };
  if (/[\u0900-\u097F]/.test(text) && /\b(मी|आहे|नमस्कार)\b/.test(lower)) return { code: 'mr', name: langMap.mr };
  if (/[\u0A80-\u0AFF]/.test(text) || /\b(ਸਤਿ|ਤੁਸੀਂ|ਹਾਂ)\b/.test(lower)) return { code: 'pa', name: langMap.pa };
  if (/[\u0A80-\u0AFF]/.test(text) || /\b(નમસ્તે|હું|તમે)\b/.test(lower)) return { code: 'gu', name: langMap.gu };
  if (/[\u0C80-\u0CFF]/.test(text) || /\b(ನಾನು|ನಮಸ್ಕಾರ)\b/.test(lower)) return { code: 'kn', name: langMap.kn };
  if (/[\u0D00-\u0D7F]/.test(text) || /\b(ഞാൻ|നമസ്കാരം)\b/.test(lower)) return { code: 'ml', name: langMap.ml };

  // Basic Latin script — default to English
  if (/^[\x00-\x7F\s]+$/.test(text)) {
    // detect some other languages heuristically by common words
    if (/\b(bonjour|merci|monsieur|madame)\b/.test(lower)) return { code: 'fr', name: 'French' };
    if (/\b(hola|gracias|usted)\b/.test(lower)) return { code: 'es', name: 'Spanish' };

    // Heuristics for transliterated (Latin-script) Hindi and Telugu
    // Telugu common transliteration tokens: nenu, naaku, nuvvu, cheppalani, cheyandi, chesthunnanu, cheddham
    if (/\b(nenu|naaku|naku|nuvvu|nuvvu|cheppalani|cheyandi|chesthunnanu|chesthunnanu|chesta|chestha|chesthavaa|chesthava|cheddham|cheyyali|cheyyandi|case|file)\b/.test(lower)) {
      return { code: 'te', name: langMap.te };
    }

    // Hindi transliteration tokens: kya, hai, main, tum, aap, nahi, kya aap, dhanyavaad, shukriya
    if (/\b(kya|hai|main|tum|aap|nahi|kuch|kyon|kaise|dhanyavaad|shukriya|namaste)\b/.test(lower)) {
      return { code: 'hi', name: langMap.hi };
    }

    return { code: 'en', name: 'English' };
  }

  // Fallback
  return { code: 'en', name: 'English' };
}

module.exports = { detectLanguage, langMap };
