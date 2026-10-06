// role-rights.spec.mjs - R223 command policy tables for every role, role resolution, and the PreToolUse entry.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commandsOf, hookDecision } from '../../scripts/guards/command-guard.mjs';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';
import { gitListFormRead, gitSubOf, nodeWholeSuite, pushTargets, rightsRoleOf } from '../../scripts/guards/rights.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = loadCommandPolicy({ root: ROOT });
const CWD = path.resolve(os.tmpdir(), 'rights-cwd');
const OP = { role: 'op', workflowId: 'wf-1', jobId: 'j1', op: 'backend.implement', workflowWorktree: null, owned: [] };
const UNIT_VERIFY = { ...OP, op: 'unit.verify' };
const E2E_VERIFY = { ...OP, op: 'e2e.verify' };
const HANDLE = 'term-rights-1';
const GUARDED = ['op', 'lead', 'supervisor', 'coordinator'];

const allow = (commands) => commands.map((text) => ({ text, code: null }));
const deny = (code, use, commands) => commands.map((text) => ({ text, code, use }));
const roleAllow = (code, use, roles, commands) => commands.map((text) => ({ text, code, use, roles }));

const CASES = [
  ...allow([
    'git status', 'git status --short', 'git log --oneline -5', 'git diff --stat', 'git diff HEAD', 'git show HEAD', 'git rev-parse HEAD', 'git ls-files',
    'git ls-tree HEAD', 'git cat-file -t HEAD', 'git blame README.md', 'git grep policy', 'git describe --always', 'git shortlog -sn', 'git rev-list HEAD',
    'git merge-base HEAD main', 'git for-each-ref refs/heads', 'git name-rev HEAD', 'git ls-remote origin', 'git show-ref', 'git check-ignore file',
    'git diff-tree HEAD', 'git diff-index HEAD', 'git diff-files', 'git count-objects', 'git whatchanged -1', 'git version', 'git help status', 'git var GIT_AUTHOR_IDENT',
    'git verify-commit HEAD', 'git verify-tag v1', 'git range-diff main...HEAD', 'git cherry main', 'git show-branch',
    'git branch', 'git branch --list', 'git branch -l lane/*', 'git branch -a', 'git branch -r', 'git branch -v', 'git branch --show-current',
    'git branch --contains HEAD', 'git branch --merged main', 'git branch --points-at HEAD', 'git tag', 'git tag -l', 'git tag --list v*',
    'git tag -v v1', 'git tag --points-at HEAD', 'git tag --contains HEAD', 'git tag --merged main', 'git tag -n3', 'git stash list',
    "git stash show 'stash@{0}'", 'git worktree list', 'git remote', 'git remote -v', 'git remote show origin', 'git remote get-url origin',
    'git config --get user.name', 'git config --get-all remote.origin.fetch', 'git config --get-regexp ^remote', 'git config --list', 'git config -l',
    'git config --show-origin --get user.email', 'git reflog', 'git reflog show HEAD', 'git notes list', 'git notes show HEAD',
    'ls -la', 'dir', 'cat package.json', 'type package.json', 'head -n 2 README.md', 'tail -n 2 README.md', 'wc -l README.md', 'rg policy scripts',
    'grep -n policy README.md', 'pwd', 'which node', 'where node', 'whoami', 'hostname', 'stat package.json', 'realpath package.json', 'dirname scripts/x.mjs',
    'basename scripts/x.mjs', 'date', 'true', 'false', 'test -f package.json', 'jq . package.json', 'Get-Content package.json', 'Get-ChildItem scripts',
    'Select-String policy README.md', 'Test-Path package.json', 'Resolve-Path package.json', 'Get-Location', 'Write-Output ok', 'Measure-Object README.md',
    'find . -name package.json', "sed -n '1p' README.md", 'sort README.md', "awk '{print $1}' README.md", 'xargs echo', 'eslint scripts/guards/rights.mjs',
    'stylelint styles.css', 'tsc --noEmit', 'prettier --check README.md', 'mkdir out', "sed -i 's/a/b/' file", 'cp a b', 'mv a b', 'rm file.txt', 'touch file.txt',
    'npm view yaml version', 'npm info yaml', 'npm show yaml', 'npm ls', 'npm list', 'npm outdated', 'npm explain yaml', 'npm root', 'npm prefix',
    'npm help view', 'npm search yaml', 'npm whoami', 'npm ping', 'npm -v', 'npm --version', 'npm config get registry', 'npm config list', 'npm pack --dry-run',
    'npm ci --dry-run', 'node --version', 'node -v', 'node --check scripts/guards/rights.mjs', 'node -c scripts/guards/rights.mjs',
    'starci git commit', 'starci gate unit',
    'orca orchestration check', 'orca orchestration worker-show --dispatch d1', 'orca orchestration worker-list', 'orca orchestration worker-read --dispatch d1',
    'orca terminal list', 'orca terminal read --terminal t1', 'orca worktree list', 'orca worktree show --worktree active', 'orca repo list', 'orca repo show --repo id:r1',
  ]),
  ...deny('RIGHTS_GIT_COMMIT', /^starci git commit/, [
    'git commit -m x', 'git commit --amend', 'git add .', 'git add -A', 'git rm file', 'git rm --cached file', 'git mv a b', 'git -C repo commit -m x',
  ]),
  ...deny('RIGHTS_GIT_PUSH', /^starci git backup/, [
    'git push', 'git push origin', 'git push origin main', 'git push -u origin lane/x', 'git push --force origin main', 'git push --all origin',
    'git push --mirror origin', 'git push --tags origin', 'git push --follow-tags origin', 'git push --prune origin', 'git push origin HEAD:refs/heads/main',
  ]),
  ...roleAllow('RIGHTS_GIT_PUSH', /^starci git backup/, ['supervisor', 'coordinator'], [
    'git push origin HEAD:refs/backup/2026-10-03/main', 'git push origin main:refs/backup/lane', 'git push origin +abc123:refs/backup/a refs/heads/x:refs/backup/b',
  ]),
  ...deny('RIGHTS_GIT_TAG', /^starci release cut/, [
    'git tag v1.0.0', 'git tag -a v1.0.0 -m release', 'git tag -d v1.0.0', 'git tag -f v1 HEAD', 'git tag -s v2 -m x',
  ]),
  ...deny('RIGHTS_GIT_SYNC', /^starci (?:git sync|worker start)/, [
    'git merge main', 'git rebase main', 'git checkout main', 'git checkout -- file', 'git switch main', 'git reset --hard', 'git reset HEAD~1',
    'git restore file', 'git clean -fd', 'git stash push', 'git stash pop', 'git worktree add ../wt HEAD', 'git worktree remove ../wt',
    'git branch lane/new', 'git branch -d lane/old', 'git fetch origin', 'git pull', 'git config user.name x', 'git remote add origin x',
    'git reflog expire --all', 'git notes add -m x HEAD', 'git cherry-pick HEAD~1', 'git revert HEAD', 'git apply patch.diff', 'git update-ref refs/x HEAD',
    'git submodule update', 'git clone repo', 'git init', 'git commit-tree HEAD^{tree}',
  ]),
  ...deny('RIGHTS_RELEASE_CUT', /^starci release cut/, [
    'starci release cut', 'starci release publish', ['npm', 'run', 'release:cut'].join(' '), ['npm', 'run', 'release:publish'].join(' '), 'node scripts/supervisor/release-cut.mjs',
  ]),
  ...deny('RIGHTS_NPM_PUBLISH', /^starci release (?:cut|publish)/, [
    'npm publish', 'npm publish --access public', 'pnpm publish', 'yarn publish', 'npm unpublish pkg', 'npm deprecate pkg old', 'npm dist-tag add pkg@1 latest',
    'npm run publish', 'npm run publish:packages', 'npm run publish-packages', ['npm', 'run', 'release:publish:dry'].join(' '),
  ]),
  ...deny('RIGHTS_SUITE_RUN', /^starci test run/, [
    'npm test', 'npm t', 'npm run test', 'pnpm test', 'yarn test', 'npm test -- --coverage', 'npm run test -- --runInBand',
  ]),
  ...deny('RIGHTS_NPM_CI_UNLOCKED', /^starci npm ci/, [
    'npm ci', 'npm clean-install', 'npm install-clean', 'npm cit', 'npm install-ci-test', 'pnpm ci', 'yarn ci',
  ]),
  ...deny('RIGHTS_RAW_TOOL', /starci|owner/, [
    'npm install', 'npm i yaml', 'npm add yaml', 'npm update', 'npm uninstall yaml', 'npm run build', 'npm run lint', 'npm start', 'npm exec jest',
    ['node', 'scripts/kernel/cli.mjs', 'report'].join(' '), ['api', 'report'].join(' '), ['hfs', 'sync'].join(' '),
    'pnpm build', 'yarn lint', 'bun run build', 'node scripts/x.mjs', 'node -e console.log(1)', 'node --eval=1', 'node -p process.version', 'node -e x --version',
    'docker', 'docker compose up -d', 'docker-compose up', 'podman run x', 'kubectl apply -f x', 'k3d cluster create x', 'supabase start',
    'gh pr create', 'schtasks /create /tn x', 'shutdown /s', 'reboot', 'jest', 'npx jest', 'vitest run', 'mocha', 'playwright test',
    'npx playwright test', 'cypress run', 'pytest', 'turbo run build', 'nest build', 'curl https://example.test', 'wget https://example.test',
    'ssh host', 'scp a host:b', 'orca orchestration worker-start --agent codex', 'orca orchestration dispatch --task t1',
    'orca terminal create --command codex', 'orca terminal send --terminal t1 --text hi', 'orca worktree create --name x', 'python x.py', 'cargo build',
  ]),
  ...deny('RIGHTS_RAW_TOOL', /read-only/, [
    'find . -delete', 'sort -o out file', "awk -i inplace '{print}' file", 'eslint --fix file', 'prettier --write file',
    'stylelint --fix file', 'tsc -p tsconfig.json', 'prettier file',
  ]),
  ...deny('RIGHTS_SUITE_RUN', /explicit spec|release cut/, [
    'node --test', 'node --test tests/', 'node --test "tests/**/*.spec.mjs"', 'node --import ./tests/setup/low-priority.mjs --test "tests/**"',
  ]),
  ...roleAllow('RIGHTS_RAW_TOOL', /^starci gate unit/, ['lead', 'supervisor', 'coordinator'], [
    'node --test tests/x.spec.mjs', 'node --import ./tests/setup/low-priority.mjs --test tests/y.spec.mjs',
  ]),
];

