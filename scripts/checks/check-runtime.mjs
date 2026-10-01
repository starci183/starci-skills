#!/usr/bin/env node
// check-runtime.mjs - `starci check` (bin/starci.mjs check, `npm run check`): the one entry point that judges the StarCi
// runtime repository. In order:
//   1. node --check over every .mjs of engine/, scripts/, modules/ and bin/ (scripts/api/node/syntax-check.mjs);
//   2. the runtime HFS check, scripts/hfs/runtime-check.mjs, with knowledge/hfs/runtime-slots.yaml, and the
//      RT_CITED_PATH_MISSING findings of scripts/checks/check-contract-cites.mjs over the runtime's live prose, judged
//      together against the manifest's pending list;
//   3. every retained self-check of ruleParams.runtime.selfChecks, in order (scripts/api/node/run-script.mjs).
// Every step runs; the exit status is 1 when any failed.
//   node scripts/checks/check-runtime.mjs [--json]      --json prints the runtime check's report instead of its lines
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { runScript } from '../api/node/run-script.mjs';
import { syntaxCheck } from '../api/node/syntax-check.mjs';
import { runtimeCheck } from '../hfs/runtime-check.mjs';
import { RUNTIME_MANIFEST_FILE, loadSlotManifest, ruleParams } from '../lib/hfs-slots.mjs';
import { CITED_PATH_MISSING, citedPathFindings } from './check-contract-cites.mjs';
import { isMain, walkFiles } from './common.mjs';

/** The folders whose every .mjs must parse. */
export const SYNTAX_ROOTS = Object.freeze(['engine', 'scripts', 'modules', 'bin']);

/** Every .mjs under SYNTAX_ROOTS of `root` (node_modules skipped), sorted. */
export function syntaxFiles(root = skillRoot) {
  return SYNTAX_ROOTS.flatMap((dir) => (fs.existsSync(path.join(root, dir))
    ? walkFiles(path.join(root, dir), { sorted: true, filter: (name) => name.endsWith('.mjs'), exclude: (name) => name === 'node_modules' })
    : []));
}

/** One line of a runtime finding. */
const line = (f) => `${f.code} ${f.message}`;

/** The whole `starci check` of the runtime at `root`: {ok, syntax, runtime, selfChecks}. Prints as it goes (the runtime report as JSON with `json`). */
export function checkRuntime({ root = skillRoot, json = false } = {}) {
  const out = (text) => { if (!json) process.stdout.write(`${text}\n`); };
  const err = (text) => { if (!json) process.stderr.write(`${text}\n`); };

  const files = syntaxFiles(root);
  const bad = [];
  for (const file of files) {
    const r = syntaxCheck(file);
    if (!r.ok) { bad.push(file); err(`${path.relative(root, file).split(path.sep).join('/')}\n${r.stderr}`); }
  }
  out(`node --check: ${files.length} files, ${bad.length} failed`);

  const runtime = runtimeCheck({ repoRoot: root, root, extraFindings: citedPathFindings(root), extraCodes: [CITED_PATH_MISSING] });
  for (const f of runtime.findings) err(line(f));
  const lanes = {};
  for (const f of runtime.pending) lanes[f.lane] = (lanes[f.lane] ?? 0) + 1;
  const owed = Object.entries(lanes).sort().map(([lane, n]) => `${lane} ${n}`).join(', ') || 'none';
  if (runtime.ok) out(`OK: runtime HFS ${runtime.manifest} - ${runtime.tracked} tracked files, ${runtime.sources} sources; ${runtime.pending.length} pending finding(s) owed by chunk (${owed})`);
  else err(`runtime HFS: ${runtime.findings.length} error finding(s); ${runtime.pending.length} pending (${owed})`);
  if (json) process.stdout.write(`${JSON.stringify(runtime, null, 2)}\n`);

  const { selfChecks } = ruleParams(loadSlotManifest({ root, file: path.join(root, RUNTIME_MANIFEST_FILE) }), 'runtime');
  const failed = [];
  for (const check of selfChecks) {
    const status = runScript(path.join(root, check.run), check.args ?? [], { cwd: root });
    if (status !== 0) { failed.push(check.id); err(`self-check ${check.id} (${check.run}) failed with exit ${status}`); }
  }
  out(`self-checks: ${selfChecks.length - failed.length} of ${selfChecks.length} passed${failed.length ? ` (failed: ${failed.join(', ')})` : ''}`);
  return { ok: bad.length === 0 && runtime.ok && failed.length === 0, syntax: { files: files.length, failed: bad.length }, runtime, selfChecks: { run: selfChecks.length, failed } };
}

if (isMain(import.meta.url)) {
  const result = checkRuntime({ json: process.argv.includes('--json') });
  process.exitCode = result.ok ? 0 : 1;
}
