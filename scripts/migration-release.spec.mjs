import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationDigest as hash, migrationRunnerErrors, migrationExecutionErrors, migrationReleaseProofErrors, validateMigrationReleaseRequest, migrationJournalFingerprint, migrationConnectionFingerprint } from './migration-release.mjs';
import { executeMigrationRelease } from './migration-release-run.mjs';
import { validateReleaseStep } from '../operators/release-deploy/validate.mjs';
import { validateAgainst } from './json-schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clone = (value) => structuredClone(value);
const OLD = 'ExistingMigration', NEW = 'AddScope';
const beforeHash = hash(JSON.stringify([{ id: 7, timestamp: 100, name: OLD }]));
const afterHash = hash(JSON.stringify([{ id: 7, timestamp: 100, name: OLD }, { id: 8, timestamp: 200, name: NEW }]));
const plan = { sourceHead: 'a'.repeat(40), contractFingerprint: hash('contract'), connectionFingerprint: hash('connection'),
  journalBefore: [OLD], journalExistsBefore: true, journalFingerprintBefore: beforeHash,
  migrations: [{ name: NEW }], journal: { allowInitialization: false } };
const planSha256 = hash('plan');
const applied = () => ({ schemaVersion: 1, operation: 'apply', planSha256, sourceHead: plan.sourceHead, connectionFingerprint: plan.connectionFingerprint,
  journalExistsBefore: true, journalExistsAfter: true, journalBefore: [OLD], journalAfter: [NEW, OLD],
  journalFingerprintBefore: beforeHash, journalFingerprintAfter: afterHash, preservedJournalFingerprint: beforeHash,
  pendingBefore: [NEW], pendingAfter: [], applied: [NEW] });
const expected = { journalExists: true, journal: [OLD], journalFingerprint: beforeHash };
const inspect = (value, side) => ({ ...value, operation: 'inspect', applied: [],
  journalExistsBefore: value[`journalExists${side}`], journalExistsAfter: value[`journalExists${side}`],
  journalBefore: value[`journal${side}`], journalAfter: value[`journal${side}`],
  journalFingerprintBefore: value[`journalFingerprint${side}`], journalFingerprintAfter: value[`journalFingerprint${side}`], preservedJournalFingerprint: value[`journalFingerprint${side}`],
  pendingBefore: value[`pending${side}`], pendingAfter: value[`pending${side}`] });

function fixture(t) {
  const session = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-release-proof-'));
  assert.equal(path.dirname(path.resolve(session)), path.resolve(os.tmpdir()));
  t.after(() => fs.rmSync(session, { recursive: true, force: true }));
  const branch = path.join(session, 'step-1/parallel-1'); fs.mkdirSync(path.join(branch, 'response/artifacts'), { recursive: true });
  const first = applied(); const second = { ...inspect(first, 'After'), operation: 'apply' };
  const fields = ['applied', 'pendingBefore', 'pendingAfter', 'journalExistsBefore', 'journalExistsAfter', 'journalBefore', 'journalAfter', 'journalFingerprintBefore', 'journalFingerprintAfter', 'preservedJournalFingerprint'];
  const executions = [first, second].map((value, index) => {
    const logRef = `response/artifacts/migration-${index + 1}.log`;
    const bytes = JSON.stringify([inspect(value, 'Before'), value, inspect(value, 'After')].map((entry) => JSON.stringify(entry) + '\n')) + '\n';
    fs.writeFileSync(path.join(branch, logRef), bytes);
    return { invocation: index + 1, ...Object.fromEntries(fields.map((field) => [field, value[field]])), exitCode: 0, logRef, logSha256: hash(bytes) };
  });
  return { session, branch, proof: { schemaVersion: 1, outcome: 'migrated', planSha256, sourceHead: plan.sourceHead, contractFingerprint: plan.contractFingerprint,
    connectionFingerprint: plan.connectionFingerprint, journalExistsBefore: true, journalExistsAfter: true, journalBefore: [OLD], journalAfter: [NEW, OLD],
    journalFingerprintBefore: beforeHash, journalFingerprintAfter: afterHash, executions } };
}

