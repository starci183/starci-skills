#!/usr/bin/env node
// check-revision-scope.mjs - RT_REVISION_SCOPE (R237; part of `npm run check`).
//   runs in the check stage (self-check revision-scope)
//
// modules/kernel/revision-scope.yaml says which part of the runtime tree concerns which role and what each role does when it changes. The
// table is checked against the tree, so a scope can never silently miss a file:
//   - every tracked path matches at least one row (a path in no row would take the default only by accident);
//   - only the declared vocabulary is used, and a row names only declared roles;
//   - the engine-loaded set is DERIVED from the import graph of `engineEntries`: no row hand-lists a fixed engine restart for a script, and
//     every file of the derived set classifies as an engine restart;
//   - the files each seat's launch prompt is built from (`seatBoot`) are the files its generator reads, are classified `boot`, and include the
//     generated role-block prompt of the seat;
//   - a wording-only declaration cannot cover an edit that deletes a list entry or a choice (a probe of the comparison itself).
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { rolesContract } from '../machine/roles-contract.mjs';
import { SCOPE_FILE, actionsFor, engineLoadedSet, loadScope, rowsOf } from '../reconciler/revision-scope.mjs';
import { wordingOnly } from '../reconciler/revision-change.mjs';

export const CODE = 'RT_REVISION_SCOPE';
const finding = (message) => ({ code: CODE, path: SCOPE_FILE, line: 0, message: `${SCOPE_FILE} ${message}` });
const SCRIPT = /\.mjs$/;
const PROMPT_TOKEN = /['"`]([\w.-]+\.(?:md|yaml))['"`]/g;

const trackedFiles = (root) => String(lsFiles(['--cached'], { dir: root, maxBuffer: 64 * 1024 * 1024 }).stdout ?? '').split(/\r?\n/).filter(Boolean);

function vocabularyFindings(doc) {
  const allowed = new Set([...doc.order, 'derived']);
  const out = [];
  for (const row of doc.rows) {
    for (const [role, action] of Object.entries(row.roles ?? {})) {
      if (!doc.roleIds.includes(role)) out.push(finding(`row ${row.id} names the unknown role ${role}`));
      if (!allowed.has(action)) out.push(finding(`row ${row.id} gives ${role} the unknown action ${action}`));
      if (action === 'derived' && role !== 'engine') out.push(finding(`row ${row.id}: only the engine action may be derived`));
    }
  }
  return out;
}

function coverageFindings(doc, files) {
  return files.filter((file) => rowsOf(doc, file).length === 0).map((file) => finding(`covers no row for the tracked path ${file}`));
}

function engineFindings(root, doc, files) {
  const out = [];
  const scripts = files.filter((file) => SCRIPT.test(file));
  for (const row of doc.rows.filter((r) => r.roles?.engine === 'restart')) {
    const hit = scripts.find((file) => rowsOf(doc, file).includes(row));
    if (hit) out.push(finding(`row ${row.id} hand-lists an engine restart for the script ${hit}; the engine-loaded scripts are derived from engineEntries`));
  }
  const { loaded, entries } = engineLoadedSet(root, doc);
  if (!entries.length) out.push(finding('engineEntries match no module of the tree'));
  const loadedFiles = [...loaded].filter((file) => files.includes(file));
  const missed = loadedFiles.find((file) => actionsFor(doc, file, { engineLoaded: () => true }).actions.engine !== 'restart');
  if (missed) out.push(finding(`the engine loads ${missed} and no row restarts the engine for it`));
  return out;
}

const bootTokens = (root, generator, dir) => {
  const text = fs.readFileSync(path.join(root, generator), 'utf8').split(/\r?\n/).filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line)).join('\n');
  return [...new Set([...text.matchAll(PROMPT_TOKEN)].map((m) => `${dir}/${m[1]}`).filter((file) => fs.existsSync(path.join(root, file))))].sort(byCodeUnit);
};

function bootFindings(root, doc) {
  const out = [];
  const roles = rolesContract(root).roles;
  for (const [seat, boot] of Object.entries(doc.seatBoot ?? {})) {
    if (!fs.existsSync(path.join(root, boot.generator))) { out.push(finding(`seatBoot.${seat} generator ${boot.generator} does not exist`)); continue; }
    const read = bootTokens(root, boot.generator, boot.dir);
    for (const file of read.filter((f) => !boot.files.includes(f))) out.push(finding(`seatBoot.${seat} omits ${file}, which ${boot.generator} reads into the launch prompt`));
    for (const file of boot.files.filter((f) => !read.includes(f))) out.push(finding(`seatBoot.${seat} lists ${file}, which ${boot.generator} does not read`));
    for (const file of boot.files.filter((f) => actionsFor(doc, f).actions[seat] !== 'boot')) out.push(finding(`${file} feeds the ${seat} launch prompt and its row does not give ${seat} the action boot`));
    const prompts = (roles.find((r) => r.id === seat)?.surfaces ?? []).filter((s) => s.mode === 'block' && s.file.startsWith(`${boot.dir}/`) && s.file.endsWith('.md')).map((s) => s.file);
    for (const file of prompts.filter((f) => !boot.files.includes(f))) out.push(finding(`${file} carries the generated ${seat} role block and is not a seatBoot file`));
  }
  return out;
}

const PROBES = [
  { file: 'probe.yaml', before: 'a:\n  - x\n  - y\nchoices:\n  p: one\n  q: two\n', after: 'a:\n  - x\nchoices:\n  p: one\n  q: two\n', ok: false, what: 'a deleted list entry' },
  { file: 'probe.yaml', before: 'a:\n  - x\nchoices:\n  p: one\n  q: two\n', after: 'a:\n  - x\nchoices:\n  p: one\n', ok: false, what: 'a deleted choice' },
  { file: 'probe.yaml', before: 'a:\n  - x\nchoices:\n  p: one\n', after: 'a:\n  - z\nchoices:\n  p: uno\n', ok: true, what: 'reworded values' },
  { file: 'probe.md', before: '# T\n\n- one\n- two\n', after: '# T\n\n- one\n', ok: false, what: 'a deleted bullet' },
  { file: 'probe.md', before: '# T\n\n- one\n- two\n', after: '# T\n\n- uno\n- dos\n', ok: true, what: 'reworded bullets' },
];

function probeFindings() {
  return PROBES.filter((p) => wordingOnly(p.file, p.before, p.after).ok !== p.ok).map((p) => finding(`wording-only comparison is wrong for ${p.what}`));
}

/** The RT_REVISION_SCOPE findings over the tree at `root`. */
export function checkRevisionScope(root = skillRoot) {
  const doc = loadScope(root);
  const files = trackedFiles(root);
  return [...vocabularyFindings(doc), ...coverageFindings(doc, files), ...engineFindings(root, doc, files), ...bootFindings(root, doc), ...probeFindings()];
}

if (isMain(import.meta.url)) process.exitCode = printFindings(checkRevisionScope(), 'OK: every tracked path has a revision-scope row and the engine and boot sets are derived.');
