// land-spec-baseline (diagnosis fix-red-on-main-specs-10464b): one stale spec fixture red on main refused every land whose
// touching set included it (every package.json land runs 92 specs), although the candidate was not at fault. The same
// failure mode 82be34072/595071221 fixed for tree checks. When `specs (N)` is red the gate reruns ONLY the failing spec
// files once in a scratch at `base` (same env, same selection) and compares failures by (spec file, test name), never by
// count: a failure main has too is inherited (an advisory "specs red on main (k)" + a Supervisor signal); a failure main
// lacks, or any failure in a spec the change added or modified, refuses; a base run that cannot run refuses (fail closed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runChecks, runSpecFiles, specBaselineVerdict, describe } from '../../scripts/supervisor/land.mjs';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => { try { spawnSync('git', ['-C', dir, 'worktree', 'prune'], { windowsHide: true }); } catch { /* none */ } try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* best effort */ } });
  return dir;
};
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, files) => { for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), c); } };

// main: tests/red.spec.mjs has one stale test red on main and one test of scripts/a.mjs that is green on main.
const RED_SPEC = [
  "import test from 'node:test';",
  "import assert from 'node:assert/strict';",
  "import { a } from '../scripts/a.mjs';",
  "test('stale fixture', () => { assert.equal(1, 2); });",
  "test('a is one', () => { assert.equal(a, 1); });",
  '',
].join('\n');

/** A repo at `main` and a candidate worktree at main + `files` committed; {root, dir, base, head, env}. */
function fixture(t, files) {
  const root = tmp(t, 'land-sb-repo-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  write(root, { 'scripts/a.mjs': 'export const a = 1;\n', 'scripts/b.mjs': 'export const b = 1;\n', 'tests/red.spec.mjs': RED_SPEC });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');
  const dir = path.join(tmp(t, 'land-sb-cand-'), 'wt');
  git(root, 'worktree', 'add', '-q', '--detach', dir, base);
  write(dir, files);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'candidate');
  const head = git(dir, 'rev-parse', 'HEAD');
  const env = { ...process.env, STARCI_LANES_ROOT: tmp(t, 'land-sb-lanes-') };
  return { root, dir, base, head, env };
}
const check = (f, extra = {}) => runChecks({ dir: f.dir, base: f.base, head: f.head, specs: ['tests/red.spec.mjs'], specMode: 'touching', baseTree: f.root, env: f.env,
  ramGate: () => ({ ok: true, concurrency: 2 }), ...extra });
const specsCheck = (r) => r.checks.find((c) => /^specs \(\d+\)$/.test(c.name));
const advisory = (r) => r.checks.find((c) => /^specs red on main/.test(c.name));

test('(1) a spec red identically on main and on the candidate passes, with the advisory naming the inherited test', (t) => {
  const f = fixture(t, { 'scripts/b.mjs': 'export const b = 2;\n' });
  const r = check(f);
  assert.equal(specsCheck(r).ok, true, JSON.stringify(specsCheck(r), null, 2));
  assert.equal(r.ok, true);
  const adv = advisory(r);
  assert.ok(adv, 'the inherited red is reported, never silently tolerated');
  assert.equal(adv.name, 'specs red on main (1)');
  assert.equal(adv.advisory, true);
  assert.deepEqual(adv.inherited, [{ file: 'tests/red.spec.mjs', name: 'stale fixture' }]);
  assert.match(describe({ ok: true, landed: f.head, commits: [f.head], checks: r.checks }), /specs red on main \(1\)/);
  // the base scratch is gone
  assert.deepEqual(fs.readdirSync(path.join(f.env.STARCI_LANES_ROOT, 'land')), []);
});

test('(2) a new failing test in the same (unchanged) spec file is refused and named', (t) => {
  const f = fixture(t, { 'scripts/a.mjs': 'export const a = 2;\n' });
  const r = check(f);
  assert.equal(r.ok, false);
  const s = specsCheck(r);
  assert.equal(s.ok, false);
  assert.deepEqual(s.newFailures, [{ file: 'tests/red.spec.mjs', name: 'a is one' }]);
  assert.deepEqual(s.inherited, [{ file: 'tests/red.spec.mjs', name: 'stale fixture' }]);
});

test('(3) a red spec the change modified is refused even when its failure is the same as main', (t) => {
  const f = fixture(t, { 'tests/red.spec.mjs': `// touched\n${RED_SPEC}` });
  let baseRuns = 0;
  const r = check(f, { specBaseRun: () => { baseRuns += 1; return { ok: true, failures: [{ file: 'tests/red.spec.mjs', name: 'stale fixture' }] }; } });
  assert.equal(r.ok, false);
  const s = specsCheck(r);
  assert.equal(s.ok, false);
  assert.deepEqual(s.changedSpecFailures, [{ file: 'tests/red.spec.mjs', name: 'stale fixture' }]);
  assert.equal(baseRuns, 0, 'a spec the change added or modified is never rerun at base');
  assert.equal(advisory(r), undefined);
});

test('(4) a base run that cannot run refuses (fail closed)', (t) => {
  const f = fixture(t, { 'scripts/b.mjs': 'export const b = 2;\n' });
  const r = check(f, { specBaseRun: () => ({ ok: false, error: 'base scratch failed: boom' }) });
  assert.equal(r.ok, false);
  const s = specsCheck(r);
  assert.equal(s.ok, false);
  assert.match(s.output, /base scratch failed: boom/);
  assert.equal(advisory(r), undefined);
});

test('verdict: compared by (file, test name), never by count', () => {
  const cand = [{ file: 'tests/x.spec.mjs', name: 'b' }];
  const v = specBaselineVerdict({ candidate: cand, base: { ok: true, failures: [{ file: 'tests/x.spec.mjs', name: 'a' }] }, changed: [] });
  assert.equal(v.ok, false);
  assert.deepEqual(v.newFailures, cand);
  assert.equal(specBaselineVerdict({ candidate: null, base: { ok: true, failures: [] }, changed: [] }).ok, false, 'an unreadable candidate failure list refuses');
  assert.equal(specBaselineVerdict({ candidate: [], base: { ok: true, failures: [] }, changed: [] }).ok, false, 'a red run naming no failed test refuses');
  const same = specBaselineVerdict({ candidate: cand, base: { ok: true, failures: cand }, changed: [] });
  assert.equal(same.ok, true);
  assert.deepEqual(same.inherited, cand);
});

test('a failure in a describe is named by its full path of names', (t) => {
  const dir = tmp(t, 'land-sb-nest-');
  write(dir, { 'tests/n.spec.mjs': "import { describe, it } from 'node:test';\nimport assert from 'node:assert/strict';\ndescribe('suite', () => { it('ok', () => {}); describe('inner', () => { it('leaf', () => { assert.equal(1, 2); }); }); });\ndescribe('other', () => { it('leaf', () => {}); });\n" });
  const r = runSpecFiles({ dir, files: ['tests/n.spec.mjs'], concurrency: 1, timeout: 60_000 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.failures.map((f) => f.name).sort(), ['suite', 'suite > inner', 'suite > inner > leaf']);
  assert.ok(r.failures.every((f) => f.file === 'tests/n.spec.mjs'));
});
