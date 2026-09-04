import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateAgainst } from '../../scripts/json-schema.mjs';
import { ROOT, schema, planErrors, safeRelative, safePath, nextPatch, hash, git, loadContext, worktreeErrors, proofErrors, resolveCommand, snapshots, regressionFailed } from './validate.mjs';

const manifest = { name: '@example/library', version: '1.2.3', exports: './index.js', scripts: { test: 'node index.spec.js', build: 'node --check index.js', typecheck: 'node --check index.js' } };
const command = (name) => ({ kind: 'npm-script', name, args: [] });
const plan = {
  packageRoot: 'package', packageName: '@example/library', baseVersion: '1.2.3', targetVersion: '1.2.4',
  files: [{ path: 'package/index.js', kind: 'behavior' }, { path: 'package/index.spec.js', kind: 'test' }, { path: 'package/package.json', kind: 'manifest' }],
  pairs: [{ source: 'package/index.js', test: 'package/index.spec.js' }],
  regression: { command: command('test'), assertion: 'keeps the declared panel relationship' },
  gates: ['test', 'build', 'typecheck'].map((id) => ({ id, command: command(id) }))
};
assert.deepEqual(validateAgainst(schema(ROOT, 'library-behavior-plan'), plan), []);
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
  (p) => { p.files.push({ path: 'package/README.md', kind: 'docs' }); }
]) { const changed = structuredClone(plan); mutate(changed); assert.ok(planErrors(changed, manifest).length); }
assert.ok(planErrors(plan, { ...manifest, private: true }).length);
assert.equal(regressionFailed('not ok 1 - keeps the declared panel relationship', plan.regression.assertion), true);
assert.equal(regressionFailed('ok 1 - keeps the declared panel relationship\nnot ok unrelated', plan.regression.assertion), false);

const temp = mkdtempSync(path.join(tmpdir(), 'library-operator-'));
try {
  const repo = path.join(temp, 'repo'); mkdirSync(path.join(repo, 'package'), { recursive: true });
  const write = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
  write(path.join(repo, 'package/package.json'), manifest);
  write(path.join(repo, 'package/index.js'), 'export const relationship = 0;\n');
  write(path.join(repo, 'package/index.spec.js'), 'console.log("base test");\n');
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
    gitPolicy: { worktreeBranches: 'session-only', mutationBranch: 'main' }, mutationReadiness: 'ready', writeRoots: ['package'], authorityRoots: { businesses: null }, runtime: null, provenanceHeadRef: null
  };
  const request = { schemaVersion: 9, operatorId: 'library.source.apply', step: 2, parallel: 1, sessionId: 'library-test', contexts: [{ alias: '@workspaces/fe', head: base }], requirements: { plan }, inputs: { route: routeRef }, resume: null };
  const state = { id: 'library-test', project: 'example', startedAt: '2026-09-04', status: 'running', chain: [['1/1'], ['2/1']], steps: { '1/1': 'workspace.bind', '2/1': 'library.source.apply' }, requestHashes: {} };
  write(path.join(session, 'state.json'), state); write(path.join(session, routeRef), route); write(path.join(branch, 'request/request.json'), request);
  const ctx = await loadContext(branch);
  assert.equal(path.resolve(ctx.checkout), path.resolve(checkout));
  assert.deepEqual(worktreeErrors(ctx, { pristine: true }), []);
  write(path.join(checkout, 'consumer.js'), 'unauthorized');
  assert.ok(worktreeErrors(ctx).some((e) => e.includes('consumer.js'))); rmSync(path.join(checkout, 'consumer.js'));
  write(path.join(checkout, 'package/index.spec.js'), 'console.log("new regression");\n');
  assert.ok(worktreeErrors(ctx, { pristine: true }).length);
  assert.deepEqual(worktreeErrors(ctx), []);
  const badPlan = structuredClone(plan); badPlan.files[0].path = 'consumer.js'; badPlan.pairs[0].source = 'consumer.js';
  write(path.join(branch, 'request/request.json'), { ...request, requirements: { plan: badPlan } });
  await assert.rejects(loadContext(branch), /outside package|outside bound write roots/);
  write(path.join(branch, 'request/request.json'), request);
  const badRoute = { ...route, writeRoots: ['elsewhere'] }; write(path.join(session, routeRef), badRoute);
  await assert.rejects(loadContext(branch), /outside bound write roots/); write(path.join(session, routeRef), route);
  const link = path.join(checkout, 'package/link');
  try { symlinkSync(temp, link, process.platform === 'win32' ? 'junction' : 'dir'); assert.throws(() => safePath(checkout, 'package/link/escape.js'), /symlink|escaped/); }
  finally { unlinkSync(link); }

  const beforeFiles = snapshots(ctx);
  write(path.join(checkout, 'package/index.js'), 'export const relationship = 1;\n');
  write(path.join(checkout, 'package/package.json'), { ...manifest, version: plan.targetVersion });
  const finalHashes = snapshots(ctx);
  const proofs = {};
  const phases = ['before', 'after', ...plan.gates.map((g) => g.id)];
  for (const phase of phases) {
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
    (p) => { p.build.head = 'f'.repeat(40); }
  ]) { const changed = structuredClone(proofs); mutate(changed); assert.ok(proofErrors(ctx, changed, finalHashes).length); }
  git(checkout, ['checkout', '-q', '-b', 'other-session']);
  await assert.rejects(loadContext(branch), /exactly one worktree/);
} finally {
  const resolved = path.resolve(temp);
  assert.ok(path.dirname(resolved) === path.resolve(tmpdir()) && path.basename(resolved).startsWith('library-operator-'));
  rmSync(resolved, { recursive: true, force: true });
}
process.stdout.write('library.source.apply self-test: package boundary, session binding and regression proof mutations passed\n');
