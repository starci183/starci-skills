import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { installedTreeOf, junctionErrors, reflogErrors, resolveWorkspaceCheckout, sourceWriteErrors, validateWorkspaceCheckoutBinding, validateWorkspaceCheckoutRequest } from './workspace-checkout.mjs';
import { fixtureGit as git, workspaceCheckoutFixture } from './workspace-checkout-fixture.mjs';

test('routed remains canonical; session selects only its registered worktree and current head', () => {
  const f = workspaceCheckoutFixture();
  try {
    const routed = resolveWorkspaceCheckout({ ...f.options, checkout: 'routed' });
    assert.equal(routed.checkout.branch, 'main');
    assert.equal(routed.sourceHead, f.baseHead);
    assert.equal(routed.sessionCheckout, undefined);
    const selected = resolveWorkspaceCheckout(f.options);
    assert.equal(selected.checkout.diskPath, f.selected.replaceAll('\\', '/'));
    assert.equal(selected.checkout.branch, `session/${f.sessionId}`);
    assert.equal(selected.sourceHead, f.sessionHead);
    assert.equal(selected.sessionCheckout.canonicalSourceHead, f.baseHead);
    assert.equal(git(f.canonical, 'branch', '--show-current'), 'main');
    assert.equal(git(f.canonical, 'status', '--porcelain'), '');
    f.write(path.join(f.canonical, 'outside.md'), 'concurrent canonical change\n');
    git(f.canonical, 'add', 'outside.md'); git(f.canonical, 'commit', '-m', 'Canonical advances independently');
    const advanced = resolveWorkspaceCheckout(f.options);
    assert.equal(advanced.sourceHead, f.sessionHead);
    assert.notEqual(advanced.sessionCheckout.canonicalSourceHead, f.baseHead);
  } finally { f.dispose(); }
});

test('source route resolves its canonical Source and registered session with directory null', () => {
  const f = workspaceCheckoutFixture({ repositoryKind: 'source' });
  try {
    const routed = resolveWorkspaceCheckout({ ...f.options, checkout: 'routed' });
    assert.equal(routed.checkout.repositoryKind, 'source');
    assert.equal(routed.checkout.directory, null);
    assert.equal(routed.checkout.diskPath, f.source.replaceAll('\\', '/'));
    const selected = resolveWorkspaceCheckout(f.options);
    assert.equal(selected.checkout.repositoryKind, 'source');
    assert.equal(selected.checkout.directory, null);
    assert.equal(selected.sourceHead, f.sessionHead);
    assert.equal(selected.sessionCheckout.canonicalDiskPath, routed.checkout.diskPath);
    assert.equal(git(f.source, 'branch', '--show-current'), 'main');
  } finally { f.dispose(); }
});

test('session selection rejects absent, ambiguous, forbidden and wrong-source route declarations', () => {
  const f = workspaceCheckoutFixture();
  try {
    assert.throws(() => resolveWorkspaceCheckout({ ...f.options, sessionId: 'other-session' }), /exactly one registered/);
    const duplicate = path.join(f.temporary, 'duplicate');
    git(f.canonical, 'worktree', 'add', '--force', duplicate, `session/${f.sessionId}`);
    assert.throws(() => resolveWorkspaceCheckout(f.options), /exactly one registered/);
    git(f.canonical, 'worktree', 'remove', duplicate);
    f.portable.repository.gitPolicy.worktreeBranches = 'forbidden';
    f.local.repository.gitPolicy.worktreeBranches = 'forbidden'; f.saveRoutes();
    assert.throws(() => resolveWorkspaceCheckout(f.options), /forbidden worktree policy/);
    assert.equal(resolveWorkspaceCheckout({ ...f.options, checkout: 'routed' }).checkout.branch, 'main');
    f.local.source.path = f.canonical; f.saveRoutes();
    assert.throws(() => resolveWorkspaceCheckout(f.options), /another Source/);
  } finally { f.dispose(); }
});

test('Git-registered path replaced by foreign repository is refused even with matching origin and branch', () => {
  const f = workspaceCheckoutFixture();
  try {
    renameSync(f.selected, path.join(f.temporary, 'moved-worktree'));
    mkdirSync(f.selected);
    git(f.selected, 'init', '-b', `session/${f.sessionId}`);
    git(f.selected, 'remote', 'add', 'origin', f.origin);
    assert.throws(() => resolveWorkspaceCheckout(f.options), /not a registered worktree/);
  } finally { f.dispose(); }
});

