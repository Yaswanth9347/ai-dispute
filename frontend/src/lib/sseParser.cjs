// CommonJS wrapper for sseParser to allow running tests with plain node
function parseSSEChunk(partialBuffer, chunkText) {
  const combined = (partialBuffer || '') + (chunkText || '');
  const events = [];
  let buf = combined.replace(/\r\n/g, '\n');
  const parts = buf.split('\n\n');
  const lastIndex = parts.length - 1;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === lastIndex && !buf.endsWith('\n\n')) {
      return { events, partial: part };
    }
    if (!part || !part.trim()) continue;
    const lines = part.split('\n');
    let eventType = undefined;
    const dataLines = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('event:')) {
        eventType = line.replace(/^event:\s?/, '').trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.replace(/^data:\s?/, ''));
      } else if (line === '[DONE]') {
        dataLines.push('[DONE]');
      } else if (line) {
        dataLines.push(line);
      }
    }
    const data = dataLines.join('\n');
    events.push({ event: eventType, data });
  }
  return { events, partial: '' };
}

function extractEventText(ev) {
  if (!ev || !ev.data) return '';
  const d = ev.data.trim();
  if (!d) return '';
  if (d === '[DONE]') return '';
  try {
    const parsed = JSON.parse(d);
    if (typeof parsed === 'string') return parsed;
    if (parsed && parsed.text) return parsed.text;
    if (parsed && parsed.content) return parsed.content;
    return JSON.stringify(parsed);
  } catch (e) {
    return d.replace(/\\n/g, '\n');
  }
}

module.exports = { parseSSEChunk, extractEventText };
