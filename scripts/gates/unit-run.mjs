#!/usr/bin/env node
// unit-run.mjs - the unit run summary (schema starci/unit-run@1) unit.verify attaches (knowledge/op-gate.yaml proofs.unit-kit,
// contract change op-mechanism-proofs).
//
//   starci gate unit --root <app> [--out <file>]
//
// The unit standard (packages/jest-preset README, knowledge/patterns/be/test.yaml): the unit-tested roles of the slot manifest
// (ruleParams.be.unitRoles: every be/src/**/*.service.ts, every cli command of be.cli) own one <name>.<role>.spec.ts beside each, the subject built by
// Test.createTestingModule over exactly its constructor dependencies with the @starci/jest-preset kit doubles (mockEntityManager, fakeTransaction,
// fakeCache, fakeLock, recordingEventBus, recordingQueueOutbox, FakeClock, fakeIds, mock) and the Outcome matchers; and every file the coverage scope
// measures (a logic role inside a slot whose `coverage` is required: scripts/hfs/coverage-scope.mjs) is at 100 on lines, branches, functions and
// statements on its own, with or without a spec of its own. Over the app at --root it records:
//   run       the managed `npm test` (the unit project with --coverage) with jest's --json report and a json-summary coverage
//             report into a private temp directory: exit, totals, failures;
//   services  per subject, a spec-required unit role or a measured file (its role in `role`): its coverage (the four pcts, owed when `measured`), its
//             spec beside it (owed when `specRequired`), and the kit judgment of that spec of a spec-required subject
//             (op-gate.yaml unitKit: Test.createTestingModule required; jest.mock, overrideProvider, Date.now(), process.env and a
//             `new <Service>(` of the subject forbidden).
// `starci kernel settle` re-reads it (scripts/kernel/gate-settle.mjs). Exit 0 green, 1 a finding or a red run, 2 it could not be built.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runNpm } from '../api/npm/run-npm.mjs';
import { fileURLToPath } from 'node:url';
import { posixPath } from '../lib/path-key.mjs';
import { isMain } from '../lib/is-main.mjs'; import { walkFiles } from '../lib/walk.mjs';
import { jestRunError, reduceJest } from './test-world-run.mjs';
import { loadSlotManifest } from '../hfs/slots.mjs';
import { unitRolesOf } from '../hfs/manifest-shape.mjs';
import { globExpression, braceVariants } from '../lib/glob.mjs';
import { isMeasured } from '../hfs/coverage-scope.mjs';
import { opGateRules } from '../lib/op-gate.mjs';

export const UNIT_RUN_SCHEMA = 'starci/unit-run@1';
const COVERAGE_METRICS = Object.freeze(['lines', 'branches', 'functions', 'statements']);
const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVICE_ROOT = 'be/src';
const USAGE = 'usage: starci gate unit --root <app> [--out <file>]';

/** op-gate.yaml unitKit: {required[], forbidden[]}. */
export function unitKitRules(runtime = runtimeRoot) {
  const rules = opGateRules(runtime, 'unitKit');
  return { required: rules.required, forbidden: rules.forbidden };
}

const BE = 'be/';

/** `variant` with each `<placeholder>` replaced by `*` (an empty `<>` is left alone, as <[^>]+> requires a name). */
const placeholderStars = (variant) => {
  let out = '', i = 0;
  for (;;) {
    const open = variant.indexOf('<', i);
    if (open < 0) return out + variant.slice(i);
    const close = variant.indexOf('>', open + 1);
    if (close < 0) return out + variant.slice(i);
    if (close === open + 1) { out += variant.slice(i, open + 1); i = open + 1; continue; }
    out += `${variant.slice(i, open)}*`;
    i = close + 1;
  }
};

/** True when the be-relative `file` lies inside slot `id` (its path with each `<placeholder>` a `*`, a directory owning everything below it). */
function inSlot(manifest, id, file) {
  const slot = manifest.slots.find((candidate) => candidate.id === id);
  if (!slot) return false;
  return braceVariants(slot.path).some((variant) => globExpression(`${placeholderStars(variant)}${variant.endsWith('/') ? '**' : ''}`).test(file));
}

