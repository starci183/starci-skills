#!/usr/bin/env node
// check-one-allowlist.mjs - the ONE allowlist law (RT_ALLOWLIST_SPRAWL; part of `npm run check`).
//   node scripts/checks/check-one-allowlist.mjs [--json]
//
// modules/kernel/allowlist.yaml (schema starci/allowlist@1, read through scripts/lib/allowlist.mjs) is the ONE explicit
// allowlist of the runtime: every exception a check keeps is a reasoned entry of one of its named sections and every
// section only shrinks. No second list file exists. This check refuses a git-tracked file whose NAME looks like one:
//   - *.pending, *.entries, *.not-codes      the list-file suffixes the runtime once carried
//   - *exceptions*.yaml                       a scoped exception list like the retired `json-exceptions.yaml`
//   - *baseline*.json / *.yaml / *.txt        a lint or scan baseline
//   - *allowlist*.yaml                        a second allowlist
// other than the allowlist itself, its schema file (modules/schemas/allowlist.schema.yaml) and the files of this check.
// The append-only contract history (modules/kernel/contract-changes/<id>.yaml) is the one directory outside the law's
// reach: a change id may name the mechanism it changed (a record about a baseline is not a baseline) and history keeps
// its names (scripts/checks/check-contract-cites.mjs). The second sprawl path is a bare list under scripts/checks/:
// no check loads a data file from the checks directory, so a tracked file there that is not check-<topic>.mjs is a
// list that belongs in the allowlist.
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { ALLOWLIST_FILE } from '../lib/allowlist.mjs';

export const ALLOWLIST_SCHEMA_FILE = 'modules/schemas/allowlist.schema.yaml';
const CHECK_FILES = Object.freeze(['scripts/checks/check-one-allowlist.mjs', 'tests/checks/check-one-allowlist.spec.mjs', 'scripts/lib/allowlist.mjs']);
/** Append-only contract history: a change id may name the mechanism it changed; its names are records, not lists. */
export const HISTORY_DIR = 'modules/kernel/contract-changes/';
const CHECKS_DIR = 'scripts/checks/';

/** The file-name forms of a stray allowlist, baseline or pending list, matched against the base name. */
const LIST_NAME = [
  /\.pending$/,
  /\.entries$/,
  /\.not-codes$/,
  /exceptions.*\.yaml$/,
  /baseline.*\.(?:json|yaml|txt)$/,
  /allowlist.*\.yaml$/,
];

/** The reason a tracked path looks like a stray list, or null. */
function sprawlReason(rel) {
  const name = path.posix.basename(rel);
  if (LIST_NAME.some((re) => re.test(name))) return `its name reads as an allowlist, baseline or list file`;
  if (rel.startsWith(CHECKS_DIR) && !name.endsWith('.mjs')) return `a bare list file under ${CHECKS_DIR} - a check carries no data file; the entries belong in ${ALLOWLIST_FILE}`;
  return null;
}

/** The sprawl findings of a tracked-file list: [{code, path, message}]. */
export function allowlistSprawlFindings(tracked) {
  const exempt = new Set([ALLOWLIST_FILE, ALLOWLIST_SCHEMA_FILE, ...CHECK_FILES]);
  const findings = [];
  for (const rel of tracked) {
    if (exempt.has(rel) || rel.startsWith(HISTORY_DIR)) continue;
    const why = sprawlReason(rel);
    if (why) findings.push({ code: 'RT_ALLOWLIST_SPRAWL', path: rel, message: `${rel} is a second allowlist, baseline or list file (${why}): move its entries, each with its reason, into the matching section of ${ALLOWLIST_FILE} and delete the file` });
  }
  return findings;
}

/** Run the check on the runtime at `root`. */
export function checkOneAllowlist(root = skillRoot) {
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter(Boolean);
  return allowlistSprawlFindings(tracked);
}

if (isMain(import.meta.url)) {
  const findings = checkOneAllowlist();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.message}`);
    if (!findings.length) console.log(`OK: ${ALLOWLIST_FILE} is the one allowlist of the runtime; no list file sprawls.`);
  }
  process.exit(findings.length ? 1 : 0);
}
