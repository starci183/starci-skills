#!/usr/bin/env node
// check-worktree-add.mjs — the runtime creates a worktree in exactly one place (owner decision WFWT; lane WT before it:
// 600+ orphan worktrees piled up because every script ran its own `git worktree add`). An agent's workspace is created
// by Orca (`orca worktree create` through scripts/api/orca/worktree-create.mjs: the Kernel's workflow worktree, the
// draw critic's placement, the [Worker] staging checkout), never by git. A runtime-internal scratch tree no agent works
// in (land/push scratch, the verify-proof base tree, the revert lane) is made by git in ONE function:
// scripts/api/git/worktree-add.mjs worktreeAdd, whose one caller scripts/machine/worktree-git.mjs createScratchWorktree
// registers it in machine.sqlite and hands it to the GC. A `git worktree add` anywhere else - another file, or the call
// file outside that function - is red, and so is a
// createScratchWorktree call that names an Orca kind (scripts/lib/worktree-kinds.mjs ORCA_KINDS: an agent's workspace made by
// git; createScratchWorktree also refuses it at run time). A land gate tree check (scripts/supervisor/land.mjs
// TREE_CHECKS) and part of `npm run check`.
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
import { runGit } from '../api/git/lib.mjs';
import { ORCA_KINDS } from '../lib/worktree-kinds.mjs';

export const WORKTREE_API = 'scripts/api/git/worktree-add.mjs';
/** The one function of WORKTREE_API that may run `git worktree add`. */
export const WORKTREE_ADD_HOME = 'worktreeAdd';
const EXTENSIONS = /\.(?:mjs|cjs|js|ts|ps1|sh)$/;
const ARGV_FORM = /['"`]worktree['"`]\s*,\s*['"`]add['"`]/;
const SHELL_FORM = /(?:^|['"`]|&&|;|\|\|)\s*git(?:\s+-C\s+(?:"[^"]*"|'[^']*'|\S+))?\s+worktree\s+add\b/;
const isComment = (line) => /^\s*(?:\/\/|\*|\/\*|#)/.test(line);
/** A createScratchWorktree call and the literal kind it names on that line. */
const SCRATCH_CALL = /\bcreateScratchWorktree\s*\(/;
const KIND_LITERAL = /\bkind\s*:\s*['"`]([a-z-]+)['"`]/;

const SHELL_CALL = /\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\s*\(|\bshell\s*:/;
const SHELL_SCRIPT = /\.(?:ps1|sh)$/;

/** The 1-based [first, last] lines of `export function <name>(` in a module's text (to its `}` at column 0), or null. */
export function functionSpan(text, name) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`export function ${name}(`));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('}'));
  return end < 0 ? null : [start + 1, end + 1];
}

/**
 * The stray invocations in one file's text: [{line, text}]. `file` decides whether a bare shell line counts; `allowed`
 * is a [first, last] line span where an invocation is the one home (WORKTREE_ADD_HOME in WORKTREE_API). Pure.
 */
export function strayLines(text, file = 'x.mjs', { allowed = null } = {}) {
  const out = [];
  const script = SHELL_SCRIPT.test(file);
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (isComment(line)) return;
    if (allowed && i + 1 >= allowed[0] && i + 1 <= allowed[1]) return;
    const shell = SHELL_FORM.test(line) && (script || SHELL_CALL.test(line));
    const orcaKind = SCRATCH_CALL.test(line) && ORCA_KINDS.includes(KIND_LITERAL.exec(line)?.[1]);
    if (ARGV_FORM.test(line) || shell || orcaKind) out.push({ line: i + 1, text: line.trim().slice(0, 200), ...(orcaKind ? { orcaKind: KIND_LITERAL.exec(line)[1] } : {}) });
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
    if (!scanned(rel)) continue;
    let text;
    try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    count += 1;
    if (!/worktree/.test(text)) continue;
    // The worktree API itself: only its one home function may hold the invocation (no home found: every line counts).
    const allowed = rel === WORKTREE_API ? functionSpan(text, WORKTREE_ADD_HOME) : null;
    for (const h of strayLines(text, rel, { allowed })) hits.push({ file: rel, ...h });
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
    for (const h of r.hits) {
      console.log(h.orcaKind
        ? `  ${h.file}:${h.line}  createScratchWorktree asked for Orca kind ${h.orcaKind} (an agent workspace is created by Orca through createOrcaWorktree): ${h.text}`
        : `  ${h.file}:${h.line}  git worktree add outside ${WORKTREE_API} ${WORKTREE_ADD_HOME} (an agent workspace is created by Orca, a runtime scratch tree by scripts/machine/worktree-git.mjs createScratchWorktree): ${h.text}`);
    }
    console.log(r.ok ? `check-worktree-add: only ${WORKTREE_API} ${WORKTREE_ADD_HOME} runs git worktree add (${r.files} files)` : `check-worktree-add: red (${r.hits.length} stray)`);
  }
  return r.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
