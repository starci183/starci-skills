#!/usr/bin/env node
// check-installed-artefacts.mjs - INSTALLED_ARTEFACT_UNDECLARED (part of `npm run check`).
//   runs in the check stage (self-check installed-artefacts); --json prints the findings as JSON
//
// The runtime installs things outside its own tree that carry a version of its logic (git hooks in workflow trees, generated copies, guard files).
// A deploy migrates every one of them (scripts/reconciler/installed-artefacts.mjs); it can only migrate what is declared in
// modules/kernel/installed-artefacts.yaml. This check refuses:
//   - a row whose writer file does not exist or does not export the named function, whose marker the writer does not carry, or a `rewrite` row with no handler
//     (and a handler with no row);
//   - a runtime source file that matches a declared writer signal (it resolves a repository hooks directory) or carries a declared marker and is not a
//     declared writer or a declared reader of the artefact: a new installer outside the tree must be on the list.
// The scan is by signal, not by data flow: it finds the installers that resolve a hooks directory or carry a marker, which is how every installer so far works.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { ARTEFACTS_FILE, HANDLERS, loadArtefacts } from '../reconciler/installed-artefacts.mjs';

export const CODE = 'INSTALLED_ARTEFACT_UNDECLARED';
const SOURCE = /^(?:scripts|engine|ui)\/.*\.mjs$/;
const SELF = new Set(['scripts/checks/check-installed-artefacts.mjs', 'scripts/reconciler/installed-artefacts.mjs', 'scripts/guards/hook-stamp.mjs']);

const finding = (rel, message) => ({ code: CODE, path: rel, message });

function writerFindings(row, root) {
  const file = path.join(root, row.writer.file);
  if (!fs.existsSync(file)) return [finding(ARTEFACTS_FILE, `${row.id}: writer ${row.writer.file} does not exist`)];
  const text = fs.readFileSync(file, 'utf8');
  if (!new RegExp(String.raw`export (?:async )?(?:function|const) ${row.writer.export}(?![\w$])`).test(text)) return [finding(ARTEFACTS_FILE, `${row.id}: ${row.writer.file} does not export ${row.writer.export}`)];
  return row.marker && !text.includes(row.marker) ? [finding(ARTEFACTS_FILE, `${row.id}: ${row.writer.file} does not carry the marker ${row.marker}`)] : [];
}

function migrationFindings(row) {
  if (row.migrate === 'rewrite' && !HANDLERS[row.id]) return [finding(ARTEFACTS_FILE, `${row.id}: a rewrite row has no handler in scripts/reconciler/installed-artefacts.mjs`)];
  return row.migrate === 'none' && !row.reason ? [finding(ARTEFACTS_FILE, `${row.id}: a row that migrates nothing says why`)] : [];
}

function rowFindings(doc, root) {
  const orphans = Object.keys(HANDLERS).filter((id) => !doc.artefacts.some((row) => row.id === id)).map((id) => finding(ARTEFACTS_FILE, `${id}: a handler with no declared row`));
  return [...doc.artefacts.flatMap((row) => [...writerFindings(row, root), ...migrationFindings(row)]), ...orphans];
}

function sourceFindings(doc, files) {
  const writers = new Set(doc.artefacts.map((row) => row.writer.file));
  const signals = doc.writerSignals.map((signal) => ({ ...signal, rx: new RegExp(signal.pattern) }));
  const markers = doc.artefacts.map((row) => row.marker).filter(Boolean);
  const out = [];
  for (const [rel, text] of Object.entries(files)) {
    if (writers.has(rel) || SELF.has(rel)) continue;
    const hit = signals.find((signal) => signal.rx.test(text));
    const marked = markers.find((marker) => text.includes(marker));
    if (hit) out.push(finding(rel, `${rel} matches the writer signal ${hit.id} (${hit.why}) and is not a declared writer: add its artefact to ${ARTEFACTS_FILE}`));
    else if (marked) out.push(finding(rel, `${rel} carries the marker ${marked} of a declared artefact and is not its writer: it must read it through the writer or be declared`));
  }
  return out;
}

/** The findings over the tree at `root` (the tracked runtime sources). */
export function checkInstalledArtefacts(root = skillRoot) {
  const doc = loadArtefacts(root);
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter((rel) => SOURCE.test(rel));
  const files = {};
  for (const rel of tracked) {
    try { files[rel] = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { /* a lane may hold an uncommitted deletion */ }
  }
  return [...rowFindings(doc, root), ...sourceFindings(doc, files)];
}

if (isMain(import.meta.url)) process.exit(printFindings(checkInstalledArtefacts(), 'OK: every installer of the runtime is declared in modules/kernel/installed-artefacts.yaml.'));
