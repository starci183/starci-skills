// git-land-receipt.spec.mjs - `starci git land` lands only a tip that `starci runtime verify` proved (check AND the affected specs, bound to the exact commit and the land base), and writes the affected proof
// into the land note, which is what `starci runtime deploy` reads back. The land's own gate, check and bounded specs still run after it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { gitLand } from '../../scripts/supervisor/git-land.mjs';
import { affectedTrailers, landVerifyReceipt } from '../../scripts/supervisor/git-land-receipt.mjs';
import { verifyRecord, writeVerifyReceipt } from '../../scripts/supervisor/verify-receipt.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

function fixture(t) {
  const base = mkdtemp(t, 'starci-land-receipt-'), repo = path.join(base, 'repo'), lane = path.join(base, 'lane');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', key, value);
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
  git(repo, 'add', 'README.md');
  git(repo, 'commit', '-q', '-m', 'base');
  const main = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'branch', 'lane');
  git(repo, 'worktree', 'add', '-q', lane, 'lane');
  fs.mkdirSync(path.join(lane, 'scripts'));
  fs.writeFileSync(path.join(lane, 'scripts', 'value.mjs'), 'export const value = 1;\n');
  git(lane, 'add', '-A');
  git(lane, 'commit', '-q', '-m', 'lane change');
  return { base, repo, lane, main, tip: git(lane, 'rev-parse', 'HEAD'), tree: git(lane, 'rev-parse', 'HEAD^{tree}') };
}

const greenDeps = (fx) => ({
  underHostLock: async (_options, fn) => ({ ok: true, locked: true, value: await fn() }),
  runGate: () => ({ ok: true, base: fx.main, problems: [] }),
  runCheck: () => ({ ok: true, pass: 5, total: 5, output: 'green' }),
  changedFiles: () => ['scripts/value.mjs'],
  runSpecs: () => ({ ok: true, selected: 1, pass: 1, rerun: 0, log: null }),
  announceLand: () => true,
  syncCopies: () => 1,
});
const land = (fx, args = {}, deps = {}) => gitLand({ positionals: [fx.lane, 'lane'], args, cwd: fx.base, env: {}, role: 'coordinator' }, { ...greenDeps(fx), ...deps });
const receipt = (fx, over = {}) => verifyRecord({ root: fx.lane, sha: fx.tip, tree: fx.tree, base: fx.main, check: { pass: 5, total: 5 }, affected: { passed: 7, total: 7, reused: 0 }, ...over });

test('a land without a verify receipt is refused at step 0 before the gate, the check or the specs run, and names the verb that produces it', async (t) => {
  const fx = fixture(t);
  let ran = 0;
  const out = await land(fx, {}, { runGate: () => { ran += 1; return { ok: true }; }, runCheck: () => { ran += 1; return { ok: true }; } });
  assert.equal(out.code, 1);
  assert.equal(out.data.refusal.step, '0-verify-receipt');
  assert.equal(out.data.refusal.cause, 'verify-receipt-missing');
  assert.match(out.data.refusal.detail, /no verify receipt; run starci runtime verify --base [0-9a-f]{12} in /);
  assert.equal(ran, 0);
  assert.equal(git(fx.repo, 'rev-parse', 'HEAD'), fx.main, 'main did not move');
});

test('a verify receipt of another base, another commit or a short proof does not open the land', async (t) => {
  const fx = fixture(t);
  for (const [name, record, pattern] of [
    ['another base', receipt(fx, { base: 'f'.repeat(40) }), /proved the affected specs against ffffffffffff/],
    ['a short check', receipt(fx, { check: { pass: 4, total: 5 } }), /records the check at 4\/5/],
    ['a partial affected run', receipt(fx, { affected: { passed: 6, total: 7, reused: 0 } }), /records the affected specs at 6\/7/],
  ]) {
    writeVerifyReceipt(fx.lane, record);
    const out = await land(fx, { 'dry-run': true });
    assert.equal(out.code, 1, name);
    assert.match(out.data.refusal.detail, pattern, name);
  }
});

test('a verify receipt for the exact tip and the land base lets the land go on, and the note carries the affected proof for deploy to read', async (t) => {
  const fx = fixture(t);
  writeVerifyReceipt(fx.lane, receipt(fx));
  const dry = await land(fx, { 'dry-run': true });
  assert.equal(dry.code, 0, dry.text);
  assert.ok(dry.data.trailers.includes(`Affected: 7/7 ${fx.main}..${fx.tip}`));
  const out = await land(fx);
  assert.equal(out.code, 0, out.text);
  const note = git(fx.repo, 'notes', '--ref=land', 'show', fx.tip);
  assert.match(note, new RegExp(`^Affected: 7/7 ${fx.main}\\.\\.${fx.tip}$`, 'm'));
  assert.match(note, /^Check: 5\/5$/m);
});

test('the receipt lookup is pure over the worktree and names the verb in its refusal', (t) => {
  const fx = fixture(t);
  assert.equal(landVerifyReceipt({ worktree: fx.lane, tip: fx.tip, base: null }).ok, false);
  assert.match(landVerifyReceipt({ worktree: fx.lane, tip: fx.tip, base: null }).detail, /no merge base/);
  assert.equal(landVerifyReceipt({ worktree: fx.lane, tip: fx.tip, base: fx.main }).ok, false);
  writeVerifyReceipt(fx.lane, receipt(fx));
  const found = landVerifyReceipt({ worktree: fx.lane, tip: fx.tip, base: fx.main });
  assert.equal(found.ok, true);
  assert.deepEqual(affectedTrailers({ record: found.record, base: fx.main, tip: fx.tip }), [`Affected: 7/7 ${fx.main}..${fx.tip}`]);
});

test('a partial verify receipt lands (0 failed, the changed specs ran) and the note records what was not started; a deploy then needs the rest', async (t) => {
  const fx = fixture(t);
  const partial = (affected) => receipt(fx, { affected: { passed: 150, total: 469, reused: 0, ...affected } });
  writeVerifyReceipt(fx.lane, partial({ notStarted: 319, changedSpecsRan: true }));
  const out = await land(fx);
  assert.equal(out.code, 0, out.text);
  const note = git(fx.repo, 'notes', '--ref=land', 'show', fx.tip);
  assert.match(note, new RegExp(`^Affected: 150/469 ${fx.main}\.\.${fx.tip}$`, 'm'));
  assert.match(note, /^Affected-Not-Started: 319 \(budget\)$/m);
});

test('a partial receipt with a failure, with a changed spec not run, or one that ran in another tree does not open the land', async (t) => {
  const fx = fixture(t);
  for (const [name, record, pattern] of [
    ['a failure', receipt(fx, { affected: { passed: 149, total: 469, failed: 1, notStarted: 319 } }), /1 failed/],
    ['a changed spec not run', receipt(fx, { affected: { passed: 150, total: 469, notStarted: 319, changedSpecsRan: false } }), /spec the lane changed that was not run/],
    ['another tree', verifyRecord({ root: fx.repo, sha: fx.tip, tree: fx.tree, base: fx.main, check: { pass: 5, total: 5 }, affected: { passed: 7, total: 7 } }), /ran in .*not in /],
  ]) {
    writeVerifyReceipt(fx.lane, record);
    const out = await land(fx, { 'dry-run': true });
    assert.equal(out.code, 1, name);
    assert.match(out.data.refusal.detail, pattern, name);
  }
});
