// Proves validate.mjs on the shared migration fixture (scripts/migration-release-fixture.mjs): one
// migration applied once through the source-owned runner and replayed as a no-op, re-keyed to this
// operator, plus the branches a migration release may block on and one mutation per law, each of which
// must fail with a line that names the defect. The fixture is a whole synthetic host with a Git
// checkout, so this file runs under node:test the way the fixture expects.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { validateMigrationStep, RECEIPT, PROOF } from './validate.mjs';
import { migrationReleaseFixture } from '../../scripts/migration-release-fixture.mjs';
import { executeMigrationRelease } from '../../scripts/migration-release-run.mjs';

const OPERATOR = 'migration.release';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// The fixture writes its branch under the operator id the shared script knows; this operator's branch
// is the same plan, producers and proof, re-keyed: request.json carries only this operator's fields,
// state.json records this operator at the branch, and the receipt is signed by it.
async function rekey(f) {
  const requestFile = path.join(f.branch, 'request/request.json');
  const request = json(requestFile);
  const { release, target, approval, migration, resume } = request.requirements;
  write(requestFile, { ...request, operatorId: OPERATOR, requirements: { release, target, approval, migration, resume: resume ?? null } });
  const state = json(path.join(f.session, 'state.json'));
  state.steps['4/1'] = OPERATOR;
  state.requestHashes['4/1'] = hash(fs.readFileSync(requestFile));
  write(path.join(f.session, 'state.json'), state);
  const responseFile = path.join(f.branch, 'response/response.json');
  if (fs.existsSync(responseFile)) write(responseFile, { ...json(responseFile), operatorId: OPERATOR });
  const receiptFile = path.join(f.branch, RECEIPT);
  if (fs.existsSync(receiptFile)) fs.writeFileSync(receiptFile, fs.readFileSync(receiptFile, 'utf8').replace(OPERATOR_ROW, `| Operator | ${OPERATOR} |`));
}
const OPERATOR_ROW = /\| Operator \| `?[a-z.]+`? \|/;
const response = ({ status = 'done', stop, fields, next = [], extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 4, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks: [],
  fields: fields ?? (status === 'done' ? { 'migration-release': RECEIPT, 'migration-release-proof': PROOF } : {}), commits: [], next, ...extra,
});
async function errorsOf(f) { return (await validateMigrationStep(f.branch, f.root)).errors; }
async function expectValid(f, label) { assert.deepEqual(await errorsOf(f), [], `${label} should be valid`); }
async function expectError(f, needle, label) {
  const errors = await errorsOf(f);
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

test('a migration applied once through the source-owned runner and replayed as a no-op', async (t) => {
  const f = await migrationReleaseFixture(t);
  assert.deepEqual(await executeMigrationRelease(f.root, f.branch), { status: 'done', outcome: 'migrated', receipt: RECEIPT, proof: PROOF });
  f.finish();
  await rekey(f);
  await expectValid(f, 'the migrated branch re-keyed to migration.release');

  // The receipt restates the plan and the proof.
  const receipt = fs.readFileSync(path.join(f.branch, RECEIPT), 'utf8');
  const proof = json(path.join(f.branch, PROOF));
  fs.writeFileSync(path.join(f.branch, RECEIPT), receipt.replace(OPERATOR_ROW, '| Operator | release.deploy |'));
  await expectError(f, 'Binding Operator is release.deploy', 'a receipt signed by the image operator');
  fs.writeFileSync(path.join(f.branch, RECEIPT), receipt.replace('| Replay | no-op |', '| Replay | applied |'));
  await expectError(f, 'Outcome or the journal revisions differ from the proof', 'a replay that claims to have applied');
  fs.writeFileSync(path.join(f.branch, RECEIPT), receipt.replace(`| Target | ${f.plan.target} |`, '| Target | other/target |'));
  await expectError(f, 'Binding Target is other/target', 'a receipt for another target');
  fs.writeFileSync(path.join(f.branch, RECEIPT), receipt.replace(/\| 2 \| — \| 0 \|[^\n]*\n/, ''));
  await expectError(f, 'Executions has 1 rows, the proof has 2', 'a receipt that hides the replay');
  fs.writeFileSync(path.join(f.branch, RECEIPT), `${receipt}\n| Note | password: hunter2-hunter2 |\n`);
  await expectError(f, 'carries a credential-shaped value', 'a credential in the receipt');
  fs.writeFileSync(path.join(f.branch, RECEIPT), receipt);

  // The proof is the runner's own captured output.
  write(path.join(f.branch, PROOF), { ...proof, journalFingerprintAfter: proof.journalFingerprintBefore });
  await expectError(f, 'migration proof journal summary differs from its executions', 'a proof whose journal never moved');
  write(path.join(f.branch, PROOF), proof);

  // A done branch owes both outputs and takes no image branch.
  write(path.join(f.branch, 'response/response.json'), response({ fields: { 'migration-release': RECEIPT } }));
  await expectError(f, 'required output migration-release-proof is not in fields', 'a done branch with no proof');
  write(path.join(f.branch, 'response/response.json'), response({ extra: { fallbacks: ['ROLLOUT_FAILED'] } }));
  await expectError(f, 'takes no recovery or rollback branch', 'a migration that took the image recovery branch');
  write(path.join(f.branch, 'response/response.json'), response({ status: 'blocked', stop: 'MIGRATION_FAILED', fields: { 'migration-release': RECEIPT, 'migration-release-proof': PROOF } }));
  await expectError(f, 'cannot claim a completed migration', 'a blocked branch that claims the migration');
  write(path.join(f.branch, 'response/response.json'), response());

  // The request gate: only this operator's fields, one frozen plan.
  const requestFile = path.join(f.branch, 'request/request.json');
  const request = json(requestFile);
  const refreeze = (req) => { write(requestFile, req); const state = json(path.join(f.session, 'state.json')); state.requestHashes['4/1'] = hash(fs.readFileSync(requestFile)); write(path.join(f.session, 'state.json'), state); };
  refreeze({ ...request, requirements: { ...request.requirements, rollbackIdentity: { releaseId: 'x', artifactRef: 'y', digest: `sha256:${'1'.repeat(64)}`, dataCompatible: true } } });
  await expectError(f, 'requirements.rollbackIdentity is not a field', 'an image rollback identity on a migration release');
  refreeze({ ...request, requirements: { ...request.requirements, migration: null } });
  await expectError(f, 'runs one frozen plan and migration names none', 'a migration release with no plan');
  refreeze({ ...request, requirements: { ...request.requirements, migration: { ...request.requirements.migration, sha256: `sha256:${'9'.repeat(64)}` } } });
  await expectError(f, 'migration plan digest changed', 'a plan whose bytes moved since it was frozen');
  refreeze({ ...request, requirements: { ...request.requirements, approval: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD' } });
  await expectError(f, 'carries a credential-shaped value', 'a token where an approval id belongs');
  refreeze({ ...request, requirements: { ...request.requirements, target: 'other/target' } });
  await expectError(f, 'migration target differs from the request', 'a request for another target');
  refreeze({ ...request, inputs: { ...request.inputs, 'quality-verification': undefined } });
  await expectError(f, 'required input quality-verification is absent', 'a migration with no passing quality');
  refreeze(request);
  await expectValid(f, 'the branch restored');
});

test('a migration release blocked before effects carries no receipt', async (t) => {
  const f = await migrationReleaseFixture(t);
  await rekey(f);
  write(path.join(f.branch, 'response/response.json'), response({ status: 'blocked', stop: 'MIGRATION_PLAN_INVALID' }));
  await expectValid(f, 'blocked on a plan that no longer agrees with the disk');
  write(path.join(f.branch, 'response/response.json'), response({ status: 'blocked', stop: 'APPROVAL_REQUIRED' }));
  await expectValid(f, 'blocked on a release nobody approved');
  write(path.join(f.branch, 'response/response.json'), response({ status: 'blocked', stop: 'ROLLOUT_FAILED' }));
  await expectError(f, 'not a registered code migration.release may emit', 'an image stop on a migration release');
  write(path.join(f.branch, 'response/response.json'), response({ fields: {} }));
  await expectError(f, 'a migration release requires migration-release', 'a done branch that ran nothing');
});

test.after(() => process.stdout.write('migration.release self-test: 3 valid branches, 15 rejected mutations\n'));