test('migration runner accepts exact apply and closed read-only inspection', () => {
  assert.deepEqual(migrationRunnerErrors(root, plan, planSha256, applied(), 'apply'), []);
  assert.deepEqual(migrationRunnerErrors(root, plan, planSha256, inspect(applied(), 'Before'), 'inspect'), []);
  assert.deepEqual(migrationExecutionErrors(plan, applied(), expected), []);
});
test('migration inspection cannot initialize the journal or change a revision', () => {
  const value = inspect(applied(), 'Before'); value.journalExistsBefore = false;
  assert.ok(migrationRunnerErrors(root, plan, planSha256, value, 'inspect').some((error) => error.includes('inspect performed')));
  value.journalExistsBefore = true; value.journalFingerprintAfter = hash('changed');
  assert.ok(migrationRunnerErrors(root, plan, planSha256, value, 'inspect').some((error) => error.includes('inspect performed')));
});
test('pending and applied sets must equal the complete frozen set', () => {
  for (const patch of [{ pendingBefore: [NEW, 'UnexpectedMigration'] }, { pendingBefore: [] }, { applied: [] }, { journalAfter: [NEW] }]) {
    assert.ok(migrationExecutionErrors(plan, { ...applied(), ...patch }, expected).length);
  }
});
test('journal identity metadata is compared and preserved, not just migration names', () => {
  assert.ok(migrationExecutionErrors(plan, { ...applied(), journalFingerprintBefore: hash('rewritten') }, expected).some((error) => error.includes('drifted')));
  assert.ok(migrationExecutionErrors(plan, { ...applied(), preservedJournalFingerprint: hash('rewritten') }, expected).some((error) => error.includes('prior journal')));
  assert.ok(migrationExecutionErrors(plan, { ...applied(), journalFingerprintAfter: beforeHash }, expected).some((error) => error.includes('advancing')));
});
test('journal initialization needs an explicit ceiling and empty history', () => {
  const freshPlan = { ...plan, journalBefore: [], journalExistsBefore: false, journalFingerprintBefore: hash('[]'), journal: { allowInitialization: true } };
  const fresh = { ...applied(), journalExistsBefore: false, journalBefore: [], journalAfter: [NEW], journalFingerprintBefore: hash('[]'), preservedJournalFingerprint: hash('[]') };
  const freshExpected = { journalExists: false, journal: [], journalFingerprint: hash('[]') };
  assert.deepEqual(migrationExecutionErrors(freshPlan, fresh, freshExpected), []);
  assert.ok(migrationExecutionErrors(plan, fresh, freshExpected).some((error) => error.includes('initialization')));
});
test('replay applies nothing and preserves the whole journal revision', () => {
  const replay = { ...inspect(applied(), 'After'), operation: 'apply' };
  const prior = { journalExists: true, journal: [NEW, OLD], journalFingerprint: afterHash };
  assert.deepEqual(migrationExecutionErrors(plan, replay, prior, true), []);
  for (const patch of [{ applied: [NEW] }, { pendingBefore: [NEW] }, { journalFingerprintAfter: hash('drift') }, { journalExistsAfter: false }]) {
    assert.ok(migrationExecutionErrors(plan, { ...replay, ...patch }, prior, true).length);
  }
});
test('closed runner output rejects command, credential and wrong connection fields', () => {
  for (const patch of [{ command: 'arbitrary' }, { password: 'secret' }, { connectionFingerprint: hash('another database') }]) {
    assert.ok(migrationRunnerErrors(root, plan, planSha256, { ...applied(), ...patch }, 'apply').length);
  }
});
test('complete migration proof accepts measured apply and replay transcripts', (t) => {
  const { branch, proof } = fixture(t);
  assert.deepEqual(migrationReleaseProofErrors(root, branch, plan, planSha256, proof), []);
});
test('proof rejects changed raw log bytes, missing captures and repeated invocation', (t) => {
  const { branch, proof } = fixture(t);
  fs.appendFileSync(path.join(branch, proof.executions[0].logRef), ' ');
  assert.ok(migrationReleaseProofErrors(root, branch, plan, planSha256, proof).some((error) => error.includes('log bytes')));
  const second = clone(proof); second.executions[1].invocation = 1;
  assert.ok(migrationReleaseProofErrors(root, branch, plan, planSha256, second).some((error) => error.includes('invocation')));
  fs.writeFileSync(path.join(branch, proof.executions[0].logRef), '[]');
  assert.ok(migrationReleaseProofErrors(root, branch, plan, planSha256, proof).some((error) => error.includes('transcript')));
});
test('proof rejects metadata drift even when a receipt and log are both edited', (t) => {
  const { branch, proof } = fixture(t);
  proof.executions[1].journalFingerprintAfter = hash('rewritten');
  const logPath = path.join(branch, proof.executions[1].logRef), raws = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  raws[1] = JSON.stringify({ ...JSON.parse(raws[1]), journalFingerprintAfter: hash('rewritten') });
  const bytes = JSON.stringify(raws); fs.writeFileSync(logPath, bytes); proof.executions[1].logSha256 = hash(bytes);
  assert.ok(migrationReleaseProofErrors(root, branch, plan, planSha256, proof).some((error) => error.includes('no-op')));
});
test('legacy release requests stay inactive; malformed migration binding fails closed', async () => {
  assert.equal((await validateMigrationReleaseRequest(root, root, { operatorId: 'release.deploy', requirements: {} })).active, false);
  const result = await validateMigrationReleaseRequest(root, root, { operatorId: 'release.deploy', requirements: { migration: { command: 'anything' } } });
  assert.equal(result.active, true); assert.ok(result.errors.length);
});
test('execution refuses before effects when its request was never frozen', async (t) => {
  const { session, branch } = fixture(t); fs.mkdirSync(path.join(branch, 'request'));
  fs.writeFileSync(path.join(branch, 'request/request.json'), JSON.stringify({ operatorId: 'release.deploy', sessionId: 'test', step: 1, parallel: 1 }));
  fs.writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 'test', steps: { '1/1': 'release.deploy' }, requestHashes: {} }));
  assert.deepEqual(await executeMigrationRelease(root, branch), { status: 'blocked', code: 'REQUEST_NOT_FROZEN', partialMutation: false });
});

