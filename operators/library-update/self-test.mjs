// Proves validate.mjs: the package plan against its manifest and every plan mutation the former
// library operator refused; the consumer plan against the root manifest; the consumer metadata delta
// (a workspace consumer whose pin moves, whose link entry stays, whose nested install carries the
// packed release) and every lock mutation the former dependency operator refused; the install
// invocation shape; and, on a real Git repository with a session worktree, the context binding, the
// worktree boundaries, the package proof set with its mutations, and the consumer proof binding
// against the package commit. No npm, tar or network runs here.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateAgainst } from '../../scripts/json-schema.mjs';
import { ROOT, schema, planErrors, consumerPlanErrors, metadataErrors, safeRelative, safePath, nextPatch, hash, integrityOf, git, loadContext, worktreeErrors, proofErrors, consumerProofErrors, resolveCommand, consumerCommand, snapshots, consumerSnapshots, regressionFailed, proofEnvironment, consumerPhase, releaseRef, releaseFileName, baseWorkingBytes, modeSectionErrors, bindRelease, consumerPhases, auditProofErrors, isAuditRegression, publicationErrors, publishStopErrors, publishRequested, publishFieldErrors, PUBLISH_STOP, validateLibraryUpdateStep } from './validate.mjs';
import { installInvocation } from './install.mjs';
import { sourceWriteErrors } from '../../scripts/workspace-checkout.mjs';

const manifest = { name: '@example/library', version: '1.2.3', exports: './index.js', scripts: { test: 'node index.spec.js', build: 'node --check index.js', typecheck: 'node --check index.js' } };
const rootManifest = { name: 'consumer-root', private: true, workspaces: ['package', 'apps/app'], scripts: { test: 'node apps/app/index.spec.js', build: 'node --check apps/app/index.js' } };
const command = (name) => ({ kind: 'npm-script', name, args: [] });
const plan = {
  packageRoot: 'package', packageName: '@example/library', baseVersion: '1.2.3', targetVersion: '1.2.4',
  files: [{ path: 'package/index.js', kind: 'behavior' }, { path: 'package/index.spec.js', kind: 'test' }, { path: 'package/package.json', kind: 'manifest' }],
  pairs: [{ source: 'package/index.js', test: 'package/index.spec.js' }],
  regression: { command: command('test'), assertion: 'keeps the declared panel relationship' },
  publicDelta: [],
  consumerImpact: [{ consumer: 'apps/app', effect: 'uses the repaired relationship', compatibility: 'existing call remains source compatible' }],
  gates: ['test', 'build', 'typecheck'].map((id) => ({ id, command: command(id) })),
};
const consumer = {
  manifests: ['apps/app/package.json'], lockfile: 'package-lock.json',
  regression: { file: 'apps/app/index.spec.js', assertion: 'renders the panel relationship', command: command('test') },
  gates: ['test', 'build'].map((id) => ({ id, command: command(id) })),
};
assert.deepEqual(validateAgainst(schema(ROOT, 'library-behavior-plan'), plan), []);
assert.deepEqual(validateAgainst(schema(ROOT, 'dependency-plan'), consumer), []);
assert.deepEqual(planErrors(plan, manifest), []);
assert.equal(nextPatch('0.4.8'), '0.4.9');
for (const invalid of ['../outside.js', '/outside', 'C:/outside', 'a\\b', 'a/../b', 'a//b', './a']) assert.equal(safeRelative(invalid), false);
for (const mutate of [
  (p) => { p.targetVersion = '2.0.0'; },
  (p) => { p.packageName = '@example/other'; },
  (p) => { p.files[0].path = 'package/styles.css'; },
  (p) => { p.files[0].kind = 'test'; },
  (p) => { p.pairs[0].source = 'consumer/index.js'; },
  (p) => { p.files.push(p.files[0]); },
  (p) => { p.gates = p.gates.filter((g) => g.id !== 'build'); },
  (p) => { p.gates[0].command.args = ['--skip']; },
  (p) => { p.files.push({ path: 'package/README.md', kind: 'docs' }); },
]) { const changed = structuredClone(plan); mutate(changed); assert.ok(planErrors(changed, manifest).length); }
assert.ok(planErrors(plan, { ...manifest, private: true }).length);
assert.equal(regressionFailed('not ok 1 - keeps the declared panel relationship', plan.regression.assertion), true);
assert.equal(regressionFailed('ok 1 - keeps the declared panel relationship\nnot ok unrelated', plan.regression.assertion), false);

// The consumer plan against the root manifest and the consumer manifests at the base.
const consumerManifest = { name: 'app', private: true, dependencies: { '@example/library': '1.2.3', other: '2.0.0' } };
const lookups = { manifestAt: () => consumerManifest, lockAt: () => ({ lockfileVersion: 3, packages: {} }), exists: () => true };
assert.deepEqual(consumerPlanErrors(consumer, plan, rootManifest, lookups), []);
for (const [mutate, needle] of [
  [(c) => { c.regression.file = 'package-lock.json'; }, 'regression must be an existing unchanged source test'],
  [(c) => { c.gates = c.gates.filter((g) => g.id !== 'build'); }, 'missing complete delivery gate: build'],
  [(c) => { c.gates[0].command.args = ['--filter']; }, 'must use a complete existing root script'],
  [(c) => { c.manifests = ['apps/app/manifest.json']; }, 'consumer manifest must be package.json'],
]) { const changed = structuredClone(consumer); mutate(changed); assert.ok(consumerPlanErrors(changed, plan, rootManifest, lookups).some((e) => e.includes(needle)), needle); }
assert.ok(consumerPlanErrors(consumer, plan, rootManifest, { ...lookups, manifestAt: () => ({ ...consumerManifest, dependencies: { '@example/library': '1.0.0' } }) }).some((e) => e.includes('does not pin')), 'a consumer that pins another version');

