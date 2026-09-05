import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadOperatorPackages } from './operator-md.mjs';
import { validateAgainst } from './json-schema.mjs';
import { profileReceiptErrors } from './validate-response.mjs';
import { V22_CONTRACT } from './validate-request.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = await loadOperatorPackages(root);
const pkg = packages.find((candidate) => candidate.manifest.id === 'interface.audit');
const receipt = { contractVersion: V22_CONTRACT, status: 'done', boundProfile: 'sol-reviewer', ranProfile: 'sol-reviewer' };

test('the response schema permits a pre-dispatch skeleton but requires ranProfile after execution', async () => {
  const schema = JSON.parse(await readFile(path.join(root, 'templates', 'step', 'response.schema.json'), 'utf8'));
  const skeleton = {
    contractVersion: V22_CONTRACT,
    schemaVersion: 9,
    operatorId: 'interface.audit',
    step: 1,
    parallel: 1,
    status: 'running',
    fields: {},
    fallbacks: [],
    commits: [],
    next: [],
    attempt: { id: 'audit-a1', number: 1, expectedVersion: 1 },
    boundProfile: 'sol-reviewer'
  };
  assert.deepEqual(validateAgainst(schema, skeleton), []);
  const waiting = { ...skeleton, status: 'waiting', awaiting: { exchange: 'critique', kind: 'critique' } };
  assert.ok(validateAgainst(schema, waiting).some((error) => error.includes('ranProfile')));
  assert.deepEqual(validateAgainst(schema, { ...waiting, ranProfile: 'sol-reviewer' }), []);
});

test('a v2.2 receipt records the real active bound profile, or its one active equivalent', async () => {
  assert.ok(pkg, 'the test must use the shipped interface.audit package');
  assert.deepEqual(await profileReceiptErrors(root, pkg, receipt), []);
  assert.deepEqual(await profileReceiptErrors(root, pkg, { ...receipt, ranProfile: 'fable' }), []);
});

test('a v2.2 receipt rejects omitted, wrong, unknown, and retired runtime profiles', async () => {
  assert.ok((await profileReceiptErrors(root, pkg, { contractVersion: V22_CONTRACT, status: 'done' })).some((error) => error.includes('ranProfile')));
  assert.ok((await profileReceiptErrors(root, pkg, { ...receipt, ranProfile: 'sol-fresh' })).some((error) => error.includes('neither boundProfile')));
  assert.ok((await profileReceiptErrors(root, pkg, { ...receipt, ranProfile: 'missing-profile' })).some((error) => error.includes('not a declared profile')));
  assert.ok((await profileReceiptErrors(root, pkg, { ...receipt, ranProfile: 'astra' })).some((error) => error.includes('retired')));
  assert.ok((await profileReceiptErrors(root, pkg, { ...receipt, boundProfile: 'sol-fresh', ranProfile: 'sol-fresh' })).some((error) => error.includes('is not the profile')));
});
