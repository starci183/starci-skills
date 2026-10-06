#!/usr/bin/env node
// check-runtime.mjs - `starci runtime check` (`npm run check`): the one entry point that judges the StarCi
// runtime repository. In order:
//   1. node --check over every .mjs of engine/, scripts/, modules/ and bin/ (scripts/api/node/syntax-check.mjs);
//   2. the runtime HFS check, scripts/hfs/runtime-check.mjs, with knowledge/hfs/runtime-slots.yaml, and the
//      RT_CITED_PATH_MISSING findings of scripts/checks/check-contract-cites.mjs over the runtime's live prose;
//   3. every retained self-check of ruleParams.runtime.selfChecks, in order (scripts/api/node/run-script.mjs).
// Every step runs; the exit status is 1 when any failed.
//   starci runtime check [--json]                       run the complete runtime check
//   starci runtime check --only <name> [-- <arguments>] run one named check and pass its arguments through unchanged
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { runScript } from '../api/node/run-script.mjs';
import { syntaxCheck } from '../api/node/syntax-check.mjs';
import { runtimeCheck } from '../hfs/runtime-check.mjs';
import { RUNTIME_MANIFEST_FILE, loadSlotManifest, ruleParams } from '../hfs/slots.mjs';
import { citedPathFindings } from './check-contract-cites.mjs';
import { isMain } from '../lib/is-main.mjs'; import { walkFiles } from '../lib/walk.mjs';

/** The folders whose every .mjs must parse. */
const SYNTAX_ROOTS = Object.freeze(['engine', 'scripts', 'modules', 'bin']);

/** Every .mjs under SYNTAX_ROOTS of `root` (node_modules skipped), sorted. */
function syntaxFiles(root = skillRoot) {
  return SYNTAX_ROOTS.flatMap((dir) => (fs.existsSync(path.join(root, dir))
    ? walkFiles(path.join(root, dir), { sorted: true, filter: (name) => name.endsWith('.mjs'), exclude: (name) => name === 'node_modules' })
    : []));
}

/** One line of a runtime finding. */
const line = (f) => `${f.code} ${f.message}`;

const writeTo = (target, text) => {
  if (typeof target === 'function') target(text);
  else target.write(text);
};

/**
 * The checks addressable by `starci runtime check --only <name>`, sorted by
 * name. Check scripts are discovered from disk so this list cannot drift; the
 * retained self-check ids add configured scripts outside scripts/checks/.
 * The driver itself is excluded because it represents the complete suite, not
 * one check.
 */
export function runtimeOnlyChecks(root = skillRoot) {
  const checks = new Map();
  const checksDir = path.join(root, 'scripts', 'checks');
  for (const entry of fs.readdirSync(checksDir, { withFileTypes: true })) {
    const match = entry.isFile() ? /^check-([a-z0-9-]+)\.mjs$/.exec(entry.name) : null;
    if (!match || match[1] === 'runtime') continue;
    checks.set(match[1], { name: match[1], run: `scripts/checks/${entry.name}`, args: [] });
  }

  const manifest = loadSlotManifest({ root, file: path.join(root, RUNTIME_MANIFEST_FILE) });
  const { selfChecks } = ruleParams(manifest, 'runtime');
  for (const check of selfChecks) {
    checks.set(check.id, { name: check.id, run: check.run, args: [...(check.args ?? [])] });
  }
  return [...checks.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Run exactly one dynamically discovered check, returning its child exit code. */
export function runRuntimeOnly(name, args = [], {
  root = skillRoot,
  runner = runScript,
  stderr = process.stderr,
} = {}) {
  const checks = runtimeOnlyChecks(root);
  const selected = checks.find((check) => check.name === name);
  if (!selected) {
    const reason = name ? `unknown check "${name}"` : '--only needs a check name';
    writeTo(stderr, `check-runtime: ${reason}\nValid --only names: ${checks.map((check) => check.name).join(', ')}\n`);
    return 2;
  }
  return runner(path.join(root, selected.run), [...selected.args, ...args], { cwd: root });
}

/** The whole `starci runtime check` at `root`: {ok, syntax, runtime, selfChecks}. Prints as it goes (the runtime report as JSON with `json`). */
function checkRuntime({ root = skillRoot, json = false } = {}) {
  const out = (text) => { if (!json) process.stdout.write(`${text}\n`); };
  const err = (text) => { if (!json) process.stderr.write(`${text}\n`); };

  const files = syntaxFiles(root);
  const bad = [];
  for (const file of files) {
    const r = syntaxCheck(file);
    if (!r.ok) { bad.push(file); err(`${path.relative(root, file).split(path.sep).join('/')}\n${r.stderr}`); }
  }
  out(`node --check: ${files.length} files, ${bad.length} failed`);

  // The cites run lazily: runtimeCheck regenerates the git-ignored runtime copies first, and a live-prose cite of a
  // path inside them must resolve on disk.
  const runtime = runtimeCheck({ repoRoot: root, root, extraFindings: () => citedPathFindings(root) });
  for (const f of runtime.findings) err(line(f));
  if (runtime.ok) out(`OK: runtime HFS ${runtime.manifest} - ${runtime.tracked} tracked files, ${runtime.sources} sources`);
  else err(`runtime HFS: ${runtime.findings.length} error finding(s)`);
  if (json) process.stdout.write(`${JSON.stringify(runtime, null, 2)}\n`);

  const { selfChecks } = ruleParams(loadSlotManifest({ root, file: path.join(root, RUNTIME_MANIFEST_FILE) }), 'runtime');
  const failed = [];
  for (const check of selfChecks) {
    const status = runScript(path.join(root, check.run), check.args ?? [], { cwd: root });
    if (status !== 0) { failed.push(check.id); err(`self-check ${check.id} (${check.run}) failed with exit ${status}`); }
    else out(`self-check ${check.id}: ok`);
  }
  const failedTail = failed.length ? ` (failed: ${failed.join(', ')})` : '';
  out(`self-checks: ${selfChecks.length - failed.length} of ${selfChecks.length} passed${failedTail}`);
  return { ok: bad.length === 0 && runtime.ok && failed.length === 0, syntax: { files: files.length, failed: bad.length }, runtime, selfChecks: { run: selfChecks.length, failed } };
}

/** CLI branch; without --only this calls the complete suite exactly as before. */
export function checkRuntimeMain(argv = process.argv.slice(2), deps = {}) {
  const onlyAt = argv.findIndex((arg) => arg === '--only' || arg.startsWith('--only='));
  if (onlyAt >= 0) {
    const joined = argv[onlyAt].startsWith('--only=');
    const name = joined ? argv[onlyAt].slice('--only='.length) : argv[onlyAt + 1];
    const passThrough = argv.slice(onlyAt + (joined ? 1 : 2));
    if (passThrough[0] === '--') passThrough.shift();
    return runRuntimeOnly(name, passThrough, deps);
  }
  const result = checkRuntime({ root: deps.root ?? skillRoot, json: argv.includes('--json') });
  return result.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  process.exitCode = checkRuntimeMain(process.argv.slice(2));
}