test('session dirt is bounded by exact safe roots including both sides of renames; canonical dirt is refused', () => {
  const f = workspaceCheckoutFixture();
  try {
    f.write(path.join(f.selected, 'src', 'new file.txt'), 'new\n');
    assert.equal(resolveWorkspaceCheckout(f.options).mutationReadiness, 'ready');
    assert.throws(() => resolveWorkspaceCheckout({ ...f.options, declaredWriteRoots: [] }), /outside the declared write roots/);
    assert.throws(() => resolveWorkspaceCheckout({ ...f.options, declaredWriteRoots: ['../'] }), /safe repository-relative/);
    assert.throws(() => resolveWorkspaceCheckout({ ...f.options, declaredWriteRoots: [f.selected] }), /safe repository-relative/);
    git(f.selected, 'mv', 'outside.md', 'src/renamed.md');
    assert.throws(() => resolveWorkspaceCheckout(f.options), /outside the declared write roots/);
    git(f.selected, 'mv', 'src/renamed.md', 'outside.md');
    f.write(path.join(f.canonical, 'src', 'model.txt'), 'canonical dirt inside a permitted root\n');
    assert.throws(() => resolveWorkspaceCheckout(f.options), /canonical mutation checkout must be clean/);
  } finally { f.dispose(); }
});

test('dirty linked paths cannot borrow a declared root', () => {
  const f = workspaceCheckoutFixture();
  try {
    const outside = path.join(f.temporary, 'outside'); mkdirSync(outside);
    f.write(path.join(outside, 'dirty.txt'), 'outside data\n');
    symlinkSync(outside, path.join(f.selected, 'src', 'linked'), 'junction');
    assert.throws(() => resolveWorkspaceCheckout(f.options), /symbolic link/);
  } finally { f.dispose(); }
});

test('request and response gates reject forged selection and changed actual head; legacy is not rebound', () => {
  const f = workspaceCheckoutFixture();
  try {
    const request = { sessionId: f.sessionId, step: 1, parallel: 1, requirements: { project: f.project, role: f.role, checkout: 'session', declaredWriteRoots: ['src'] } };
    const branchDir = f.freezeRequest(request);
    const bound = resolveWorkspaceCheckout(f.options);
    assert.deepEqual(validateWorkspaceCheckoutRequest(f.runtime, request, branchDir), []);
    assert.deepEqual(validateWorkspaceCheckoutBinding(f.runtime, request, bound, branchDir), []);
    assert.match(validateWorkspaceCheckoutBinding(f.runtime, request, { ...bound, sessionCheckout: { ...bound.sessionCheckout, sessionId: 'other-session' } }, branchDir).join('\n'), /sessionCheckout differs/);
    assert.match(validateWorkspaceCheckoutBinding(f.runtime, request, { ...bound, checkout: { ...bound.checkout, diskPath: f.canonical } }, branchDir).join('\n'), /checkout differs/);
    const { sessionCheckout, ...unmarked } = bound;
    assert.match(validateWorkspaceCheckoutBinding(f.runtime, request, unmarked, branchDir).join('\n'), /requires a sessionCheckout/);
    assert.match(validateWorkspaceCheckoutBinding(f.runtime, { ...request, requirements: { ...request.requirements, checkout: 'routed' } }, bound).join('\n'), /requires checkout=session/);
    assert.deepEqual(validateWorkspaceCheckoutBinding(f.runtime, { requirements: {} }, unmarked), []);
    assert.match(validateWorkspaceCheckoutRequest(f.runtime, { ...request, requirements: { ...request.requirements, checkout: f.selected } }, branchDir).join('\n'), /routed or session/);
    assert.match(validateWorkspaceCheckoutRequest(f.runtime, { ...request, sessionId: 'other-session' }, branchDir).join('\n'), /outside its own session coordinate/);
    assert.match(validateWorkspaceCheckoutRequest(f.runtime, { ...request, sessionId: '../other-session' }, branchDir).join('\n'), /safe before resolving paths/);
    assert.match(validateWorkspaceCheckoutRequest(f.runtime, { ...request, step: '../2' }, branchDir).join('\n'), /safe before resolving paths/);
    assert.match(validateWorkspaceCheckoutRequest(f.runtime, { ...request, parallel: 2 }, branchDir).join('\n'), /outside its own session coordinate/);
    const stateFile = path.join(branchDir, '..', '..', 'state.json');
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    f.write(stateFile, { ...state, id: 'other-session' });
    assert.match(validateWorkspaceCheckoutRequest(f.runtime, request, branchDir).join('\n'), /containing session does not own/);
    f.write(stateFile, { ...state, requestHashes: {} });
    assert.match(validateWorkspaceCheckoutRequest(f.runtime, request, branchDir).join('\n'), /unchanged frozen request hash/);
    f.write(stateFile, state);
  } finally { f.dispose(); }
});

