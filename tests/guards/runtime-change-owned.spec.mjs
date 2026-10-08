import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileWriteVerdict } from '../../scripts/guards/rights.mjs';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';
import { requireRole } from '../../scripts/cli/roles.mjs';
import { runtimeChangeRefusal } from '../../scripts/machine/runtime-change.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = loadCommandPolicy({ root: ROOT });
const run = (args, role = 'supervisor') => policyVerdict({ role, command: { program: 'starci', args }, policy: POLICY });

test('a Supervisor running a land or a fix-worker verb is refused with the code that names Debug', () => {
  for (const args of [['supervisor', 'land', '--commit', 'abc'], ['supervisor', 'workers', 'stage', '--self'], ['supervisor', 'lesson-actions', 'land']]) {
    const verdict = run(args);
    assert.equal(verdict.code, 'RUNTIME_CHANGE_OWNED_BY_DEBUG', args.join(' '));
    assert.match(verdict.reason, /belongs to Debug/);
  }
});

test('a Supervisor still records a defect and reads the workers', () => {
  assert.equal(run(['supervisor', 'actions', 'record', '--item', 'runtime-defect:x', '--action', 'recorded']), null);
  assert.equal(run(['supervisor', 'workers', 'list']), null);
  assert.equal(runtimeChangeRefusal(['supervisor', 'workers', 'list']), null);
});

test('a Supervisor write inside the runtime checkout is refused with the same code', () => {
  const zone = { runtimeRoot: ROOT, rel: 'scripts/kernel/cli.mjs', zone: null, catalog: null };
  const verdict = fileWriteVerdict({ role: 'supervisor', filePath: path.join(ROOT, zone.rel), zone });
  assert.equal(verdict.code, 'RUNTIME_CHANGE_OWNED_BY_DEBUG');
  assert.equal(fileWriteVerdict({ role: 'supervisor', filePath: path.join(ROOT, zone.rel), zone: { ...zone, runtimeRoot: null } }), null);
});

test('the dispatcher refuses the land verb to the Supervisor seat and lets the owner run it', () => {
  const roles = ['coordinator', 'owner', 'release'];
  assert.match(requireRole({ role: 'lead', group: 'supervisor', verb: 'land', roles }), /RUNTIME_CHANGE_OWNED_BY_DEBUG/);
  assert.equal(requireRole({ role: 'owner', group: 'supervisor', verb: 'land', roles }), null);
});