// The consumer metadata delta of a workspace consumer: the pin moves, the link entry stays, the nested
// install carries the packed release, and the package's own workspace entry moved in the package commit.
const release = { version: '1.2.4', integrity: 'sha512-example' };
const delta = { packageName: '@example/library', fromVersion: '1.2.3', toVersion: '1.2.4', manifests: ['apps/app/package.json'], release };
const oldManifest = { name: 'app', private: true, scripts: { test: 'test' }, dependencies: { '@example/library': '1.2.3', other: '2.0.0' } };
const newManifest = { ...structuredClone(oldManifest), dependencies: { ...oldManifest.dependencies, '@example/library': '1.2.4' } };
const oldLock = { lockfileVersion: 3, packages: { '': { name: 'consumer-root' }, package: { name: '@example/library', version: '1.2.4' }, 'apps/app': { dependencies: { '@example/library': '1.2.3' } }, 'apps/other': { dependencies: { '@example/library': '1.2.3' } }, 'node_modules/@example/library': { resolved: 'package', link: true }, 'apps/app/node_modules/@example/library': { version: '1.2.3', resolved: 'https://registry.npmjs.org/old.tgz', integrity: 'sha512-old', peerDependencies: { react: '19' } }, 'node_modules/other': { version: '2.0.0' } } };
const newLock = structuredClone(oldLock); newLock.packages['apps/app'].dependencies['@example/library'] = '1.2.4'; newLock.packages['apps/app/node_modules/@example/library'] = { ...oldLock.packages['apps/app/node_modules/@example/library'], version: '1.2.4', resolved: 'file:../../response/artifacts/release/example-library-1.2.4.tgz', integrity: release.integrity };
const check = (m = newManifest, l = newLock) => metadataErrors(delta, { 'apps/app/package.json': oldManifest }, { 'apps/app/package.json': m }, oldLock, l);
assert.deepEqual(check(), []);
for (const mutate of [
  (m) => { m.scripts.test = 'skip'; }, (m) => { m.dependencies.other = '3.0.0'; }, (m) => { m.version = '9'; },
  (m, l) => { l.packages['node_modules/other'].version = '3.0.0'; }, (m, l) => { l.lockfileVersion = 2; },
  (m, l) => { l.packages['apps/app/node_modules/@example/library'].integrity = 'sha512-wrong'; },
  (m, l) => { l.packages['apps/app/node_modules/@example/library'].peerDependencies.react = '20'; },
  (m, l) => { delete l.packages['node_modules/@example/library']; },
  (m, l) => { l.packages['node_modules/@example/library'] = { resolved: 'elsewhere', link: true }; },
  (m, l) => { l.packages['apps/other'].dependencies['@example/library'] = '1.2.4'; },
  (m, l) => { delete l.packages['apps/app/node_modules/@example/library']; l.packages.package.version = '1.2.3'; },
]) { const m = structuredClone(newManifest), l = structuredClone(newLock); mutate(m, l); assert.ok(check(m, l).length, 'a metadata mutation is refused'); }
process.stdout.write('library.update self-test: plan, consumer plan, exact manifest, lock identity and dependency closure mutations passed\n');

// Which receipt sections each mode may carry: the halves it ran and no others.
const packageSections = { 'library-source-application': 'response/data/library.json', 'library-proof': ['response/data/proofs/before.json'], 'library-release': 'response/data/release.json', 'library-archive': `response/artifacts/release/${releaseFileName(plan)}` };
const consumerSections = { 'dependency-update': 'response/data/dependency.json', 'dependency-proof': ['response/data/proofs/consumer-before.json'], 'dependency-log': ['response/artifacts/proofs/consumer-before.log'] };
assert.deepEqual(modeSectionErrors('full', { ...packageSections, ...consumerSections }), []);
assert.deepEqual(modeSectionErrors('publish', packageSections), []);
assert.deepEqual(modeSectionErrors('consume', consumerSections), []);
assert.ok(modeSectionErrors('publish', { ...packageSections, ...consumerSections }).some((e) => e.includes('dependency-update')), 'a consumer section under publish');
assert.ok(modeSectionErrors('consume', { ...packageSections, ...consumerSections }).some((e) => e.includes('library-source-application')), 'a package section under consume');
assert.ok(modeSectionErrors('publish', {}).some((e) => e.includes('library-release')), 'publish must record its release');
assert.ok(modeSectionErrors('consume', {}).some((e) => e.includes('dependency-update')), 'consume must record its metadata commit');
assert.ok(modeSectionErrors('full', packageSections).some((e) => e.includes('dependency-proof')), 'full runs both halves');

