// hook-shape.spec.mjs - RT_HOOK_SHAPE (scripts/hfs/runtime-rules/hook-shape.mjs, wired into scripts/hfs/runtime-check.mjs): the app
// hook templates keep the gate model. The commit gate is L0 only (no typecheck, no test run); the push gate checks the release gate
// (the L4 record directory, the backup namespace, the release tag pattern) and never builds or tests. Comments are not judged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';
import { RUNTIME_MANIFEST_FILE } from '../../scripts/hfs/slots.mjs';
import { TEMPLATE_DIR, fileHookShapeFindings, hookShapeFindings } from '../../scripts/hfs/runtime-rules/hook-shape.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const COMMIT = `${TEMPLATE_DIR}/pre-commit`;
const PUSH = `${TEMPLATE_DIR}/pre-push`;
const real = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const commit = (text) => fileHookShapeFindings({ path: COMMIT, name: 'pre-commit', text });
const push = (text) => fileHookShapeFindings({ path: PUSH, name: 'pre-push', text });
const GATE = 'x=$(git rev-parse --git-common-dir)/starci-release/$h.l4.json\ncase "$r" in refs/backup/*) ;; refs/tags/v*) git tag --list \'v[0-9]*\' ;; esac\necho RIGHTS_PUSH_NOT_RELEASE\n';

test('RT_HOOK_SHAPE: the real app hook templates keep the model', () => {
  assert.deepEqual(commit(real(COMMIT)), []);
  assert.deepEqual(push(real(PUSH)), []);
  const ctx = { fileSet: new Set([COMMIT, PUSH]), read: real };
  assert.deepEqual(hookShapeFindings(ctx), []);
  assert.deepEqual(hookShapeFindings({ fileSet: new Set(), read: () => { throw new Error('not tracked, not read'); } }), [], 'a repository without the templates has nothing to judge');
});

test('RT_HOOK_SHAPE: a commit gate that types or tests is refused, naming what it runs', () => {
  const messages = (text) => commit(text).map((f) => f.message);
  assert.match(messages('npm run typecheck\n')[0], /typecheck/);
  assert.match(messages('npm run test:affected -- --findRelatedTests $specs\n')[0], /test run/);
  assert.match(messages('npx jest --bail\n')[0], /test run/);
  assert.match(messages('npm test\n')[0], /test run/);
  assert.equal(commit('npm run typecheck\nnpx jest\n').length, 2);
  const retiredHygiene = ['npx', 'hfs', 'work-hygiene'].join(' ');
  assert.ok(commit(`${retiredHygiene}\n`).every((f) => f.code === 'RT_HOOK_SHAPE'));
  assert.deepEqual(commit(`# no typecheck and no jest here, only eslint\n${retiredHygiene}\nnpx eslint $be\nnpx prettier --check $formatted\n`), [], 'comments are not judged; eslint and prettier are L0');
});

test('RT_HOOK_SHAPE: a push gate that builds, tests or lacks the release gate markers is refused', () => {
  for (const [line, what] of [['npm test', /test run/], ['npm run test:affected', /test run/], ['npx jest', /test run/], ['npm run typecheck', /typecheck/], ['npm run lint', /lint run/]]) {
    const found = push(`${GATE}${line}\n`);
    assert.equal(found.length, 1, line);
    assert.match(found[0].message, what);
  }
  assert.equal(push('exit 0\n').length, 1, 'a hook with no gate');
  assert.match(push('exit 0\n')[0].message, /`starci-release`, `refs\/backup\/`, `v\[0-9\]`/);
  assert.match(push('case "$r" in refs/backup/*) ;; esac\n')[0].message, /`starci-release`, `v\[0-9\]`/);
  assert.match(push(GATE.replace('starci-release', 'release'))[0].message, /marker `starci-release`/);
  assert.deepEqual(push(`# runs no npm test, no typecheck, no lint\n${GATE}`), [], 'comments are not judged; eslint-like words are not lint');
  assert.deepEqual(push(`${GATE}npx eslint x\n`), []);
});

test('RT_HOOK_SHAPE: runtimeCheck reports it for a template of the judged repository', (t) => {
  const dir = mkdtemp(t, 'starci-hook-shape-');
  const bad = { [COMMIT]: 'npm run typecheck\n', [PUSH]: 'npm run test:affected\n', 'hfs.json': real('hfs.json'), [RUNTIME_MANIFEST_FILE]: real(RUNTIME_MANIFEST_FILE) };
  for (const [rel, body] of Object.entries(bad)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); }
  const result = runtimeCheck({ repoRoot: dir, root: ROOT, files: Object.keys(bad), tree: false, base: null, drift: [] });
  const found = result.findings.filter((f) => f.code === 'RT_HOOK_SHAPE');
  assert.deepEqual(found.map((f) => f.path).sort(), [COMMIT, PUSH, PUSH].sort());
});
