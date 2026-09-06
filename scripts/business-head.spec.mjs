import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { businessDocumentErrors, businessHeadContractErrors, businessesRootFor, headDirectory, projectBusinessHead, verifyBusinessHead, writeBusinessHead } from './business-head.mjs';
import { REGISTRY_FILE, applyHeadPublication, contentAddress, objectRef, openStore, planHeadPublication, selfFingerprint, verifyHeadPublication } from './business-registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['CONTEXT.md', 'overview.md', 'actors.md', 'contracts.md', 'rules.md', 'states.md', 'spec.md', 'acceptance.md', 'evidence.json', 'model.json'];
const SECTION_TOPICS = {
  overview: ['Purpose and exclusions', 'Module map', 'Legacy and target comparison', 'Open decisions'],
  actors: ['Learner responsibilities', 'Reviewer responsibilities'],
  contracts: ['Entities and operations', 'RAG sources and unknown answers', 'Entitlements matrix'],
  rules: ['Authorization invariants', 'Lifecycle recovery', 'Data ownership'],
  states: ['Subscription transitions', 'Project journey', 'Interrupted journey'],
  acceptance: ['Positive and negative outcomes', 'Handoff evidence']
};
const fingerprint = (value, key = 'fingerprint') => ({ ...value, [key]: selfFingerprint(value, key) });
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const posix = value => value.split(path.sep).join('/');

function fixture(t) {
  const owner = mkdtempSync(path.join(tmpdir(), 'business-head-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(owner)), path.resolve(tmpdir()));
    assert.ok(path.basename(owner).startsWith('business-head-'));
    rmSync(owner, { recursive: true, force: true });
  });
  const storeRoot = path.join(owner, '.worktrees', 'synthetic', 'businesses');
  mkdirSync(storeRoot, { recursive: true });
  writeFileSync(path.join(storeRoot, REGISTRY_FILE), encode({ schemaVersion: 1, project: 'synthetic', hashAlgorithm: 'sha256', canonicalization: 'RFC8785-JCS', featureHeads: {}, objects: { immutable: true, byHash: {} } }));
  const claims = fingerprint({ featureId: 'learning-hub', sourceHead: 'a'.repeat(40), claims: [{ claimId: 'requested-scope', kind: 'intent', role: 'user', statement: 'The reviewed product scope includes the documented modules and open decisions.', source: 'request/request.json#requirements.goal' }] });
  const coverage = fingerprint({ featureId: 'learning-hub', dimensions: ['access'], discoveredConsumers: [], discoveredLifecycleBranches: [], rows: [{ dimension: 'access', disposition: 'defer', statement: 'Implementation evidence remains a later delivery obligation.', enforcementOwner: null, sourceRef: null, positiveProofRef: null, negativeProofRef: null, deferralRef: 'request/request.json#requirements.goal', consumerIds: [], claimIds: ['requested-scope'] }] });
  const sections = Object.fromEntries(Object.entries(SECTION_TOPICS).map(([name, topics]) => [name, {
    markdown: topics.map((topic, i) => `## ${topic}\n\n### Case ${i + 1}\n\nĐã chốt: retain this authored ${name} case.\n\n| Condition | Outcome |\n| --- | --- |\n| Available | Continue |\n| Unknown | Ask the owner |\n\n- Preserve the full text.\n  - Keep the nested decision.\n\n\`\`\`text\npending -> ready -> unavailable\n\`\`\``).join('\n\n'),
    claimIds: ['requested-scope'], dimensions: ['access']
  }]));
  const model = fingerprint({ featureId: 'learning-hub', mode: 'model', headRef: posix(path.join(storeRoot, 'features', 'learning-hub')), state: 'pending', promise: { statement: 'A reviewed learning product promise.', actorStatement: 'Learners and reviewers.', eligibilityStatement: 'The declared entitlement determines access.' }, lineage: { previousHeadRef: null, previousState: null, transition: 'absent->pending' }, claimsFingerprint: claims.fingerprint, coverageFingerprint: coverage.fingerprint, reconciliation: null, documentation: { version: 1, sections } }, 'headFingerprint');
  const input = { model, claims, coverage };
  const store = () => openStore(storeRoot);
  const plan = (overrides = {}) => planHeadPublication({ store: store(), featureId: model.featureId, ...input, ...overrides });
  const publish = () => applyHeadPublication(store(), plan());
  const verify = () => verifyHeadPublication({ store: store(), featureId: model.featureId, ...input });
  return { owner, storeRoot, input, store, plan, publish, verify, directory: path.join(storeRoot, 'features', model.featureId) };
}

