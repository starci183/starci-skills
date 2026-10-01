#!/usr/bin/env node
// check-db-openers.mjs — only the DB modules open a SQLite file (RESEARCH-STORAGE §3, DBTREE.sql header): runtime.sqlite
// through engine/ledger-db.mjs (the one writer, and openLedgerReader for readers), machine.sqlite through
// engine/machine-db.mjs. A land gate tree check (scripts/supervisor/land.mjs TREE_CHECKS): it scans every tracked .mjs
// outside tests/ for `new DatabaseSync` and fails on any file not allowed below.
//
//   node scripts/checks/check-db-openers.mjs [--root <tree>] [--json]
//
// PENDING names the files another alpha.3 lane still has to move onto a DB module; each is reported, never a failure,
// and a pending entry whose file no longer opens a database is itself a failure (so the list only shrinks).
// Exit 0 clean, 1 a forbidden opener or a stale pending entry, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGit } from '../lib/git.mjs';
import { GENERATED_MIRROR_ROOTS } from './check-json-exceptions.mjs';

export const DB_MODULES = Object.freeze(['engine/ledger-db.mjs', 'engine/machine-db.mjs']);
export const PENDING = Object.freeze({});
const OPENER = /\bnew\s+DatabaseSync\s*\(/;
/**
 * The runtime file a tracked path is: a generated mirror (packages/hfs/scripts/sync-runtime.mjs writes each bundle byte for
 * byte from the runtime, and `sync-runtime --check` fails on any drift) is the same module as its source, so a mirrored
 * engine/machine-db.mjs is the DB module, while a mirrored file that is not a DB module is judged like its source.
 */
export const sourceOf = (rel) => { for (const mirror of GENERATED_MIRROR_ROOTS) if (rel.startsWith(`${mirror}/`)) return rel.slice(mirror.length + 1); return rel; };
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

export function scanOpeners(root) {
  const listed = runGit(['ls-files', '*.mjs'], { cwd: root });
  const files = listed.status === 0 ? listed.stdout.split('\n').filter(Boolean) : [];
  const hits = [];
  for (const rel of files) {
    if (rel.startsWith('tests/') || rel.includes('node_modules/')) continue;
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    if (!OPENER.test(text)) continue;
    text.split('\n').forEach((line, i) => { if (OPENER.test(line) && !isComment(line)) hits.push({ file: rel, line: i + 1 }); });
  }
  const forbidden = hits.filter((h) => !DB_MODULES.includes(sourceOf(h.file)) && !PENDING[h.file]);
  const pending = Object.entries(PENDING).map(([file, owner]) => ({ file, owner, opens: hits.some((h) => h.file === file) }));
  const stale = pending.filter((p) => !p.opens);
  return { ok: forbidden.length === 0 && stale.length === 0, forbidden, pending: pending.filter((p) => p.opens), stale };
}

function main(argv) {
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), asJson = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = path.resolve(argv[++i] ?? '');
    else if (argv[i] === '--json') asJson = true;
    else { console.error(`unknown argument ${argv[i]}`); return 2; }
  }
  const r = scanOpeners(root);
  if (asJson) console.log(JSON.stringify(r, null, 2));
  else {
    for (const f of r.forbidden) console.log(`  ${f.file}:${f.line}  new DatabaseSync outside ${DB_MODULES.join(' / ')}`);
    for (const s of r.stale) console.log(`  ${s.file}  listed as pending but opens no database: drop it from PENDING`);
    for (const p of r.pending) console.log(`  pending ${p.file} (${p.owner})`);
    console.log(r.ok ? `check-db-openers: only ${DB_MODULES.join(' / ')} open SQLite (${r.pending.length} pending)` : 'check-db-openers: red');
  }
  return r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
