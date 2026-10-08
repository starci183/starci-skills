#!/usr/bin/env node
// check-example-architecture.mjs - the examples meet their own standard (RED14). Runs `starci app lint --format json` at the root of
// every examples/<name> app that has an hfs.json, through the `starci` bin the example installs (its @starci/cli), else this runtime's
// packages/cli/bin/starci.mjs (scripts/lib/package-at.mjs starciBin) - THE lint of an app: ESLint over be/ and fe/ with the two canons,
// which judge the architecture machine's source findings, stylelint over fe/ and `starci app check`. It prints per example the
// findings by code plus bounded app-relative locations, and fails when any example has a finding or a tool that
// could not run. `starci app check` alone is not the standard: the machine's source rules (BE_FEATURE_NOT_COMPOSED, HFS_UNUSED_FILE,
// ...) sit on the lint surface (scripts/hfs/architecture/surface.mjs) and reach an app only through `starci app lint`.
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
import { starciBin } from '../lib/package-at.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const USAGE = 'usage: starci runtime check --only example-architecture -- [--examples <dir>] [--only <name>]';

/** The example directories under `examplesDir` that declare an hfs.json, by name. */
export function exampleDirs(examplesDir, only) {
  return fs.readdirSync(examplesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(examplesDir, e.name, 'hfs.json')) && (!only || e.name === only))
    .map((e) => e.name).sort(byCodeUnit);
}

const LINT_SHAPE = (report) => report.schema === 'starci/lint@1' && typeof report.ok === 'boolean'
  && Number.isInteger(report.counts?.error) && report.counts.error >= 0
  && Array.isArray(report.errors) && report.errors.every((item) => typeof item === 'string')
  && Array.isArray(report.findings) && report.findings.every((item) => item && typeof (item.code ?? item.rule) === 'string')
  && report.counts.error === report.findings.length
  && report.ok === (report.counts.error === 0 && report.errors.length === 0);