test('six authored sections preserve seventeen rich business topics in exactly ten deterministic files', t => {
  const f = fixture(t), files = projectBusinessHead(f.input);
  assert.deepEqual(Object.keys(files).sort(), [...FILES].sort());
  assert.deepEqual(projectBusinessHead(structuredClone(f.input)), files);
  assert.equal(Object.values(SECTION_TOPICS).flat().length, 17);
  for (const [name, section] of Object.entries(f.input.model.documentation.sections)) {
    assert.ok(files[`${name}.md`].includes(section.markdown), `${name} loses authored Markdown`);
    assert.ok(files['spec.md'].includes(section.markdown), `spec loses ${name}`);
  }
  for (const name of FILES.filter(name => name !== 'CONTEXT.md')) assert.ok(files['CONTEXT.md'].includes(`](${name})`), `navigation omits ${name}`);
  assert.deepEqual(JSON.parse(files['model.json']), f.input.model);
  assert.deepEqual(JSON.parse(files['evidence.json']), { claims: f.input.claims, coverage: f.input.coverage });
  assert.deepEqual(businessDocumentErrors(f.input), []);
});

test('long authored sections use bounded blocks without losing tables or later decisions', t => {
  const f = fixture(t);
  const blocks = ['## Module map\n\n' + 'Module detail. '.repeat(450), '## Journeys\n\n' + 'Journey detail. '.repeat(450), '## Open decisions\n\n| Decision | Owner |\n| --- | --- |\n| Unknown answer | Reviewer |'];
  f.input.model.documentation.sections.contracts.markdown = blocks;
  f.input.model.headFingerprint = selfFingerprint(f.input.model, 'headFingerprint');
  assert.ok(blocks.join('\n\n').length > 8192);
  const files = projectBusinessHead(f.input);
  assert.ok(files['contracts.md'].includes(blocks.join('\n\n')));
  assert.ok(files['spec.md'].includes(blocks.join('\n\n')));
  assert.deepEqual(JSON.parse(files['model.json']).documentation.sections.contracts.markdown, blocks);
  f.publish();
  assert.deepEqual(f.verify(), []);
});

