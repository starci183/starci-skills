// proves: RT_EVENT_SPILL_BYPASS@lite
// proves: RT_EVENT_SPILL_BYPASS@full
// proves: RT_STORAGE_UNDECLARED@lite
// proves: RT_STORAGE_UNDECLARED@full
// proves: RT_ROOT_ADHOC@lite
// proves: RT_ROOT_ADHOC@full
// proves: RT_HELD_UNSURFACED@lite
// proves: RT_HELD_UNSURFACED@full
// proves: RT_OP_JUDGE_UNDECLARED@lite
// proves: RT_OP_JUDGE_UNDECLARED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkEventSpill } from '../../scripts/checks/check-event-spill.mjs';
import { checkStorageConvention, REGISTRY_FILE } from '../../scripts/checks/check-storage-convention.mjs';
import { checkRootAdhoc } from '../../scripts/checks/check-root-adhoc.mjs';
import { checkHeldSurfacing } from '../../scripts/checks/check-held-surfacing.mjs';
import { checkOpJudge, CODE as OP_JUDGE_CODE } from '../../scripts/checks/check-op-judge.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE = 'scripts/kernel/cli.mjs';
const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();

function write(root, file, value) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
}

function fixture(t, edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-runtime-integrity-${edition}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

// Only log/show/ls-files read the checkout's existing Git metadata. Source reads
// use this sparse temporary tree; no Git command mutates an index or a ref.
function trackedFixture(t, edition, source) {
  const root = fixture(t, edition);
  write(root, '.git', `gitdir: ${gitDir}\n`);
  write(root, SOURCE, source);
  // A sandbox user may differ from the checkout owner. Trust this fixture only,
  // through its own process-scoped config; leave the user's global config alone.
  const previousConfig = process.env.GIT_CONFIG_GLOBAL;
  const config = path.join(root, 'git-config');
  write(root, 'git-config', '[safe]\n\tdirectory = ' + root.replaceAll(path.sep, '/') + '\n');
  process.env.GIT_CONFIG_GLOBAL = config;
  t.after(() => {
    if (previousConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = previousConfig;
  });
  return root;
}

function storageFixture(t, edition, undeclared) {
  const root = fixture(t, edition);
  const registry = parseYaml(fs.readFileSync(path.join(ROOT, REGISTRY_FILE), 'utf8'));
  if (undeclared) delete registry.columns.ledger.events.payload_json;
  write(root, REGISTRY_FILE, registry);
  return root;
}

function heldFixture(t, edition, surfaced) {
  const root = fixture(t, edition);
  const entry = { kind: 'runtime-fault', owner: 'supervisor' };
  if (surfaced) Object.assign(entry, { surfacedBy: 'open', openCase: 'carried' });
  write(root, 'modules/kernel/failure-codes.yaml', { SPEC_FAULT: entry });
  write(root, 'modules/reconciler/sla.yaml', { codes: {} });
  write(root, 'modules/reconciler/operating-standard.yaml', { departures: {} });
  write(root, 'modules/reconciler/edge-cases.yaml', { cases: [{ id: 'carried', status: 'open' }] });
  return root;
}

function judgeFixture(t, edition, declared) {
  const root = fixture(t, edition);
  const source = 'scripts/kernel/settle/job-settle-verify.mjs';
  const contract = { goal: { en: 'Make a product for independent runtime judgment.' } };
  if (declared) contract.judge = [{ by: 'machine', measures: ['declared-checks'], why: 'The runtime reruns the declared checks.' }];
  write(root, 'modules/ops/ops/spec.perform.yaml', contract);
  write(root, 'modules/models/kinds.yaml', { kinds: {} });
  write(root, 'knowledge/op-gate.yaml', { proofs: {}, opProofs: {} });
  write(root, 'modules/kernel/critic.yaml', { coverage: [] });
  write(root, 'modules/kernel/critic-rubrics.yaml', { kinds: [] });
  write(root, 'modules/kernel/op-judges.yaml', {
    measures: { 'declared-checks': { kind: 'product', independence: 'runtime', applies: 'dispatched', source } },
    ownerGates: {}, reviewers: {},
  });
  write(root, source, fs.readFileSync(path.join(ROOT, source), 'utf8'));
  return root;
}

for (const edition of ['lite', 'full']) {
  test(`${edition}: violating event writer bypasses appendEvent spill ownership`, (t) => {
    const root = trackedFixture(t, edition, "ledger.appendEvent({ kind: 'changed', payload, payloadSha });");
    assert.deepEqual(checkEventSpill(root).map((finding) => finding.code), ['RT_EVENT_SPILL_BYPASS']);
  });

  test(`${edition}: passing event writer delegates payload storage to appendEvent`, (t) => {
    const root = trackedFixture(t, edition, "ledger.appendEvent({ kind: 'changed', payload });");
    assert.deepEqual(checkEventSpill(root), []);
  });

  test(`${edition}: violating storage registry omits an actual event text column`, (t) => {
    const root = storageFixture(t, edition, true);
    assert.deepEqual(checkStorageConvention(root).map((finding) => finding.code), ['RT_STORAGE_UNDECLARED']);
  });

  test(`${edition}: passing storage registry declares the actual schemas of both stores`, (t) => {
    assert.deepEqual(checkStorageConvention(storageFixture(t, edition, false)), []);
  });

  test(`${edition}: violating runtime resolver grows raw root inputs beyond the landing baseline`, (t) => {
    const root = trackedFixture(t, edition, 'process.cwd();\n'.repeat(1024));
    assert.deepEqual(checkRootAdhoc(root).map((finding) => finding.code), ['RT_ROOT_ADHOC']);
  });

  test(`${edition}: passing runtime resolver uses the owning root helper`, (t) => {
    const root = trackedFixture(t, edition, 'const directory = invocationDir();');
    assert.deepEqual(checkRootAdhoc(root), []);
  });

  test(`${edition}: violating held fault has no mechanism that surfaces its stop`, (t) => {
    assert.deepEqual(checkHeldSurfacing(heldFixture(t, edition, false)).map((finding) => finding.code), ['RT_HELD_UNSURFACED']);
  });

  test(`${edition}: passing held fault explicitly carries its open surfacing gap`, (t) => {
    assert.deepEqual(checkHeldSurfacing(heldFixture(t, edition, true)), []);
  });

  test(`${edition}: violating op contract declares no judge`, (t) => {
    assert.equal(checkOpJudge(judgeFixture(t, edition, false)).filter((finding) => finding.code === OP_JUDGE_CODE).length, 1);
  });

  test(`${edition}: passing op contract names an independent runtime product judge`, (t) => {
    assert.equal(checkOpJudge(judgeFixture(t, edition, true)).filter((finding) => finding.code === OP_JUDGE_CODE).length, 0);
  });
}
