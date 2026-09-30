#!/usr/bin/env node
// check-dead-scripts.mjs - no runtime script lives without a reader (redundancy RED18; part of `npm run check`).
//   node scripts/checks/check-dead-scripts.mjs [--json]
//
// A tracked `.mjs` under scripts/, engine/, modules/, bin/ or ext/ is alive when another tracked file that is not a
// test names it: an import or dynamic import (by relative specifier), a `node scripts/...` command in package.json, a
// spawn argument, a skill, a doc or a YAML contract (by its repository path or its file name). A script only tests read
// is dead code with a test attached: both go. Refuses a script no non-test tracked file names (RT_DEAD_SCRIPT).
// Untracked scratch files are the working copy's business (git status), not this check's: it reads tracked files only.
// The owner ruling behind it: a superseded or unused mechanism is deleted with every reference (owner-rulings.yaml).
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from './common.mjs';
import { gitOutput } from '../lib/git.mjs';

export const SCRIPT_ROOTS = Object.freeze(['scripts', 'engine', 'modules', 'bin', 'ext']);
/** Tracked text files whose mention keeps a script alive (tests excluded: a script only a test reads is dead). */
const TEXT = /\.(mjs|cjs|js|json|ya?ml|md|ps1|sh|txt)$/;
const isTest = (rel) => rel.startsWith('tests/') || /\.(test|spec)\.mjs$/.test(rel);
const GENERATED = /^packages\/[^/]+\/runtime\/|^packages\/eslint\/[^/]+\/runtime\//;

/**
 * The dead scripts of a tree: [{code, path, message}].
 * files: {tracked: [rel], read: (rel) => text}.
 */
export function deadScriptFindings({ tracked, read }) {
  const scripts = tracked.filter((rel) => rel.endsWith('.mjs') && SCRIPT_ROOTS.some((r) => rel.startsWith(`${r}/`)) && !isTest(rel));
  const readers = tracked.filter((rel) => TEXT.test(rel) && !isTest(rel) && !GENERATED.test(rel));
  const texts = new Map(readers.map((rel) => [rel, read(rel)]));
  const findings = [];
  for (const rel of scripts) {
    const base = path.posix.basename(rel);
    const stem = rel.replace(/\.mjs$/, '');
    let alive = false;
    for (const [reader, text] of texts) {
      if (reader === rel) continue;
      if (text.includes(base) || text.includes(stem)) { alive = true; break; }
    }
    if (!alive) findings.push({ code: 'RT_DEAD_SCRIPT', path: rel, message: `${rel} is named by no tracked file except tests: delete it with its tests, or wire it where it is used` });
  }
  return findings;
}

/** Run the check on the runtime at `root`. */
export function checkDeadScripts(root = skillRoot) {
  const tracked = gitOutput(['ls-files', '-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  return deadScriptFindings({ tracked, read: (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; } } });
}

if (isMain(import.meta.url)) {
  const findings = checkDeadScripts();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.message}`);
    if (!findings.length) console.log('OK: every runtime script has a reader outside the tests.');
  }
  process.exit(findings.length ? 1 : 0);
}
