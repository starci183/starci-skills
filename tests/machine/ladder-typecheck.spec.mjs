// ladder-typecheck.spec.mjs - deepest/affected project selection and runtime node syntax checks.
import assert from 'node:assert/strict';
import test from 'node:test';
import { typecheckRun } from '../../scripts/machine/ladder-typecheck.mjs';
import { projectsForChanges } from '../../scripts/machine/ladder-select.mjs';

test('project selection uses deepest owners at L1 and every affected owner at L2', () => {
  const projects = ['be/tsconfig.json', 'be/apps/api/tsconfig.json', 'fe/tsconfig.json'];
  assert.deepEqual(projectsForChanges(projects, ['be/apps/api/src/a.ts']), ['be/apps/api/tsconfig.json']);
  assert.deepEqual(projectsForChanges(projects, ['be/apps/api/src/a.ts'], { affected: true }), ['be/apps/api/tsconfig.json', 'be/tsconfig.json']);
  assert.deepEqual(projectsForChanges(projects, ['be']), ['be/tsconfig.json']);
  assert.deepEqual(projectsForChanges(projects, ['be'], { affected: true }), ['be/apps/api/tsconfig.json', 'be/tsconfig.json']);
});

test('runtime L1 node-checks only changed runtime JavaScript', async () => {
  const checked = [];
  const result = await typecheckRun({ args: { level: 'L1', changed: ['scripts/a.mjs', 'docs/a.md', 'packages/a.ts'] }, cwd: '.', env: {} }, {
    repositoryKind: () => 'runtime',
    syntaxCheck: (file) => { checked.push(file.replaceAll('\\', '/')); return { ok: true, stderr: '' }; },
  });
  assert.equal(result.code, 0);
  assert.equal(checked.length, 1);
  assert.match(checked[0], /scripts\/a\.mjs$/);
  assert.deepEqual(result.data.scope, ['scripts/a.mjs']);
});

test('app L2 runs tsc --noEmit for affected projects and reports a red project', async () => {
  const projects = [];
  const result = await typecheckRun({ args: { level: 'L2', changed: ['be/apps/api/src/a.ts'] }, cwd: '.', env: {} }, {
    repositoryKind: () => 'app',
    typeScriptProjects: () => ['be/tsconfig.json', 'be/apps/api/tsconfig.json', 'fe/tsconfig.json'],
    runTypeScript: ({ project }) => { projects.push(project); return project === 'be/tsconfig.json' ? { status: 1, stderr: 'TS1000' } : { status: 0, stdout: '' }; },
  });
  assert.equal(result.code, 1);
  assert.deepEqual(projects, ['be/apps/api/tsconfig.json', 'be/tsconfig.json']);
  assert.equal(result.data.findings[0].project, 'be/tsconfig.json');
});