/** The app-relative path of a finding safe to print, or null (absolute, overlong, control-char or private-segment path). */
const publicPathOf = (file) => file && file.length <= 512 && !path.posix.isAbsolute(file) && !path.win32.isAbsolute(file)
  && !/[\u0000-\u001f\u007f<>:"|?*]/.test(file)
  && (file === '.' || file.split('/').every((part) => part && part !== '.' && part !== '..'
    && !/^(?:\.git|\.starciwork|node_modules|\.env(?:\..*)?|credentials(?:\..*)?)$/i.test(part)));

const CODE_TOKEN = /^[A-Za-z0-9@][A-Za-z0-9_@./:-]{0,159}$/;

/** The displayed fields of one report finding (a bounded subset of existing report fields; never messages or raw tool output). */
const displayedFinding = (finding, code, file) => {
  const selected = { code, path: file };
  for (const key of ['rule', 'slot']) {
    if (typeof finding[key] === 'string' && CODE_TOKEN.test(finding[key])) selected[key] = finding[key];
  }
  if (Number.isSafeInteger(finding.line) && finding.line > 0) {
    selected.line = finding.line;
    if (Number.isSafeInteger(finding.column) && finding.column > 0) selected.column = finding.column;
  }
  return selected;
};

/** The {byCode, findings} of a validated lint report: the finding counts and the bounded display list. */
const lintFindings = (report) => {
  const byCode = {};
  const findings = [];
  for (const finding of report.findings) {
    const code = finding.code ?? finding.rule;
    byCode[code] = (byCode[code] ?? 0) + 1;
    const file = typeof finding.path === 'string' ? finding.path.replaceAll('\\', '/') : null;
    if (!publicPathOf(file) || findings.length >= 100 || !CODE_TOKEN.test(code)) continue;
    findings.push(displayedFinding(finding, code, file));
  }
  return { byCode, findings };
};

/**
 * {name, status, errors, byCode, findings} of one example: status is `clean`, `findings` or `unrunnable` (the CLI refused, printed no
 * report, or a tool of the lint could not run - a lint that did not run is never clean).
 */
function checkExample(examplesDir, name, { bin, runner = runNode } = {}) {
  const root = path.join(examplesDir, name);
  const run = runner([bin ?? starciBin(root), 'app', 'lint', '--format', 'json'], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  const refused = (detail) => ({ name, status: 'unrunnable', errors: 1, byCode: {}, detail });
  let report;
  try { report = JSON.parse(run.stdout); } catch { report = null; }
  // JSON printed before a failed child is diagnostic output, not evidence that lint completed.
  if (run.error != null || run.signal != null || ![0, 1, 2].includes(run.status))
    return refused(`lint did not complete (exit ${run.status}, signal ${run.signal ?? 'none'})`);
  if (!report) return refused(String(run.stderr || run.stdout || `exit ${run.status}`).trim().split('\n')[0]);
  if (!LINT_SHAPE(report)) return refused('malformed starci/lint@1 report');
  // This gate judges the whole selected app, never a clean report from another root or a partial lint.
  if (typeof report.repoRoot !== 'string' || path.resolve(report.repoRoot) !== path.resolve(root)
    || report.changed !== null || report.workspace !== null) return refused('lint report does not bind the whole selected example');
  if (report.errors.length) return { name, status: 'unrunnable', errors: report.errors.length, byCode: {}, detail: report.errors[0].split('\n')[0] };
  if (run.status !== (report.counts.error === 0 ? 0 : 1)) return refused('lint exit disagrees with its report');
  const { byCode, findings } = lintFindings(report);
  return { name, status: report.counts.error === 0 ? 'clean' : 'findings', errors: report.counts.error, byCode, findings };
}

export function checkExamples({ examplesDir, only, bin, runner } = {}) {
  return exampleDirs(examplesDir, only).map((name) => checkExample(examplesDir, name, { bin, runner }));
}

const statusText = (r) => {
  if (r.status === 'clean') return 'clean';
  if (r.status === 'unrunnable') return `the check could not run (${r.detail})`;
  return `${r.errors} finding${r.errors === 1 ? '' : 's'}`;
};

const locationText = (f) => {
  if (!f.line) return f.path;
  return f.column ? `${f.path}:${f.line}:${f.column}` : `${f.path}:${f.line}`;
};

/** The lines one result contributes to the report. */
const resultLines = (r) => {
  const lines = [`${r.name}: ${statusText(r)}`];
  for (const [code, count] of Object.entries(r.byCode).sort(([a], [b]) => a.localeCompare(b))) lines.push(`  ${code} x${count}`);
  for (const f of r.findings ?? []) {
    const rule = f.rule && f.rule !== f.code ? ` (${f.rule})` : '';
    const slot = f.slot ? ` slot:${f.slot}` : '';
    lines.push(`  ${locationText(f)}  ${f.code}${rule}${slot}`);
  }
  if (r.findings && r.errors > r.findings.length) lines.push(`  ${r.errors - r.findings.length} finding location(s) not shown (missing, private, unsafe or over the display limit)`);
  return lines;
};

export function formatResults(results) {
  const lines = [];
  for (const r of results) lines.push(...resultLines(r));
  const bad = results.filter((r) => r.status !== 'clean').length;
  if (results.length) lines.push(`${bad} of ${results.length} example${results.length === 1 ? '' : 's'} not clean`);
  else lines.push('no example with an hfs.json found');
  return `${lines.join('\n')}\n`;
}

/** The check: `bin` is the starci CLI the examples are linted with (by default each example's own, else the runtime's). */
export function main(argv, { out = (s) => process.stdout.write(s), err = (s) => process.stderr.write(s), bin, runner } = {}) {
  let examplesDir = path.join(skillRoot, 'examples');
  let only;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--examples' && argv[i + 1]) { examplesDir = path.resolve(argv[i + 1]); i += 1; }
    else if (argv[i] === '--only' && argv[i + 1]) { only = argv[i + 1]; i += 1; }
    else { err(`unexpected argument ${argv[i]}; ${USAGE}\n`); return 2; }
  }
  const results = checkExamples({ examplesDir, only, bin, runner });
  out(formatResults(results));
  return results.length && results.every((r) => r.status === 'clean') ? 0 : 1;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
