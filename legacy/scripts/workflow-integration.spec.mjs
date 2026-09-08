import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { affectedConsumerHeads, canonicalRepository, verifyIntegratedTuple } from './workflow-coordination.mjs';

// This suite owns the extracted Git/tuple boundary only. Its bindings are measured from real
// repositories; they are deliberately not labeled accepted operator evidence. The production
// caller separately requires accepted source and verifier attempts, sealed Inputs, the final
// resolved assignment and a mandatory combined criterion before entering this helper.
const put = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'); };
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = (cwd, message) => { git(cwd, 'add', '.'); git(cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', message); return git(cwd, 'rev-parse', 'HEAD'); };
const merge = (cwd, head) => git(cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'merge', '--no-ff', '-m', 'Integrate consumer contribution', head);

function fixture(t) {
  const home = mkdtempSync(path.join(tmpdir(), 'starci-integration-'));
  t.after(() => {
    if (!path.resolve(home).startsWith(path.resolve(tmpdir()) + path.sep)) throw Error('unsafe integration fixture cleanup');
    rmSync(home, { recursive: true, force: true });
  });
  const repositoryRoot = path.join(home, 'product'); mkdirSync(repositoryRoot); git(repositoryRoot, 'init', '-q');
  put(path.join(repositoryRoot, 'package.json'), { private: true, type: 'module', scripts: { build: 'node integration-check.mjs a b' } });
  put(path.join(repositoryRoot, 'integration-check.mjs'), [
    "import assert from 'node:assert/strict';",
    "import { readFileSync } from 'node:fs';",
    "const read = name => JSON.parse(readFileSync(new URL(`src/modules/${name}/contract.json`, import.meta.url), 'utf8'));",
    "const shared = read('shared'); assert.equal(shared.version, 'shared-v1');",
    "assert.ok(process.argv.length > 2, 'at least one consumer must be checked');",
    "for (const name of process.argv.slice(2)) { const consumer = read(name); assert.equal(consumer.consumer, name); assert.equal(consumer.dependency, shared.version); }",
    "process.stdout.write(JSON.stringify({ checked: process.argv.slice(2), shared: shared.version }) + '\\n');",
    ''
  ].join('\n'));
  const base = commit(repositoryRoot, 'Real Git fixture base with declared integration check');
  git(repositoryRoot, 'remote', 'add', 'origin', repositoryRoot);
  const repository = canonicalRepository(repositoryRoot);
  const checkout = (name, start) => { const worktree = path.join(home, name); git(repositoryRoot, 'worktree', 'add', '--quiet', '-b', `session/${name}`, worktree, start); return worktree; };
  const producer = checkout('producer-c', base);
  put(path.join(producer, 'src/modules/shared/contract.json'), { version: 'shared-v1' });
  const sharedHead = commit(producer, 'Introduce the extracted shared contract');
  const a = checkout('consumer-a', sharedHead), b = checkout('consumer-b', sharedHead);
  put(path.join(a, 'src/modules/a/contract.json'), { consumer: 'a', dependency: 'shared-v1' });
  put(path.join(b, 'src/modules/b/contract.json'), { consumer: 'b', dependency: 'shared-v1' });
  const aHead = commit(a, 'Consumer A uses the shared contract'), bHead = commit(b, 'Consumer B uses the shared contract');
  const integrated = checkout('integrated', sharedHead); merge(integrated, aHead); merge(integrated, bHead);
  const integratedHead = git(integrated, 'rev-parse', 'HEAD');
  const contributions = new Map([[repository, new Map([['producer-c', sharedHead], ['consumer-b', bHead], ['consumer-a', aHead]])]]);
  const required = [...contributions.get(repository)].map(([sessionId, head]) => ({ sessionId, head })).sort((x, y) => x.sessionId.localeCompare(y.sessionId));
  const binding = (worktree, alias = '@workspaces/be') => ({ alias, worktree, revision: git(worktree, 'rev-parse', 'HEAD') });
  const declaration = head => ({ repositories: [{ repository, head, contributions: structuredClone(required) }] });
  const repositoryFor = item => canonicalRepository(git(item.worktree, 'remote', 'get-url', 'origin'));
  const verify = (worktree, overrides = {}) => verifyIntegratedTuple({ contributions, integration: declaration(git(worktree, 'rev-parse', 'HEAD')), bindings: [binding(worktree)], repositoryFor, ...overrides });
  const run = (worktree, ...consumers) => spawnSync(process.execPath, ['integration-check.mjs', ...consumers], { cwd: worktree, encoding: 'utf8', windowsHide: true, shell: false, timeout: 10000 });
  return { home, repositoryRoot, repository, base, producer, sharedHead, a, aHead, b, bHead, integrated, integratedHead, contributions, required, checkout, binding, declaration, verify, run, repositoryFor };
}

test('real separate A/B regression heads do not prove the combined delivery; the actual merged head contains every contribution', t => {
  const f = fixture(t);
  assert.equal(git(f.repositoryRoot, 'merge-base', f.aHead, f.bHead), f.sharedHead, 'A and B actually diverge after the shared producer');
  for (const [worktree, consumer] of [[f.a, 'a'], [f.b, 'b']]) {
    const result = f.run(worktree, consumer);
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { checked: [consumer], shared: 'shared-v1' });
    const combined = f.run(worktree, 'a', 'b');
    assert.equal(combined.error, undefined); assert.notEqual(combined.status, 0, 'the other consumer is absent at this independently passing head');
    assert.throws(() => f.verify(worktree), /COORDINATION_COMBINED.*every producer and consumer contribution/);
  }
  const actual = f.run(f.integrated, 'a', 'b');
  assert.equal(actual.error, undefined); assert.equal(actual.status, 0, actual.stderr);
  assert.deepEqual(JSON.parse(actual.stdout), { checked: ['a', 'b'], shared: 'shared-v1' });
  assert.deepEqual(f.verify(f.integrated), [{ repository: f.repository, alias: '@workspaces/be', head: f.integratedHead, contributions: f.required }]);
  assert.equal(git(f.integrated, 'rev-parse', 'HEAD'), f.integratedHead, 'regression and tuple verification do not move the source head');
});

test('the combined tuple requires exactly one frozen repository binding and the complete sorted contribution set', t => {
  const f = fixture(t), baseline = f.declaration(f.integratedHead);
  for (const [name, change, needle] of [
    ['missing producer', value => { value.repositories[0].contributions.pop(); }, /omits or changes/],
    ['missing consumer', value => { value.repositories[0].contributions.shift(); }, /omits or changes/],
    ['changed consumer head', value => { value.repositories[0].contributions[0].head = f.sharedHead; }, /omits or changes/],
    ['wrong producer identity', value => { value.repositories[0].contributions[2].sessionId = 'foreign-producer'; }, /omits or changes/],
    ['unsorted contribution identity', value => { value.repositories[0].contributions.reverse(); }, /omits or changes/],
    ['duplicate contribution', value => { value.repositories[0].contributions.push(value.repositories[0].contributions[0]); }, /omits or changes/],
    ['missing repository', value => { value.repositories = []; }, /exact integrated repository tuple/],
    ['extra repository', value => { value.repositories.push(structuredClone(value.repositories[0])); }, /exact integrated repository tuple/],
    ['wrong repository identity', value => { value.repositories[0].repository += '-foreign'; }, /omits or changes/],
    ['stale tested head', value => { value.repositories[0].head = f.aHead; }, /one actual integrated head/]
  ]) {
    const integration = structuredClone(baseline); change(integration);
    assert.throws(() => f.verify(f.integrated, { integration }), needle, name);
  }
  assert.throws(() => f.verify(f.integrated, { bindings: [] }), /one actual integrated head/);
  assert.throws(() => f.verify(f.integrated, { bindings: [{ alias: '@workspaces/be', revision: f.integratedHead, worktree: null }] }), /one actual integrated head/, 'a planned context is not a repository binding');
  assert.throws(() => f.verify(f.integrated, { bindings: [f.binding(f.integrated), f.binding(f.integrated, '@workspaces/alias')] }), /one actual integrated head/, 'duplicate aliases cannot count one repository twice');
  assert.deepEqual(f.declaration(f.integratedHead), baseline, 'failed tuple checks leave the declaration unchanged');
});

test('a changed integration checkout and a content-equivalent head without contribution ancestry are rejected', t => {
  const f = fixture(t), measured = f.binding(f.integrated), integration = f.declaration(f.integratedHead);
  git(f.integrated, 'checkout', '--quiet', '--detach', f.aHead);
  assert.throws(() => f.verify(f.integrated, { integration, bindings: [measured] }), /integrated worktree moved after verification/);
  git(f.integrated, 'checkout', '--quiet', '--detach', f.integratedHead);
  assert.equal(f.verify(f.integrated).length, 1);
  const replay = f.checkout('content-replay', f.base);
  for (const name of ['shared', 'a', 'b']) put(path.join(replay, `src/modules/${name}/contract.json`), readFileSync(path.join(f.integrated, `src/modules/${name}/contract.json`), 'utf8'));
  const replayHead = commit(replay, 'Copy identical source content without producer or consumer history');
  assert.equal(git(replay, 'rev-parse', `${replayHead}^{tree}`), git(f.integrated, 'rev-parse', `${f.integratedHead}^{tree}`), 'the source content is byte-equivalent');
  assert.equal(f.run(replay, 'a', 'b').status, 0, 'actual commands can pass even when contribution provenance is absent');
  assert.throws(() => f.verify(replay), /every producer and consumer contribution/);
});

test('a backend-only shared extraction does not add the consumer frontend head to its incorporation tuple', t => {
  const f = fixture(t);
  const frontend = path.join(f.home, 'frontend'); mkdirSync(frontend); git(frontend, 'init', '-q');
  put(path.join(frontend, 'README.md'), 'An independently verified frontend boundary.\n');
  const frontendHead = commit(frontend, 'Frontend fixture boundary');
  const report = { sessionId: 'consumer-a', heads: [{ alias: '@workspaces/be', head: f.aHead }, { alias: '@workspaces/fe', head: frontendHead }] };
  const incorporation = { bindings: [f.binding(f.a), { alias: '@workspaces/fe', revision: frontendHead, worktree: null, repositoryHash: null }] };
  assert.deepEqual(affectedConsumerHeads(report, incorporation), [report.heads[0]]);
  assert.deepEqual(report.heads.map(item => item.alias), ['@workspaces/be', '@workspaces/fe'], 'the peer report still preserves both terminal boundaries');
  assert.throws(() => affectedConsumerHeads(report, { bindings: [{ alias: '@workspaces/fe', revision: frontendHead, worktree: null }] }), /no verified affected repository boundary/);
  const both = { bindings: [...incorporation.bindings.filter(item => item.worktree), f.binding(frontend, '@workspaces/fe')] };
  assert.deepEqual(affectedConsumerHeads(report, both), report.heads, 'a real frontend incorporation still owes its frontend boundary');
});