const decisionOf = (role, text, { guard = role === 'op' ? OP : null, handle = HANDLE, lock = null } = {}) => {
  for (const command of commandsOf(text, { cwd: CWD, env: {} })) {
    const verdict = policyVerdict({ role, command, guard, handle, lockOwner: () => lock, policy: POLICY });
    if (verdict) return verdict;
  }
  return null;
};

test('role table contains enough command cases', () => {
  assert.ok(CASES.length >= 120, `the role table has ${CASES.length} command texts`);
});

for (const role of [...GUARDED, 'release', 'owner']) {
  test(`${role} command policy: ${CASES.length} command texts`, () => {
    const policyRole = role === 'owner' ? null : role;
    for (const row of CASES) {
      const verdict = decisionOf(policyRole, row.text);
      const expected = role === 'owner' || role === 'release' || row.code == null || row.roles?.includes(role) ? null : row.code;
      assert.equal(verdict?.code ?? null, expected, `${role}: ${row.text}`);
      if (expected && row.use) assert.match(verdict.use, row.use, `${role}: ${row.text} names the allowed path`);
    }
  });
}

test('unit.verify and e2e.verify are the only op guards that may run a whole suite', () => {
  for (const text of ['npm test', 'npm run test', 'node --test', 'node --test "tests/**/*.spec.mjs"']) {
    assert.equal(decisionOf('op', text, { guard: OP })?.code, 'RIGHTS_SUITE_RUN', text);
    assert.equal(decisionOf('op', text, { guard: UNIT_VERIFY }), null, `unit.verify: ${text}`);
    assert.equal(decisionOf('op', text, { guard: E2E_VERIFY }), null, `e2e.verify: ${text}`);
  }
});