test('canonical journal identities preserve exact safe integers and reject lossy or duplicate rows', () => {
  const rows = [{ id: '2', timestamp: 30n, name: NEW }, { id: 1n, timestamp: '20', name: OLD }];
  assert.equal(migrationJournalFingerprint(rows), hash(JSON.stringify([{ id: 1, timestamp: 20, name: OLD }, { id: 2, timestamp: 30, name: NEW }])));
  for (const id of [9007199254740992, '9007199254740993', 9007199254740993n, 0, '01', -1, 1.5]) assert.throws(() => migrationJournalFingerprint([{ id, timestamp: 0, name: NEW }]));
  assert.throws(() => migrationJournalFingerprint([{ id: 1, timestamp: 0, name: NEW }, { id: 1, timestamp: 1, name: OLD }]));
  assert.throws(() => migrationJournalFingerprint([{ id: 1, timestamp: 0, name: NEW }, { id: 2, timestamp: 1, name: NEW }]));
});

test('environment migration connection is a closed exact tuple with one username form', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'readiness/initialization/stacks/environment.schema.json'), 'utf8'));
  const literal = { driver: 'postgres', host: 'fixture.invalid', port: 5432, database: 'fixture', schema: 'public', username: 'fixture' };
  const target = { project: 'fixture', target: 'fixture/dev', connectionRef: 'secret-ref://fixture/primary', connection: literal };
  const check = (entry) => validateAgainst(schema, { schemaVersion: 9, env: 'dev', production: false, migrationTargets: [entry] });
  assert.deepEqual(check(target), []);
  const { username, ...publicPart } = literal;
  assert.deepEqual(check({ ...target, connection: { ...publicPart, usernameRef: 'secret-ref://fixture/username' }, connectionFingerprint: migrationConnectionFingerprint(literal) }), []);
  for (const connection of [{ username: 'fixture' }, { ...publicPart, usernameRef: 42 }, { ...literal, mystery: true }, { ...literal, usernameRef: 'secret-ref://fixture/username' }, publicPart]) assert.ok(check({ ...target, connection }).length);
  assert.ok(check({ ...target, connection: { ...publicPart, usernameRef: 'secret-ref://fixture/username' } }).length);
});

