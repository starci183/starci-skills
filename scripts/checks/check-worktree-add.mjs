#!/usr/bin/env node
// check-worktree-add.mjs — only the runtime's worktree API creates a git worktree (owner order, lane WT: 600+ orphan
// worktrees piled up because every script ran its own `git worktree add`). scripts/lib/worktrees.mjs createWorktree is
// the one place: it registers the tree in machine.sqlite, enforces the per-repo cap and hands it to the GC. A land gate
// tree check (scripts/supervisor/land.mjs TREE_CHECKS) and part of `npm run check`.
//
// It scans every tracked script outside tests/ (.mjs .js .cjs .ts .ps1 .sh; node_modules and the packages' copied
// runtime/ excluded) for an invocation of `worktree add`:
//   argv form    'worktree', 'add'   (any quote, any spacing: a git runner's argument list)
//   shell form   git [-C <dir>] worktree add   at the start of a string, a command, or after && ; || - any line of a
//                .ps1/.sh script, and a JS line that hands it to a shell (exec, execSync, spawn, spawnSync, shell:)
// Comment lines (//, *, /*, #), prose and messages that merely name the command are not invocations.
//
//   node scripts/checks/check-worktree-add.mjs [--root <tree>] [--json]
// Exit 0 clean, 1 a stray `git worktree add`, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGit } from '../lib/git.mjs';

export const WORKTREE_API = 'scripts/lib/worktrees.mjs';
const EXTENSIONS = /\.(?:mjs|cjs|js|ts|ps1|sh)$/;
const ARGV_FORM = /['"`]worktree['"`]\s*,\s*['"`]add['"`]/;
const SHELL_FORM = /(?:^|['"`]|&&|;|\|\|)\s*git(?:\s+-C\s+(?:"[^"]*"|'[^']*'|\S+))?\s+worktree\s+add\b/;
const isComment = (line) => /^\s*(?:\/\/|\*|\/\*|#)/.test(line);

const SHELL_CALL = /\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\s*\(|\bshell\s*:/;
const SHELL_SCRIPT = /\.(?:ps1|sh)$/;

/** The stray invocations in one file's text: [{line, text}]. `file` decides whether a bare shell line counts. Pure. */
export function strayLines(text, file = 'x.mjs') {
  const out = [];
  const script = SHELL_SCRIPT.test(file);
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (isComment(line)) return;
    const shell = SHELL_FORM.test(line) && (script || SHELL_CALL.test(line));
    if (ARGV_FORM.test(line) || shell) out.push({ line: i + 1, text: line.trim().slice(0, 200) });
  });
  return out;
}

const scanned = (rel) => EXTENSIONS.test(rel) && !rel.startsWith('tests/') && !rel.includes('node_modules/') && !/^packages\/[^/]+(?:\/[^/]+)?\/runtime\//.test(rel);

/** {ok, hits: [{file, line, text}], files} over the tracked tree at `root`. */
export function scanWorktreeAdd(root, { files = null } = {}) {
  const listed = files ?? (() => { const r = runGit(['ls-files'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : []; })();
  const hits = [];
  let count = 0;
  for (const rel of listed.map((f) => f.replace(/\\/g, '/'))) {
    if (!scanned(rel) || rel === WORKTREE_API) continue;
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    count += 1;
    if (!/worktree/.test(text)) continue;
    for (const h of strayLines(text, rel)) hits.push({ file: rel, ...h });
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
  const r = scanWorktreeAdd(root);
  if (asJson) console.log(JSON.stringify(r, null, 2));
  else {
    for (const h of r.hits) console.log(`  ${h.file}:${h.line}  git worktree add outside ${WORKTREE_API} (use createWorktree): ${h.text}`);
    console.log(r.ok ? `check-worktree-add: only ${WORKTREE_API} creates a worktree (${r.files} files)` : `check-worktree-add: red (${r.hits.length} stray)`);
  }
  return r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
