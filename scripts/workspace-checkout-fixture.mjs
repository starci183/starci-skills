// Synthetic repositories only; never reads or changes an installed product route.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const fixtureGit = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export function workspaceCheckoutFixture({ attachRuntime = false, repositoryKind = 'sibling' } = {}) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'workspace-checkout-'));
  const source = path.join(temporary, 'source');
  const runtime = path.join(source, '.claude');
  const canonical = repositoryKind === 'source' ? source : path.join(temporary, 'declared-repository');
  const selected = path.join(temporary, 'unrelated-directory-name');
  const project = 'fixture', role = 'be', sessionId = 's-test';
  const origin = 'https://github.com/example/workspace-checkout-fixture.git';
  const write = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`); };
  mkdirSync(runtime, { recursive: true });
  symlinkSync(path.join(ROOT, 'readiness'), path.join(runtime, 'readiness'), 'junction');
  if (attachRuntime) {
    for (const directory of ['templates', 'operators', 'resources', 'alias', 'knowledge', 'workflows']) symlinkSync(path.join(ROOT, directory), path.join(runtime, directory), 'junction');
    copyFileSync(path.join(ROOT, 'routing.json'), path.join(runtime, 'routing.json'));
  }
  mkdirSync(canonical, { recursive: true });
  fixtureGit(canonical, 'init', '-b', 'main');
  fixtureGit(canonical, 'config', 'user.email', 'fixture@example.invalid');
  fixtureGit(canonical, 'config', 'user.name', 'Workspace fixture');
  fixtureGit(canonical, 'remote', 'add', 'origin', origin);
  write(path.join(canonical, '.gitignore'), '.claude/\n.workspaces/\n.worktrees/\n');
  write(path.join(canonical, 'src', 'model.txt'), 'initial\n');
  write(path.join(canonical, 'outside.md'), 'outside\n');
  fixtureGit(canonical, 'add', '.');
  fixtureGit(canonical, 'commit', '-m', 'Initial fixture');
  const baseHead = fixtureGit(canonical, 'rev-parse', 'HEAD');
  fixtureGit(canonical, 'worktree', 'add', '-b', `session/${sessionId}`, selected, baseHead);
  write(path.join(selected, 'src', 'model.txt'), 'session change\n');
  fixtureGit(selected, 'add', 'src/model.txt');
  fixtureGit(selected, 'commit', '-m', 'Session fixture change');
  const sessionHead = fixtureGit(selected, 'rev-parse', 'HEAD');
  const gitPolicy = { mutationBranch: 'main', worktreeBranches: 'session-only', incomingBranchRefs: 'merge-into-mutation-branch' };
  const portable = { $schema: '../../../.claude/readiness/initialization/workspaces/portable-route.schema.json', schemaVersion: 6, schemaRevision: 2, project, role,
    repository: { kind: repositoryKind, directory: repositoryKind === 'source' ? null : 'declared-repository', gitRepository: origin, branch: 'main', gitPolicy },
    context: { instructions: [], contract: null, contractSource: null, manifests: [], grammarId: null } };
  const portableFile = path.join(source, `.workspaces/projects/${project}/${role}.json`);
  const localFile = path.join(source, `.workspaces/local/routes/${project}/${role}/config.json`);
  write(path.join(source, '.workspaces/config.json'), { $schema: '../.claude/readiness/initialization/workspaces/config.schema.json', schemaVersion: 6, defaultLang: 'vi' });
  write(portableFile, portable);
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/workspace-portable.mjs'), 'hydrate', '--source', source, '--apply'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const local = JSON.parse(readFileSync(localFile, 'utf8'));
  const saveRoutes = () => { write(portableFile, portable); write(localFile, local); };
  const freezeRequest = request => {
    const branchDir = path.join(source, '.worktrees', 'sessions', sessionId, `step-${request.step}`, `parallel-${request.parallel}`);
    const bytes = `${JSON.stringify(request, null, 2)}\n`;
    write(path.join(branchDir, 'request/request.json'), bytes);
    write(path.join(branchDir, '..', '..', 'state.json'), { id: sessionId, project, startedAt: '2026-09-04T00:00:00Z', requestHashes: { [`${request.step}/${request.parallel}`]: `sha256:${createHash('sha256').update(bytes).digest('hex')}` }, chain: [[`${request.step}/${request.parallel}`]], steps: { [`${request.step}/${request.parallel}`]: 'workspace.bind' }, current: `${request.step}/${request.parallel}`, status: 'running' });
    return branchDir;
  };
  return { temporary, source, runtime, canonical, selected, project, role, sessionId, baseHead, sessionHead, origin, portable, local, saveRoutes, write, freezeRequest,
    options: { source, project, role, sessionId, checkout: 'session', declaredWriteRoots: ['src'] },
    dispose() {
      const parent = path.resolve(tmpdir()), target = path.resolve(temporary), relative = path.relative(parent, target);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('refusing unsafe fixture cleanup');
      rmSync(target, { recursive: true, force: true });
    } };
}
