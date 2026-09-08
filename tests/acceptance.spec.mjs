import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWorkspace } from '../core/index.mjs';
import { base, node, resource, complete, mutateJSON, mutateNode, imageAsset, COMMIT } from '../fixtures/build-workspace.mjs';

function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'work-v3-acceptance-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return base(root);
}
function rejected(root, code) {
  const result = validateWorkspace(root);
  assert.equal(result.ok, false, 'invalid fixture incorrectly accepted');
  if (code) assert.ok(result.errors.some(item => item.code === code), `Expected ${code}: ${JSON.stringify(result.errors)}`);
  return result;
}

test('synthetic complete business leaf binds observations; changing operational state leaves digest stable', t => {
  const root = temporary(t);
  const proof = complete(root, 'business');
  let result = validateWorkspace(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.nodes[0].effectiveState, 'done');
  mutateNode(path.join(root, 'business/node.md'), value => { value.state = 'doing'; delete value.completion; });
  result = validateWorkspace(root);
  assert.equal(result.nodes[0].inputDigest, proof.inputDigest);
  assert.equal(result.nodes[0].effectiveState, 'doing');
});

test('duplicate IDs, missing references, and dependency cycles are executable failures', t => {
  const root = temporary(t);
  node(root, 'first', { id: 'duplicate' }); node(root, 'second', { id: 'duplicate' });
  rejected(root, 'DUPLICATE_ID');
  node(root, 'second', { id: 'second', refs: ['missing'] });
  rejected(root, 'MISSING_REF');
  node(root, 'first', { id: 'first', dependsOn: ['second'] });
  node(root, 'second', { id: 'second', dependsOn: ['first'] });
  rejected(root, 'CYCLE');
});

test('parents derive state and cannot self-certify while required children remain incomplete', t => {
  const root = temporary(t);
  node(root, 'business', { state: 'done' }); node(root, 'business/required');
  rejected(root, 'BRANCH_STATE');
  mutateNode(path.join(root, 'business/node.md'), value => { delete value.state; });
  const result = validateWorkspace(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.nodes.find(item => item.id === 'business').effectiveState, 'todo');
});

test('semantic requirement edit suspends done rather than preserving an old checkmark', t => {
  const root = temporary(t);
  complete(root, 'business');
  fs.appendFileSync(path.join(root, 'business/node.md'), '\nRequirement changed: now verify restart.\n');
  const result = rejected(root, 'STALE_COMPLETION');
  assert.equal(result.nodes[0].effectiveState, 'suspended');
});

test('resource revisions and transitive dependencies invalidate downstream completions', t => {
  const root = temporary(t);
  const file = resource(root, 'env', 'environment');
  complete(root, 'upstream', { refs: ['env'] });
  complete(root, 'downstream', { dependsOn: ['upstream'] });
  assert.equal(validateWorkspace(root).ok, true);
  mutateJSON(file, value => { value.revision = 'r2'; });
  const result = rejected(root, 'STALE_COMPLETION');
  assert.notEqual(result.nodes.find(item => item.id === 'downstream').effectiveState, 'done');
});

test('extension data is retained in input binding; unknown kinds cannot earn done', t => {
  const root = temporary(t);
  node(root, 'piece', { kind: 'custom.mobile', extensions: { 'example.mobile': { variant: 1 } } });
  const before = validateWorkspace(root);
  assert.equal(before.ok, true, JSON.stringify(before.errors));
  mutateNode(path.join(root, 'piece/node.md'), value => { value.extensions['example.mobile'].variant = 2; });
  assert.notEqual(validateWorkspace(root).nodes[0].inputDigest, before.nodes[0].inputDigest);
  complete(root, 'piece', { kind: 'custom.mobile' });
  rejected(root, 'UNSUPPORTED_PROFILE');
});

test('unsupported YAML is rejected rather than coerced to false completion', t => {
  const root = temporary(t);
  fs.writeFileSync(path.join(root, 'workspace.yaml'), 'schema: work/workspace@1\nid: duplicate\nid: ambiguous\n');
  rejected(root, 'UNSUPPORTED_METADATA');
});

test('assertion coverage, negative observations, and wrong evidence ownership refuse done', t => {
  const root = temporary(t);
  const proof = complete(root, 'piece');
  mutateJSON(proof.evidenceFile, value => { value.assertions[0].id = 'different'; });
  rejected(root, 'ASSERTION_COVERAGE');
  mutateJSON(proof.evidenceFile, value => { value.assertions[0].id = 'accept'; value.assertions[0].outcome = 'fail'; });
  rejected(root, 'EVIDENCE_NOT_PASS');
  node(root, 'other');
  mutateJSON(proof.evidenceFile, value => { value.assertions[0].outcome = 'pass'; value.nodeId = 'other'; });
  rejected(root, 'EVIDENCE_OWNER');
});

