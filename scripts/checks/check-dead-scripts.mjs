#!/usr/bin/env node
// check-dead-scripts.mjs - no runtime script lives without a reader (redundancy RED18; part of `npm run check`).
//   starci runtime check --only dead-scripts -- [--json]
//
// A tracked `.mjs` under scripts/, engine/, modules/, bin/ or ext/ is alive only when something EXECUTABLE names it:
//   - code: an import or dynamic import (by relative specifier), a spawn argument or a path literal in another code file
//     (comment lines do not count), a package.json script, a hook or .claude/settings.json;
//   - an agent command: a `node <script>` line of a skill (skills/**/SKILL.md) or of a YAML contract, or a YAML key that is
//     an executable position (run, check, script, executable, entry, command, exec, cmd, handler) holding the script path;
//     `starci runtime check --only <name>` names scripts/checks/check-<name>.mjs through the runtime check dispatcher;
//   - a directory the runtime loads by listing it (DYNAMIC_ROOTS: verbs, status views, reconciler controllers);
//   - an entry of scripts/checks/dead-scripts.entries: a CLI nothing imports (owner or agent tool), declared once with the
//     reason it has no code reader.
// A mention in a doc, a README, retired-paths.yaml, a contract-change, a benchmark finding or YAML prose is NOT a reader:
// that is how a one-off script (why-backfill, migrate-ui-shapes, repair-rejected-attempts) survived its own removal.
// A script only tests read is dead code with a test attached: both go (RT_DEAD_SCRIPT). An entry whose script is gone, or
// that code now reads, is stale and goes too (RT_DEAD_ENTRY): the list only shrinks.
// Untracked scratch files are the working copy's business (git status), not this check's: it reads tracked files only.
// The owner ruling behind it: a superseded or unused mechanism is deleted with every reference (owner-rulings.yaml).
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';

export const SCRIPT_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext']);
export const ENTRIES_FILE = 'scripts/checks/dead-scripts.entries';
/**
 * Directories the runtime loads by listing them, never by naming a file. The loader is named so a removed loader makes the
 * directory dead again (the spec asserts each loader still lists its directory).
 */
