#!/usr/bin/env node
// check-worktree-rm.mjs — the runtime removes an Orca worktree in exactly one place. Orca walks a junction and deletes what it
// leads to (measured by tests/api-orca/orca-worktree-rm-live.spec.mjs, registry entry orca-worktree-rm-walks-junctions-measured),
// so every removal unlinks every link first: scripts/machine/worktree-orca.mjs removeOrcaWorktree does that and then asks Orca
// through scripts/api/orca/worktree-rm.mjs worktreeRm, which itself refuses a tree that still holds a link. A tracked script outside
// tests/ that imports the call file, calls the `worktree-rm` host call, or spells `orca worktree rm` as an argument list or a
// shell command - anywhere but those two files - is red (git's own `worktree remove` is scripts/machine/worktree-git.mjs's). Part of `npm run check` and the land gate's tree checks.
//
//   starci runtime check --only worktree-rm -- [--root <tree>] [--json]
// Exit 0 clean, 1 a stray removal, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lsFiles } from '../api/git/ls-files.mjs';
import { isMain } from '../lib/is-main.mjs';

const CALL_FILE = 'scripts/api/orca/worktree-rm.mjs';
const OWNER = 'scripts/machine/worktree-orca.mjs';
const EXTENSIONS = /\.(?:mjs|cjs|js|ts|ps1|sh)$/;
const IMPORT_FORM = /\bfrom\s+['"][^'"]*worktree-rm\.mjs['"]|\bimport\s*\(\s*['"][^'"]*worktree-rm\.mjs['"]/;
const CALL_FORM = /\borcaCall\s*\(\s*['"`]worktree-rm['"`]/;
const ARGV_FORM = /['"`]worktree['"`]\s*,\s*['"`]rm['"`]/;
const SHELL_PREFIX = /(?:^|['"`]|&&|;|\|\|)\s*orca/;
const SHELL_FORM = new RegExp(String.raw`${SHELL_PREFIX.source}(?:\s+--?[\w-]+)*\s+worktree\s+(?:rm|remove)\b`);
const SHELL_CALL = /\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\s*\(|\bshell\s*:/;
const SHELL_SCRIPT = /\.(?:ps1|sh)$/;
const isComment = (line) => /^\s*(?:\/\/|\*|\/\*|#)/.test(line);

/** The stray lines of one file's text: [{line, text}]. `file` decides whether a bare shell line counts and whether a file is a home. Pure. */
export function strayRemovals(text, file = 'x.mjs') {
  const home = file === CALL_FILE || file === OWNER;
  const script = SHELL_SCRIPT.test(file);
  const out = [];
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (isComment(line)) return;
    const shell = SHELL_FORM.test(line) && (script || SHELL_CALL.test(line));
    const raw = file === CALL_FILE ? false : ARGV_FORM.test(line) || shell;
    const call = !home && (IMPORT_FORM.test(line) || CALL_FORM.test(line));
    if (raw || call) out.push({ line: i + 1, text: line.trim().slice(0, 200) });
  });
  return out;
}

const scanned = (rel) => EXTENSIONS.test(rel) && !rel.startsWith('tests/') && !rel.includes('node_modules/') && !/^packages\/[^/]+(?:\/[^/]+)?\/runtime\//.test(rel);

/** {ok, hits: [{file, line, text}], files} over the tracked tree at `root`. */
export function scanWorktreeRm(root, { files = null } = {}) {
  const listed = files ?? (() => { const r = lsFiles([], { cwd: root, maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : []; })();
  const hits = [];
  let count = 0;
  for (const rel of listed.map((f) => f.replaceAll(String.fromCodePoint(92), '/'))) {
    if (!scanned(rel)) continue;
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    count += 1;
    if (/worktree/.test(text)) for (const h of strayRemovals(text, rel)) hits.push({ file: rel, ...h });
  }
  return { ok: hits.length === 0, hits, files: count };
}

function main(argv) {
  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), asJson = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = path.resolve(argv[++i] ?? '');
    else if (argv[i] === '--json') asJson = true;
    else { console.error(`unknown argument ${argv[i]}`); return 2; }
  }
  const r = scanWorktreeRm(root);
  if (asJson) console.log(JSON.stringify(r, null, 2));
  else {
    for (const h of r.hits) console.log(`  ${h.file}:${h.line}  an Orca worktree is removed only by ${OWNER} removeOrcaWorktree (links unlinked first, then ${CALL_FILE}): ${h.text}`);
    console.log(r.ok ? `check-worktree-rm: only ${OWNER} removes an Orca worktree (${r.files} files)` : `check-worktree-rm: red (${r.hits.length} stray)`);
  }
  return r.ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
