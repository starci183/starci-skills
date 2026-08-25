import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { inspect, resolveReferences } from './reference-context.mjs';

test('portable routes resolve direct clean-reference identities without writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'starci-reference-plan-'));
  try {
    const projectRoot = join(root, '.workspaces', 'projects', 'demo');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(join(projectRoot, 'fe.json'), JSON.stringify({ project: 'demo', role: 'fe', repository: { gitRepository: 'https://example.test/demo.git', branch: 'main' } }));
    const references = resolveReferences({ sourceRoot: root });
    assert.deepEqual(references, [{ id: 'demo-fe', project: 'demo', role: 'fe', repository: 'https://example.test/demo.git', branch: 'main', path: '.worktrees/references/demo-fe' }]);
    const plan = inspect({ sourceRoot: root });
    assert.equal(plan.references[0].present, false);
    assert.equal(plan.stateRoot, '.workspaces/local/state/reference-context');
    assert.equal(plan.codexUrl, 'http://127.0.0.1:8021/mcp');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('duplicate project-role identities are rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'starci-reference-duplicate-'));
  try {
    const projectRoot = join(root, '.workspaces', 'projects', 'demo');
    mkdirSync(projectRoot, { recursive: true });
    const route = JSON.stringify({ project: 'demo', role: 'fe', repository: { gitRepository: 'https://example.test/demo.git', branch: 'main' } });
    writeFileSync(join(projectRoot, 'one.json'), route);
    writeFileSync(join(projectRoot, 'two.json'), route);
    assert.throws(() => resolveReferences({ sourceRoot: root }), /duplicate reference identities/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
