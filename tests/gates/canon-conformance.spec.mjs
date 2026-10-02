import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConformance, planSlices, seamPaths, unitOf } from '../../scripts/gates/canon-scan.mjs';
import { resolveOpParams } from '../../scripts/kernel/dispatch-op.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
const plan = (text) => {
  const result = node([path.join(ROOT, 'scripts', 'route', 'route-plan.mjs'), '--text', text, '--json']);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
};

test('a canon-conformance phrase in Vietnamese or English routes to the canon-conformance chain: a lint scan, then the refactor slices and the verify leg', () => {
  for (const text of [
    'd\u1ecdn n\u1ee3 todo-app-fe theo chu\u1ea9n starci',
    'chu\u1ea9n ho\u00e1 source ecommerce-app-fe',
    'D\u1ecdn n\u1ee3 k\u1ef9 thu\u1eadt my-app-fe: s\u1eeda h\u1ebft lint canon',
    'conform the todo-app-fe frontend to the starci canon, zero lint findings',
    'clean up the canon debt in the my-app-fe screens',
  ]) {
    const result = plan(text);
    assert.equal(result.status, 'ok', text);
    assert.equal(result.scopeKind, 'canon-conformance', text);
    const labels = result.legs.map((leg) => `${leg.op}${leg.instance ? `#${leg.instance}` : ''}`);
    assert.deepEqual(labels, ['review.verify#lint', 'test.author', 'code.refactor', 'review.verify', 'handover.review'], `${text}: the scan leg leads and no work.author remap follows`);
    assert.deepEqual(result.legs[0].kernelParams, { mode: 'lint' }, text);
    assert.equal(result.legs[0].params, undefined, `${text}: mode is the kernel's, never an owner param on the goal leg`);
    assert.ok(result.edges.some(([from, to]) => from === 'review.verify#lint' && to === 'test.author'), text);
    assert.ok(!labels.includes('interface.draw') && !labels.includes('backend.implement'), `${text}: a canon cleanup builds nothing new`);
  }
});

test('a plain refactor keeps its chain: no scan leg, and work.author remaps the moved code', () => {
  const result = plan('refactor the billing module into smaller services');
  assert.equal(result.scopeKind, 'refactor');
  assert.deepEqual(result.legs.map((leg) => `${leg.op}${leg.instance ? `#${leg.instance}` : ''}`), ['test.author', 'code.refactor', 'work.author', 'review.verify', 'handover.review']);
});

test('the kernel cuts a canon code.refactor leg by canon-scan slices, each still sized by api estimate', () => {
  const cut = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'driver-loop.yaml'), 'utf8')).tick.enqueue.cutExecution;
  const text = cut.replace(/\s+/g, ' ');
  assert.match(text, /params\.canonFamilies is set takes its partition from `node scripts\/gates\/canon-scan\.mjs --root ROOT --families <value> \[--exclude <paths other workflows own>\] --json` -> `slices`/);
  assert.match(text, /each wave enqueued `--after` every job of the wave before it; each slice is still sized by `api estimate --paths`/);
});

test('the conformance leg carries the owner families as a declared code.refactor param', () => {
  const brief = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'ops', 'ops', 'code.refactor.yaml'), 'utf8'));
  // code.refactor also declares kernel params with defaults (canonWire, resumeFrom, admissionBase - canon slice wire).
  assert.deepEqual(resolveOpParams(brief, { leg: { canonFamilies: 'shape-slot,architecture' }, enforceRequired: true }).params,
    { gateRounds: 5, canonFamilies: 'shape-slot,architecture', canonWire: false, resumeFrom: '', admissionBase: '' });
  assert.equal(resolveOpParams(brief, { enforceRequired: true }).params.canonFamilies, '');
  assert.equal(resolveOpParams(brief, { flag: { canonFamilies: 'all' } }).ok, false, 'the kernel cannot set an owner param the leg does not carry');
});

const findings = (files, family = 'shape-slot') => files.map((file) => ({ machine: 'eslint', ruleId: `starci-fe/${family}`, family, file, line: 1, fixable: false }));

