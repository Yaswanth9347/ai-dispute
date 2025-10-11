#!/usr/bin/env node
// Backwards-compatible server start script.
// Historically some projects start the server via src/bin/www.js — create a
// tiny shim that loads the main index.js server entry.
const path = require('path');
try {
  const entry = path.join(__dirname, '..', 'index');
  require(entry);
} catch (e) {
  console.error('Failed to start backend from src/bin/www.js:', e?.message || e);
  console.error(e?.stack || '');
  process.exit(1);
}
