import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openSession, confirmSession, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { openAttempt } from './attempt-gate.mjs';
import { acquireWorkerSlot } from './worker-slots.mjs';
import { V22_CONTRACT } from './validate-request.mjs';
import { publishBusinessHead } from './publish-business-head.mjs';
import { REGISTRY_FILE, selfFingerprint, openStore, contentAddress, verifyHeadPublication } from './business-registry.mjs';

const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const fingerprint = (value, field = 'fingerprint') => ({ ...value, [field]: selfFingerprint(value, field) });
const posix = value => value.split(path.sep).join('/');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const table = (heading, headers, rows) => `## ${heading}\n\n| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}\n\n`;

async function fixture(t, { open = true, lease = true, complete = true, worktree = 'locked' } = {}) {
  const owner = mkdtempSync(path.join(tmpdir(), 'publish-business-'));
  t.after(() => {
    cleanupFixtureOwners(owner);
    assert.equal(path.dirname(path.resolve(owner)), path.resolve(tmpdir()));
    assert.ok(path.basename(owner).startsWith('publish-business-'));
    rmSync(owner, { recursive: true, force: true });
  });
  const opened = await openSession(path.join(owner, '.worktrees/sessions'), {
    project: 'publication', hostBinding: { kind: 'codex-task', hostId: path.basename(owner), worktree: owner, sourcePromptRef: 'user:scope' },
    mission: { language: 'en', goal: 'Publish the reviewed business documentation.', target: 'One business head', includes: ['Business documentation'], excludes: ['Product source and runtime'], outputs: ['Business authority bundle'], doneWhen: [{ evidence: 'The business head is documented and archived.', producedBy: 'business.decide' }], verification: 'Validate the business bundle and registry.', sourceRef: 'user:scope' }
  });
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved' });
  const stateFile = path.join(opened.session, 'state.json'), state = json(stateFile);
  const branch = path.join(opened.session, 'step-1/parallel-1'), storeRoot = path.join(owner, '.worktrees', state.project, 'businesses');
  const featureId = 'documented-promise', directory = path.join(storeRoot, 'features', featureId);
  mkdirSync(path.join(branch, 'request'), { recursive: true });
  mkdirSync(path.join(branch, 'response/data'), { recursive: true });
  if (worktree === 'locked' || worktree === 'unlocked') {
    git(owner, 'worktree', 'add', '-b', 'business-authority', storeRoot, 'HEAD');
    if (worktree === 'locked') git(owner, 'worktree', 'lock', '--reason', 'Fixture business authority', storeRoot);
  } else {
    mkdirSync(storeRoot, { recursive: true });
    if (worktree === 'standalone') {
      git(storeRoot, 'init');
      git(storeRoot, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'Independent repository');
    }
  }
  writeFileSync(path.join(storeRoot, REGISTRY_FILE), encode({ project: state.project, featureHeads: {}, objects: { immutable: true, byHash: {} } }));
  const contexts = [{ alias: '@workspaces/be', head: state.mission.discovery.repositories[0].head }, { alias: `@worktrees/businesses/${featureId}`, head: null }];
  const request = {
    contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'business.decide', step: 1, parallel: 1, sessionId: opened.sessionId,
    contexts, requirements: { featureId, targetState: 'pending', dimensions: ['documentation'], approval: null, resume: null }, inputs: {}, resume: null, goal: { doneWhen: 0 },
    attempt: { id: 'business-a1', number: 1, kind: 'initial', previous: null },
    expected: { version: 1, goalVersion: 1, sourceRef: 'state.json#mission:v1/doneWhen:0', criteria: [{ id: 'documented', required: true, expected: 'The business promise has a complete evidence-bound specification.', verification: 'Validate the complete business candidate and published registry.' }] },
    environment: { isolationId: 'business-a1', mode: 'isolated', workspace: null, reads: contexts.map(context => context.alias), writes: [directory], exclusive: [directory], outputRoot: 'response' }, frozenInputs: []
  };
  writeFileSync(path.join(branch, 'request/request.json'), encode(request));
  state.chain = [['1/1']]; state.steps = { '1/1': 'business.decide' }; state.current = '1/1';
  writeFileSync(stateFile, encode(state));
  if (open) await openAttempt(branch);
  if (lease) await acquireWorkerSlot(branch, 'business-worker', { ranProfile: 'sol-reviewer' });
  const claims = fingerprint({ featureId, sourceHead: contexts[0].head, claims: [{ claimId: 'c-intent', kind: 'intent', role: 'requested documentation', statement: 'Document the bounded business feature.', source: 'request/request.json#requirements.featureId' }] });
  const coverage = fingerprint({ featureId, dimensions: ['documentation'], discoveredConsumers: [], discoveredLifecycleBranches: [], rows: [{ dimension: 'documentation', disposition: 'defer', statement: 'Source implementation is a later owned outcome.', enforcementOwner: null, sourceRef: null, positiveProofRef: null, negativeProofRef: null, deferralRef: 'objective:implementation', consumerIds: [], claimIds: ['c-intent'] }] });
  const model = fingerprint({ featureId, mode: 'model', headRef: posix(directory), state: 'pending', promise: { statement: 'A documented business promise.', actorStatement: 'The reader.', eligibilityStatement: 'The declared business scope.' }, lineage: { previousHeadRef: null, previousState: null, transition: 'absent->pending' }, claimsFingerprint: claims.fingerprint, coverageFingerprint: coverage.fingerprint, reconciliation: null, documentation: { version: 1, sections: Object.fromEntries(['overview', 'actors', 'contracts', 'rules', 'states', 'acceptance'].map(name => [name, { markdown: `## ${name}\n\nThe complete reviewed ${name} is retained.`, claimIds: ['c-intent'], dimensions: ['documentation'] }])) } }, 'headFingerprint');
  for (const [name, value] of Object.entries({ model, claims, 'coverage-matrix': coverage })) writeFileSync(path.join(branch, `response/data/${name}.json`), encode(value));
  const response = {
    contractVersion: V22_CONTRACT, schemaVersion: 9, operatorId: 'business.decide', step: 1, parallel: 1, status: 'done',
    fields: { 'business-promise-authority': 'response/response.md', claims: 'response/data/claims.json', 'coverage-matrix': 'response/data/coverage-matrix.json', model: 'response/data/model.json' }, fallbacks: [], commits: [], next: ['backend.generate'],
    boundProfile: 'sol-reviewer', ranProfile: 'sol-reviewer', attempt: { id: 'business-a1', number: 1, expectedVersion: 1 },
    actual: { expectedVersion: 1, observedAt: new Date(Date.now() + 1000).toISOString(), observations: [{ criterionId: 'documented', observed: 'The reviewed specification is complete.', evidence: ['response/response.md'] }] },
    comparison: { expectedVersion: 1, verdict: 'matched', criteria: [{ criterionId: 'documented', verdict: 'matched', evidence: ['response/response.md'], note: 'The specification and evidence cover the declared outcome.' }], next: 'advance' },
    goalCheck: { achieved: true, evidence: ['response/response.md'] },
    outcome: { summary: 'The business documentation is ready for review.', primary: { kind: 'document', label: 'Business authority', ref: 'response/response.md' } }
  };
  const prose = `# business-promise-authority — ${featureId}\n\nThe reviewed documentation is the pending business authority.\n\n`
    + table('Binding', ['Field', 'Value'], [['Feature', featureId], ['Mode', 'model'], ['Target state', 'pending'], ['Head', model.headRef], ['Claims fingerprint', claims.fingerprint], ['Coverage fingerprint', coverage.fingerprint]])
    + table('Promise', ['Field', 'Value'], [['Promise', model.promise.statement], ['Actor', model.promise.actorStatement], ['Eligibility', model.promise.eligibilityStatement]])
    + table('Lineage', ['Field', 'Value'], [['Previous head', '—'], ['Previous state', '—'], ['Transition', 'absent->pending']])
    + table('Cited claims', ['Claim', 'Kind', 'Role', 'Source', 'Lines', 'Head'], [['`c-intent`', 'intent', 'requested documentation', 'request/request.json#requirements.featureId', `${encode(request).split('\n').findIndex(line => line.includes('"featureId"')) + 1}-${encode(request).split('\n').findIndex(line => line.includes('"featureId"')) + 1}`, '—']])
    + table('Coverage', ['Dimension', 'Disposition', 'Statement', 'Consumers'], [['`documentation`', 'defer', coverage.rows[0].statement, '—']])
    + table('Reconciliation', ['Dimension', 'Delivered evidence', 'Discrepancy'], [])
    + table('Findings', ['Code', 'Severity', 'Dimension', 'Statement'], []);
  writeFileSync(path.join(branch, 'response/response.md'), prose);
  if (complete) writeFileSync(path.join(branch, 'response/response.json'), encode(response));
  return { owner, session: opened.session, branch, stateFile, storeRoot, directory, request, response, input: { model, claims, coverage } };
}