/** The spec-required unit role of an app-relative file, or null: its name ends in .<role>.ts under be/src (outside be/src/tests) and, for a role tied to a slot, inside that slot. */
export function unitRoleOf(rel, roles = unitRolesOf(loadSlotManifest()), manifest = loadSlotManifest()) {
  if (!rel.startsWith(`${BE}src/`) || rel.startsWith(`${BE}src/tests/`)) return null;
  return roles.find((role) => rel.endsWith(`.${role.role}.ts`) && (role.slot === undefined || inSlot(manifest, role.slot, rel.slice(BE.length)))) ?? null;
}

/** The role a file name carries (`<name>.<role>.ts`), or null. */
const roleOfName = (rel) => /\.([a-z][a-z0-9-]*)\.ts$/.exec(rel)?.[1] ?? null;

/** The subjects of the app outside be/src/tests: every spec-required unit role (ruleParams.be.unitRoles) and every measured file (the coverage scope), app-relative POSIX paths. */
export function servicesOf(root, roles = unitRolesOf(loadSlotManifest()), manifest = loadSlotManifest()) {
  const dir = path.join(root, SERVICE_ROOT);
  if (!fs.existsSync(dir)) return [];
  return walkFiles(dir, { sorted: true, exclude: (name, full, entry) => entry.isDirectory() && ['node_modules', 'dist', 'coverage', 'tests'].includes(name) })
    .map((file) => posixPath(path.relative(root, file)))
    .filter((rel) => !rel.endsWith('.spec.ts') && (unitRoleOf(rel, roles, manifest) !== null || isMeasured(manifest, rel.slice(BE.length))));
}

/** The kit judgment of one service spec: the forbidden needles it uses, the required ones it lacks, a `new Subject(`. */
function judgeServiceSpec(text, serviceText, rules) {
  const code = String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r\u2028\u2029]*/gm, '$1');
  const subject = /export\s+class\s+(\w+)/.exec(String(serviceText ?? ''))?.[1] ?? null;
  return { missing: rules.required.filter((needle) => !code.includes(needle)), forbidden: rules.forbidden.filter((needle) => code.includes(needle)),
    constructsSubject: Boolean(subject && new RegExp(String.raw`new\s+${subject}\s*\(`).test(code)), subject };
}

/** The per-subject records from the coverage summary (keys absolute or app-relative) and the specs beside each subject. */
export function judgeServices(root, coverage, rules = unitKitRules()) {
  const byRel = new Map();
  for (const [file, metrics] of Object.entries(coverage ?? {})) {
    if (file === 'total') continue;
    const rel = posixPath(path.isAbsolute(file) ? path.relative(root, file) : file);
    byRel.set(rel, metrics);
  }
  const manifest = loadSlotManifest();
  const roles = unitRolesOf(manifest);
  return servicesOf(root, roles, manifest).map((rel) => {
    const metrics = byRel.get(rel) ?? null;
    const pct = Object.fromEntries(COVERAGE_METRICS.map((m) => [m, metrics?.[m]?.pct ?? null]));
    const unitRole = unitRoleOf(rel, roles, manifest);
    const roleName = unitRole?.role ?? roleOfName(rel);
    const suffix = `.${roleName}.ts`;
    const specName = unitRole?.spec ?? `${roleName}.spec`;
    const specRel = `${rel.slice(0, -suffix.length)}.${specName}.ts`;
    const spec = fs.existsSync(path.join(root, specRel)) ? specRel : null;
    const kit = spec && unitRole ? judgeServiceSpec(fs.readFileSync(path.join(root, specRel), 'utf8'), fs.readFileSync(path.join(root, rel), 'utf8'), rules) : null;
    return { path: rel, role: roleName, measured: isMeasured(manifest, rel.slice(BE.length)), specRequired: unitRole !== null, coverage: pct, spec, kit };
  });
}

