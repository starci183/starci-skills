#!/usr/bin/env node
// check-example-architecture.mjs - the examples meet their own standard (RED14). Runs `hfs lint` (the published CLI over its
// runtime copy, THE lint of an app: ESLint over be/ and fe/ with the two canons, which judge the architecture machine's source
// findings, stylelint over fe/ and `hfs check`) on every examples/<name> app that has an hfs.json, prints per example the
// findings by code (the catalog code a finding carries, else its rule) and fails when any example has a finding or a tool that
// could not run. `hfs check` alone is not the standard: the machine's source rules (BE_FEATURE_NOT_COMPOSED, HFS_UNUSED_FILE,
// ...) sit on the lint surface (scripts/hfs/architecture/surface.mjs) and reach an app only through `hfs lint`.
//
//   starci runtime check --only example-architecture -- [--examples <dir>] [--only <name>]
//
// It is deliberately NOT part of `npm run check`: run it by hand, after `npm ci` in each example app, before landing an
// example change. It is heavy (one TypeScript program per side of each example): run it once, never in a loop.
// Exit 0: every example is clean. Exit 1: an example has findings or its check could not run. Exit 2: bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';

const HFS_BIN = path.join(skillRoot, 'packages', 'hfs', 'bin', 'hfs.mjs');
const USAGE = 'usage: check-example-architecture.mjs [--examples <dir>] [--only <name>]';

/** The example directories under `examplesDir` that declare an hfs.json, by name. */
export function exampleDirs(examplesDir, only) {
  return fs.readdirSync(examplesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(examplesDir, e.name, 'hfs.json')) && (!only || e.name === only))
    .map((e) => e.name).sort();
}

/**
 * {name, status, errors, byCode} of one example: status is `clean`, `findings` or `unrunnable` (the CLI refused, printed no
 * report, or a tool of the lint could not run - a lint that did not run is never clean).
 */
export function checkExample(examplesDir, name, { bin = HFS_BIN } = {}) {
  const run = runNode([bin, 'lint', '--repo', path.join(examplesDir, name), '--format', 'json'], { maxBuffer: 256 * 1024 * 1024 });
  let report;
  try { report = JSON.parse(run.stdout); } catch { report = null; }
  if (!report?.counts || !Array.isArray(report.findings)) return { name, status: 'unrunnable', errors: 1, byCode: {}, detail: (run.stderr || run.stdout || `exit ${run.status}`).trim().split('\n')[0] };
  if (report.errors?.length) return { name, status: 'unrunnable', errors: report.errors.length, byCode: {}, detail: String(report.errors[0]).split('\n')[0] };
  const byCode = {};
  for (const finding of report.findings) {
    const code = finding.code ?? finding.rule;
    byCode[code] = (byCode[code] ?? 0) + 1;
  }
  return { name, status: report.counts.error === 0 ? 'clean' : 'findings', errors: report.counts.error, byCode };
}

export function checkExamples({ examplesDir, only, bin } = {}) {
  return exampleDirs(examplesDir, only).map((name) => checkExample(examplesDir, name, { bin }));
}

export function formatResults(results) {
  const lines = [];
  for (const r of results) {
    lines.push(`${r.name}: ${r.status === 'clean' ? 'clean' : r.status === 'unrunnable' ? `the check could not run (${r.detail})` : `${r.errors} finding${r.errors === 1 ? '' : 's'}`}`);
    for (const [code, count] of Object.entries(r.byCode).sort(([a], [b]) => a.localeCompare(b))) lines.push(`  ${code} x${count}`);
  }
  const bad = results.filter((r) => r.status !== 'clean').length;
  lines.push(results.length ? `${bad} of ${results.length} example${results.length === 1 ? '' : 's'} not clean` : 'no example with an hfs.json found');
  return `${lines.join('\n')}\n`;
}

/** The CLI: `bin` is the hfs CLI the examples are linted with (the runtime's own by default; a spec passes a stub). */
export function main(argv, { out = (s) => process.stdout.write(s), err = (s) => process.stderr.write(s), bin = HFS_BIN } = {}) {
  let examplesDir = path.join(skillRoot, 'examples');
  let only;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--examples' && argv[i + 1]) { examplesDir = path.resolve(argv[i + 1]); i += 1; }
    else if (argv[i] === '--only' && argv[i + 1]) { only = argv[i + 1]; i += 1; }
    else { err(`unexpected argument ${argv[i]}; ${USAGE}\n`); return 2; }
  }
  const results = checkExamples({ examplesDir, only, bin });
  out(formatResults(results));
  return results.length && results.every((r) => r.status === 'clean') ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
