// runtime-verify.spec.mjs - `starci runtime verify`: a branch is verified only by ONE receipt bound to its exact commit that holds BOTH the check and the affected specs; the last line cannot be misread,
// and `starci runtime deploy` takes that receipt (and a land note only when it carries the affected proof too).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runtimeVerify } from '../../scripts/reconciler/runtime-verify.mjs';
import { receiptFor } from '../../scripts/reconciler/runtime-deploy-receipt.mjs';
import { readVerifyReceipt, verdictOf, verifyRecord, writeVerifyReceipt } from '../../scripts/supervisor/verify-receipt.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const BASE = 'b'.repeat(40);
const SHA = 'a'.repeat(40);

const done = { exited: true, code: 0, signal: null, timedOut: false };
const receiptIn = (root, over = {}) => ({ schema: 'starci/affected-receipt@1', root, base: BASE, tip: SHA, clean: true, files: 3, passed: 3, total: 3, ok: true, ...over });
const ran = (root, over = {}, run = {}) => ({ exit: done, receipt: receiptIn(root, over), answer: {}, tail: [], red: [], unfinished: [], ...run });

/** The seams of a verification that finds a clean commit, a green check and a green affected run; `over` replaces any. */
function seams(over = {}) {
  return {
    facts: () => ({ sha: SHA, tree: 't'.repeat(40), dirty: false }),
    base: () => BASE,
    runCheck: () => ({ ok: true, pass: 2301, total: 2301, output: 'ok' }),
    provenAffected: () => null,
    changedSpecs: () => [],
    runAffected: (root) => ran(root, { reused: 1, ms: 40 }),
    ...over,
  };
}
const verify = (t, over = {}, args = {}) => {
  const root = mkdtemp(t, 'starci-verify-');
  const lines = [];
  return runtimeVerify({ args: { root, ...args }, positionals: [], cwd: root, env: {} }, { seams: seams(over), progress: (line) => lines.push(line) }).then((out) => ({ out, root, lines }));
};
const last = (out) => out.text.split('\n').at(-1);

test('a clean commit with a green check and green affected specs is verified: one receipt, one unmistakable last line', async (t) => {
  const { out, root } = await verify(t);
  assert.equal(out.code, 0, out.text);
  assert.equal(last(out), `verified ${SHA.slice(0, 12)}: check 2301/2301, affected 3/3 of ${BASE.slice(0, 12)}..${SHA.slice(0, 12)} (1 reused from a proven run at an unchanged key)`);
  assert.equal(out.data.schema, 'starci/runtime-verify@1');
  const found = readVerifyReceipt({ root, sha: SHA, tree: 't'.repeat(40), base: BASE });
  assert.deepEqual([found.record.check, found.record.affected.passed, found.record.affected.total, found.record.affected.reused], [{ pass: 2301, total: 2301 }, 3, 3, 1]);
});

