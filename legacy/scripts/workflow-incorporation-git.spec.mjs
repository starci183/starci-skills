// Real Git boundary tests only. These helpers neither open an operator nor represent accepted
// product execution; coordination authority and current acceptance are tested by separate suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sharedSourceIntent, sharedSourceResult } from './workspace-checkout.mjs';

const put = (file, bytes) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, bytes); };
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitInput = (cwd, input, ...args) => execFileSync('git', ['-C', cwd, ...args], { input, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const status = cwd => git(cwd, 'status', '--porcelain=v1', '--untracked-files=all');
const head = cwd => git(cwd, 'rev-parse', 'HEAD');
const commit = (cwd, message) => { git(cwd, 'add', '--all'); git(cwd, 'commit', '-qm', message); return head(cwd); };
const quoted = file => "'" + file.replaceAll('\\', '/').replaceAll("'", "'\\''") + "'";

function fixture(t, producerChange = null) {
  const home = mkdtempSync(path.join(tmpdir(), 'starci-incorporation-git-'));
  t.after(() => { assert.ok(path.resolve(home).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(home, { recursive: true, force: true }); });
  const repository = path.join(home, 'repository'), hooks = path.join(home, 'hooks'); mkdirSync(repository); mkdirSync(hooks);
  git(repository, 'init', '-q'); git(repository, 'config', 'user.name', 'Disposable Git fixture'); git(repository, 'config', 'user.email', 'fixture@example.invalid'); git(repository, 'config', 'commit.gpgsign', 'false'); git(repository, 'config', 'core.hooksPath', hooks);
  put(path.join(repository, 'src/shared/value.mjs'), "export const value = 'base';\n");
  put(path.join(repository, 'src/consumer/value.mjs'), "export const consumer = 'base';\n");
  put(path.join(repository, 'outside.txt'), 'outside base\n');
  const base = commit(repository, 'Fixture base');
  const producer = path.join(home, 'producer'), consumer = path.join(home, 'consumer');
  git(repository, 'worktree', 'add', '--quiet', '-b', 'session/producer', producer, base);
  git(repository, 'worktree', 'add', '--quiet', '-b', 'session/consumer', consumer, base);
  let stagedOnly = false;
  if (producerChange) stagedOnly = producerChange({ producer, consumer, repository, base })?.stagedOnly === true;
  else put(path.join(producer, 'src/shared/value.mjs'), "export const value = 'shared';\n");
  if (stagedOnly) git(producer, 'commit', '-qm', 'Declared shared source');
  const sourceHead = stagedOnly ? head(producer) : commit(producer, 'Declared shared source');
  put(path.join(consumer, 'src/consumer/value.mjs'), "export const consumer = 'independent';\n");
  const oldHead = commit(consumer, 'Independent consumer contribution');
  const hook = (name, body) => { const file = path.join(hooks, name); put(file, '#!/bin/sh\nset -eu\n' + body + '\n'); chmodSync(file, 0o755); return file; };
  const intent = () => ({ ...sharedSourceIntent(consumer, sourceHead, ['src/shared']), message: `Consume exact shared source ${sourceHead}` });
  const mergeHead = () => { try { return git(consumer, 'rev-parse', '--verify', 'MERGE_HEAD'); } catch { return null; } };
  return { home, repository, hooks, producer, consumer, base, sourceHead, oldHead, hook, intent, mergeHead };
}

function failingCommitHook(f) {
  const allow = path.join(f.home, 'allow-commit'), log = path.join(f.home, 'pre-commit-runs');
  f.hook('pre-commit', `printf 'checked\\n' >> ${quoted(log)}\nif [ ! -f ${quoted(allow)} ]; then printf 'fixture policy refused commit\\n' >&2; exit 1; fi`);
  // Git's merge hook delegates to the same configured pre-commit policy; retrying with a normal
  // commit must call it again. No -c core.hooksPath override or --no-verify is used by the boundary.
  f.hook('pre-merge-commit', 'exec "$(dirname "$0")/pre-commit"');
  return { allow, log, permit: () => put(allow, 'reviewed\n') };
}

test('configured pre-commit failure retains the exact pending merge and normal retry runs the hook again', t => {
  const f = fixture(t), intent = f.intent(), policy = failingCommitHook(f);
  assert.throws(() => sharedSourceResult(f.consumer, intent, { execute: true }), /COORDINATION_MERGE_FAILED/);
  assert.equal(head(f.consumer), intent.oldHead); assert.equal(f.mergeHead(), intent.sourceHead); assert.equal(git(f.consumer, 'write-tree'), intent.tree);
  assert.equal(readFileSync(policy.log, 'utf8'), 'checked\n');
  policy.permit();
  const result = sharedSourceResult(f.consumer, intent, { execute: true });
  assert.deepEqual(result.parents, [intent.oldHead, intent.sourceHead]); assert.equal(result.tree, intent.tree); assert.equal(status(f.consumer), ''); assert.equal(f.mergeHead(), null);
  assert.equal(readFileSync(policy.log, 'utf8'), 'checked\nchecked\n', 'the retry obeys the same repository policy');
  assert.equal(sharedSourceResult(f.consumer, intent).head, result.head, 'read-only recovery measures the completed merge without another commit');
});

test('tracked, staged and untracked edits between frozen intent and initial execution are refused without mutation', async t => {
  for (const edit of ['tracked', 'staged', 'untracked']) await t.test(edit, t => {
    const f = fixture(t), intent = f.intent(), file = path.join(f.consumer, edit === 'untracked' ? 'local-user-work.txt' : 'src/consumer/value.mjs');
    put(file, 'preserve the user edit\n'); if (edit === 'staged') git(f.consumer, 'add', '--', path.relative(f.consumer, file));
    const before = status(f.consumer);
    assert.throws(() => sharedSourceResult(f.consumer, intent, { execute: true }), /COORDINATION_DIRTY/);
    assert.equal(head(f.consumer), intent.oldHead); assert.equal(f.mergeHead(), null); assert.equal(status(f.consumer), before); assert.equal(readFileSync(file, 'utf8'), 'preserve the user edit\n');
  });
});

test('intervening work after a failed hook is preserved and refused before a retry commits anything', async t => {
  for (const edit of ['tracked', 'staged', 'untracked']) await t.test(edit, t => {
    const f = fixture(t), intent = f.intent(), policy = failingCommitHook(f);
    assert.throws(() => sharedSourceResult(f.consumer, intent, { execute: true }), /COORDINATION_MERGE_FAILED/);
    const file = path.join(f.consumer, edit === 'untracked' ? 'local-user-work.txt' : 'src/consumer/value.mjs');
    put(file, 'intervening owner edit\n'); if (edit === 'staged') git(f.consumer, 'add', '--', path.relative(f.consumer, file)); policy.permit();
    const before = status(f.consumer), staged = git(f.consumer, 'write-tree');
    assert.throws(() => sharedSourceResult(f.consumer, intent, { execute: true }), /COORDINATION_(?:DIRTY|INCORPORATION)/);
    assert.equal(head(f.consumer), intent.oldHead, 'refusal must precede any retry commit'); assert.equal(f.mergeHead(), intent.sourceHead); assert.equal(git(f.consumer, 'write-tree'), staged); assert.equal(status(f.consumer), before); assert.equal(readFileSync(file, 'utf8'), 'intervening owner edit\n');
  });
});

test('a consumer HEAD changed after intent is refused and its new commit remains untouched', t => {
  const f = fixture(t), intent = f.intent(); put(path.join(f.consumer, 'src/consumer/new.mjs'), 'export const later = true;\n');
  const changed = commit(f.consumer, 'Owner continued independently');
  assert.throws(() => sharedSourceResult(f.consumer, intent, { execute: true }), /COORDINATION_INCORPORATION.*parents/);
  assert.equal(head(f.consumer), changed); assert.equal(f.mergeHead(), null); assert.equal(status(f.consumer), '');
});

test('normal hooks that alter the merge tree, message or checkout cannot earn completion and their effects are retained', async t => {
  for (const mutation of ['tree', 'message', 'checkout']) await t.test(mutation, t => {
    const f = fixture(t), intent = f.intent();
    if (mutation === 'tree') {
      const policy = failingCommitHook(f);
      assert.throws(() => sharedSourceResult(f.consumer, intent, { execute: true }), /COORDINATION_MERGE_FAILED/); policy.permit();
      f.hook('pre-commit', "printf 'hook-owned staged content\\n' > src/shared/hook.txt\ngit add -- src/shared/hook.txt");
    }
    if (mutation === 'message') f.hook('commit-msg', "printf 'Hook replaced the frozen consumption message\\n' > \"$1\"");
    if (mutation === 'checkout') f.hook('post-merge', "printf 'hook-owned local content\\n' > local-hook-work.txt");
    let failure; try { sharedSourceResult(f.consumer, intent, { execute: true }); } catch (error) { failure = error; }
    assert.match(failure?.message ?? 'No refusal occurred', mutation === 'tree' ? /COORDINATION_INCORPORATION.*tree/ : mutation === 'message' ? /COORDINATION_INCORPORATION.*message/ : /COORDINATION_DIRTY/);
    const actual = head(f.consumer); assert.notEqual(actual, intent.oldHead, 'the real hook affected a real Git merge, which is retained for owner inspection');
    assert.deepEqual(git(f.consumer, 'show', '-s', '--format=%P', actual).split(' '), [intent.oldHead, intent.sourceHead]);
    if (mutation === 'tree') assert.equal(git(f.consumer, 'show', `${actual}:src/shared/hook.txt`), 'hook-owned staged content');
    if (mutation === 'message') assert.equal(git(f.consumer, 'show', '-s', '--format=%B', actual), 'Hook replaced the frozen consumption message');
    if (mutation === 'checkout') assert.equal(readFileSync(path.join(f.consumer, 'local-hook-work.txt'), 'utf8'), 'hook-owned local content\n');
    assert.throws(() => sharedSourceResult(f.consumer, intent), /COORDINATION_(?:INCORPORATION|DIRTY)/);
    assert.equal(head(f.consumer), actual, 'read-only recovery never rewrites an unrecognized result');
  });
});

test('outside-root additions, deletions and both sides of renames are rejected before checkout mutation', async t => {
  for (const mutation of ['add', 'delete', 'rename-in', 'rename-out']) await t.test(mutation, t => {
    const f = fixture(t, ({ producer }) => {
      if (mutation === 'add') put(path.join(producer, 'unowned.txt'), 'unowned addition\n');
      if (mutation === 'delete') git(producer, 'rm', '--', 'outside.txt');
      if (mutation === 'rename-in') git(producer, 'mv', '--', 'outside.txt', 'src/shared/from-outside.txt');
      if (mutation === 'rename-out') git(producer, 'mv', '--', 'src/shared/value.mjs', 'outside-renamed.mjs');
    });
    assert.throws(() => f.intent(), /COORDINATION_INCORPORATION.*transferred roots/);
    assert.equal(head(f.consumer), f.oldHead); assert.equal(status(f.consumer), ''); assert.equal(f.mergeHead(), null);
  });
});

test('a real Git symlink entry is rejected even when its path is inside the transferred root', t => {
  const f = fixture(t, ({ producer }) => {
    const blob = gitInput(producer, '../../outside.txt', 'hash-object', '-w', '--stdin');
    git(producer, 'update-index', '--add', '--cacheinfo', `120000,${blob},src/shared/link`);
    // On Windows Git may materialize a tracked symlink as a plain file. The indexed mode is the
    // source authority, so use an actual commit without asking the host for symlink privileges.
    return { stagedOnly: true };
  });
  assert.match(git(f.producer, 'ls-tree', f.sourceHead, '--', 'src/shared/link'), /^120000/);
  assert.throws(() => f.intent(), /COORDINATION_INCORPORATION.*symlinks/);
  assert.equal(head(f.consumer), f.oldHead); assert.equal(status(f.consumer), ''); assert.equal(f.mergeHead(), null);
});

test('a real content conflict is detected by intent without changing checkout, index or refs', t => {
  const f = fixture(t); put(path.join(f.consumer, 'src/shared/value.mjs'), "export const value = 'consumer-conflict';\n");
  const before = commit(f.consumer, 'Consumer owns a conflicting shared edit'), tree = git(f.consumer, 'write-tree');
  assert.throws(() => f.intent(), /COORDINATION_CONFLICT/);
  assert.equal(head(f.consumer), before); assert.equal(git(f.consumer, 'write-tree'), tree); assert.equal(f.mergeHead(), null); assert.equal(status(f.consumer), '');
  assert.equal(readFileSync(path.join(f.consumer, 'src/shared/value.mjs'), 'utf8'), "export const value = 'consumer-conflict';\n");
});