test('a clean install passes only while this handle or the release role owns the live host lock', () => {
  const live = (extra = {}) => ({ pid: 4242, role: 'coordinator', handle: HANDLE, stale: false, ...extra });
  for (const role of GUARDED) {
    assert.equal(decisionOf(role, 'npm ci', { lock: null })?.code, 'RIGHTS_NPM_CI_UNLOCKED');
    assert.equal(decisionOf(role, 'npm ci', { lock: live({ handle: 'other' }) })?.code, 'RIGHTS_NPM_CI_UNLOCKED');
    assert.equal(decisionOf(role, 'npm ci', { lock: live({ stale: true }) })?.code, 'RIGHTS_NPM_CI_UNLOCKED');
    assert.equal(decisionOf(role, 'npm ci', { lock: live() }), null);
    assert.equal(decisionOf(role, 'npm ci', { lock: live({ role: 'release', handle: 'other' }) }), null);
  }
});

test('role resolution: a bound guard or seat outranks a claim and release needs its live lock', () => {
  const owner = (role, stale = false) => ({ role, stale, pid: 1 });
  assert.equal(rightsRoleOf({ guard: { role: 'kernel' } }), 'lead');
  assert.equal(rightsRoleOf({ guard: { role: 'op', workflowId: 'wf-1' } }), 'op');
  assert.equal(rightsRoleOf({ guard: { role: 'op', workflowId: 'supervisor' } }), 'supervisor');
  assert.equal(rightsRoleOf({ seat: { role: 'supervisor' } }), 'supervisor');
  assert.equal(rightsRoleOf({ env: { STARCI_ROLE: 'coordinator' } }), 'coordinator');
  assert.equal(rightsRoleOf({ env: { STARCI_ROLE: 'LEAD' } }), 'lead');
  assert.equal(rightsRoleOf({ env: {} }), null);
  assert.equal(rightsRoleOf({ env: { STARCI_ROLE: 'release' }, lockOwner: owner('release') }), 'release');
  assert.equal(rightsRoleOf({ env: { STARCI_ROLE: 'release' }, lockOwner: owner('release', true) }), null);
  assert.equal(rightsRoleOf({ env: { STARCI_ROLE: 'release' }, lockOwner: owner('coordinator') }), null);
  assert.equal(rightsRoleOf({ guard: { role: 'op', workflowId: 'wf-1' }, env: { STARCI_ROLE: 'coordinator' } }), 'op');
});