test('NOT VERIFIED, each with its reason: a dirty tree, no base, a red check (the specs are not run), red spec files listed, an unfinished run, a tree that moved', async (t) => {
  const dirty = await verify(t, { facts: () => ({ sha: SHA, tree: 't', dirty: true }) });
  assert.equal(dirty.out.code, 1);
  assert.match(last(dirty.out), /^NOT VERIFIED aaaaaaaaaaaa: the working tree has uncommitted or untracked changes/);
  const noBase = await verify(t, { base: () => null });
  assert.match(last(noBase.out), /^NOT VERIFIED aaaaaaaaaaaa: no base to diff against/);
  let affectedRuns = 0;
  const redCheck = await verify(t, { runCheck: () => ({ ok: false, pass: 2300, total: 2301, output: 'x\nRT_TIER_DIRECTION scripts/a.mjs' }), runAffected: () => { affectedRuns += 1; } });
  assert.match(last(redCheck.out), /^NOT VERIFIED aaaaaaaaaaaa: the runtime check is red \(2300\/2301\); the affected specs were not run: .*RT_TIER_DIRECTION/);
  assert.equal(affectedRuns, 0);
  const redSpecs = await verify(t, { runAffected: (root) => ran(root, { ok: false, passed: 1 }, { exit: { ...done, code: 1 }, red: ['tests/a.spec.mjs', 'tests/b.spec.mjs'] }) });
  assert.equal(redSpecs.out.code, 1);
  assert.match(last(redSpecs.out), /^NOT VERIFIED aaaaaaaaaaaa: 2 spec file\(s\) are red: tests\/a\.spec\.mjs, tests\/b\.spec\.mjs \[red: tests\/a\.spec\.mjs, tests\/b\.spec\.mjs\]$/);
  const unfinished = await verify(t, { runAffected: (root) => ran(root, { ok: false, passed: 2, total: 3 }, { exit: { ...done, code: 2 }, unfinished: ['tests/z.spec.mjs'] }), changedSpecs: () => ['tests/z.spec.mjs'] });
  assert.match(last(unfinished.out), /^NOT VERIFIED .*the budget ended before 1 spec file\(s\) the change itself touched ran.*Run starci runtime verify again: the files that passed are reused/);
  assert.equal(unfinished.out.code, 1, 'the lane changed the spec that did not run: not a partial');
  let calls = 0;
  const moved = await verify(t, { facts: () => ({ sha: calls++ ? 'c'.repeat(40) : SHA, tree: 't', dirty: false }) });
  assert.match(last(moved.out), /^NOT VERIFIED .*HEAD moved while they ran/);
  for (const result of [dirty, noBase, redCheck, redSpecs, unfinished, moved]) assert.equal(fs.existsSync(path.join(result.root, '.runtime', 'verify')), false, 'a refusal leaves no receipt');
});

test('an affected receipt already proven for the same base..tip is accepted, not run again; a usage error is exit 2', async (t) => {
  let ran = 0;
  const proven = await verify(t, { provenAffected: (root) => ({ root, passed: 5, total: 5, reused: 0, files: 5, ms: 9 }), runAffected: () => { ran += 1; } });
  assert.equal(proven.out.code, 0);
  assert.equal(ran, 0);
  assert.match(last(proven.out), /affected 5\/5 of /);
  assert.ok(proven.lines.some((line) => /accepting the receipt already proven/.test(line)));
  const usage = await runtimeVerify({ args: {}, positionals: ['x'], env: {} }, { seams: seams() });
  assert.equal(usage.code, 2);
});

test('the receipt verifies only the commit, tree and base it names, and only with BOTH proofs full; a hand edit fails its digest', (t) => {
  const root = mkdtemp(t, 'starci-verify-');
  const record = verifyRecord({ root, sha: SHA, tree: 't1', base: BASE, check: { pass: 4, total: 4 }, affected: { passed: 2, total: 2, reused: 0 } });
  writeVerifyReceipt(root, record);
  const read = (over) => readVerifyReceipt({ root, sha: SHA, tree: 't1', base: BASE, ...over });
  assert.ok(read({}).record);
  assert.match(read({ tree: 't2' }).problem, /is for /);
  assert.match(read({ base: 'c'.repeat(40) }).problem, /proved the affected specs against bbbbbbbbbbbb, not cccccccccccc/);
  assert.match(readVerifyReceipt({ root, sha: 'd'.repeat(40), tree: 't1', base: BASE }).problem, /no verify receipt/);
  const file = path.join(root, '.runtime', 'verify', `${SHA}.json`);
  for (const [name, edit, pattern] of [['check short', (r) => ({ ...r, check: { pass: 3, total: 4 } }), /digest/], ['affected short', (r) => ({ ...r, affected: { ...r.affected, passed: 1 } }), /digest/], ['hand-made', (r) => ({ ...r, tree: 't2' }), /digest/]]) {
    fs.writeFileSync(file, JSON.stringify(edit(record)));
    assert.match(read({}).problem, pattern, name);
  }
  const short = verifyRecord({ root, sha: SHA, tree: 't1', base: BASE, check: { pass: 3, total: 4 }, affected: { passed: 2, total: 2 } });
  writeVerifyReceipt(root, short);
  assert.match(read({}).problem, /records the check at 3\/4/, 'a digest-correct receipt that records a short check is still not a verification');
  const partial = verifyRecord({ root, sha: SHA, tree: 't1', base: BASE, check: { pass: 4, total: 4 }, affected: { passed: 1, total: 2 } });
  writeVerifyReceipt(root, partial);
  assert.match(read({}).problem, /records the affected specs at 1\/2/);
});