test('complete migration release runs a source-pinned subprocess and validates the actual branch', async (t) => {
  const { migrationReleaseFixture } = await import('./migration-release-fixture.mjs');
  const f = await migrationReleaseFixture(t);
  const results = await Promise.all([validateMigrationReleaseRequest(f.root, f.branch, f.request), validateMigrationReleaseRequest(f.root, f.branch, f.request)]);
  for (const result of results) assert.deepEqual(result.errors, []);
  assert.deepEqual(await executeMigrationRelease(f.root, f.branch), { status: 'done', outcome: 'migrated', receipt: 'response/migration-release.md', proof: 'response/data/migration-release.json' });
  f.finish();
  assert.deepEqual((await validateReleaseStep(f.branch, f.root)).errors, []);
  const proof = JSON.parse(fs.readFileSync(path.join(f.branch, 'response/data/migration-release.json'), 'utf8'));
  assert.deepEqual(proof.executions.map(row => row.applied), [[NEW], []]);
  assert.equal(proof.journalExistsBefore, false); assert.equal(proof.journalExistsAfter, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.checkout, '.migration-state.json'), 'utf8')), [{ id: 1, timestamp: 200, name: NEW }]);
});

test('authoritative environment pin rejects foreign, ambiguous and sealed connection identities before effects', async (t) => {
  const { migrationReleaseFixture } = await import('./migration-release-fixture.mjs');
  const f = await migrationReleaseFixture(t, { sealed: true });
  assert.deepEqual((await validateMigrationReleaseRequest(f.root, f.branch, f.request)).errors, []);
  const initial = clone(f.environment), planInitial = clone(f.plan);
  const check = async (mutate, needle) => {
    const env = clone(initial); Object.assign(f.plan, clone(planInitial)); mutate(env, f.plan);
    f.write(f.environmentFile, env); f.plan.environmentSha256 = hash(fs.readFileSync(f.environmentFile));
    f.request.requirements.approval = `.stacks/dev/environment.json#${f.plan.environmentSha256}`; f.freeze();
    assert.ok((await validateMigrationReleaseRequest(f.root, f.branch, f.request)).errors.some(error => error.includes(needle)));
    assert.equal((await executeMigrationRelease(f.root, f.branch)).partialMutation, false);
    assert.equal(fs.existsSync(path.join(f.checkout, '.migration-state.json')), false);
  };
  await check(env => { env.migrationTargets[0].connectionRef = 'secret-ref://foreign/database'; }, 'exactly one');
  await check(env => { env.migrationTargets[0].connectionFingerprint = hash('foreign'); }, 'environment authority');
  await check(env => { delete env.migrationTargets[0].connectionFingerprint; }, 'environment declaration');
  await check(env => { env.migrationTargets[0].connection.schema = 'foreign'; }, 'environment authority');
  await check(env => { env.migrationTargets.push({ ...env.migrationTargets[0], connectionFingerprint: hash('other') }); }, 'exactly one');
  Object.assign(f.plan, planInitial); f.write(f.environmentFile, initial); f.freeze();
  fs.appendFileSync(f.environmentFile, '\n');
  assert.ok((await validateMigrationReleaseRequest(f.root, f.branch, f.request)).errors.some(error => error.includes('declaration changed')));
});

