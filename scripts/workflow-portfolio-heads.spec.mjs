import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { repositoryProof } from './workflow-verification.mjs';
import { validateAgainst } from './json-schema.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const schema = name => JSON.parse(readFileSync(path.join(ROOT, 'templates/kinds', `${name}.schema.json`), 'utf8'));

const git = (worktree, args) => execFileSync('git', ['-C', worktree, ...args], {
  encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
}).trim();
const commit = (worktree, message) => {
  git(worktree, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', message]);
  return git(worktree, ['rev-parse', 'HEAD']);
};
const proof = (doneWhen, ref, alias, worktree, revision, repositoryHash) => ({
  doneWhen, ref, fingerprint: `sha256:${String(doneWhen + 1).padStart(64, '0')}`,
  bindings: [{ alias, worktree, revision, repositoryHash }]
});
const rows = (...items) => new Map(items.map((item, index) => [index, { proofs: [item], refusals: [] }]));

test('multi-repository proof keeps frozen evidence on same-repository ancestry and pins every delivered head exactly', () => {
  const host = mkdtempSync(path.join(tmpdir(), 'starci-portfolio-heads-'));
  try {
    const be = path.join(host, 'be');
    const fe = path.join(host, 'fe');
    git(host, ['init', '-q', be]);
    git(host, ['init', '-q', fe]);
    const beBase = commit(be, 'business baseline');
    const beHead = commit(be, 'backend delivery');
    const feBase = commit(fe, 'frontend baseline');
    const feHead = commit(fe, 'frontend delivery');
    const peer = { heads: [
      { alias: '@workspaces/be', head: beHead, deliveryDoneWhen: [1] },
      { alias: '@workspaces/fe', head: feHead, deliveryDoneWhen: [2] }
    ] };
    const goals = [
      { producedBy: 'business.decide' },
      { producedBy: 'api.verify' },
      { producedBy: 'interface.audit' }
    ];
    const ancestors = ['business.decide'];
    const validRows = rows(
      proof(0, 'step-1/parallel-1', '@workspaces/be', be, beBase, 'repo-be'),
      proof(1, 'step-2/parallel-1', '@workspaces/be', be, beHead, 'repo-be'),
      proof(2, 'step-3/parallel-1', '@workspaces/fe', fe, feHead, 'repo-fe')
    );
    const verified = repositoryProof(peer, validRows, goals, ancestors);
    assert.deepEqual(verified.evidence.map(item => [item.doneWhen, item.repository.relation]), [[0, 'ancestor'], [1, 'exact'], [2, 'exact']]);
    assert.deepEqual(verified.heads.map(item => [item.alias, item.head]), [['@workspaces/be', beHead], ['@workspaces/fe', feHead]]);

    const stale = structuredClone(peer);
    stale.heads[0].head = beBase;
    assert.throws(() => repositoryProof(stale, validRows, goals, ancestors), /no single accepted proving branch/);

    const mismatched = structuredClone(peer);
    mismatched.heads[0].head = feHead;
    assert.throws(() => repositoryProof(mismatched, validRows, goals, ancestors), /no single accepted proving branch/);

    const foreign = path.join(host, 'foreign-be');
    execFileSync('git', ['clone', '-q', be, foreign], { windowsHide: true, stdio: 'ignore' });
    const foreignRows = rows(
      proof(0, 'step-1/parallel-1', '@workspaces/be', foreign, beBase, 'repo-foreign'),
      proof(1, 'step-2/parallel-1', '@workspaces/be', be, beHead, 'repo-be'),
      proof(2, 'step-3/parallel-1', '@workspaces/fe', fe, feHead, 'repo-fe')
    );
    assert.throws(() => repositoryProof(peer, foreignRows, goals, ancestors), /no single accepted proving branch in the declared repository ancestry/);

    const arbitraryAncestorRows = rows(
      proof(0, 'step-1/parallel-1', '@workspaces/fe', fe, feBase, 'repo-fe'),
      proof(1, 'step-2/parallel-1', '@workspaces/be', be, beHead, 'repo-be'),
      proof(2, 'step-3/parallel-1', '@workspaces/fe', fe, feHead, 'repo-fe')
    );
    arbitraryAncestorRows.get(0).proofs[0].bindings[0].alias = '@workspaces/be';
    assert.throws(() => repositoryProof(peer, arbitraryAncestorRows, goals, ancestors), /no single accepted proving branch in the declared repository ancestry/);

    const omittedCurrent = rows(
      proof(0, 'step-1/parallel-1', '@workspaces/be', be, beBase, 'repo-be'),
      proof(1, 'step-2/parallel-1', '@workspaces/be', be, beHead, 'repo-be'),
      proof(2, 'step-3/parallel-1', '@workspaces/be', be, beBase, 'repo-be')
    );
    const omittedGoals = [goals[0], { producedBy: 'backend.generate' }, { producedBy: 'quality.verify' }];
    const callerSelectedGenerationOnly = { heads: [{ alias: '@workspaces/be', head: beHead, deliveryDoneWhen: [1] }] };
    assert.throws(() => repositoryProof(callerSelectedGenerationOnly, omittedCurrent, omittedGoals, ancestors), /omits required current child doneWhen:2/);
    callerSelectedGenerationOnly.heads[0].deliveryDoneWhen.push(2);
    assert.throws(() => repositoryProof(callerSelectedGenerationOnly, omittedCurrent, omittedGoals, ancestors), /no single accepted proving branch/);

    const uat = proof(2, 'step-3/parallel-1', '@workspaces/fe', fe, feHead, 'repo-fe');
    uat.bindings.push({ alias: '@workspaces/be', worktree: be, revision: beHead, repositoryHash: 'repo-be' });
    const crossBoundaryRows = rows(
      proof(0, 'step-1/parallel-1', '@workspaces/be', be, beBase, 'repo-be'),
      proof(1, 'step-2/parallel-1', '@workspaces/be', be, beHead, 'repo-be'),
      uat
    );
    const missingFeUat = { heads: [
      { alias: '@workspaces/be', head: beHead, deliveryDoneWhen: [1, 2] },
      { alias: '@workspaces/fe', head: feHead, deliveryDoneWhen: [1] }
    ] };
    assert.throws(() => repositoryProof(missingFeUat, crossBoundaryRows, goals, ancestors), /@workspaces\/fe: deliveryDoneWhen omits required current child doneWhen:2/);

    const pairedPeer = structuredClone(peer);
    pairedPeer.heads[0].deliveryDoneWhen.push(3);
    pairedPeer.heads[1].deliveryDoneWhen.push(3);
    const pairedGoals = [...goals, { producedBy: 'uat.verify' }];
    const partial = proof(3, 'step-4/parallel-1', '@workspaces/fe', fe, feHead, 'repo-fe');
    const exactPair = proof(3, 'step-4/parallel-2', '@workspaces/fe', fe, feHead, 'repo-fe');
    exactPair.bindings.push({ alias: '@workspaces/be', worktree: be, revision: beHead, repositoryHash: 'repo-be' });
    const exactPairRows = new Map(validRows);
    exactPairRows.set(3, { proofs: [partial, exactPair], refusals: [] });
    const paired = repositoryProof(pairedPeer, exactPairRows, pairedGoals, ancestors);
    const pairedEvidence = paired.evidence.filter(item => item.doneWhen === 3);
    assert.equal(pairedEvidence.length, 2);
    assert.ok(pairedEvidence.every(item => item.ref === exactPair.ref), 'one complete accepted row proves the delivered FE/BE pair');

    const feNewBeOld = proof(3, 'step-4/parallel-1', '@workspaces/fe', fe, feHead, 'repo-fe');
    feNewBeOld.bindings.push({ alias: '@workspaces/be', worktree: be, revision: beBase, repositoryHash: 'repo-be' });
    const feOldBeNew = proof(3, 'step-4/parallel-2', '@workspaces/fe', fe, feBase, 'repo-fe');
    feOldBeNew.bindings.push({ alias: '@workspaces/be', worktree: be, revision: beHead, repositoryHash: 'repo-be' });
    const crossedRows = new Map(validRows);
    crossedRows.set(3, { proofs: [feNewBeOld, feOldBeNew], refusals: [] });
    assert.throws(() => repositoryProof(pairedPeer, crossedRows, pairedGoals, ancestors), /no single accepted proving branch at the exact delivered head of every bound repository/);

    const ambiguousHints = new Map([['@workspaces/be', [
      { worktree: be, repositoryHash: 'repo-be' },
      { worktree: foreign, repositoryHash: 'repo-foreign' }
    ]]]);
    assert.throws(() => repositoryProof(peer, validRows, goals, ancestors, ambiguousHints), /resolves to multiple accepted repository identities/);
  } finally {
    rmSync(host, { recursive: true, force: true });
  }
});

test('version 2 snapshot and report contracts carry repository boundaries while version 1 remains available', () => {
  const doneWhen = ['portfolio outcome'];
  const snapshot = { version: 2, peers: { task: {
    sessionId: 'peer-session', goal: 'deliver two repositories', owns: 'feature', doneWhen,
    heads: [
      { alias: '@workspaces/be', head: 'a'.repeat(40), deliveryDoneWhen: [1] },
      { alias: '@workspaces/fe', head: 'b'.repeat(40), deliveryDoneWhen: [2] }
    ]
  } } };
  assert.deepEqual(validateAgainst(schema('workflow-peers'), snapshot, 'request/peers.json'), []);
  const report = { version: 2, snapshotHash: `sha256:${'c'.repeat(64)}`, peers: [{
    taskId: 'task', sessionId: 'peer-session', goal: 'deliver two repositories', owns: 'feature', doneWhen,
    stateHash: `sha256:${'d'.repeat(64)}`,
    heads: snapshot.peers.task.heads.map((item, index) => ({ alias: item.alias, head: item.head,
      repositoryHash: `sha256:${String(index + 1).repeat(64)}`,
      deliveryEvidence: [{ doneWhen: item.deliveryDoneWhen[0], ref: `step-${index + 2}/parallel-1`, fingerprint: `sha256:${String(index + 3).repeat(64)}` }] })),
    evidence: [
      { doneWhen: 0, ref: 'step-1/parallel-1', fingerprint: `sha256:${'4'.repeat(64)}`,
        repository: { alias: '@workspaces/be', revision: 'e'.repeat(40), terminalHead: 'a'.repeat(40), relation: 'ancestor' } },
      { doneWhen: 1, ref: 'step-2/parallel-1', fingerprint: `sha256:${'5'.repeat(64)}`,
        repository: { alias: '@workspaces/be', revision: 'a'.repeat(40), terminalHead: 'a'.repeat(40), relation: 'exact' } },
      { doneWhen: 2, ref: 'step-3/parallel-1', fingerprint: `sha256:${'6'.repeat(64)}`,
        repository: { alias: '@workspaces/fe', revision: 'b'.repeat(40), terminalHead: 'b'.repeat(40), relation: 'exact' } }
    ]
  }] };
  assert.deepEqual(validateAgainst(schema('workflow-verification-report'), report, 'report'), []);
  const legacy = { version: 1, peers: { task: { sessionId: 'peer-session', goal: 'one repository', owns: 'feature', head: 'a'.repeat(40), doneWhen } } };
  assert.deepEqual(validateAgainst(schema('workflow-peers'), legacy, 'request/peers.json'), []);
});