test('implementation binds full source commit and selected evidence commit, not a short SHA', t => {
  const root = temporary(t);
  resource(root, 'repo', 'repository');
  const proof = complete(root, 'code', { kind: 'implementation', refs: ['repo'] }, { codeRefs: [{ repository: 'repo', commit: COMMIT }] });
  assert.equal(validateWorkspace(root).ok, true);
  mutateNode(path.join(root, 'code/node.md'), value => { value.completion.codeRefs[0].commit = COMMIT.slice(0, 8); });
  rejected(root, 'COMMIT');
  mutateNode(path.join(root, 'code/node.md'), value => { value.completion.codeRefs[0].commit = COMMIT; });
  mutateJSON(proof.evidenceFile, value => { value.codeRefs[0].commit = 'b'.repeat(40); });
  rejected(root, 'CODE_EVIDENCE_BINDING');
});

test('asset traversal, missing files, and byte tampering refuse completion', t => {
  const root = temporary(t);
  const proof = complete(root, 'piece');
  mutateJSON(proof.evidenceFile, value => { value.assets = [{ path: '../../outside.png', sha256: 'a'.repeat(64) }]; });
  rejected(root, 'ASSET_ESCAPE');
  mutateJSON(proof.evidenceFile, value => { value.assets[0].path = 'capture.png'; });
  rejected(root, 'ASSET_UNREADABLE');
  fs.writeFileSync(path.join(path.dirname(proof.evidenceFile), 'capture.png'), 'tampered bytes');
  rejected(root, 'ASSET_HASH');
});