test('a partial run is honest: land reads it (0 failed, the specs the lane changed ran, not-started counted), deploy and release never do', (t) => {
  const root = mkdtemp(t, 'starci-verify-');
  const at = (affected) => verifyRecord({ root, sha: SHA, tree: 't1', base: BASE, check: { pass: 4, total: 4 }, affected });
  const asks = (record) => { writeVerifyReceipt(root, record); return [readVerifyReceipt({ root, sha: SHA, tree: 't1', base: BASE, need: 'land' }), readVerifyReceipt({ root, sha: SHA, tree: 't1', base: BASE })]; };
  const [landOk, deployNo] = asks(at({ passed: 150, total: 469, notStarted: 319, changedSpecsRan: true }));
  assert.ok(landOk.record, 'a partial with its own specs run opens the land');
  assert.match(deployNo.problem, /150\/469 \(319 not started\): a deploy needs all of them/);
  assert.match(asks(at({ passed: 150, total: 469, notStarted: 319, changedSpecsRan: false }))[0].problem, /a spec the lane changed that was not run/);
  assert.match(asks(at({ passed: 150, total: 469, notStarted: 318, changedSpecsRan: true }))[0].problem, /150\/469 with 318 not started/);
  assert.match(asks(at({ passed: 149, total: 469, failed: 1, notStarted: 319 }))[0].problem, /1 failed/);
  assert.equal(verdictOf({ sha: SHA, base: BASE, check: { pass: 4, total: 4 }, affected: at({ passed: 150, total: 469, notStarted: 319 }).affected, problems: [] }).replace(/[0-9a-f]{12}/g, 'X'),
    'PARTIAL X: check 4/4, affected 150/469 passed, 0 failed, 319 not started (budget) of X..X; fit to land, not to deploy or release');
});

test('a verb run whose budget ended with nothing red and the lane specs run is PARTIAL, exit 3; a changed spec that never ran is NOT VERIFIED', async (t) => {
  const partial = (changed) => ({ runAffected: (root) => ran(root, { ok: false, passed: 2, total: 5 }, { exit: { ...done, code: 2 }, unfinished: ['tests/x.spec.mjs', 'tests/y.spec.mjs', 'tests/z.spec.mjs'] }), changedSpecs: () => changed });
  const ok = await verify(t, partial(['tests/a.spec.mjs']));
  assert.equal(ok.out.code, 3, ok.out.text);
  assert.equal(ok.out.data.partial, true);
  assert.match(last(ok.out), /^PARTIAL aaaaaaaaaaaa: check 2301\/2301, affected 2\/5 passed, 0 failed, 3 not started \(budget\) of /);
  const found = readVerifyReceipt({ root: ok.root, sha: SHA, tree: 't'.repeat(40), base: BASE, need: 'land' });
  assert.equal(found.record.affected.notStarted, 3);
  const bad = await verify(t, partial(['tests/y.spec.mjs']));
  assert.equal(bad.out.code, 1);
  assert.match(last(bad.out), /^NOT VERIFIED /);
});

test('specs that ran in another tree are no proof here: the verb refuses a receipt that names no root or another one', async (t) => {
  const other = await verify(t, { runAffected: () => ran('/somewhere/else') });
  assert.match(last(other.out), /^NOT VERIFIED .*the affected specs ran in \/somewhere\/else, not in /);
  const none = await verify(t, { runAffected: () => ran(undefined) });
  assert.match(last(none.out), /ran in no named tree/);
});

