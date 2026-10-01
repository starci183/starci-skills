#!/usr/bin/env node
// check-work-citations.mjs — every citation of agent output in a product's Work records resolves in its ledger
// (alpha.3, ARCHITECTURE-DB §5.3; scripts/work/validate/work-citations.mjs).
//
//   node scripts/work/validate/check-work-citations.mjs --repo <repo> [--json]
//
// A Work record cites an artifact by {artifact: <id>, sha256}; this check reads every .starciwork yaml record, opens
// the project's runtime.sqlite read-only and reports CITATION_UNRESOLVED for a sha256 with no blob, an artifact id the
// ledger does not know, or an artifact that holds other bytes. Exit 0 clean, 1 on any finding, 2 on usage or a
// ledger it cannot open.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { ledgerFileFor, openLedgerReader } from '../../../engine/db/ledger.mjs';
import { citationsOf, resolveCitations } from './work-citations.mjs';
import { isMain } from '../../lib/is-main.mjs'; import { walkFiles } from '../../lib/walk.mjs';

const SKIP = new Set(['node_modules', '.git', '_derived']);

/** {ok, records, citations, findings:[{code, recordPath, field, sha256, artifactId, reason}]} over one repo. */
export function checkWorkCitations({ repo, db }) {
  const work = path.join(repo, '.starciwork');
  const files = fs.existsSync(work) ? walkFiles(work, { filter: (f) => /\.ya?ml$/i.test(f), exclude: (p) => SKIP.has(path.basename(p)) }) : [];
  let records = 0, citations = 0;
  const findings = [];
  for (const file of files) {
    let doc = null;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const cited = citationsOf(doc);
    if (!cited.length) continue;
    records += 1;
    citations += cited.length;
    const recordPath = path.relative(repo, file).replace(/\\/g, '/');
    for (const bad of resolveCitations(db, cited)) findings.push({ code: bad.code, recordPath, field: bad.field, sha256: bad.sha256, artifactId: bad.artifactId, reason: bad.reason });
  }
  return { ok: !findings.length, records, citations, findings };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--repo');
  const repo = i >= 0 ? argv[i + 1] : null;
  if (!repo) { console.error('usage: check-work-citations.mjs --repo <repo> [--json]'); process.exit(2); }
  let db;
  try { db = openLedgerReader(ledgerFileFor(path.resolve(repo))); }
  catch (error) { console.error(`check-work-citations: cannot open the ledger of ${repo}: ${error.message}`); process.exit(2); }
  try {
    const out = checkWorkCitations({ repo: path.resolve(repo), db });
    if (argv.includes('--json')) console.log(JSON.stringify(out));
    else {
      console.log(`check-work-citations: ${out.citations} citation(s) in ${out.records} record(s), ${out.findings.length} unresolved`);
      for (const f of out.findings) console.log(`  ${f.code} ${f.recordPath} ${f.field}: ${f.reason}`);
    }
    process.exitCode = out.ok ? 0 : 1;
  } finally { db.close(); }
}
