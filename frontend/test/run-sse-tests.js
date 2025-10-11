const assert = require('assert');
const path = require('path');
const { parseSSEChunk, extractEventText } = require(path.join(__dirname, '../src/lib/sseParser.cjs'));

function run() {
  console.log('Running simple SSE parser tests...');

  // test 1
  let { events, partial } = parseSSEChunk('', 'data: {"text":"hello"}\n\n');
  assert.strictEqual(partial, '');
  assert.strictEqual(events.length, 1);
  assert.strictEqual(extractEventText(events[0]), 'hello');

  // test 2 - chunked JSON
  let r1 = parseSSEChunk('', 'data: {"text":"hel');
  assert.strictEqual(r1.events.length, 0);
  let r2 = parseSSEChunk(r1.partial, 'lo"}\n\n');
  assert.strictEqual(r2.events.length, 1);
  assert.strictEqual(extractEventText(r2.events[0]), 'hello');

  // test 3 - multiple
  let m = parseSSEChunk('', 'data: {"text":"one"}\n\n' + 'data: {"text":"two"}\n\n');
  assert.strictEqual(m.events.length, 2);
  assert.strictEqual(extractEventText(m.events[0]), 'one');
  assert.strictEqual(extractEventText(m.events[1]), 'two');

  // test 4 - done
  let d = parseSSEChunk('', 'data: [DONE]\n\n');
  assert.strictEqual(d.events.length, 1);
  assert.strictEqual(extractEventText(d.events[0]), '');

  console.log('All simple SSE parser tests passed');
}

if (require.main === module) run();