// The publication under mode publish: the record is judged against the archive this branch packed and
// the proofs it stands on, and pending is lawful only where the request asked for no publication.
const packed = { version: plan.targetVersion, integrity: 'sha512-packed' };
const greenProofs = { before: { exitCode: 1 }, after: { exitCode: 0 }, test: { exitCode: 0 }, build: { exitCode: 0 }, typecheck: { exitCode: 0 } };
const publicationRecord = (over = {}) => ({ publication: { registry: 'https://registry.example.invalid/', version: packed.version, state: 'published', integrity: packed.integrity, at: '2026-09-05T10:00:00Z', ...over } });
const releaseRecordOf = (publication) => ({ name: plan.packageName, version: plan.targetVersion, digest: integrityOf('a synthetic packed archive'), artifact: releaseRef(plan), packageCommit: 'b'.repeat(40), publication });
const publishing = { mode: 'publish', publish: true, ...packed };
assert.deepEqual(publicationErrors(publishing, publicationRecord(), greenProofs), [], 'a lawful publication');
assert.deepEqual(publicationErrors({ ...publishing, publish: false }, releaseRecordOf({ registry: null, state: 'pending' }), greenProofs), [], 'publish false leaves the archive packed');
assert.deepEqual(publicationErrors({ mode: 'full', publish: true, ...packed }, releaseRecordOf({ registry: null, state: 'pending' }), greenProofs), [], 'a run inside one checkout publishes nothing');
for (const [record, proofs, needle] of [
  [publicationRecord({ integrity: 'sha512-other' }), greenProofs, 'published integrity'],
  [publicationRecord({ version: '9.9.9' }), greenProofs, 'published version'],
  [publicationRecord({ registry: null }), greenProofs, 'names the registry'],
  [publicationRecord(), { ...greenProofs, build: { exitCode: 1 } }, 'proofs are red'],
  [releaseRecordOf({ registry: null, state: 'pending' }), greenProofs, 'ends at a published release'],
]) assert.ok(publicationErrors(publishing, record, proofs).some((e) => e.includes(needle)), needle);
assert.ok(publicationErrors({ mode: 'consume', publish: true, ...packed }, publicationRecord(), greenProofs).some((e) => e.includes('no archive to a registry')), 'a consumer branch claims no publication');
// The record contract behind those gates: published carries its registry, version, integrity and moment.
assert.deepEqual(validateAgainst(schema(ROOT, 'library-release'), releaseRecordOf(publicationRecord().publication)), []);
assert.deepEqual(validateAgainst(schema(ROOT, 'library-release'), releaseRecordOf({ registry: null, state: 'pending' })), []);
for (const publication of [
  { registry: 'https://registry.example.invalid/', version: packed.version, state: 'published' },
  { registry: null, version: packed.version, state: 'published', integrity: packed.integrity, at: '2026-09-05T10:00:00Z' },
  { registry: 'https://registry.example.invalid/', version: packed.version, state: 'published', integrity: packed.integrity },
  { registry: null, state: 'held' },
]) assert.ok(validateAgainst(schema(ROOT, 'library-release'), releaseRecordOf(publication)).length, 'an incomplete publication record is refused');
// The requirement, and the stop that carries the registry's own answer.
assert.equal(publishRequested({ requirements: {} }), true);
assert.equal(publishRequested({ requirements: { publish: 'false' } }), false);
assert.deepEqual(publishFieldErrors({ requirements: { publish: false } }), []);
assert.ok(publishFieldErrors({ requirements: { publish: 'later' } }).length);
const stopped = (over = {}) => ({ status: 'blocked', stop: PUBLISH_STOP, ...over });
assert.ok(publishStopErrors(stopped()).length, 'a publish stop with no reason');
assert.deepEqual(publishStopErrors(stopped({ reason: 'the registry answered 403: you do not have permission to publish this version' })), []);
assert.ok(publishStopErrors(stopped({ reason: 'npm ERR! with token password: hunter2secret' })).some((e) => e.includes('credential-shaped')), 'the answer travels, the credential does not');
assert.deepEqual(publishStopErrors({ status: 'blocked', stop: 'LIBRARY_PROOF_FAILED' }), []);
process.stdout.write('library.update self-test: the publication record, the publish requirement and the publish stop passed\n');