test('missing approval, absent required quality gate and changed source refuse before launching a runner', async (t) => {
  const { migrationReleaseFixture } = await import('./migration-release-fixture.mjs');
  const f = await migrationReleaseFixture(t);
  const approval = f.request.requirements.approval; f.request.requirements.approval = ''; f.freeze();
  assert.ok((await validateMigrationReleaseRequest(f.root, f.branch, f.request)).errors.some(error => error.includes('explicit release approval')));
  assert.equal((await executeMigrationRelease(f.root, f.branch)).partialMutation, false);
  f.request.requirements.approval = approval; f.freeze();
  const quality = path.join(f.session, 'step-3/parallel-1');
  const originals = new Map(['request/request.json', 'response/data/gates/integration.json', 'response/response.md'].map(name => [name, fs.readFileSync(path.join(quality, name), 'utf8')]));
  const qualityRequest = JSON.parse(originals.get('request/request.json')); qualityRequest.requirements.gates[0].required = false;
  const gate = JSON.parse(originals.get('response/data/gates/integration.json')); Object.assign(gate, { required: false, status: 'fail', exitCode: 1, classification: 'in-boundary' });
  f.write(path.join(quality, 'request/request.json'), qualityRequest); f.write(path.join(quality, 'response/data/gates/integration.json'), gate);
  f.write(path.join(quality, 'response/response.md'), originals.get('response/response.md').replace('| `integration` | yes |', '| `integration` | no |').replace('| `integration` | pass | 0 |', '| `integration` | fail | 1 |').replace('| `gates/integration.log` | — | synthetic gate passed |', '| `gates/integration.log` | in-boundary | synthetic gate failed |'));
  f.freeze();
  assert.ok((await validateMigrationReleaseRequest(f.root, f.branch, f.request)).errors.some(error => error.includes('actual passing required gate')));
  assert.equal((await executeMigrationRelease(f.root, f.branch)).partialMutation, false);
  for (const [name, bytes] of originals) f.write(path.join(quality, name), bytes);
  f.freeze();
  fs.appendFileSync(path.join(f.checkout, 'runner.mjs'), '\n// drift\n');
  assert.ok((await validateMigrationReleaseRequest(f.root, f.branch, f.request)).errors.some(error => error.includes('uncommitted')));
  assert.equal((await executeMigrationRelease(f.root, f.branch)).partialMutation, false);
  assert.equal(fs.existsSync(path.join(f.checkout, '.migration-state.json')), false);
});

test('runner exit and untrusted apply output remain typed, hashed and do not publish raw failures', async (t) => {
  const { migrationReleaseFixture } = await import('./migration-release-fixture.mjs');
  for (const mode of ['early-exit', 'malformed-apply', 'cas-refusal']) {
    const f = await migrationReleaseFixture(t, { mode });
    assert.deepEqual((await validateMigrationReleaseRequest(f.root, f.branch, f.request)).errors, []);
    const result = await executeMigrationRelease(f.root, f.branch);
    assert.equal(result.status, 'blocked'); assert.equal(result.partialMutation, mode === 'early-exit' ? false : 'unknown');
    assert.match(result.code, /^RUNNER_(?:INPUT_FAILED|OUTPUT_INVALID|FAILED)$/);
    assert.match(result.stdoutSha256, /^sha256:/); assert.match(result.stderrSha256, /^sha256:/);
    assert.equal(fs.existsSync(path.join(f.branch, 'response/data/migration-release.json')), false);
    assert.equal(fs.existsSync(path.join(f.branch, 'response/artifacts/migration-1.log')), false);
    assert.equal(fs.existsSync(path.join(f.checkout, '.migration-state.json')), false);
    assert.ok(!JSON.stringify(result).includes('untrusted output'));
  }
});