export const DYNAMIC_ROOTS = Object.freeze({
  'scripts/kernel/verbs/': 'scripts/kernel/cli.mjs lists the verb files',
  'scripts/kernel/status/': 'scripts/kernel/api-extensions.mjs lists the status views',
  'scripts/reconciler/controllers/': 'scripts/reconciler/engine.mjs loads each controller of modules/reconciler/reconciler.yaml by name',
});
const CODE = /\.(mjs|cjs|js|ts|tsx|ps1|sh|cmd)$/;
const HOOK = /(^|\/)(?:\.husky|hooks\/husky)\/[^/]+$/;
const GENERATED = /^packages\/[^/]+\/runtime\/|^packages\/eslint\/[^/]+\/runtime\//;
const isTest = (rel) => rel.startsWith('tests/') || /\.(test|spec)\.mjs$/.test(rel);
const HISTORY = /^modules\/kernel\/(contract-changes\/|retired-paths\.yaml|owner-rulings\.yaml)/;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|#)/;
const EXEC_POSITION = /\b(run|check|script|executable|entry|command|exec|cmd|handler)\s*:/;
const EXEC_KEY = /\b(run|check|script|executable|entry|command|exec|cmd|handler)\s*:\s*['"]?(node\s+|npm run\s+)?[\w./-]+\.mjs/;
const NODE_COMMAND = /(^|[\s`'"(])node\s+[\w./-]+\.mjs/;
const runtimeCheckNames = (text) => new Set([...String(text).matchAll(/\b(?:(?:npx\s+)?starci\s+runtime\s+check|npm\s+run(?:\s+--silent)?\s+starci(?:\s+--silent)?\s+--\s+runtime\s+check)\s+--only(?:=|\s+)([a-z0-9-]+)/gi)].map((match) => match[1]));

/** The part of a reader's text that counts: code without comment lines; YAML and skills only where executable. */
function executableText(rel, text) {
  if (CODE.test(rel) || HOOK.test(rel) || rel === 'package.json' || rel === '.claude/settings.json') {
    return CODE.test(rel) || HOOK.test(rel) ? text.split('\n').filter((line) => !COMMENT_LINE.test(line)).join('\n') : text;
  }
  const skill = /^skills\/.*SKILL\.md$/.test(rel);
  if (/\.ya?ml$/.test(rel) || skill) {
    return text.split('\n').filter((line) => !/^\s*#/.test(line) && (
      EXEC_KEY.test(line) || NODE_COMMAND.test(line) || (runtimeCheckNames(line).size && (skill || EXEC_POSITION.test(line)))
    )).join('\n');
  }
  return '';
}

/** The declared entries: `path<TAB>reason` lines of ENTRIES_FILE (`#` lines and blanks skipped). */
function parseEntries(text) {
  const entries = new Map();
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [entry, ...reason] = line.split('\t');
    entries.set(entry.trim(), reason.join('\t').trim());
  }
  return entries;
}

/**
 * The dead scripts of a tree: [{code, path, message}].
 * files: {tracked: [rel], read: (rel) => text}.
 */
export function deadScriptFindings({ tracked, read }) {
  const scripts = tracked.filter((rel) => rel.endsWith('.mjs') && SCRIPT_ROOTS.some((r) => rel.startsWith(`${r}/`)) && !isTest(rel));
  const entries = parseEntries(tracked.includes(ENTRIES_FILE) ? read(ENTRIES_FILE) : '');
  const readers = tracked.filter((rel) => !isTest(rel) && !GENERATED.test(rel) && !HISTORY.test(rel));
  const texts = new Map();
  for (const rel of readers) {
    const text = executableText(rel, read(rel));
    if (text) texts.set(rel, { text, checks: runtimeCheckNames(text) });
  }
  const readBy = (rel) => {
    const base = path.posix.basename(rel);
    const stem = rel.replace(/\.mjs$/, '');
    const check = /^scripts\/checks\/check-([a-z0-9-]+)\.mjs$/.exec(rel)?.[1];
    for (const [reader, executable] of texts) {
      if (reader !== rel && (executable.text.includes(base) || executable.text.includes(stem) || (check && executable.checks.has(check)))) return reader;
    }
    return null;
  };
  const findings = [];
  for (const rel of scripts) {
    if (Object.keys(DYNAMIC_ROOTS).some((root) => rel.startsWith(root))) continue;
    const reader = readBy(rel);
    if (entries.has(rel)) {
      if (reader && CODE.test(reader)) findings.push({ code: 'RT_DEAD_ENTRY', path: rel, message: `${ENTRIES_FILE} lists ${rel}, but ${reader} reads it: delete the entry` });
      continue;
    }
    if (!reader) findings.push({ code: 'RT_DEAD_SCRIPT', path: rel, message: `${rel} is read by no code, package script, hook or agent command (a doc or YAML prose mention is not a reader): delete it with its tests, wire it where it is used, or declare a CLI in ${ENTRIES_FILE}` });
  }
  for (const [entry] of entries) {
    if (!scripts.includes(entry)) findings.push({ code: 'RT_DEAD_ENTRY', path: entry, message: `${ENTRIES_FILE} lists ${entry}, which is not a tracked runtime script: delete the entry` });
  }
  return findings;
}

/** Run the check on the runtime at `root`. */
export function checkDeadScripts(root = skillRoot) {
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter(Boolean);
  return deadScriptFindings({ tracked, read: (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; } } });
}

if (isMain(import.meta.url)) {
  const findings = checkDeadScripts();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.message}`);
    if (!findings.length) console.log('OK: every runtime script has an executable reader or a declared entry.');
  }
  process.exit(findings.length ? 1 : 0);
}