/** The findings of a summary, each {rule, path, message}. */
export function unitFindings(summary) {
  const out = [];
  for (const s of summary.services ?? []) {
    const below = COVERAGE_METRICS.filter((m) => s.coverage?.[m] !== 100);
    if (s.measured !== false && below.length) {
      const parts = below.map((m) => `${m} ${s.coverage?.[m] ?? 'not measured'}`).join(', ');
      out.push({ rule: 'coverage-below', path: s.path, message: `${parts} (every measured file owes 100 on each metric)` });
    }
    if (s.specRequired === false) continue;
    if (!s.spec) { out.push({ rule: 'spec-missing', path: s.path, message: `no <name>.${s.role ?? 'service'}.spec.ts beside it` }); continue; }
    for (const needle of s.kit?.missing ?? []) out.push({ rule: 'kit', path: s.spec, message: `the spec never uses ${needle}` });
    for (const needle of s.kit?.forbidden ?? []) out.push({ rule: 'kit', path: s.spec, message: `the spec uses ${needle}` });
    if (s.kit?.constructsSubject) out.push({ rule: 'kit', path: s.spec, message: `the spec constructs ${s.kit.subject} with new: build it through Test.createTestingModule` });
  }
  return out;
}

/** Run the managed `npm test` with jest's JSON report and a json-summary coverage report: {command, exit, ...totals, coverage, error}. */
function runUnit(root, { npm = runNpm } = {}) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-unit-run-'));
  const outFile = path.join(outDir, 'jest.json');
  const covDir = path.join(outDir, 'coverage');
  const args = ['test', '--', '--json', `--outputFile=${outFile}`, '--coverageReporters=json-summary', '--coverageReporters=text-summary', `--coverageDirectory=${covDir}`];
  const run = npm(args, { cwd: root, maxBuffer: 512 * 1024 * 1024 });
  let report = null, coverage = null;
  try { report = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { report = null; }
  try { coverage = JSON.parse(fs.readFileSync(path.join(covDir, 'coverage-summary.json'), 'utf8')); } catch { coverage = null; }
  for (const file of [path.join(covDir, 'coverage-summary.json'), outFile]) { try { fs.rmSync(file, { force: true }); } catch { /* temp */ } }
  for (const dir of [covDir, outDir]) { try { fs.rmdirSync(dir); } catch { /* temp; a reporter may leave more */ } }
  return { command: `npm ${args.filter((a) => !/^--(outputFile|coverageDirectory)=/.test(a)).join(' ')}`, exit: run.status ?? null,
    ...(report ? reduceJest(report) : { total: 0, passed: 0, failed: 0, skipped: 0, files: 0, failedFiles: 0, failures: [] }), coverage,
    error: jestRunError(report, run) };
}

/** Measure the required unit project and its subject coverage; missing or incomplete runs remain non-green. */
export function buildUnitRun({ root, rules = unitKitRules(), npm = runNpm }) {
  const abs = path.resolve(root);
  const { coverage, ...run } = runUnit(abs, { npm });
  const summary = { schema: UNIT_RUN_SCHEMA, at: new Date().toISOString(), root: posixPath(abs), run, services: judgeServices(abs, coverage, rules), findings: [], exit: 2 };
  summary.findings = unitFindings(summary);
  const red = run.error || run.exit !== 0 || run.failed > 0 || run.failedFiles > 0 || run.skipped > 0 || run.total === 0;
  if (run.error) summary.exit = 2;
  else summary.exit = summary.findings.length || red ? 1 : 0;
  return summary;
}

if (isMain(import.meta.url)) {
  try {
    const argv = process.argv.slice(2);
    const opts = { root: null, out: null };
    for (let i = 0; i < argv.length; i += 1) {
      if (argv[i] === '--root' || argv[i] === '--out') opts[argv[i].slice(2)] = argv[++i];
      else throw new Error(`unknown argument ${argv[i]}; ${USAGE}`);
    }
    const summary = buildUnitRun({ root: opts.root ?? process.cwd() });
    const text = `${JSON.stringify(summary, null, 2)}\n`;
    if (opts.out) { fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true }); fs.writeFileSync(path.resolve(opts.out), text); }
    process.stdout.write(text);
    process.exitCode = summary.exit;
  } catch (error) {
    process.stderr.write(`unit-run: ${error.message}\n`);
    process.exitCode = 2;
  }
}
