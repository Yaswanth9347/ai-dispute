import { describe, it, expect } from 'vitest';
import { parseSSEChunk, extractEventText } from '@/lib/sseParser';

describe('SSE Parser', () => {
  it('parses single complete event with JSON data', () => {
    const chunk = 'data: {"text":"hello"}\n\n';
    const { events, partial } = parseSSEChunk('', chunk);
    expect(partial).toBe('');
    expect(events.length).toBe(1);
    expect(extractEventText(events[0])).toBe('hello');
  });

  it('handles chunked JSON across boundaries', () => {
    const part1 = 'data: {"text":"hel';
    const part2 = 'lo"}\n\n';
    let res = parseSSEChunk('', part1);
    expect(res.events.length).toBe(0);
    const res2 = parseSSEChunk(res.partial, part2);
    expect(res2.events.length).toBe(1);
    expect(extractEventText(res2.events[0])).toBe('hello');
  });

  it('parses multiple events in one chunk', () => {
    const chunk = 'data: {"text":"one"}\n\n' + 'data: {"text":"two"}\n\n';
    const { events } = parseSSEChunk('', chunk);
    expect(events.length).toBe(2);
    expect(extractEventText(events[0])).toBe('one');
    expect(extractEventText(events[1])).toBe('two');
  });

  it('handles [DONE] marker', () => {
    const chunk = 'data: [DONE]\n\n';
    const { events } = parseSSEChunk('', chunk);
    expect(events.length).toBe(1);
    expect(extractEventText(events[0])).toBe('');
  });
});