test('the last line names the red files, caps the list, and a verified line never carries a problem', () => {
  const many = Array.from({ length: 15 }, (_, i) => `tests/f${i}.spec.mjs`);
  const line = verdictOf({ sha: SHA, base: BASE, problems: ['15 spec file(s) are red'], red: many });
  assert.match(line, /\[red: tests\/f0\.spec\.mjs, .*tests\/f11\.spec\.mjs and 3 more\]$/);
  assert.match(verdictOf({ sha: SHA, base: BASE, check: { pass: 1, total: 1 }, affected: { passed: 0, total: 0, reused: 0 }, problems: [] }), /^verified aaaaaaaaaaaa: check 1\/1, affected 0\/0 of /);
});

/** A host repository and a clone of it one commit ahead: the deploy-side reading of the receipt. */
function hostAndClone(t) {
  const root = mkdtemp(t, 'starci-verify-deploy-');
  const host = path.join(root, 'host'), clone = path.join(root, 'clone');
  fs.mkdirSync(host);
  git(host, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(host, 'a.txt'), '1\n');
  git(host, 'add', '-A');
  git(host, 'commit', '-q', '-m', 'base');
  git(root, 'clone', '-q', host, clone);
  fs.writeFileSync(path.join(clone, 'a.txt'), '2\n');
  git(clone, 'commit', '-q', '-am', 'change');
  return { root, host, clone, base: git(host, 'rev-parse', 'HEAD'), tip: git(clone, 'rev-parse', 'HEAD'), tree: git(clone, 'rev-parse', 'HEAD^{tree}') };
}

test('a deploy takes the verify receipt of the source clone for the host head, and nothing weaker', (t) => {
  const w = hostAndClone(t);
  const env = { STARCI_LOCAL_ROOT: path.join(w.root, 'state') };
  const ask = (over = {}) => receiptFor({ sha: w.tip, tree: w.tree, base: w.base, host: w.host, env, root: w.clone, ...over });
  assert.equal(ask(), null, 'no receipt, no proof');
  writeVerifyReceipt(w.clone, verifyRecord({ root: w.clone, sha: w.tip, tree: w.tree, base: w.base, check: { pass: 9, total: 9 }, affected: { passed: 4, total: 4, reused: 0 } }));
  assert.deepEqual([ask().via, ask().affected], ['verify-receipt', { base: w.base, tip: w.tip, root: w.clone, passed: 4, total: 4 }]);
  assert.equal(ask({ root: w.host }), null, 'the same receipt copied beside another tree names the root it ran in: not the proof of that tree');
  assert.equal(ask({ base: 'e'.repeat(40) }), null, 'a receipt proven against another host head is no proof for this one');
});

test('a land note is a deploy receipt only when it carries the affected proof for this host head; a note with the check alone is not', (t) => {
  const w = hostAndClone(t);
  git(w.host, 'fetch', '-q', w.clone, 'HEAD');
  const env = { STARCI_LOCAL_ROOT: path.join(w.root, 'state') };
  const ask = () => receiptFor({ sha: w.tip, tree: w.tree, base: w.base, host: w.host, env, root: w.host });
  const note = (...lines) => git(w.host, 'notes', '--ref=land', 'add', '-f', '-m', lines.join('\n'), w.tip);
  note(`Land-Verified: ${w.tip}`, 'Specs: 3/3', 'Check: 9/9');
  assert.equal(ask(), null, 'check alone is not a receipt');
  note(`Land-Verified: ${w.tip}`, 'Specs: 3/3', 'Check: 9/9', `Affected: 4/4 ${w.base}..${w.tip}`);
  assert.equal(ask().via, 'land-note');
  note(`Land-Verified: ${w.tip}`, 'Check: 9/9', `Affected: 3/4 ${w.base}..${w.tip}`);
  assert.equal(ask(), null, 'a partial affected run');
  note(`Land-Verified: ${w.tip}`, 'Check: 9/9', `Affected: 4/4 ${'f'.repeat(40)}..${w.tip}`);
  assert.equal(ask(), null, 'another base');
});