test('first pending publication generates a discoverable bundle and later revisions preserve archived bytes', t => {
  const f = fixture(t);
  const initialPlan = f.plan();
  assert.equal(existsSync(f.directory), false);
  applyHeadPublication(f.store(), initialPlan, { dryRun: true });
  assert.equal(existsSync(f.directory), false);
  assert.equal(f.store().hasObject(contentAddress(f.input.model)), false);
  f.publish();
  assert.deepEqual(f.verify(), []);
  assert.deepEqual(readdirSync(f.directory).sort(), [...FILES].sort());
  const firstEntry = f.store().entry(f.input.model.featureId);
  const firstFile = f.store().objectFile(firstEntry.head), bytes = readFileSync(firstFile);
  const revised = structuredClone(f.input.model);
  revised.state = 'in-progress';
  revised.lineage = { previousHeadRef: objectRef(posix(f.storeRoot), firstEntry.head), previousState: 'pending', transition: 'pending->in-progress' };
  revised.documentation.sections.overview.markdown += '\n\n### Reviewed revision\n\nThe owner clarified the initial promise.';
  revised.headFingerprint = selfFingerprint(revised, 'headFingerprint');
  applyHeadPublication(f.store(), f.plan({ model: revised }));
  assert.deepEqual(readFileSync(firstFile), bytes);
  const entry = f.store().entry(revised.featureId);
  assert.equal(entry.baseHead, firstEntry.head);
  assert.equal(entry.previousHead, firstEntry.head);
  assert.equal(entry.head, contentAddress(revised));
  assert.notEqual(`sha256:${entry.head}`, revised.headFingerprint);
  assert.deepEqual(verifyHeadPublication({ store: f.store(), featureId: revised.featureId, ...f.input, model: revised }), []);
  const tamperedPrevious = JSON.parse(bytes);
  tamperedPrevious.promise.statement += ' changed under the old address';
  writeFileSync(firstFile, encode(tamperedPrevious));
  assert.notDeepEqual(verifyHeadPublication({ store: f.store(), featureId: revised.featureId, ...f.input, model: revised }), [], 'lineage cannot accept altered previous bytes merely because the prior state stayed unchanged');
  writeFileSync(firstFile, bytes);
  const withoutDocumentation = { ...revised }; delete withoutDocumentation.documentation;
  withoutDocumentation.headFingerprint = selfFingerprint(withoutDocumentation, 'headFingerprint');
  assert.throws(() => f.plan({ model: withoutDocumentation }), /discard.*documentation/);
});

test('every missing or changed bundle file refuses publication verification', t => {
  const f = fixture(t); f.publish();
  for (const name of FILES) {
    const file = path.join(f.directory, name), bytes = readFileSync(file);
    unlinkSync(file);
    assert.ok(f.verify().some(error => error.includes(name)), `missing ${name} passed`);
    writeFileSync(file, `${bytes.toString('utf8')}\nunauthorized edit\n`);
    assert.ok(f.verify().some(error => error.includes(name)), `changed ${name} passed`);
    writeFileSync(file, bytes);
    assert.deepEqual(f.verify(), []);
  }
});

test('fingerprints, feature identity and section evidence references cannot drift independently', t => {
  const f = fixture(t);
  const cases = [
    [value => { value.model.documentation.sections.rules.markdown += '\nchanged'; }, /model.*fingerprint/],
    [value => { value.claims.claims[0].statement += ' changed'; }, /claims.*fingerprint/],
    [value => { value.coverage.rows[0].statement += ' changed'; }, /coverage.*fingerprint/],
    [value => { value.model.documentation.sections.actors.claimIds = ['missing-claim']; value.model.headFingerprint = selfFingerprint(value.model, 'headFingerprint'); }, /unknown claim/],
    [value => { value.model.documentation.sections.states.dimensions = ['missing-dimension']; value.model.headFingerprint = selfFingerprint(value.model, 'headFingerprint'); }, /unknown dimension/],
    [value => { value.claims.featureId = 'other-feature'; value.claims = fingerprint(value.claims); }, /featureId differs/],
    [value => { value.coverage.featureId = 'other-feature'; value.coverage = fingerprint(value.coverage); }, /featureId differs/]
  ];
  for (const [mutate, expected] of cases) {
    const candidate = structuredClone(f.input); mutate(candidate);
    assert.throws(() => projectBusinessHead(candidate), expected);
  }
  assert.throws(() => f.plan({ featureId: 'other-feature' }), /feature/i);
});

test('archived model, claims and coverage corruption cannot be accepted or overwritten', t => {
  const f = fixture(t); f.publish();
  for (const document of Object.values(f.input)) {
    const file = f.store().objectFile(contentAddress(document)), bytes = readFileSync(file);
    writeFileSync(file, '{"tampered":true}\n');
    assert.notDeepEqual(f.verify(), []);
    assert.throws(() => applyHeadPublication(f.store(), f.plan()), /immutable|content address|hash|coverage|documentation/);
    assert.equal(readFileSync(file, 'utf8'), '{"tampered":true}\n');
    writeFileSync(file, bytes);
  }
});