test('business publication requires an existing owning session', async t => {
  const owner = mkdtempSync(path.join(tmpdir(), 'publish-business-missing-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(owner)), path.resolve(tmpdir())); rmSync(owner, { recursive: true, force: true }); });
  await assert.rejects(publishBusinessHead(owner), /SESSION_MISSING/);
});

test('an opened leased business attempt publishes ten files and a verified immutable head', async t => {
  const f = await fixture(t), before = readFileSync(f.stateFile);
  const worktreesBefore = git(f.owner, 'worktree', 'list', '--porcelain');
  assert.match(worktreesBefore, /locked Fixture business authority/);
  const result = await publishBusinessHead(f.branch);
  assert.equal(result.head, contentAddress(f.input.model));
  assert.equal(result.files.length, 10);
  assert.equal(readdirSync(f.directory).length, 10);
  assert.deepEqual(verifyHeadPublication({ store: openStore(f.storeRoot), featureId: f.input.model.featureId, ...f.input }), []);
  assert.deepEqual(readFileSync(f.stateFile), before, 'publication does not pretend to accept or complete the running attempt');
  assert.equal(git(f.owner, 'worktree', 'list', '--porcelain'), worktreesBefore, 'publication preserves existing worktree lock and reason');
});

test('business publication refuses missing attempt or exclusive lease before changing the authority', async t => {
  for (const option of [{ open: false, lease: false }, { lease: false }]) {
    const f = await fixture(t, option), before = readFileSync(path.join(f.storeRoot, REGISTRY_FILE));
    await assert.rejects(publishBusinessHead(f.branch), /opened running attempt|exclusive lease|lease/);
    assert.deepEqual(readFileSync(path.join(f.storeRoot, REGISTRY_FILE)), before);
    assert.equal(existsSync(f.directory), false);
  }
});

test('a running skeleton with undeclared candidate files cannot publish business authority', async t => {
  const f = await fixture(t, { complete: false });
  await assert.rejects(publishBusinessHead(f.branch), /candidate|done|complete|declared|response/i);
  assert.equal(existsSync(f.directory), false);
});

test('frozen request drift and changed current lineage refuse publication', async t => {
  const f = await fixture(t), file = path.join(f.branch, 'request/request.json'), original = readFileSync(file);
  const changed = structuredClone(f.request); changed.requirements.dimensions = ['changed']; writeFileSync(file, encode(changed));
  await assert.rejects(publishBusinessHead(f.branch), /requestHashes|frozen|hash/);
  writeFileSync(file, original);
  const registryFile = path.join(f.storeRoot, REGISTRY_FILE), registry = json(registryFile);
  registry.featureHeads[f.input.model.featureId] = { head: 'e'.repeat(64) }; writeFileSync(registryFile, encode(registry));
  await assert.rejects(publishBusinessHead(f.branch), /SOURCE_DRIFT|lineage/);
  assert.equal(existsSync(f.directory), false);
});

test('a schema-valid but semantically invalid business candidate cannot publish', async t => {
  const f = await fixture(t);
  const coverage = structuredClone(f.input.coverage); coverage.rows[0].deferralRef = null; coverage.fingerprint = selfFingerprint(coverage, 'fingerprint');
  const model = { ...f.input.model, coverageFingerprint: coverage.fingerprint }; model.headFingerprint = selfFingerprint(model, 'headFingerprint');
  writeFileSync(path.join(f.branch, 'response/data/coverage-matrix.json'), encode(coverage));
  writeFileSync(path.join(f.branch, 'response/data/model.json'), encode(model));
  await assert.rejects(publishBusinessHead(f.branch), /deferral|fingerprint/);
  assert.equal(existsSync(f.directory), false);
});

test('publication refuses cross-project and unpartitioned heads and never initializes a competing registry', async t => {
  const f = await fixture(t), modelFile = path.join(f.branch, 'response/data/model.json');
  const before = readFileSync(path.join(f.storeRoot, REGISTRY_FILE));
  for (const wrongRoot of [path.join(f.owner, '.worktrees/other-project/businesses'), path.join(f.owner, '.worktrees/businesses')]) {
    const model = { ...f.input.model, headRef: posix(path.join(wrongRoot, 'features', f.input.model.featureId)) };
    model.headFingerprint = selfFingerprint(model, 'headFingerprint'); writeFileSync(modelFile, encode(model));
    await assert.rejects(publishBusinessHead(f.branch), /headRef|project|directory|alias/i);
    assert.equal(existsSync(wrongRoot), false);
    assert.deepEqual(readFileSync(path.join(f.storeRoot, REGISTRY_FILE)), before);
  }
  writeFileSync(modelFile, encode(f.input.model));
  const staleRoot = path.join(f.owner, '.worktrees/businesses'); mkdirSync(staleRoot);
  writeFileSync(path.join(staleRoot, REGISTRY_FILE), before);
  unlinkSync(path.join(f.storeRoot, REGISTRY_FILE));
  await assert.rejects(publishBusinessHead(f.branch), /registry.*absent|authority.*ownership/i);
  assert.equal(existsSync(path.join(f.storeRoot, REGISTRY_FILE)), false);
  assert.deepEqual(readFileSync(path.join(staleRoot, REGISTRY_FILE)), before);
  assert.equal(existsSync(f.directory), false);
});

test('a registered unlocked authority publishes without changing its Git lock state', async t => {
  const f = await fixture(t, { worktree: 'unlocked' }), before = git(f.owner, 'worktree', 'list', '--porcelain');
  assert.doesNotMatch(before, /\nlocked(?: |\n|$)/);
  await publishBusinessHead(f.branch);
  assert.equal(git(f.owner, 'worktree', 'list', '--porcelain'), before);
});

test('unregistered and unrelated repositories cannot become business authority', async t => {
  for (const worktree of ['none', 'standalone']) {
    const f = await fixture(t, { worktree }), before = readFileSync(path.join(f.storeRoot, REGISTRY_FILE));
    await assert.rejects(publishBusinessHead(f.branch), /worktree|registered|repository|Git|git|root/);
    assert.deepEqual(readFileSync(path.join(f.storeRoot, REGISTRY_FILE)), before);
    assert.equal(existsSync(f.directory), false);
  }
});

test('the existing registry must belong to the current workflow project', async t => {
  const f = await fixture(t), file = path.join(f.storeRoot, REGISTRY_FILE), registry = json(file);
  registry.project = 'other-project'; const before = encode(registry); writeFileSync(file, before);
  await assert.rejects(publishBusinessHead(f.branch), /registry project|owning session/);
  assert.equal(readFileSync(file, 'utf8'), before);
  assert.equal(existsSync(f.directory), false);
});
