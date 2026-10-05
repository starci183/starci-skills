// Current finding-line comparisons ignore summary-count drift and preserve every new refusal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineVerdict, findingLines } from '../../scripts/supervisor/land.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { openLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { compareSides, gateSide, gateStability } from '../../scripts/supervisor/gate-stability.mjs';

const CITES = 'scripts/checks/check-contract-cites.mjs';
const DEAD = [
  'modules/kernel/fixture-de76bd14.yaml:22  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/fixture-6621e5fe.yaml:11  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/fixture-b0944c68.yaml:15  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/fixture-f3f87816.yaml:68  scripts/hfs/architecture/size-growth.mjs — no such file (prose path)',
  'modules/kernel/fixture-733e599f.yaml:47  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/fixture-4db324e6.yaml:4  scripts/old-secrets-guard.mjs — no such file (prose path)',
  'modules/kernel/fixture-e17d08bc.yaml:8  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/fixture-bb732578.yaml:19  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/fixture-97a5d9b1.yaml:29  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/fixture-2f8ce4b5.yaml:35  packages/hfs/templates/fe/ci-workflows/github/workflows/e2e-gone.yml — no such file (prose path)',
  'modules/kernel/fixture-772bc425.yaml:21  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
];
const cites = (dead, checked) => ({ ok: false, full: [`check-contract-cites: ${dead.length} dead cite(s) of ${checked} checked`, ...dead.map((l) => `  ${l}`)].join('\n') + '\n' });

test('the same 11 dead cites under a different "of N checked" count are unchanged-red', () => {
  const v = baselineVerdict(CITES, cites(DEAD, 5368), cites(DEAD, 5370));
  assert.equal(v.ok, true);
  assert.deepEqual(v.newFindings, []);
});

test('one added dead cite is red and the verdict names the new line', () => {
  const added = 'modules/kernel/fixture-e8f172a2.yaml:9  scripts/nope.mjs — no such file (prose path)';
  const v = baselineVerdict(CITES, cites(DEAD, 5368), cites([...DEAD, added], 5370));
  assert.equal(v.ok, false);
  assert.deepEqual(v.newFindings, [added]);
});

test('a finding the land removed is fine', () => {
  const v = baselineVerdict(CITES, cites(DEAD, 5368), cites(DEAD.slice(1), 5367));
  assert.equal(v.ok, true);
  assert.deepEqual(v.newFindings, []);
});

test('main green, candidate red is red', () => {
  const v = baselineVerdict(CITES, { ok: true, full: 'check-contract-cites: 5368 cites in 900 files all resolve\n' }, cites(DEAD.slice(0, 1), 5370));
  assert.equal(v.ok, false);
  assert.deepEqual(v.newFindings, [DEAD[0]]);
});

test('no baseline, candidate red is red', () => {
  assert.equal(baselineVerdict(CITES, undefined, cites(DEAD, 5370)).ok, false);
});

test('a green candidate is ok whatever main said', () => {
  assert.equal(baselineVerdict(CITES, cites(DEAD, 5368), { ok: true, full: 'check-contract-cites: 1 cites in 1 files all resolve\n' }).ok, true);
});

test('each tree check has identifiable finding lines and its summary line is dropped', () => {
  assert.deepEqual(findingLines('scripts/checks/check-module-yaml.mjs', 'UNPARSEABLE knowledge/patterns/be/gone-cqrs.yaml: Invalid or unsupported YAML\n'), ['UNPARSEABLE knowledge/patterns/be/gone-cqrs.yaml: Invalid or unsupported YAML']);
  assert.deepEqual(findingLines('scripts/checks/check-cli-parity.mjs', 'check-cli-parity: RT_CLI_VERB_PARITY — 1 parity finding(s)\n  catalog:kernel: verb module scripts/kernel/verbs/c.mjs has no catalog file\n'), ['catalog:kernel: verb module scripts/kernel/verbs/c.mjs has no catalog file']);
  assert.deepEqual(findingLines('scripts/checks/check-db-gone.mjs', '  packages/hfs/runtime/engine/db/machine.mjs:310  new DatabaseSync outside engine/db/machine.mjs\ncheck-db-gone: red\n'), ['packages/hfs/runtime/engine/db/machine.mjs:310  new DatabaseSync outside engine/db/machine.mjs']);
  assert.deepEqual(findingLines(CITES, cites(DEAD, 5368).full), DEAD);
});

test('a red run printing no finding line falls back to the exact text', () => {
  const pre = { ok: false, full: 'check-db-gone: red\n' };
  assert.equal(baselineVerdict('scripts/checks/check-db-gone.mjs', pre, { ok: false, full: 'check-db-gone: red\n' }).ok, true);
  assert.equal(baselineVerdict('scripts/checks/check-db-gone.mjs', pre, { ok: false, full: 'check-db-gone: red (2)\n' }).ok, false);
});

test('a baseline without full output (older rows) compares its output', () => {
  const pre = { ok: false, output: cites(DEAD, 5368).full };
  assert.equal(baselineVerdict(CITES, pre, cites(DEAD, 5370)).ok, true);
});

test('explicit current gates compare the newest accepted leg and retain unavailable evidence', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sup-k-gate-compare-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite'), STARCI_PROJECTS_ROOT: path.join(root, 'projects') };
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo);
  const ledgerFile = ledgerFileFor(repo, { env }), ledger = openLedger({ file: ledgerFile });
  try {
    seedWorkflow(ledger, { id: 'wf-current-gate', phase: 'running', jobs: [
      { jobId: 'accepted-older', opId: 'code.refactor', status: 'succeeded', createdAt: 1, payload: { owned_paths: ['docs/older.md'] } },
      { jobId: 'accepted-newest', opId: 'code.refactor', status: 'succeeded', createdAt: 2, payload: { owned_paths: ['docs/current.md'] } },
    ] });
  } finally { ledger.close(); }
  const tree = (name, text) => { const dir = path.join(root, name); fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, 'gate.mjs'), text); return dir; };
  const base = tree('base', 'export const findings = () => ({ findings: [] });\n');
  const head = tree('head', "export const findings = ({ files }) => ({ findings: files.map((path) => ({ code: 'CURRENT_REFUSAL', path })) });\n");
  const gates = [{ module: 'gate.mjs', export: 'findings' }], options = { family: 'code.refactor', ledgers: [ledgerFile], gates };
  const before = await gateSide({ ...options, tree: base }), after = await gateSide({ ...options, tree: head });
  assert.deepEqual(after.legs.map((leg) => leg.jobId), ['accepted-newest']);
  const compared = compareSides(before, after);
  assert.deepEqual([compared.legs, compared.flips, compared.newlyFailing], [1, 1, 1]);
  assert.deepEqual(compared.perLeg[0].newFindings, [{ code: 'CURRENT_REFUSAL', path: 'docs/current.md' }]);
  await assert.rejects(gateSide({ ...options, tree: base, gates: [] }), /explicit nonempty/);
  assert.match(gateStability({ base, head, family: options.family, gates: [] }).error, /explicit nonempty/);
  const absent = await gateSide({ ...options, tree: base, gates: [{ module: 'missing.mjs', export: 'findings' }] });
  assert.match(absent.errors.join(';'), /module absent/);
  const missingExport = await gateSide({ ...options, tree: base, gates: [{ module: 'gate.mjs', export: 'absent' }] });
  assert.match(missingExport.errors.join(';'), /export absent/);
  const unavailable = compareSides(absent, after);
  assert.equal(unavailable.flips, 0, 'an unavailable baseline cannot prove an accepted-to-red flip');
  assert.match(unavailable.perLeg[0].errors.join(';'), /module absent/);
});