// The install invocation: fixed argv, the consumer root as cwd, the packed release as the spec.
const fakeCtx = { mode: 'full', checkout: 'D:/bound/session-consumer', branch: 'D:/bound/session/step-3/parallel-1', base: 'a'.repeat(40), packageCommit: 'b'.repeat(40), rootManifest, consumer, plan, artifact: `D:/bound/session/step-3/parallel-1/${releaseRef(plan)}`, release: { ...release, artifact: releaseRef(plan) } };
assert.deepEqual(proofEnvironment(fakeCtx, { kind: 'npm-script', name: 'test:ci' }), { COVERAGE_BASE_SHA: fakeCtx.packageCommit });
assert.deepEqual(proofEnvironment(fakeCtx, { kind: 'npm-script', name: 'test' }), {});
const baseline = installInvocation(fakeCtx, 'baseline'), releaseInstall = installInvocation(fakeCtx, 'release');
assert.equal(baseline.cwd, fakeCtx.checkout); assert.equal(releaseInstall.cwd, fakeCtx.checkout);
assert.deepEqual(baseline.args.slice(1), ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
assert.deepEqual(releaseInstall.args.slice(1), ['install', 'D:/bound/session/step-3/parallel-1/response/artifacts/release/example-library-1.2.4.tgz', '--save-exact', '--workspace', 'apps/app', '--ignore-scripts', '--no-audit', '--no-fund']);
assert.throws(() => installInvocation(fakeCtx, 'D:/unbound/source'), /phase/);
process.stdout.write('library.update self-test: install cwd/argv and coverage base binding passed\n');

// A real repository: the owner package and its consumer in one checkout, a session worktree, and the
// context, worktree and proof laws over them.
const temp = mkdtempSync(path.join(tmpdir(), 'library-update-'));
try {
  const repo = path.join(temp, 'repo'); mkdirSync(path.join(repo, 'package'), { recursive: true }); mkdirSync(path.join(repo, 'apps/app'), { recursive: true });
  const write = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
  write(path.join(repo, 'package.json'), rootManifest);
  write(path.join(repo, 'package/package.json'), manifest);
  write(path.join(repo, 'package/index.js'), 'export const relationship = 0;\n');
  write(path.join(repo, 'package/index.spec.js'), 'console.log("base test");\n');
  write(path.join(repo, 'apps/app/package.json'), consumerManifest);
  write(path.join(repo, 'apps/app/index.js'), 'export const app = 1;\n');
  write(path.join(repo, 'apps/app/index.spec.js'), 'console.log("consumer regression");\n');
  write(path.join(repo, 'package-lock.json'), { lockfileVersion: 3, packages: { '': { name: 'consumer-root' }, package: { name: '@example/library', version: '1.2.3' }, 'apps/app': { dependencies: { '@example/library': '1.2.3' } }, 'node_modules/@example/library': { resolved: 'package', link: true } } });
  git(repo, ['init', '--quiet']); git(repo, ['config', 'user.email', 'test@example.invalid']); git(repo, ['config', 'user.name', 'Operator test']);
  git(repo, ['add', '.']); git(repo, ['commit', '--quiet', '-m', 'base']);
  const base = git(repo, ['rev-parse', 'HEAD']);
  const checkout = path.join(temp, 'worktree'); git(repo, ['worktree', 'add', '--quiet', '-b', 'session/library-test', checkout]);
  const session = path.join(temp, 'session');
  const branch = path.join(session, 'step-2/parallel-1');
  const routeRef = 'step-1/parallel-1/response/data/route.json';
  const route = {
    project: 'example', role: 'fe', portableRouteRef: 'portable.json', hydratedRouteRef: 'local.json', routeFingerprint: hash('route'), identityFingerprint: hash('identity'), sourceHead: base,
    checkout: { diskPath: repo, gitRoot: repo, gitRepository: 'https://example.invalid/library.git', branch: git(repo, ['branch', '--show-current']), repositoryKind: 'source', directory: null, sourceHead: base },
    gitPolicy: { worktreeBranches: 'session-only', mutationBranch: 'main' }, mutationReadiness: 'ready', writeRoots: ['package', 'apps/app', 'package-lock.json'], authorityRoots: { businesses: null }, runtime: null, provenanceHeadRef: null,
  };
  const request = { schemaVersion: 9, operatorId: 'library.update', step: 2, parallel: 1, sessionId: 'library-test', contexts: [{ alias: '@workspaces/fe', head: base }, { alias: '@knowledge/grammars/starci', head: null }], requirements: { plan, consumer, resume: null }, inputs: { route: routeRef }, resume: null };
  const state = { id: 'library-test', project: 'example', startedAt: '2026-09-04', status: 'running', chain: [['1/1'], ['2/1']], steps: { '1/1': 'workspace.bind', '2/1': 'library.update' }, requestHashes: {} };
  write(path.join(session, 'state.json'), state); write(path.join(session, routeRef), route); write(path.join(branch, 'request/request.json'), request);
  const ctx = await loadContext(branch);
  assert.equal(path.resolve(ctx.checkout), path.resolve(checkout));
  assert.deepEqual(worktreeErrors(ctx, { phase: 'pristine' }), []);
  write(path.join(checkout, 'consumer.js'), 'unauthorized');
  assert.ok(worktreeErrors(ctx).some((e) => e.includes('consumer.js'))); rmSync(path.join(checkout, 'consumer.js'));
  write(path.join(checkout, 'package/index.spec.js'), 'console.log("new regression");\n');
  assert.ok(worktreeErrors(ctx, { phase: 'pristine' }).length);
  assert.deepEqual(worktreeErrors(ctx), []);
  const badPlan = structuredClone(plan); badPlan.files[0].path = 'consumer.js'; badPlan.pairs[0].source = 'consumer.js';
  write(path.join(branch, 'request/request.json'), { ...request, requirements: { ...request.requirements, plan: badPlan } });
  await assert.rejects(loadContext(branch), /outside package|outside bound write roots/);
  const badConsumer = structuredClone(consumer); badConsumer.manifests = ['package/package.json'];
  write(path.join(branch, 'request/request.json'), { ...request, requirements: { ...request.requirements, consumer: badConsumer } });
  await assert.rejects(loadContext(branch), /also a package file|does not pin/);
  write(path.join(branch, 'request/request.json'), request);
  const badRoute = { ...route, writeRoots: ['package'] }; write(path.join(session, routeRef), badRoute);
  await assert.rejects(loadContext(branch), /lacks route write authority/); write(path.join(session, routeRef), route);
  const link = path.join(checkout, 'package/link');
  try { symlinkSync(temp, link, process.platform === 'win32' ? 'junction' : 'dir'); assert.throws(() => safePath(checkout, 'package/link/escape.js'), /symlink|escaped/); }
  finally { unlinkSync(link); }

  // The package proof set over the repaired tree, and every mutation that made it a lie.
  const beforeFiles = snapshots(ctx);
  write(path.join(checkout, 'package/index.js'), 'export const relationship = 1;\n');
  write(path.join(checkout, 'package/package.json'), { ...manifest, version: plan.targetVersion });
  const finalHashes = snapshots(ctx);
  const proofs = {};
  for (const phase of ['before', 'after', ...plan.gates.map((g) => g.id)]) {
    const cmd = ['before', 'after'].includes(phase) ? plan.regression.command : plan.gates.find((g) => g.id === phase).command;
    const output = phase === 'before' ? `not ok 1 - ${plan.regression.assertion}` : 'all checks passed';
    const outputRef = `response/artifacts/proofs/${phase}.log`;
    write(path.join(branch, outputRef), output);
    proofs[phase] = { phase, planHash: ctx.planHash, base, head: base, command: cmd, commandHash: resolveCommand(ctx, cmd).commandHash, files: phase === 'before' ? beforeFiles : finalHashes, exitCode: phase === 'before' ? 1 : 0, outputRef, outputHash: hash(output), startedAt: '2026-09-04T00:00:00Z', finishedAt: '2026-09-04T00:00:00Z' };
  }
  assert.deepEqual(proofErrors(ctx, proofs, finalHashes), []);
  for (const mutate of [
    (p) => { delete p.build; },
    (p) => { p.before.exitCode = 0; },
    (p) => { p.before.outputRef = 'response/artifacts/proofs/absent.log'; },
    (p) => { p.after.exitCode = 1; },
    (p) => { p.after.files['package/index.js'] = hash('stale'); },
    (p) => { p.before.files['package/index.spec.js'] = hash('old test'); },
    (p) => { p.test.outputHash = hash('modified log'); },
    (p) => { p.test.commandHash = hash('invented command'); },
    (p) => { p.build.head = 'f'.repeat(40); },
  ]) { const changed = structuredClone(proofs); mutate(changed); assert.ok(proofErrors(ctx, changed, finalHashes).length); }

  // The consumer proof binding against the package commit: the unchanged regression, the metadata
  // hashes at that commit, the installed identity and the outcome per phase.
  ctx.packageCommit = base; ctx.release = { version: plan.targetVersion, integrity: 'sha512-packed', artifact: releaseRef(plan) };
  const metadataAtBase = Object.fromEntries(['apps/app/package.json', 'package-lock.json'].map((f) => [f, hash(baseWorkingBytes(checkout, base, f))]));
  const consumerProof = (phase, over = {}) => {
    const bare = phase.replace(/^consumer-/, '');
    const cmd = ['before', 'after'].includes(bare) ? consumer.regression.command : consumer.gates.find((g) => g.id === bare).command;
    const output = bare === 'before' ? `not ok 1 - ${consumer.regression.assertion}` : 'all checks passed';
    const outputRef = `response/artifacts/proofs/${phase}.log`;
    write(path.join(branch, outputRef), output);
    return { phase, base, planHash: ctx.consumerPlanHash, command: cmd, commandHash: consumerCommand(ctx, cmd).commandHash, environment: {}, files: metadataAtBase, regressionHash: hash(baseWorkingBytes(checkout, base, consumer.regression.file)), installed: { 'apps/app/package.json': { name: plan.packageName, version: bare === 'before' ? plan.baseVersion : plan.targetVersion, integrity: bare === 'before' ? null : 'sha512-packed' } }, exitCode: bare === 'before' ? 1 : 0, outputRef, outputHash: hash(output), startedAt: '2026-09-04T00:00:00Z', finishedAt: '2026-09-04T00:00:01Z', ...over };
  };
  assert.deepEqual(consumerProofErrors(ctx, consumerProof(consumerPhase('before')), consumerPhase('before'), metadataAtBase), []);
  assert.deepEqual(consumerProofErrors(ctx, consumerProof(consumerPhase('after')), consumerPhase('after'), metadataAtBase), []);
  assert.deepEqual(consumerProofErrors(ctx, consumerProof(consumerPhase('build')), consumerPhase('build'), metadataAtBase), []);
  for (const [phase, over, needle] of [
    [consumerPhase('before'), { exitCode: 0 }, 'required regression/gate outcome not proved'],
    [consumerPhase('after'), { regressionHash: hash('edited test') }, 'did not use the unchanged regression'],
    [consumerPhase('after'), { installed: { 'apps/app/package.json': { name: plan.packageName, version: plan.baseVersion, integrity: 'sha512-packed' } } }, 'installed package mismatch'],
    [consumerPhase('after'), { outputHash: hash('other log') }, 'proof output missing or changed'],
    [consumerPhase('build'), { base: 'c'.repeat(40) }, 'proof binding differs'],
    [consumerPhase('after'), { files: { ...metadataAtBase, 'package-lock.json': hash('moved') } }, 'stale dependency metadata proof'],
  ]) assert.ok(consumerProofErrors(ctx, consumerProof(phase, over), phase, metadataAtBase).some((e) => e.includes(needle)), needle);
  assert.equal(Object.keys(consumerSnapshots(ctx)).length, 2);

  // The three modes over the same routed checkout. `full` is the default this fixture has been running
  // under; `publish` binds the package half alone, `consume` the consumer half alone against a release
  // an earlier branch produced, and each refuses the other half's plan and the other half's input.
  const requestWith = (requirements, inputs = {}) => ({ ...request, requirements: { ...request.requirements, ...requirements }, inputs: { ...request.inputs, ...inputs } });
  const writeRequest = (value) => write(path.join(branch, 'request/request.json'), value);

  writeRequest(requestWith({ mode: 'publish', consumer: null }));
  const publishCtx = await loadContext(branch);
  assert.equal(publishCtx.mode, 'publish');
  assert.equal(publishCtx.consumer, null);
  assert.equal(publishCtx.consumerPlanHash, null);
  assert.equal(path.resolve(publishCtx.packageDir), path.resolve(path.join(checkout, 'package')));
  assert.deepEqual(worktreeErrors(publishCtx), []);
  writeRequest(requestWith({ mode: 'publish' }));
  await assert.rejects(loadContext(branch), /carries no consumer plan/);

  // The release of a synthetic earlier branch: the record, the archive beside it, and the digest that
  // binds the two. Nothing here unpacks the archive, so no tar runs.
  const archiveText = 'a synthetic packed archive';
  const releaseSlot = 'step-1/parallel-2';
  const archiveRef = `response/artifacts/release/${releaseFileName(plan)}`;
  write(path.join(session, releaseSlot, archiveRef), archiveText);
  const releaseRecord = { name: plan.packageName, version: plan.targetVersion, digest: integrityOf(archiveText), artifact: archiveRef, packageCommit: 'b'.repeat(40), publication: { registry: null, state: 'pending' } };
  const releaseInputRef = `${releaseSlot}/response/data/release.json`;
  write(path.join(session, releaseInputRef), releaseRecord);

  writeRequest(requestWith({ mode: 'consume', plan: null }, { 'library-release': releaseInputRef }));
  const consumeCtx = await loadContext(branch);
  assert.equal(consumeCtx.mode, 'consume');
  assert.equal(consumeCtx.packageDir, null);
  assert.equal(consumeCtx.planHash, null);
  assert.deepEqual(consumeCtx.plan, { packageName: plan.packageName, baseVersion: plan.baseVersion, targetVersion: plan.targetVersion, family: null });
  bindRelease(consumeCtx);
  assert.equal(consumeCtx.packageCommit, base);
  assert.equal(consumeCtx.release.integrity, releaseRecord.digest);
  assert.equal(consumeCtx.release.artifact, archiveRef);
  assert.equal(path.resolve(consumeCtx.artifact), path.resolve(path.join(session, releaseSlot, archiveRef)));
  writeRequest(requestWith({ mode: 'consume' }, { 'library-release': releaseInputRef }));
  await assert.rejects(loadContext(branch), /carries no plan/);
  writeRequest(requestWith({ mode: 'consume', plan: null }));
  await assert.rejects(loadContext(branch), /binds a library-release input/);
  writeRequest(requestWith({ mode: 'publish', consumer: null }, { 'library-release': releaseInputRef }));
  await assert.rejects(loadContext(branch), /binds no library-release input/);
  // The release a consume branch binds may already be published — the ordinary path now that a publish
  // branch ends at the registry — or still pending, which is the rare one, because a pending archive
  // lives only inside the session that packed it.
  const publishedRelease = { ...releaseRecord, publication: { registry: 'https://registry.example.invalid/', version: plan.targetVersion, state: 'published', integrity: releaseRecord.digest, at: '2026-09-05T10:00:00Z' } };
  write(path.join(session, releaseInputRef), publishedRelease);
  writeRequest(requestWith({ mode: 'consume', plan: null }, { 'library-release': releaseInputRef }));
  const publishedConsumeCtx = bindRelease(await loadContext(branch));
  assert.equal(publishedConsumeCtx.releaseInput.record.publication.state, 'published');
  assert.equal(publishedConsumeCtx.release.integrity, releaseRecord.digest);
  write(path.join(session, releaseInputRef), releaseRecord);
  const wrongDigest = { ...releaseRecord, digest: integrityOf('other bytes') };
  write(path.join(session, releaseInputRef), wrongDigest);
  writeRequest(requestWith({ mode: 'consume', plan: null }, { 'library-release': releaseInputRef }));
  await assert.rejects(loadContext(branch), /digest does not match the archive/);
  write(path.join(session, releaseInputRef), releaseRecord);
  writeRequest(request);

  // D7: a branch blocked because its plan names a package the routed checkout does not carry is judged
  // on its stop. The context cannot load — that is why it blocked — and the branch is still lawful.
  const blockedBranch = path.join(session, 'step-3/parallel-1');
  const unresolvable = { ...structuredClone(plan), packageRoot: 'packages/grammar' };
  write(path.join(blockedBranch, 'request/request.json'), { ...request, step: 3, requirements: { ...request.requirements, plan: unresolvable } });
  write(path.join(blockedBranch, 'response/response.json'), { schemaVersion: 9, operatorId: 'library.update', step: 3, parallel: 1, status: 'blocked', stop: 'LIBRARY_BOUNDARY_REJECTED', reason: 'the plan names an owner package this routed checkout does not carry', fields: {}, fallbacks: [], commits: [], next: [] });
  await assert.rejects(loadContext(blockedBranch), /missing path: packages\/grammar/);
  assert.deepEqual((await validateLibraryUpdateStep(blockedBranch)).errors, []);

  // A publication the registry refused is a lawful blocked receipt — and it is only lawful while it
  // carries what the registry answered, because that text is what the next attempt is decided from.
  const publishStopBranch = path.join(session, 'step-4/parallel-1');
  write(path.join(publishStopBranch, 'request/request.json'), { ...request, step: 4, requirements: { ...request.requirements, mode: 'publish', consumer: null } });
  const refusedPublication = (over = {}) => ({ schemaVersion: 9, operatorId: 'library.update', step: 4, parallel: 1, status: 'blocked', stop: PUBLISH_STOP, fields: {}, fallbacks: [], commits: [], next: [], ...over });
  write(path.join(publishStopBranch, 'response/response.json'), refusedPublication());
  assert.ok((await validateLibraryUpdateStep(publishStopBranch)).errors.some((e) => e.includes(PUBLISH_STOP)), 'a refused publication that reports no registry answer');
  write(path.join(publishStopBranch, 'response/response.json'), refusedPublication({ reason: 'the registry answered 409: @example/library@1.2.4 cannot be republished' }));
  assert.deepEqual((await validateLibraryUpdateStep(publishStopBranch)).errors, []);

  // The receipt's account of what the branch did to the checkout, beside what it wrote into it: the
  // preflight before the first write, and the entries the checkout gained while the branch held it —
  // its own commits and nothing else. Its own worktree, so the marks are read against a reflog only
  // this block wrote.
  {
    const marked = path.join(temp, 'marked-worktree');
    git(repo, ['worktree', 'add', '--quiet', '-b', 'session/marks', marked]);
    const markBase = git(marked, ['rev-parse', 'HEAD']);
    write(path.join(marked, 'package/index.js'), 'export const relationship = 2;\n');
    git(marked, ['add', 'package/index.js']); git(marked, ['commit', '--quiet', '-m', 'the branch own commit']);
    const markCommit = git(marked, ['rev-parse', 'HEAD']);
    const entries = () => git(marked, ['reflog', 'show', '--format=%H', 'HEAD']).split('\n').filter(Boolean).length;
    const preflight = new Date(Date.parse(git(marked, ['show', '-s', '--format=%cI', markCommit])) - 60000).toISOString().replace(/\.\d+Z$/, 'Z');
    const gained = entries();
    const marks = (over = {}) => ({ Preflight: `passed at ${preflight}`, 'Reflog before': `HEAD ${gained - 1} ${markBase}; stash 0`, 'Reflog after': `HEAD ${gained} ${markCommit}; stash 0`, ...over });
    const law = (over = {}) => sourceWriteErrors({ at: 'response/changes.md', binding: marks(over), base: markBase, branch: 'session/marks', commits: [markCommit], checkout: marked });
    assert.deepEqual(law(), [], 'one commit on the session branch, with a preflight before it');
    assert.ok(law({ Preflight: '—' }).some((e) => e.includes('records no Preflight')));
    assert.ok(law({ Preflight: `passed at ${new Date(Date.parse(preflight) + 600000).toISOString().replace(/\.\d+Z$/, 'Z')}` }).some((e) => e.includes('before the preflight this receipt records')));
    assert.ok(law({ 'Reflog after': `HEAD ${gained + 1} ${markCommit}; stash 0` }).some((e) => e.includes('gained 2 entries')));
    assert.ok(law({ 'Reflog after': `HEAD ${gained} ${markCommit}; stash 1` }).some((e) => e.includes('stash reflog went from 0 to 1')));

    // A stash inside the routed checkout, dropped afterwards, and the commit that followed it.
    write(path.join(marked, 'package/index.js'), 'export const relationship = 3;\n');
    git(marked, ['stash', 'push', '--quiet', '-m', 'wip']);
    git(marked, ['stash', 'drop', '--quiet']);
    write(path.join(marked, 'package/index.js'), 'export const relationship = 4;\n');
    git(marked, ['add', 'package/index.js']); git(marked, ['commit', '--quiet', '-m', 'the commit after the stash']);
    const second = git(marked, ['rev-parse', 'HEAD']);
    const stashed = sourceWriteErrors({ at: 'response/changes.md', binding: marks({ 'Reflog after': `HEAD ${entries()} ${second}; stash 0` }), base: markBase, branch: 'session/marks', commits: [markCommit, second], checkout: marked }).join('\n');
    assert.match(stashed, /reset: moving to HEAD/);
    assert.match(stashed, /forbidden inside a routed checkout/);
    git(repo, ['worktree', 'remove', '--force', marked]);
  }

  git(checkout, ['checkout', '-q', '-b', 'other-session']);
  await assert.rejects(loadContext(branch), /exactly one worktree/);
} finally {
  const resolved = path.resolve(temp);
  assert.ok(path.dirname(resolved) === path.resolve(tmpdir()) && path.basename(resolved).startsWith('library-update-'));
  rmSync(resolved, { recursive: true, force: true });
}
process.stdout.write('library.update self-test: package boundary, session binding, package and consumer proof mutations passed\n');
process.stdout.write('library.update self-test: publish and consume bind one half each, cross-mode sections and inputs are refused, a published release is consumed like a pending one, a refused publication validates only with the registry\'s answer, and a blocked branch whose plan cannot resolve validates\n');

// ---------------------------------------------------------------------------------------------------
// A presentation release consumed with no consumer spec of its own. The shape is the one a real session
// met: a `consume` branch at step 3, parallel 2, of a family release the consumer composes and calls
// nowhere, with the before half an audit of the served head at the installed version and the after half
// an audit of the head this branch bumped. The consumer plan carries no regression file, and the two
// halves are branch refs the validator resolves inside the session.
{
  const family = 'core';
  const CLAIMS = ['OVERFLOW-3', 'PADDING-4'];
  const auditConsumer = { manifests: ['apps/app/package.json'], lockfile: 'package-lock.json', regression: { kind: 'audit', claims: CLAIMS, before: 'step-3/parallel-1', after: 'step-5/parallel-1' }, gates: [{ id: 'build', command: command('build') }, { id: 'test', command: command('test') }] };
  assert.deepEqual(validateAgainst(schema(ROOT, 'dependency-plan'), auditConsumer), [], 'an audit authority is a lawful consumer plan');

  // The plan gate: lawful only for a release that names a family, and only across two branches.
  const presentation = { packageName: '@example/library', baseVersion: '1.2.3', targetVersion: '1.2.4', family };
  const plain = { ...presentation, family: null };
  assert.deepEqual(consumerPlanErrors(auditConsumer, presentation, rootManifest, lookups), []);
  assert.ok(consumerPlanErrors(auditConsumer, plain, rootManifest, lookups).some((e) => e.includes('names no family')), 'an audit authority over a package a consumer can call');
  assert.ok(consumerPlanErrors({ ...auditConsumer, regression: { ...auditConsumer.regression, after: 'step-3/parallel-1' } }, presentation, rootManifest, lookups).some((e) => e.includes('one branch cannot have measured both versions')), 'both halves on one branch');
  // The proof phases: two audits are the before and after, so this branch runs only its gates.
  assert.deepEqual(consumerPhases(auditConsumer), ['consumer-build', 'consumer-test']);
  assert.deepEqual(consumerPhases(consumer), ['consumer-before', 'consumer-after', ...consumer.gates.map((g) => `consumer-${g.id}`)]);

  // The two halves on disk: the verdicts each carries and the served surface each measured.
  const session = mkdtempSync(path.join(tmpdir(), 'library-audit-'));
  const CONSUMER_COMMIT = 'c'.repeat(40);
  const auditBranch = (ref, { version, verdict, routeTo = 'grammar-gap', applied = 'a'.repeat(40), claims = CLAIMS }) => {
    const dir = path.join(session, ...ref.split('/'));
    mkdirSync(path.join(dir, 'response', 'data'), { recursive: true });
    writeFileSync(path.join(dir, 'response', 'data', 'verdicts.json'), JSON.stringify({
      entries: [{ matrixId: 'control-centre', surfaceClass: 'console', results: claims.map((rule) => ({ path: 'SurfaceCard', owner: 'grammar', rule, measured: 'the family shell clips its own overflow', verdict, routeTo })) }],
    }));
    writeFileSync(path.join(dir, 'response', 'response.md'), [
      '# frontend-surface-audit — control-centre', '', '## Served surface', '', '| Field | Value |', '| --- | --- |',
      `| Applied commit | \`${applied}\` |`, '| Served branch | `uat` |', `| Served head | \`${'d'.repeat(40)}\` |`,
      '| Contains applied commit | yes |', '| Browser profile | `session` |',
      `| Family version observed | ${version} |`, `| Family version resolved against | ${version} |`, '',
    ].join('\n'));
    return dir;
  };
  const ctx = { root: ROOT, session, plan: presentation, consumer: auditConsumer, consumerCommit: CONSUMER_COMMIT };
  try {
    auditBranch('step-3/parallel-1', { version: '1.2.3', verdict: 'fail' });
    auditBranch('step-5/parallel-1', { version: '1.2.4', verdict: 'pass', routeTo: 'none', applied: CONSUMER_COMMIT });
    assert.deepEqual(auditProofErrors(ctx), [], 'the claims fail at the installed version and pass at the bumped one');

    // A before half at the wrong version proves nothing about this consume.
    auditBranch('step-3/parallel-1', { version: '1.2.2', verdict: 'fail' });
    assert.ok(auditProofErrors(ctx).some((e) => e.includes('observed family version 1.2.2')), 'a before half measured at another version');
    // A before half whose claims already passed repaired nothing here.
    auditBranch('step-3/parallel-1', { version: '1.2.3', verdict: 'pass', routeTo: 'none' });
    assert.ok(auditProofErrors(ctx).some((e) => e.includes('passes on the before audit')), 'a gap that was never a gap');
    // A failing claim the delivery owns is not a reason to consume a release.
    auditBranch('step-3/parallel-1', { version: '1.2.3', verdict: 'fail', routeTo: 'resolve' });
    assert.ok(auditProofErrors(ctx).some((e) => e.includes('not routed to the family owner')), 'an app-side failure dressed as a family gap');
    // The halves must judge the same claims.
    auditBranch('step-3/parallel-1', { version: '1.2.3', verdict: 'fail', claims: ['OVERFLOW-3'] });
    assert.ok(auditProofErrors(ctx).some((e) => e.includes('carries no family-owned result for PADDING-4')), 'a claim only one half judged');
    // The after half must still be passing, and must be the commit this branch made.
    auditBranch('step-3/parallel-1', { version: '1.2.3', verdict: 'fail' });
    auditBranch('step-5/parallel-1', { version: '1.2.4', verdict: 'fail', applied: CONSUMER_COMMIT });
    assert.ok(auditProofErrors(ctx).some((e) => e.includes('still fails on the after audit')), 'a release that repaired nothing');
    auditBranch('step-5/parallel-1', { version: '1.2.4', verdict: 'pass', routeTo: 'none', applied: 'e'.repeat(40) });
    assert.ok(auditProofErrors(ctx).some((e) => e.includes('the after half is the bumped head')), 'an after half measured on another head');
    // A half that is not there at all.
    assert.ok(auditProofErrors({ ...ctx, consumer: { ...auditConsumer, regression: { ...auditConsumer.regression, before: 'step-9/parallel-9' } } }).some((e) => e.includes('has no verdicts to read')), 'a half nobody wrote');
  } finally { rmSync(session, { recursive: true, force: true }); }
}
process.stdout.write('library.update self-test: a presentation release consumes on two audits of the surface it repairs, and the halves are held to the same claims, the two versions and the bumped head\n');