test('units follow the declared roots and skip route segments', () => {
  const conformance = loadConformance();
  assert.deepEqual(unitOf('src/components/blocks/sales/HandoffBlock/index.tsx', conformance), { unit: 'src/components/blocks/sales', wave: 2 });
  assert.deepEqual(unitOf('apps/app/src/app/[locale]/(console)/apps/page.tsx', conformance), { unit: 'apps/app/src/app/[locale]/(console)/apps', wave: 2 });
  assert.deepEqual(unitOf('packages/ui/src/leaves/Button/index.tsx', conformance), { unit: 'packages/ui/src/leaves/Button', wave: 1 });
  assert.deepEqual(unitOf('src/hooks/sales/useQueryOrderSwr.ts', conformance), { unit: 'src/hooks/sales', wave: 0 });
  assert.equal(unitOf('scripts/build.mjs', conformance).unit, 'scripts/build.mjs');
});

test('a small fixture tree cuts into disjoint slices: seams first, bounded size, every finding owned once', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-scope-'));
  try {
    fs.mkdirSync(path.join(root, 'src', 'modules', 'slot'), { recursive: true });
    const conformance = loadConformance();
    const list = [
      ...findings(Array.from({ length: 9 }, (_, i) => `src/components/blocks/sales/Block${i}/component.tsx`)),
      ...findings(['src/components/pages/OperatePage/component.tsx', 'src/components/leaves/MoneyText/index.tsx']),
      ...findings(['src/hooks/sales/useQueryOrderSwr.ts'], 'naming'),
      ...findings(['src/app/[lang]/(site)/layout.tsx'], 'file-layout'),
      { machine: 'architecture', ruleId: 'FE_TIER_DIRECTION', family: 'architecture', file: 'src/app/[lang]/(site)/about/page.tsx', line: 1, fixable: false, related: 'src/components/pages/AboutPage/index.tsx' },
    ];
    const seams = seamPaths(root, list, conformance.seams.next);
    assert.deepEqual(seams.map((seam) => [seam.path, seam.exists]), [
      ['src/modules/slot', true], ['src/hooks/slot', false], ['src/components/composites/SlotView', false],
    ]);
    const slices = planSlices(list, { conformance, maxFiles: 4, seams });
    const waves = slices.map((slice) => conformance.waves.indexOf(slice.wave));
    assert.deepEqual(waves, [...waves].sort((a, b) => a - b), 'foundation, then shared, then surfaces');
    assert.equal(slices[0].wave, 'foundation');
    for (const seam of seams) assert.ok(slices[0].paths.includes(seam.path) || slices.some((s) => s.wave === 'foundation' && s.paths.includes(seam.path)));
    const paths = slices.flatMap((slice) => slice.paths);
    for (const a of paths) for (const b of paths) if (a !== b) assert.ok(!a.startsWith(`${b}/`), `${a} and ${b} overlap`);
    for (const finding of list) assert.equal(paths.filter((p) => finding.file === p || finding.file.startsWith(`${p}/`)).length, 1, finding.file);
    assert.ok(slices.every((slice) => !slice.overTarget && slice.files <= 4), 'the nine-block domain splits one level deeper to fit');
    assert.equal(slices.reduce((sum, slice) => sum + slice.findings, 0), list.length);
    const bound = slices.find((slice) => slice.paths.includes('src/app/[lang]/(site)/about'));
    assert.ok(bound?.paths.includes('src/components/pages/AboutPage'), 'an import edge the fix must move stays inside one slice');
    assert.deepEqual(slices.map((slice) => slice.ordinal), slices.map((_, index) => index + 1));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// A fixture repository whose eslint package is a stub: it loads the repository's eslint.config.mjs,
// whose import of @starci/eslint-canon-fe exists nowhere in the fixture, and reports one finding per
// canon rule the config enabled. Only the runtime-source redirect lets that import resolve.
function fixtureRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-canon-scan-'));
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  write('package.json', JSON.stringify({ name: 'fixture', private: true, dependencies: { next: '15.0.0' } }));
  write('eslint.config.mjs', 'import { recommended } from "@starci/eslint-canon-fe"\nexport default [{ rules: recommended }]\n');
  write('node_modules/eslint/package.json', JSON.stringify({ name: 'eslint', version: '9.0.0-fixture', main: 'index.js' }));
  // The canon package's own dependencies resolve from the repository, as they do when it is installed.
  write('node_modules/@typescript-eslint/parser/package.json', JSON.stringify({ name: '@typescript-eslint/parser', version: '8.70.0-fixture', main: 'index.js' }));
  write('node_modules/@typescript-eslint/parser/index.js', 'module.exports = {};\n');
  write('node_modules/eslint/index.js', `
const path = require('node:path'), fs = require('node:fs'), { pathToFileURL } = require('node:url');
class ESLint {
  constructor(options) { this.cwd = options.cwd; this.fix = options.fix; }
  async lintFiles(targets) {
    const config = (await import(pathToFileURL(path.join(this.cwd, 'eslint.config.mjs')).href)).default;
    const rules = Object.keys(config[0].rules).filter((id) => id === 'starci-fe/base-props-atom' || id === 'starci-fe/no-inline-class-name');
    const files = [];
    const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.name === 'node_modules') continue; const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.tsx')) files.push(p); } };
    for (const t of targets) { const p = path.resolve(this.cwd, t); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); }
    return files.map((filePath) => ({ filePath, messages: rules.map((ruleId) => ({ ruleId, severity: 2, line: 1 })) }));
  }
  static async outputFixes() {}
}
module.exports = { ESLint };
`);
  write('src/components/blocks/sales/HandoffBlock/component.tsx', 'export const X = 1\n');
  write('src/components/leaves/MoneyText/index.tsx', 'export const Y = 1\n');
  return root;
}

test('canon-scan lints with the runtime canon source, groups by law, and bounds a slice with --paths', () => {
  const root = fixtureRepo();
  try {
    const scan = (...args) => node([path.join(ROOT, 'scripts', 'gates', 'canon-scan.mjs'), '--root', root, '--machines', 'eslint', '--json', ...args]);
    const all = scan();
    assert.equal(all.status, 1, all.stderr);
    const report = JSON.parse(all.stdout);
    assert.equal(report.schema, 'starci/canon-findings@1');
    assert.equal(report.canon.source, 'packages/eslint/fe');
    assert.deepEqual(report.totals.byFamily, { 'shape-slot': 2, 'class-names': 2 });
    assert.deepEqual(report.slices.map((slice) => slice.wave), ['foundation', 'shared', 'surfaces']);
    const one = JSON.parse(scan('--paths', 'src/components/leaves', '--families', 'shape-slot').stdout);
    assert.equal(one.totals.findings, 1);
    assert.deepEqual(one.findings.map((finding) => finding.file), ['src/components/leaves/MoneyText/index.tsx']);
    const deferred = JSON.parse(scan('--exclude', 'src/components/blocks').stdout);
    assert.equal(deferred.deferred.findings, 2);
    assert.ok(deferred.slices.every((slice) => slice.paths.every((p) => !p.startsWith('src/components/blocks'))));
    const clean = scan('--families', 'naming');
    assert.equal(clean.status, 0, 'zero findings of the selected families is a pass');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('canon-scan fails closed when a selected machine cannot run', () => {
  const root = fixtureRepo();
  try {
    const result = node([path.join(ROOT, 'scripts', 'gates', 'canon-scan.mjs'), '--root', root, '--json']);
    assert.equal(result.status, 3, result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'unavailable');
    assert.equal(report.machines.architecture.status, 'unavailable');
    assert.equal(node([path.join(ROOT, 'scripts', 'gates', 'canon-scan.mjs'), '--root', root, '--fix']).status, 2, '--fix without --paths is refused');
    const eslintOnly = node([path.join(ROOT, 'scripts', 'gates', 'canon-scan.mjs'), '--root', root, '--families', 'naming', '--json']);
    assert.equal(eslintOnly.status, 0, 'families without architecture need only the lint machine');
    assert.deepEqual(JSON.parse(eslintOnly.stdout).scope.machines, ['eslint']);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
