// Lightweight SSE parser helper
// parseSSEChunk(partial, chunk) => { events: Array<{event?:string, data:string}>, partial }
export function parseSSEChunk(partialBuffer: string, chunkText: string) {
  const combined = (partialBuffer || '') + (chunkText || '');
  const events: Array<{ event?: string; data: string }> = [];

  // Normalize CRLF to LF
  let buf = combined.replace(/\r\n/g, '\n');

  // If the stream ends without a double newline, we keep trailing partial
  // We'll split by double newline which separates events. If the final
  // segment does not end with a separator, keep it as partial.
  const parts = buf.split('\n\n');

  // If the buffer ended with \n\n, last part is '', so all parts are complete
  const lastIndex = parts.length - 1;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === lastIndex && !buf.endsWith('\n\n')) {
      // incomplete event; return as partial
      return { events, partial: part };
    }

    if (!part || !part.trim()) continue;

    // Each part can contain multiple lines like "event: done" and "data: {...}".
    const lines = part.split('\n');
    let eventType: string | undefined = undefined;
    const dataLines: string[] = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('event:')) {
        eventType = line.replace(/^event:\s?/, '').trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.replace(/^data:\s?/, ''));
      } else if (line === '[DONE]') {
        // Some servers send bare [DONE]
        dataLines.push('[DONE]');
      } else if (line) {
        // Accept raw lines as data too
        dataLines.push(line);
      }
    }

    const data = dataLines.join('\n');
    events.push({ event: eventType, data });
  }

  return { events, partial: '' };
}

// Helper to extract a string payload from an SSE event (handles JSON and raw)
export function extractEventText(ev: { event?: string; data: string }) {
  if (!ev || !ev.data) return '';
  const d = ev.data.trim();
  if (!d) return '';
  // Handle special markers
  if (d === '[DONE]') return ''; // end marker

  // Try parse JSON
  try {
    const parsed = JSON.parse(d);
    if (typeof parsed === 'string') return parsed;
    if (parsed?.text) return parsed.text;
    if (parsed?.content) return parsed.content;
    // fallback to full string
    return JSON.stringify(parsed);
  } catch (e) {
    // Not JSON — return raw
    return d.replace(/\\n/g, '\n');
  }
}
