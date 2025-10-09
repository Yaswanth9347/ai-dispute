#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let inDollar = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];
    // detect start of dollar-quote: $tag$
    if (!inDollar && ch === '$') {
      // read tag
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        inDollar = true;
        dollarTag = match[0];
        current += match[0];
        i += match[0].length;
        continue;
      }
    }
    if (inDollar) {
      // detect end tag
      if (sql.slice(i, i + dollarTag.length) === dollarTag) {
        inDollar = false;
        current += dollarTag;
        i += dollarTag.length;
        continue;
      } else {
        current += ch;
        i++;
        continue;
      }
    }
    // not in dollar, check semicolon
    if (ch === ';') {
      statements.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim()) statements.push(current.trim());
  return statements.filter(s => s.length > 0);
}

(async ()=>{
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node execute_statements.js <path-to-sql-file>');
    process.exit(2);
  }
  const sql = await fs.readFile(target, 'utf8');
  const stmts = splitStatements(sql);
  console.log('Parsed', stmts.length, 'statements');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (let idx = 0; idx < stmts.length; idx++) {
      const stmt = stmts[idx];
      try {
        await client.query(stmt);
      } catch (e) {
        console.error('\nFailed at statement index', idx+1);
        console.error('Statement (first 400 chars):\n', stmt.slice(0,400));
        console.error('Error:', e && e.message ? e.message : e);
        process.exit(4);
      }
    }
    console.log('All statements applied successfully');
  } finally {
    await client.end();
  }
})();
