// push-git.mjs (/push-git): the one place the full suites run before a main is pushed. Pure planning, failure grouping and the
// per-repository flow run on fake git/step/push seams - no suite, no push, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planFor, failuresOf, mainState, pushGitRepo, pushGit, describeRun, selectRepos } from '../../scripts/supervisor/push-git.mjs';

const RUNTIME = path.resolve('/x/runtime');
const PRODUCT = path.resolve('/x/todo-app-be');

/** A fake git: answers by the first git argument; `dirty` = porcelain lines, `head` may change per call. */
const fakeGit = ({ branch = 'main', dirty = [], ahead = 2, heads = ['aaa111'] } = {}) => {
  let headCalls = 0;
  return (args) => {
    const [a, b] = args;
    if (a === 'symbolic-ref') return { ok: true, stdout: branch };
    if (a === 'status') return { ok: true, stdout: dirty.join('\n') };
    if (a === 'rev-list') return { ok: true, stdout: String(ahead) };
    if (a === 'rev-parse' && b === 'main') return { ok: true, stdout: heads[Math.min(headCalls++, heads.length - 1)] };
    return { ok: true, stdout: '' };
  };
};

const greenStep = () => ({ ok: true, exit: 0, ms: 5, log: 'l.log', text: '' });

// The managed scripts every app carries (starci app sync writes them from this template); {{appScripts}} is the per-app run lines.
const MANAGED = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'packages', 'hfs', 'templates', 'app', 'package-scripts', 'package.json'), 'utf8')
  .replace(/^\s*\{\{appScripts\}\}\s*$/m, '').replace(/\{\{\w+\}\}/g, 'x')).scripts;

test('planFor: runtime = npm test + npm run check; an app = its managed typecheck, lint, test, build:be, build:fe, canon-scan; never e2e', () => {
  const rt = planFor(RUNTIME, { runtimeRoot: RUNTIME });
  assert.equal(rt.kind, 'runtime');
  assert.deepEqual(rt.steps.map((s) => s.name), ['npm test', 'npm run check']);
  const app = planFor(PRODUCT, { runtimeRoot: RUNTIME, skillRoot: RUNTIME, pkg: { scripts: MANAGED } });
  assert.equal(app.kind, 'product');
  assert.deepEqual(app.steps.map((s) => s.name), ['npm run typecheck', 'npm run lint', 'npm test', 'npm run build:be', 'npm run build:fe', 'canon-scan']);
  assert.ok(app.steps.every((s) => !s.absent), 'every step of the managed scripts runs: the unit suite is not skipped as absent');
  assert.deepEqual(app.steps.find((s) => s.name === 'npm test').args, ['test']);
  assert.ok(app.steps.filter((s) => s.name.startsWith('npm run build:')).every((s) => s.after === 'npm run typecheck'));
  assert.ok(!app.steps.some((s) => /e2e|integration|contract/.test(s.name) || (s.args ?? []).some((a) => /e2e/.test(a))), 'only the unit project; e2e is never a step');
  assert.deepEqual(app.steps.at(-1).args.slice(1), ['--root', PRODUCT]);
});

test('planFor: a managed script the app lacks is absent, never a pass by silence; the removed test:unit and build are not steps', () => {
  const bare = planFor(PRODUCT, { runtimeRoot: RUNTIME, skillRoot: RUNTIME, pkg: { scripts: { 'test:unit': 'jest', build: 'tsc' } } });
  assert.deepEqual(bare.steps.filter((s) => s.absent).map((s) => s.name), ['npm run typecheck', 'npm run lint', 'npm test', 'npm run build:<side>']);
  assert.ok(!bare.steps.some((s) => s.name === 'npm run test:unit' || s.name === 'npm run build'));
});