// A bind receipt is judged against the head it recorded. The chain that follows it commits on the same
// session branch, so by the time anyone re-validates the receipt the checkout has moved on; that is the
// chain working, not the binding being wrong.
test('a bind receipt survives the chain moving its head forward and is refused when the checkout moved elsewhere', () => {
  const f = workspaceCheckoutFixture();
  try {
    const request = { sessionId: f.sessionId, step: 1, parallel: 1, requirements: { project: f.project, role: f.role, checkout: 'session', declaredWriteRoots: ['src'] } };
    const branchDir = f.freezeRequest(request);
    const bound = resolveWorkspaceCheckout(f.options);
    f.write(path.join(f.selected, 'src', 'model.txt'), 'a later branch of the same chain\n');
    git(f.selected, 'add', 'src/model.txt'); git(f.selected, 'commit', '-m', 'Later session head');
    assert.deepEqual(validateWorkspaceCheckoutBinding(f.runtime, request, bound, branchDir), [], 'the recorded head is an ancestor of the head the chain reached');
    assert.match(validateWorkspaceCheckoutBinding(f.runtime, request, { ...bound, sourceHead: 'e'.repeat(40), checkout: { ...bound.checkout, sourceHead: 'e'.repeat(40) } }, branchDir).join('\n'), /neither the checkout's current head/);
    git(f.selected, 'checkout', '-q', '-b', 'sidetrack');
    assert.match(validateWorkspaceCheckoutBinding(f.runtime, request, bound, branchDir).join('\n'), /exactly one registered worktree/);
  } finally { f.dispose(); }
});

// The forbidden commands leave a trace, and this is the gate that reads it. `git stash push` resets
// HEAD, so its entry stays in the reflog even after the stash is dropped.
test('the reflog window accepts the branch own commits and refuses a stash, a drop and a reset', () => {
  const f = workspaceCheckoutFixture();
  try {
    const base = f.sessionHead;
    f.write(path.join(f.selected, 'src', 'model.txt'), 'the branch own write\n');
    git(f.selected, 'add', 'src/model.txt'); git(f.selected, 'commit', '-m', 'The branch own commit');
    const commit = git(f.selected, 'rev-parse', 'HEAD');
    const window = { since: base, sessionBranch: `session/${f.sessionId}`, until: commit, expected: 1 };
    assert.deepEqual(reflogErrors(f.selected, window), [], 'one commit on the session branch is the whole window');
    // A branch whose base is the head the worktree was created at: `git worktree add` writes an empty
    // entry and a `reset: moving to HEAD` at the bottom of the new reflog, and neither is the branch
    // doing anything.
    {
      const fresh = path.join(f.temporary, 'freshly-created-worktree');
      git(f.canonical, 'worktree', 'add', '--quiet', '-b', 'session/fresh', fresh);
      const freshBase = git(fresh, 'rev-parse', 'HEAD');
      f.write(path.join(fresh, 'src', 'model.txt'), 'the first thing this branch wrote\n');
      git(fresh, 'add', 'src/model.txt'); git(fresh, 'commit', '-q', '-m', 'The branch own commit');
      assert.deepEqual(reflogErrors(fresh, { since: freshBase, sessionBranch: 'session/fresh', until: git(fresh, 'rev-parse', 'HEAD'), expected: 1 }), [], 'the worktree coming into being is not the branch gaining an entry');
      git(f.canonical, 'worktree', 'remove', '--force', fresh);
    }
    assert.deepEqual(reflogErrors(null, window), [], 'a checkout a publish already removed leaves the live half unavailable');
    assert.match(reflogErrors(f.selected, { ...window, until: 'f'.repeat(40) }).join('\n'), /never made in this checkout/);
    assert.match(reflogErrors(f.selected, { ...window, since: 'f'.repeat(40) }).join('\n'), /window between the base and the commit cannot be read/);

    f.write(path.join(f.selected, 'src', 'model.txt'), 'work in progress\n');
    git(f.selected, 'stash', 'push', '-q', '-m', 'wip');
    git(f.selected, 'stash', 'drop', '-q');
    const stashed = reflogErrors(f.selected, { ...window, until: git(f.selected, 'rev-parse', 'HEAD') }).join('\n');
    assert.match(stashed, /reset: moving to HEAD/, 'the stash entry outlives the drop');
    assert.match(stashed, /forbidden inside a routed checkout/);

    git(f.selected, 'reset', '--hard', '-q', base);
    f.write(path.join(f.selected, 'src', 'model.txt'), 'written again after the reset\n');
    git(f.selected, 'add', 'src/model.txt'); git(f.selected, 'commit', '-m', 'The commit the receipt would name');
    const reset = reflogErrors(f.selected, { ...window, until: git(f.selected, 'rev-parse', 'HEAD'), expected: null }).join('\n');
    assert.match(reset, new RegExp(`reset: moving to ${base}`));
    assert.match(reset, /forbidden inside a routed checkout/);
  } finally { f.dispose(); }
});

// An installed tree shared through a junction is bound on purpose or not at all: a delete inside a
// checkout that holds one travels through the link into whatever else uses it.
test('a node_modules junction into another checkout is refused unless the request declares sharedInstall', () => {
  const f = workspaceCheckoutFixture();
  try {
    assert.equal(installedTreeOf(f.selected).label, 'absent');
    assert.deepEqual(junctionErrors(f.selected, {}), []);
    const shared = path.join(f.temporary, 'another-session-checkout', 'node_modules');
    mkdirSync(shared, { recursive: true });
    symlinkSync(shared, path.join(f.selected, 'node_modules'), 'junction');
    const installed = installedTreeOf(f.selected);
    assert.equal(installed.linked, true);
    assert.match(installed.label, /^junction to /);
    assert.match(junctionErrors(f.selected, {}).join('\n'), /sharedInstall: true/);
    assert.deepEqual(junctionErrors(f.selected, { sharedInstall: true }), [], 'a declared shared install binds');
    assert.deepEqual(junctionErrors(f.selected, { sharedInstall: 'true' }), [], 'the declared choice arrives as a string or a boolean');
    assert.throws(() => resolveWorkspaceCheckout(f.options), /shared with whatever else uses it/);
    assert.deepEqual(resolveWorkspaceCheckout({ ...f.options, sharedInstall: true }).checkout.branch, `session/${f.sessionId}`);
  } finally { f.dispose(); }
});

// The receipt half of the same law: the two marks and the preflight stamp are read wherever the receipt
// is, and the checkout is asked whenever it is still on disk.
test('a source-writing receipt states its preflight and the entries its checkout gained', () => {
  const f = workspaceCheckoutFixture();
  try {
    const base = f.sessionHead;
    f.write(path.join(f.selected, 'src', 'model.txt'), 'the branch own write\n');
    git(f.selected, 'add', 'src/model.txt'); git(f.selected, 'commit', '-m', 'The branch own commit');
    const commit = git(f.selected, 'rev-parse', 'HEAD');
    const entries = git(f.selected, 'reflog', 'show', '--format=%H', 'HEAD').split('\n').filter(Boolean).length;
    const wrote = git(f.selected, 'show', '-s', '--format=%cI', commit);
    const preflight = new Date(Date.parse(wrote) - 60000).toISOString().replace(/\.\d+Z$/, 'Z');
    const branch = `session/${f.sessionId}`;
    const binding = { Preflight: `passed at ${preflight}`, 'Reflog before': `HEAD ${entries - 1} ${base}; stash 0`, 'Reflog after': `HEAD ${entries} ${commit}; stash 0` };
    const call = (over = {}) => sourceWriteErrors({ at: 'response/changes.md', binding: { ...binding, ...over.binding }, base, commits: [commit], branch, checkout: f.selected, ...over.rest });

    assert.deepEqual(call(), [], 'a clean commit with a preflight before it passes');
    assert.deepEqual(sourceWriteErrors({ at: 'response/changes.md', binding, base, commits: [commit], branch, status: 'blocked' }), [], 'a blocked branch is judged on its stop');
    assert.match(call({ binding: { Preflight: undefined } }).join('\n'), /records no Preflight/);
    assert.match(call({ binding: { Preflight: 'ran before the write' } }).join('\n'), /is not `<passed\|failed> at/);
    assert.match(call({ binding: { Preflight: `passed at ${new Date(Date.parse(wrote) + 60000).toISOString().replace(/\.\d+Z$/, 'Z')}` } }).join('\n'), /before the preflight this receipt records/);
    assert.match(call({ binding: { 'Reflog after': undefined } }).join('\n'), /carries no Reflog after/);
    assert.match(call({ binding: { 'Reflog before': `HEAD ${entries - 1} ${'d'.repeat(40)}; stash 0` } }).join('\n'), /at dispatch the checkout stood on the branch's base/);
    assert.match(call({ binding: { 'Reflog after': `HEAD ${entries + 1} ${commit}; stash 0` } }).join('\n'), /gained 2 entries while the branch made 1 commit/);
    assert.match(call({ binding: { 'Reflog after': `HEAD ${entries} ${commit}; stash 1` } }).join('\n'), /stash reflog went from 0 to 1 entries/);
  } finally { f.dispose(); }
});
