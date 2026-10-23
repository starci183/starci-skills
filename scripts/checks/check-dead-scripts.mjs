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
// A mention in a doc, a README, a benchmark finding or YAML prose is NOT a reader:
// that is how a one-off script (why-backfill, migrate-ui-shapes, repair-rejected-attempts) survived its own removal.
// A script only tests read is dead code with a test attached: both go (RT_DEAD_SCRIPT). There is no list that keeps a script
// alive: a CLI nothing imports is declared as a verb of modules/cli/commands (its `impl` is the reader) or deleted.
// The current tree includes indexed and new nonignored files; an indexed path removed from the worktree is absent.
// The owner ruling behind it: a superseded or unused mechanism is deleted with every reference (owner-rulings.yaml).
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { workingTreeFiles } from '../lib/tracked-text-scan.mjs';

export const SCRIPT_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext']);
/**
 * Directories the runtime loads by listing them, never by naming a file. The loader is named so a removed loader makes the
 * directory dead again (the spec asserts each loader still lists its directory).
 */
const DYNAMIC_ROOTS = Object.freeze({
  'scripts/kernel/verbs/': 'scripts/kernel/cli.mjs lists the verb files',
  'scripts/kernel/status/': 'scripts/kernel/api-extensions.mjs lists the status views',
  'scripts/reconciler/controllers/': 'scripts/reconciler/engine.mjs loads each controller of modules/reconciler/reconciler.yaml by name',
});
const CODE = /\.(mjs|cjs|js|ts|tsx|ps1|sh|cmd)$/;
const HOOK = /(^|\/)(?:\.husky|hooks\/husky)\/[^/]+$/;
const GENERATED = /^packages\/[^/]+\/runtime\/|^packages\/eslint\/[^/]+\/runtime\//;
const isTest = (rel) => rel.startsWith('e2e/') || /\.(test|spec)\.mjs$/.test(rel);
const HISTORY = 'modules/kernel/owner-rulings.yaml';
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|#)/;
const EXEC_POSITION = /\b(run|check|script|executable|entry|command|exec|cmd|handler)\s*:/;
const EXEC_KEY = /\b(?:run|check|script|executable|entry|command|exec|cmd|handler)\s*:\s*['"]?(?:(?:node|npm run)\s+)?[\w./-]+\.mjs/;
const NODE_COMMAND = /(^|[\s`'"(])node\s+[\w./-]+\.mjs/;
const DIRECT_STARCI_COMMAND = String.raw`(?:npx\s+)?starci`;
const NPM_STARCI_COMMAND = String.raw`npm\s+run(?:\s+--silent)?\s+starci(?:\s+--silent)?\s+--`;
const RUNTIME_CHECK_NAME = new RegExp(String.raw`\b(?:${DIRECT_STARCI_COMMAND}|${NPM_STARCI_COMMAND})\s+runtime\s+check\s+--only(?:=|\s+)([a-z0-9-]+)`, 'gi');
const runtimeCheckNames = (text) => new Set([...String(text).matchAll(RUNTIME_CHECK_NAME)].map((match) => match[1]));

/** The part of a reader's text that counts: code without comment lines; YAML and skills only where executable. */
function executableText(rel, text) {
  if (CODE.test(rel) || HOOK.test(rel) || path.posix.basename(rel) === 'package.json' || rel === '.claude/settings.json') {
    return CODE.test(rel) || HOOK.test(rel) ? text.split('\n').filter((line) => !COMMENT_LINE.test(line)).join('\n') : text;
  }
  const skill = /^skills\/[^/]+\/(?:SKILL\.md|references\/.+\.md)$/.test(rel) || /^\.starci\/host\/.+\.md$/.test(rel);
  if (/\.ya?ml$/.test(rel) || skill) {
    return text.split('\n').filter((line) => !/^\s*#/.test(line) && (
      EXEC_KEY.test(line) || NODE_COMMAND.test(line) || (runtimeCheckNames(line).size && (skill || EXEC_POSITION.test(line)))
    )).join('\n');
  }
  return '';
}

/** The one finding a script's read status gives, or null (a live script). */
const scriptFinding = (rel, reader) => (reader ? null : { code: 'RT_DEAD_SCRIPT', path: rel, message: `${rel} is read by no code, package script, hook or agent command (a doc or YAML prose mention is not a reader): delete it with its tests, or wire it where it is used (a verb of modules/cli/commands names its script)` });

/**
 * The dead scripts of a tree: [{code, path, message}].
 * files: {tracked: [rel], read: (rel) => text}.
 */
function deadScriptFindings({ tracked, read }) {
  const scripts = tracked.filter((rel) => rel.endsWith('.mjs') && SCRIPT_ROOTS.some((r) => rel.startsWith(`${r}/`)) && !isTest(rel));
  const readers = tracked.filter((rel) => !isTest(rel) && !GENERATED.test(rel) && !rel.startsWith(HISTORY));
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
    const finding = scriptFinding(rel, readBy(rel));
    if (finding) findings.push(finding);
  }
  return findings;
}

/** Run the check on the runtime at `root`. */
const checkDeadScripts = (root = skillRoot) => deadScriptFindings(workingTreeFiles(root, lsFiles));

if (isMain(import.meta.url)) process.exit(printFindings(checkDeadScripts(), "OK: every runtime script has an executable reader."));