test('publication refuses stale registry state even when the applying caller reopens the store', t => {
  const f = fixture(t), store = f.store(), plan = f.plan();
  const file = path.join(f.storeRoot, REGISTRY_FILE), registry = JSON.parse(readFileSync(file, 'utf8'));
  registry.project = 'changed-by-another-owner';
  const changed = encode(registry); writeFileSync(file, changed);
  assert.throws(() => applyHeadPublication(store, plan), /SOURCE_DRIFT|registry.*chang|stale/i);
  assert.throws(() => applyHeadPublication(f.store(), plan), /SOURCE_DRIFT|registry.*chang|stale/i);
  assert.equal(readFileSync(file, 'utf8'), changed);
  assert.equal(existsSync(f.directory), false);
});

test('head paths and filenames cannot escape their declared authority directory', t => {
  const f = fixture(t);
  assert.throws(() => headDirectory(f.storeRoot, { ...f.input.model, featureId: '../escaped' }), /unsafe|feature/i);
  assert.throws(() => headDirectory(f.storeRoot, { ...f.input.model, headRef: posix(path.join(f.owner, 'escaped')) }), /headRef|directory/);
  const sentinel = path.join(f.storeRoot, 'sentinel.txt'); writeFileSync(sentinel, 'owned elsewhere');
  assert.throws(() => writeBusinessHead(f.directory, { '../../sentinel.txt': 'overwritten' }), /unsafe|file|path|contract/i);
  assert.equal(readFileSync(sentinel, 'utf8'), 'owned elsewhere');
});

test('a junction at the feature boundary cannot redirect publication', t => {
  const f = fixture(t), outside = path.join(f.owner, 'outside');
  mkdirSync(outside); mkdirSync(path.dirname(f.directory), { recursive: true });
  symlinkSync(outside, f.directory, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => f.plan(), /symlink|junction|path|directory/i);
  assert.deepEqual(readdirSync(outside), []);
  assert.notDeepEqual(verifyBusinessHead(f.storeRoot, f.input), []);
});

test('projection replacement never overwrites another file through a hardlink', t => {
  const f = fixture(t), outside = path.join(f.owner, 'other-owner.txt');
  writeFileSync(outside, 'original owner bytes');
  mkdirSync(f.directory, { recursive: true });
  linkSync(outside, path.join(f.directory, 'overview.md'));
  try { writeBusinessHead(f.directory, projectBusinessHead(f.input)); }
  catch (error) { assert.match(error.message, /link|path|file|projection/i); }
  assert.equal(readFileSync(outside, 'utf8'), 'original owner bytes');
});

test('registry replacement never overwrites another owner through a hardlink', t => {
  const f = fixture(t), registryFile = path.join(f.storeRoot, REGISTRY_FILE), outside = path.join(f.owner, 'other-registry.json');
  const before = readFileSync(registryFile); linkSync(registryFile, outside);
  try { f.publish(); }
  catch (error) { assert.match(error.message, /link|path|file|registry/i); }
  assert.ok(readFileSync(outside).equals(before), 'publication changed the other owner registry through a hardlink');
});

test('immutable object publication refuses a junction outside the registry authority', t => {
  const f = fixture(t), outside = path.join(f.owner, 'outside-objects'); mkdirSync(outside);
  symlinkSync(outside, path.join(f.storeRoot, 'objects'), process.platform === 'win32' ? 'junction' : 'dir');
  const before = readFileSync(path.join(f.storeRoot, REGISTRY_FILE));
  assert.throws(() => f.publish(), /symlink|junction|link|path|authority/i);
  assert.deepEqual(readdirSync(outside), []);
  assert.deepEqual(readFileSync(path.join(f.storeRoot, REGISTRY_FILE)), before);
});