test('failuresOf groups by file: node:test spec and tap, jest, tsc, eslint, canon-scan JSON, and an unparsed tail', () => {
  const spec = ['✖ failing tests:', '', 'test at file:///x/runtime/tests/a.spec.mjs:10:1', '✖ first case (1.2ms)', '  AssertionError', 'test at file:///x/runtime/tests/b.spec.mjs:3:1', '✖ second case (0.4ms)'].join('\n');
  assert.deepEqual(failuresOf('npm test', spec, { repo: '/x/runtime' }), [{ file: 'tests/a.spec.mjs', items: ['first case'] }, { file: 'tests/b.spec.mjs', items: ['second case'] }]);
  const tap = ['not ok 1 - tap case', '  ---', "  location: 'file:///x/runtime/tests/c.spec.mjs:7:1'", '  ...'].join('\n');
  assert.deepEqual(failuresOf('npm test', tap, { repo: '/x/runtime' }), [{ file: 'tests/c.spec.mjs', items: ['tap case'] }]);
  const jest = ['FAIL src/cart/cart.service.spec.ts', '  ● CartService › adds', '  ● CartService › removes'].join('\n');
  assert.deepEqual(failuresOf('npm test', jest), [{ file: 'src/cart/cart.service.spec.ts', items: ['CartService › adds', 'CartService › removes'] }]);
  const tsc = 'src/a.ts(4,7): error TS2322: Type string is not assignable to type number.\nsrc/a.ts(9,1): error TS2304: Cannot find name x.';
  const tscGroups = failuresOf('npm run typecheck', tsc);
  assert.equal(tscGroups.length, 1);
  assert.equal(tscGroups[0].file, 'src/a.ts');
  assert.equal(tscGroups[0].items.length, 2);
  const eslint = ['src/b.ts', '  3:5  error  Unexpected any  @typescript-eslint/no-explicit-any', ''].join('\n');
  assert.deepEqual(failuresOf('npm run lint', eslint), [{ file: 'src/b.ts', items: ['@typescript-eslint/no-explicit-any @3 Unexpected any'] }]);
  const canon = JSON.stringify({ findings: [{ file: 'src/c.ts', family: 'naming', rule: 'canon/x', line: 2, message: 'bad' }] });
  assert.deepEqual(failuresOf('canon-scan', canon), [{ file: 'src/c.ts', items: ['naming:canon/x @2 bad'] }]);
  const other = failuresOf('npm run build:be', 'boom\nsecond line');
  assert.equal(other[0].file, '(unparsed)');
  assert.ok(other[0].items.includes('second line'));
});

test('mainState never mutates: reads branch, tracked-dirty, untracked and ahead', () => {
  const s = mainState('/r', { run: fakeGit({ dirty: [' M a.mjs', '?? new.txt', '?? other.txt'], ahead: 3 }) });
  assert.deepEqual([s.onMain, s.dirty, s.untracked, s.ahead], [true, [' M a.mjs'], 2, 3]);
});

test('pushGitRepo: dirty and off-main checkouts stop before any suite runs, and report what is dirty', () => {
  let ran = 0;
  const deps = { git: fakeGit({ dirty: [' M scripts/a.mjs'] }), step: () => { ran += 1; return greenStep(); }, plan: () => planFor(RUNTIME, { runtimeRoot: RUNTIME }) };
  const dirty = pushGitRepo(RUNTIME, { deps });
  assert.equal(dirty.verdict, 'dirty');
  assert.deepEqual(dirty.dirty, [' M scripts/a.mjs']);
  assert.equal(ran, 0);
  assert.equal(pushGitRepo(RUNTIME, { deps: { ...deps, git: fakeGit({ branch: 'lane/x' }) } }).verdict, 'not-on-main');
  assert.equal(pushGitRepo(RUNTIME, { deps: { ...deps, git: fakeGit({ ahead: 0 }) } }).verdict, 'nothing-to-push');
  assert.equal(ran, 0);
});