test('symlink escape cannot supply evidence from outside a workspace', t => {
  const root = temporary(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'work-v3-external-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const proof = complete(root, 'piece');
  fs.writeFileSync(path.join(outside, 'capture.png'), 'external bytes');
  fs.symlinkSync(outside, path.join(path.dirname(proof.evidenceFile), 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  mutateJSON(proof.evidenceFile, value => { value.assets = [{ path: 'linked/capture.png', sha256: 'a'.repeat(64) }]; });
  rejected(root, 'SYMLINK');
});

test('invalid plaintext credential metadata is not echoed in validation output', t => {
  const root = temporary(t);
  resource(root, 'actor', 'identity', { password: 'SYNTHETIC_SECRET_MUST_NOT_ECHO' });
  const result = rejected(root, 'PLAINTEXT_SECRET');
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET_MUST_NOT_ECHO'));
});

function uat(root, kind = 'uat.ux', metadata = {}) {
  resource(root, 'env', 'environment'); resource(root, 'actor', 'identity', { sealedRef: 'secret-store:synthetic' }); resource(root, 'repo', 'repository');
  const proof = complete(root, 'uat', { kind, refs: ['env', 'actor', 'repo'], assertions: ['accept', 'runtime-version'], ...metadata }, {
    assertions: [{ id: 'accept', outcome: 'pass', kind: 'behavior', observation: 'Synthetic behavior observation, not product acceptance.' },
      { id: 'runtime-version', outcome: 'pass', observation: 'Synthetic runtime identity readback.' }],
    provenance: { environment: 'env', actor: 'actor', servedVersions: [{ repository: 'repo', commit: COMMIT, artifact: `sha256:${'b'.repeat(64)}` }],
      tool: 'synthetic-test-harness', capturedAt: '2026-09-07T00:00:00.000Z', servedVersionEvidence: 'runtime-version' }
  });
  const asset = imageAsset(path.dirname(proof.evidenceFile));
  mutateJSON(proof.evidenceFile, value => { value.assets = [asset]; });
  return proof;
}

test('UAT rejects screenshot-only UX even when image integrity and runtime provenance are valid', t => {
  const root = temporary(t);
  const proof = uat(root);
  assert.equal(validateWorkspace(root).ok, true, JSON.stringify(validateWorkspace(root).errors));
  mutateJSON(proof.evidenceFile, value => { delete value.assertions[0].kind; });
  rejected(root, 'UAT_BEHAVIOR');
});

test('UAT refuses absent served revision, source-HEAD-only proof, and unbound resource custody', t => {
  const root = temporary(t);
  const proof = uat(root);
  mutateJSON(proof.evidenceFile, value => { delete value.provenance.servedVersions; });
  rejected(root, 'CODE_REFS');
  mutateJSON(proof.evidenceFile, value => { value.provenance.servedVersions = [{ repository: 'repo', commit: COMMIT, artifact: COMMIT }]; });
  rejected(root);
  mutateJSON(proof.evidenceFile, value => { value.provenance.servedVersions[0].artifact = `sha256:${'b'.repeat(64)}`; delete value.provenance.servedVersionEvidence; });
  rejected(root, 'SERVED_VERSION_PROOF');
  mutateJSON(proof.evidenceFile, value => { value.provenance.servedVersionEvidence = 'runtime-version'; });
  mutateNode(path.join(root, 'uat/node.md'), value => { value.refs = ['repo']; });
  rejected(root, 'UNBOUND_PROVENANCE');
});

test('UI requires captured image bytes, and missing acceptance assertions never earn done', t => {
  const root = temporary(t);
  const proof = uat(root, 'uat.ui');
  assert.equal(validateWorkspace(root).ok, true, JSON.stringify(validateWorkspace(root).errors));
  mutateJSON(proof.evidenceFile, value => { value.assets = []; });
  rejected(root, 'UI_CAPTURE');
  mutateJSON(proof.evidenceFile, value => { value.assertions = []; });
  rejected(root, 'ASSERTION_COVERAGE');
});

test('a 40-character hash is structurally bindable but is not falsely certified as a real Git object', t => {
  const root = temporary(t);
  resource(root, 'repo', 'repository', { location: 'nonexistent-synthetic-repository' });
  complete(root, 'code', { kind: 'implementation', refs: ['repo'] }, { codeRefs: [{ repository: 'repo', commit: COMMIT }] });
  // This explicit limit prevents interpreting validator success as a Git existence or UAT truth proof.
  const result = validateWorkspace(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(!Object.keys(result).some(key => /gitObjectVerified|productAccepted/i.test(key)));
});

test('malformed nested code references produce structured errors rather than crashing validation', t => {
  const root = temporary(t);
  resource(root, 'repo', 'repository');
  complete(root, 'code', { kind: 'implementation', refs: ['repo'] }, { codeRefs: [{ repository: 'repo', commit: COMMIT }] });
  mutateNode(path.join(root, 'code/node.md'), value => { value.completion.codeRefs = [null]; });
  rejected(root, 'COMMIT');
});

test('malformed UAT assertions produce structured errors rather than crashing validation', t => {
  const root = temporary(t);
  const proof = uat(root);
  mutateJSON(proof.evidenceFile, value => { value.assertions = [null]; });
  rejected(root, 'ASSERTION');
});

test('ancestor dependency gates apply to executable descendants, not only the rollup label', t => {
  const root = temporary(t);
  node(root, 'contract', { id: 'contract' });
  node(root, 'implementation', { id: 'implementation', dependsOn: ['contract'] });
  mutateNode(path.join(root, 'implementation/node.md'), value => { delete value.state; });
  node(root, 'implementation/backend', { id: 'backend' });
  const result = validateWorkspace(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.nodes.find(item => item.id === 'backend').eligible, false, 'Child cannot bypass an unmet branch prerequisite.');
});

test('one evidence bundle supports explicitly bound consumers but not unauthorized reuse or outdated consumers', t => {
  const root = temporary(t);
  const proof = complete(root, 'first');
  node(root, 'second');
  const secondDigest = validateWorkspace(root).nodes.find(item => item.id === 'second').inputDigest;
  mutateNode(path.join(root, 'second/node.md'), value => { value.state = 'done'; value.completion = { inputDigest: secondDigest, evidence: [proof.evidenceId] }; });
  rejected(root, 'EVIDENCE_OWNER');
  mutateJSON(proof.evidenceFile, value => { value.bindings = [{ nodeId: 'second', inputDigest: secondDigest }]; });
  let result = validateWorkspace(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.nodes.every(item => item.effectiveState === 'done'));
  fs.appendFileSync(path.join(root, 'second/node.md'), '\nChanged second-consumer acceptance only.\n');
  result = rejected(root, 'STALE_COMPLETION');
  assert.notEqual(result.nodes.find(item => item.id === 'second').effectiveState, 'done');
  assert.equal(result.nodes.find(item => item.id === 'first').effectiveState, 'done');
});

test('business changes suspend architecture, implementation and UAT across multiple dependency hops without rewriting proof', t => {
  const root = temporary(t);
  resource(root, 'repo', 'repository');
  const business = complete(root, 'business');
  const architecture = complete(root, 'architecture', { kind: 'architecture', dependsOn: ['business'] });
  const code = complete(root, 'code', { kind: 'implementation', dependsOn: ['architecture'], refs: ['repo'] }, { codeRefs: [{ repository: 'repo', commit: COMMIT }] });
  const verification = uat(root, 'uat.ux', { dependsOn: ['code'] });
  const proofs = [business, architecture, code, verification].map(item => [item.evidenceFile, fs.readFileSync(item.evidenceFile, 'utf8')]);
  assert.equal(validateWorkspace(root).ok, true);
  fs.appendFileSync(path.join(root, 'business/node.md'), '\nNew authoritative business requirement.\n');
  const result = rejected(root, 'STALE_COMPLETION');
  for (const id of ['business', 'architecture', 'code', 'uat']) {
    const current = result.nodes.find(item => item.id === id);
    assert.equal(current.state, 'done', `${id} must preserve authored completion state`);
    assert.equal(current.effectiveState, 'suspended', `${id} must suspend outdated completion`);
  }
  assert.ok(result.nodes.find(item => item.id === 'uat').blockedBy.includes('code'));
  for (const [file, bytes] of proofs) assert.equal(fs.readFileSync(file, 'utf8'), bytes);
});

test('account and chat pieces cannot execute before their module exists and has verified done state', t => {
  const root = temporary(t);
  node(root, 'account', { dependsOn: ['module'] });
  node(root, 'chat', { dependsOn: ['module', 'account'] });
  rejected(root, 'MISSING_REF');
  node(root, 'module');
  let result = validateWorkspace(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.nodes.find(item => item.id === 'account').eligible, false);
  assert.ok(result.nodes.find(item => item.id === 'chat').blockedBy.includes('module'));
  node(root, 'module', { state: 'na', naReason: 'Synthetic module deliberately absent; this cannot satisfy dependents.' });
  result = validateWorkspace(root);
  assert.equal(result.nodes.find(item => item.id === 'account').eligible, false);
  complete(root, 'module');
  result = validateWorkspace(root);
  assert.equal(result.nodes.find(item => item.id === 'account').eligible, true);
  assert.equal(result.nodes.find(item => item.id === 'chat').eligible, false);
  complete(root, 'account', { dependsOn: ['module'] });
  assert.equal(validateWorkspace(root).nodes.find(item => item.id === 'chat').eligible, true);
});

test('completed dependent suspends when a prerequisite loses done even if all semantic digests still match', t => {
  const root = temporary(t);
  complete(root, 'module');
  const account = complete(root, 'account', { dependsOn: ['module'] });
  const evidenceBefore = fs.readFileSync(account.evidenceFile, 'utf8');
  const before = validateWorkspace(root).nodes.find(item => item.id === 'account');
  mutateNode(path.join(root, 'module/node.md'), value => { value.state = 'todo'; delete value.completion; });
  const result = rejected(root, 'DEPENDENCY_NOT_DONE');
  const current = result.nodes.find(item => item.id === 'account');
  assert.equal(current.inputDigest, before.inputDigest);
  assert.equal(current.state, 'done');
  assert.equal(current.effectiveState, 'suspended');
  assert.ok(current.blockedBy.includes('module'));
  assert.ok(current.suspensionReasons.some(reason => reason.code === 'PREREQUISITE_NOT_DONE' && reason.ids.includes('module')));
  assert.equal(fs.readFileSync(account.evidenceFile, 'utf8'), evidenceBefore);
});

test('an art-direction image byte edit suspends UI and dependent UAT while unrelated backend remains done', t => {
  const root = temporary(t);
  resource(root, 'repo', 'repository');
  const artFile = resource(root, 'art', 'design', { purpose: 'Synthetic desired art direction, not a browser capture.' });
  const image = imageAsset(path.dirname(artFile));
  mutateJSON(artFile, value => { value.files = [{ path: image.path }]; });
  const ui = complete(root, 'ui', { kind: 'implementation', refs: ['repo', 'art'] }, { codeRefs: [{ repository: 'repo', commit: COMMIT }] });
  const backend = complete(root, 'backend', { kind: 'implementation', refs: ['repo'] }, { codeRefs: [{ repository: 'repo', commit: COMMIT }] });
  const verification = uat(root, 'uat.ux', { dependsOn: ['ui'] });
  const evidenceBefore = [ui, backend, verification].map(item => [item.evidenceFile, fs.readFileSync(item.evidenceFile, 'utf8')]);
  const resourceBefore = fs.readFileSync(artFile, 'utf8');
  let result = validateWorkspace(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  fs.appendFileSync(path.join(path.dirname(artFile), image.path), Buffer.from('synthetic-art-revision'));
  result = rejected(root, 'STALE_COMPLETION');
  assert.equal(result.nodes.find(item => item.id === 'ui').effectiveState, 'suspended');
  assert.equal(result.nodes.find(item => item.id === 'uat').effectiveState, 'suspended');
  assert.equal(result.nodes.find(item => item.id === 'backend').effectiveState, 'done');
  assert.equal(fs.readFileSync(artFile, 'utf8'), resourceBefore, 'actual bytes, not a manual revision edit, caused suspension');
  for (const [file, bytes] of evidenceBefore) assert.equal(fs.readFileSync(file, 'utf8'), bytes);
});

test('dependency declaration typos fail closed instead of creating an apparently eligible piece', t => {
  const root = temporary(t);
  node(root, 'account', { dependOn: ['absent-module'] });
  const result = rejected(root, 'UNKNOWN_FIELD');
  assert.equal(result.nodes.find(item => item.id === 'account').eligible, false);
});