test('the projection contract rejects deletion or remapping of each required output', t => {
  const f = fixture(t), root = path.join(f.owner, 'runtime');
  mkdirSync(path.join(root, 'templates/kinds'), { recursive: true });
  cpSync(path.join(ROOT, 'templates/business-head'), path.join(root, 'templates/business-head'), { recursive: true });
  cpSync(path.join(ROOT, 'templates/kinds/model.schema.json'), path.join(root, 'templates/kinds/model.schema.json'));
  const file = path.join(root, 'templates/business-head/projection.json'), contract = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(businessHeadContractErrors(root), []);
  for (const name of FILES) {
    const changed = structuredClone(contract); delete changed.files[name]; writeFileSync(file, encode(changed));
    assert.notDeepEqual(businessHeadContractErrors(root), [], `contract accepted missing ${name}`);
  }
  const changed = structuredClone(contract); changed.files['model.json'].source = 'evidence'; writeFileSync(file, encode(changed));
  assert.notDeepEqual(businessHeadContractErrors(root), [], 'contract accepted evidence as model.json');
  for (const name of ['CONTEXT.md', 'spec.md', 'model.json', 'evidence.json']) {
    const renamed = structuredClone(contract); renamed.files['renamed.md'] = renamed.files[name]; delete renamed.files[name]; writeFileSync(file, encode(renamed));
    assert.notDeepEqual(businessHeadContractErrors(root), [], `contract accepted renaming ${name}`);
  }
});

test('business storage resolves from the declared Workflow owner', t => {
  const f = fixture(t);
  assert.equal(path.resolve(businessesRootFor(ROOT, { project: 'synthetic', workflowOwner: { ownerRoot: f.owner } })), path.resolve(f.storeRoot));
});

test('relative head references follow alias depth and unsafe alias paths are refused', t => {
  const f = fixture(t), root = path.join(f.owner, 'alias-runtime');
  mkdirSync(path.join(root, 'alias'), { recursive: true });
  const alias = JSON.parse(readFileSync(path.join(ROOT, 'alias/alias.json'), 'utf8'));
  const file = path.join(root, 'alias/alias.json');
  alias.tree['@worktrees'].businesses.resolvesTo = '<Workflow>/.worktrees/<project>/businesses';
  writeFileSync(file, encode(alias));
  const directory = businessesRootFor(root, { project: 'synthetic', workflowOwner: { ownerRoot: f.owner } });
  const relative = '.worktrees/synthetic/businesses/features/learning-hub';
  assert.equal(path.resolve(headDirectory(directory, { ...f.input.model, headRef: relative }, root)), path.resolve(directory, 'features', 'learning-hub'));
  for (const unsafe of ['<Workflow>/../outside', ...(process.platform === 'win32' ? ['<Workflow>/.worktrees\\..\\..\\outside'] : [])]) {
    alias.tree['@worktrees'].businesses.resolvesTo = unsafe; writeFileSync(file, encode(alias));
    assert.throws(() => businessesRootFor(root, { project: 'synthetic', workflowOwner: { ownerRoot: f.owner } }), /escape|unsafe|Workflow|project/i);
  }
});

test('two projects sharing one Workflow root keep separate business authorities', t => {
  const f = fixture(t);
  const first = businessesRootFor(ROOT, { project: 'synthetic', workflowOwner: { ownerRoot: f.owner } });
  const second = businessesRootFor(ROOT, { project: 'other-project', workflowOwner: { ownerRoot: f.owner } });
  assert.notEqual(first, second);
  assert.equal(path.resolve(second), path.resolve(f.owner, '.worktrees/other-project/businesses'));
  assert.throws(() => headDirectory(first, { ...f.input.model, headRef: posix(path.join(second, 'features', f.input.model.featureId)) }), /headRef|directory|project/);
  const unpartitioned = path.join(f.owner, '.worktrees/businesses');
  assert.throws(() => headDirectory(unpartitioned, { ...f.input.model, headRef: posix(path.join(unpartitioned, 'features', f.input.model.featureId)) }), /alias|project|root|partition|directory/i);
  assert.equal(existsSync(unpartitioned), false);
  for (const project of [undefined, '', '../other-project', '..', 'a/b', 'a\\b']) assert.throws(() => businessesRootFor(ROOT, { project, workflowOwner: { ownerRoot: f.owner } }), /project|unsafe|missing/i);
});