test('git list-form, global-option, push-target, and node-suite parsers cover their structural cases', () => {
  assert.deepEqual(gitSubOf(['-C', 'x', '-c', 'a=b', '--no-pager', 'push', 'origin']), { sub: 'push', rest: ['origin'] });
  assert.deepEqual(pushTargets(['origin', '+a:refs/backup/b']), { remote: 'origin', refs: ['refs/backup/b'], broad: false });
  assert.equal(pushTargets(['--tags', 'origin', 'x:refs/backup/x']).broad, true);
  assert.equal(gitListFormRead('branch', ['--list', 'lane/*']), true);
  assert.equal(gitListFormRead('branch', ['lane/x']), false);
  assert.equal(gitListFormRead('tag', ['-a', 'v1']), false);
  assert.equal(nodeWholeSuite(['--test']), true);
  assert.equal(nodeWholeSuite(['--import', './tests/setup/x.mjs', '--test', 'tests/a.spec.mjs']), false);
});

const bind = (kind, handle, body) => {
  const dir = path.join(process.env.STARCI_GUARDS_ROOT, kind);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${handle}.json`), JSON.stringify(body));
};
const call = (tool, input, cwd) => ({ tool_name: tool, cwd, tool_input: input });

test('the hook enforces the policy by job guard, seat guard and claimed role, while an unbound handle is the owner', async (t) => {
  const cwd = mkdtemp(t, 'rights-hook-');
  const run = (handle, command, env = {}) => hookDecision(call('Bash', { command }, cwd), { env: { ...process.env, ORCA_TERMINAL_HANDLE: handle, STARCI_ROLE: '', ...env } });
  bind('terminals', 'hk-op', OP);
  bind('terminals', 'hk-kernel', { schema: 'starci/op-guard@1', role: 'kernel', jobId: 'k1', workflowId: 'wf-1', owned: [] });
  bind('seats', 'hk-sup', { schema: 'starci/seat-guard@1', role: 'supervisor', terminal: 'hk-sup', deniedTools: [] });
  assert.equal((await run('hk-op', 'git push origin main')).verdict.code, 'RIGHTS_GIT_PUSH');
  assert.equal((await run('hk-op', 'docker compose up -d')).verdict.code, 'RIGHTS_RAW_TOOL');
  assert.equal((await run('hk-kernel', 'npm publish')).verdict.code, 'RIGHTS_NPM_PUBLISH');
  assert.equal((await run('hk-sup', 'git tag v1')).verdict.code, 'RIGHTS_GIT_TAG');
  assert.equal(await run('hk-sup', 'git push origin HEAD:refs/backup/x'), null);
  assert.equal((await run('', 'git push origin main', { STARCI_ROLE: 'coordinator' })).verdict.code, 'RIGHTS_GIT_PUSH');
  assert.equal(await run('', 'git push origin main'), null);
  assert.equal(await run('hk-none', 'git push origin main'), null);
});

test('a live release lock makes the release claim unrestricted; without it the unbound session is the owner', async (t) => {
  const cwd = mkdtemp(t, 'rights-release-');
  const lockDir = mkdtemp(t, 'rights-lock-');
  const env = { ...process.env, ORCA_TERMINAL_HANDLE: '', STARCI_ROLE: 'release', STARCI_HOST_LOCK_DIR: path.join(lockDir, 'lock') };
  const claim = () => hookDecision(call('Bash', { command: 'git tag v9.9.9' }, cwd), { env });
  assert.equal(await claim(), null);
  const lock = await import('../../scripts/machine/host-lock.mjs');
  const got = lock.acquireHostLock({ role: 'release', purpose: 'release-cut', env });
  assert.equal(got.ok, true);
  assert.equal(await claim(), null);
  lock.releaseHostLock({ token: got.token, env });
});

test('Edit and Write calls of a session with no role pass untouched', async (t) => {
  const cwd = mkdtemp(t, 'rights-edit-');
  assert.equal(await hookDecision(call('Edit', { file_path: path.join(cwd, 'x.txt'), old_string: 'a', new_string: 'b' }, cwd),
    { env: { ...process.env, ORCA_TERMINAL_HANDLE: '', STARCI_ROLE: '' } }), null);
});

test('the hot-path subset of read-only programs is a subset of the table: one source of truth', async () => {
  const { intrinsicPolicyRead, loadCommandPolicy } = await import('../../scripts/guards/command-policy.mjs');
  const policy = loadCommandPolicy();
  assert.ok(policy, 'the real table loads');
  const known = new Set([...policy.read, ...Object.keys(policy['guarded-read']), ...policy['scoped-write'], ...Object.keys(policy['raw-tools']), 'git', 'npm', 'node', 'orca', 'starci', 'sed', 'find', 'docker']);
  for (const program of known) {
    if (intrinsicPolicyRead({ program })) assert.ok(policy.read.includes(program), `${program} is on the hot path but not in the read list of modules/kernel/command-policy.yaml`);
  }
  assert.equal(intrinsicPolicyRead({ program: 'ls' }), true);
  for (const program of ['sed', 'find', 'git', 'node', 'rm', 'tee', 'sort']) assert.equal(intrinsicPolicyRead({ program }), false, program);
});
