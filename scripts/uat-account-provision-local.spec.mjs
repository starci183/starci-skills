import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { candidateAccountRecord, stableUatIdentity } from './uat-account-provision-local.mjs';

const script = fileURLToPath(new URL('./uat-account-provision-local.mjs', import.meta.url));
const operatorInput = {
  schemaVersion: 7,
  operatorId: 'workspace/uat-account-provision',
  context: {
    authorityRefs: ['runtime-owner://central-runtime/generation/6'],
    runtimeOwnerRef: 'runtime-owner://central-runtime/generation/6',
    sourceFingerprint: `sha256:${'a'.repeat(64)}`,
  },
  input: {
    missionRef: 'mission://pro-subscription',
    project: 'starci-academy',
    feature: 'pro-subscription',
    flow: 'purchase',
    runId: 'run-1',
    role: 'learner',
    origin: 'http://localhost:3000',
    accountRecordRef: '.worktrees/uat/pro-subscription/purchase/snapshot.json#account',
    fixtureNamespace: 'uat-pro-subscription-purchase-run-1',
  },
};

test('local UAT identity is deterministic, synthetic, and run scoped', () => {
  const first = stableUatIdentity(operatorInput.input);
  const second = stableUatIdentity(operatorInput.input);
  const anotherRun = stableUatIdentity({ ...operatorInput.input, runId: 'run-2' });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, anotherRun);
  assert.match(first.username, /^uat-[0-9a-f]{20}$/u);
  assert.match(first.email, /^uat\.[0-9a-f]{20}@starci\.local$/u);
});

test('candidate account record contains only non-secret refs and fingerprints', () => {
  const record = candidateAccountRecord(operatorInput.input, 'thread://control-panel', 'kc-1', 'db-1');
  assert.equal(record.fixtureNamespace, operatorInput.input.fixtureNamespace);
  assert.match(record.identityRecordRef, /^keycloak-user:\/\/uat\//u);
  assert.match(record.applicationRecordRef, /^database-user:\/\/uat\//u);
  assert.match(record.principalFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.doesNotMatch(JSON.stringify(record), /password|accessToken|refreshToken|cookie|otp/iu);
});

test('preflight accepts a prospective snapshot target without creating or reading it', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-uat-provision-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const inputFile = path.join(directory, 'input.json');
  fs.writeFileSync(inputFile, JSON.stringify(operatorInput));
  const prospectiveSnapshot = path.resolve('.worktrees/uat/pro-subscription/purchase/snapshot.json');
  const existedBefore = fs.existsSync(prospectiveSnapshot);
  const result = spawnSync(process.execPath, [script, '--preflight', '--input', inputFile, '--provisioning-owner-ref', 'thread://control-panel'], {
    cwd: path.resolve(fileURLToPath(new URL('../..', import.meta.url))),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.outcome, 'preflight');
  assert.equal(output.snapshotTargetState, 'prospective');
  assert.equal(fs.existsSync(prospectiveSnapshot), existedBefore);
});
