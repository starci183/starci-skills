import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { resolveWorkspaceCheckout, validateWorkspaceCheckoutBinding, validateWorkspaceCheckoutRequest } from './workspace-checkout.mjs';
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
    f.write(path.join(f.selected, 'src', 'model.txt'), 'new committed change\n');
    git(f.selected, 'add', 'src/model.txt'); git(f.selected, 'commit', '-m', 'Later session head');
    assert.match(validateWorkspaceCheckoutBinding(f.runtime, request, bound, branchDir).join('\n'), /sourceHead differs/);
  } finally { f.dispose(); }
});
