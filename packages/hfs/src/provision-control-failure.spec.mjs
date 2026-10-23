// The provision control verb names why it could not read or accept a prepared operation (scripts/lib/provision-control-failure.mjs, read by
// scripts/gates/provision-operation.mjs runProvisionControl): a plan blob that this runtime's blob store does not hold is its own code, every
// other failure keeps the stage and the error's identifier, and no detail ever carries an error message.
import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionControlFailure, errorIdentifier, PROVISION_CONTROL_STAGES } from '../runtime/scripts/lib/provision-control-failure.mjs';

const SHA = 'a'.repeat(64);
const missing = () => Object.assign(new Error(`blob not found: ${SHA}`), { code: 'ENOENT' });

test('a plan blob missing from this runtime names the blob, the operation and the runtime that prepared it', () => {
  const failure = provisionControlFailure(missing(), { stage: 'plan', planSha: SHA, operationId: 'd6f4b6a8-1c2d-4e5f-8a9b-0c1d2e3f4a5b' });
  assert.equal(failure.code, 'provision-plan-blob-missing');
  assert.match(failure.detail, /^the plan blob aaaaaaaaaaaa of operation d6f4b6a8-1c2d-4e5f-8a9b-0c1d2e3f4a5b is not in this runtime's blob store/);
  assert.match(failure.detail, /prepared by another runtime/);
});

test('a missing file outside the plan stage is not a missing plan blob', () => {
  for (const stage of ['ledger', 'target', 'accept']) {
    const failure = provisionControlFailure(missing(), { stage, planSha: SHA });
    assert.equal(failure.code, 'provision-control-unavailable');
    assert.equal(failure.detail, `the ${stage} stage failed (ENOENT); the operation journal holds its state`);
  }
});

test('any other failure keeps the stage and the identifier, never the message', () => {
  const sqlite = Object.assign(new Error('SQLITE_BUSY: token=secret-value'), { code: 'ERR_SQLITE_ERROR' });
  const failure = provisionControlFailure(sqlite, { stage: 'plan', planSha: SHA });
  assert.deepEqual(failure, { code: 'provision-control-unavailable', detail: 'the plan stage failed (ERR_SQLITE_ERROR); the operation journal holds its state' });
  assert.doesNotMatch(failure.detail, /secret-value/);
  assert.equal(provisionControlFailure(new TypeError('x'), { stage: 'accept' }).detail, 'the accept stage failed (TypeError); the operation journal holds its state');
  assert.equal(provisionControlFailure('not an error', { stage: 'ledger' }).detail, 'the ledger stage failed; the operation journal holds its state');
});

test('a malformed sha or operation id is left out of the detail', () => {
  const failure = provisionControlFailure(missing(), { stage: 'plan', planSha: 'not-a-sha', operationId: 'id with spaces' });
  assert.match(failure.detail, /^the plan blob is not in this runtime's blob store/);
});

test('an unknown stage is a caller bug', () => {
  assert.deepEqual(PROVISION_CONTROL_STAGES, ['ledger', 'plan', 'target', 'accept']);
  assert.throws(() => provisionControlFailure(missing(), { stage: 'execute' }), TypeError);
});

test('the identifier is the error code first, then the class name, and only an identifier', () => {
  assert.equal(errorIdentifier({ code: 'ENOENT', name: 'Error' }), 'ENOENT');
  assert.equal(errorIdentifier({ code: 'has space', name: 'RangeError' }), 'RangeError');
  assert.equal(errorIdentifier(null), null);
});
