#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('pg');

async function listSqlFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.sql'))
      .map(e => path.join(dir, e.name))
      .sort();
  } catch (e) {
    return [];
  }
}

(async () => {
  const backendSqlDir = path.resolve(__dirname, '../sql');
  const rootSqlDir = path.resolve(__dirname, '../../sql');
  const candidates = [];

  const backendFiles = await listSqlFiles(backendSqlDir);
  const rootFiles = await listSqlFiles(rootSqlDir);

  if (rootFiles.length) {
    console.log('Found root sql files:', rootFiles.map(f=>path.basename(f)).join(', '));
    candidates.push(...rootFiles);
  }
  if (backendFiles.length) {
    console.log('Found backend sql files:', backendFiles.map(f=>path.basename(f)).join(', '));
    candidates.push(...backendFiles);
  }

  if (candidates.length === 0) {
    console.error('No SQL files found in', rootSqlDir, 'or', backendSqlDir);
    process.exit(2);
  }

  // Ensure deterministic order:
  // 1) If supabase_schema.sql exists, run it first (base tables)
  // 2) Then run numeric-prefixed files in ascending order
  // 3) Finally any remaining files in alphabetical order
  const baseNameMap = uniq = Array.from(new Set(candidates));
  const supabaseIndex = baseNameMap.findIndex(p => path.basename(p).toLowerCase().includes('supabase_schema'));
  const supabaseFiles = supabaseIndex >= 0 ? [baseNameMap.splice(supabaseIndex,1)[0]] : [];
  // numeric-prefixed
  const numeric = baseNameMap.filter(p => /^\\d+_/.test(path.basename(p))).sort((a,b)=> path.basename(a).localeCompare(path.basename(b), undefined, {numeric:true}));
  const others = baseNameMap.filter(p => !numeric.includes(p)).sort((a,b)=> path.basename(a).localeCompare(path.basename(b), undefined, {numeric:true}));
  const uniqOrdered = [...supabaseFiles, ...numeric, ...others];

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set in env. Aborting.');
    process.exit(3);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    for (const filePath of uniqOrdered) {
      console.log('\n--- Applying', path.basename(filePath), '---');
      const sql = await fs.readFile(filePath, 'utf8');
        // Preflight: If applying the 05_extend file, ensure core cases columns exist so index/alter commands won't fail
        if (path.basename(filePath).toLowerCase().includes('05_extend_ai_dispute_resolver_schema')) {
          console.log('🔎 Preflight: ensuring core `cases` columns exist (status, filed_by, title, created_at, dispute_amount, currency)');
          const preflightSql = `ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';\nALTER TABLE public.cases ADD COLUMN IF NOT EXISTS filed_by UUID REFERENCES public.users(id);\nALTER TABLE public.cases ADD COLUMN IF NOT EXISTS title TEXT;\nALTER TABLE public.cases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();\nALTER TABLE public.cases ADD COLUMN IF NOT EXISTS dispute_amount DECIMAL(12,2);\nALTER TABLE public.cases ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';`;
          try {
            await client.query(preflightSql);
            console.log('✅ Preflight alterations applied');
          } catch (pfErr) {
            console.warn('⚠️ Preflight failed (continuing):', pfErr && pfErr.message ? pfErr.message : pfErr);
          }
        }
      try {
        await client.query(sql);
        console.log('✅ Applied', path.basename(filePath));
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        // Non-fatal: already exists / duplicate object errors -- log and continue
        if (/already exists|duplicate|relation .* already exists|function .* already exists/i.test(msg)) {
          console.warn('⚠️ Non-fatal SQL error (skipping):', msg.split('\n')[0]);
          continue;
        }
        console.error('❌ Failed applying', path.basename(filePath));
        console.error('Error message:', msg);
        console.error('Failing SQL file path:', filePath);
        // Stop on first blocking error so we can inspect and fix
        process.exit(4);
      }
    }
    console.log('\nAll SQL files applied successfully.');
  } finally {
    await client.end();
  }
})();