test('pushGitRepo: a red suite prints the grouped failures, runs every step, skips build after a red typecheck, and never pushes', () => {
  const pushes = [];
  const outputs = { 'npm run typecheck': 'src/a.ts(1,1): error TS1005: x', 'npm test': 'FAIL src/a.spec.ts\n  ● a › b' };
  const seen = [];
  const deps = {
    git: fakeGit(),
    plan: () => planFor(PRODUCT, { runtimeRoot: RUNTIME, skillRoot: RUNTIME, pkg: { scripts: { typecheck: 't', 'lint': 'l', test: 'u', 'build:be': 'b', 'build:fe': 'f' } } }),
    step: (step) => { seen.push(step.name); const text = outputs[step.name]; return text ? { ok: false, exit: 1, ms: 5, log: 'l.log', text } : greenStep(); },
    push: (o) => { pushes.push(o); return [{}]; },
  };
  const r = pushGitRepo(PRODUCT, { deps });
  assert.equal(r.verdict, 'red');
  assert.deepEqual(seen, ['npm run typecheck', 'npm run lint', 'npm test', 'canon-scan'], 'the builds are skipped after the red typecheck');
  assert.deepEqual(r.steps.filter((s) => s.name.startsWith('npm run build:')).map((s) => s.status), ['skipped', 'skipped']);
  assert.deepEqual(r.steps.find((s) => s.name === 'npm test').failures, [{ file: 'src/a.spec.ts', items: ['a › b'] }]);
  assert.equal(pushes.length, 0, 'a red run never reaches the push');
  const text = describeRun({ ok: false, check: false, repos: [r], notRun: [] });
  assert.match(text, /src\/a\.spec\.ts/);
  assert.match(text, /PUSH-GIT RED/);
});

test('pushGitRepo: green pushes in the promised order (dry run, hooks only, push); --check stops before the push; main moving is red', () => {
  const calls = [];
  const push = (o) => {
    calls.push(o.dryRun ? 'dry-run' : o.hooksOnly ? 'hooks-only' : 'push');
    return [o.dryRun ? { wouldPush: true } : o.hooksOnly ? { hooks: 'green' } : { pushed: true, head: 'abc1234', repo: PRODUCT }];
  };
  const base = { plan: () => planFor(RUNTIME, { runtimeRoot: RUNTIME }), step: greenStep, push };
  const green = pushGitRepo(RUNTIME, { deps: { ...base, git: fakeGit({ ahead: 4 }) } });
  assert.equal(green.verdict, 'green');
  assert.equal(green.pushed, 4);
  assert.deepEqual(calls, ['dry-run', 'hooks-only', 'push']);
  calls.length = 0;
  const check = pushGitRepo(RUNTIME, { check: true, deps: { ...base, git: fakeGit({ ahead: 4 }) } });
  assert.equal(check.verdict, 'green');
  assert.equal(check.checkOnly, true);
  assert.deepEqual(calls, ['dry-run', 'hooks-only'], '--check does everything except the push');
  calls.length = 0;
  const moved = pushGitRepo(RUNTIME, { deps: { ...base, git: fakeGit({ ahead: 4, heads: ['aaa111', 'bbb222'] }) } });
  assert.equal(moved.verdict, 'main-moved');
  assert.deepEqual(calls, []);
  const refused = pushGitRepo(RUNTIME, { deps: { ...base, git: fakeGit({ ahead: 4 }), push: () => [{ refused: 'secret scan found candidates' }] } });
  assert.equal(refused.verdict, 'push-refused');
  const hooksRed = pushGitRepo(RUNTIME, { deps: { ...base, git: fakeGit({ ahead: 4 }), push: (o) => [o.dryRun ? { wouldPush: true } : { hooks: 'red', error: 'lint' }] } });
  assert.equal(hooksRed.verdict, 'hooks-red');
});

test('pushGit stops at the first repository that is not green; an explicit --repo runs even when nothing is ahead', () => {
  const deps = { git: fakeGit({ ahead: 0 }), plan: () => planFor(RUNTIME, { runtimeRoot: RUNTIME }), step: greenStep, defaultRepos: () => [RUNTIME, PRODUCT] };
  const idle = pushGit({ deps });
  assert.equal(idle.ok, true);
  assert.deepEqual(idle.repos.map((r) => r.verdict), ['nothing-to-push', 'nothing-to-push']);
  const explicit = pushGit({ repos: [RUNTIME], check: true, deps: { ...deps, push: (o) => [o.dryRun ? { wouldPush: true } : { hooks: 'green' }] } });
  assert.equal(explicit.repos[0].verdict, 'green', 'explicit repo runs its suite though nothing is ahead');
  assert.deepEqual(selectRepos({ repos: ['/a/b'] }), { list: [path.resolve('/a/b')], explicit: true });
  const dirty = pushGit({ deps: { ...deps, git: fakeGit({ dirty: [' M x'] }) } });
  assert.equal(dirty.ok, false);
  assert.deepEqual(dirty.notRun, ['todo-app-be'], 'the run stopped at the first red repository');
});
