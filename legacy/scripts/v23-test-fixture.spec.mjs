import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openSession, cleanupFixtureOwners, declareOwner } from './v23-test-fixture.mjs';
import { readWorkflowLocator } from './session-open.mjs';

test('a locator removed after listing is absent while malformed surviving metadata still fails', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'starci-locator-removal-'));
  const file = path.join(dir, 'session.json');
  try {
    writeFileSync(file, '{}'); const listed = readdirSync(dir); unlinkSync(file);
    assert.equal(await readWorkflowLocator(path.join(dir, listed[0])), null);
    writeFileSync(file, '{invalid'); await assert.rejects(() => readWorkflowLocator(file), SyntaxError);
    await assert.rejects(() => readWorkflowLocator(dir));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a real session fixture removes its host owner, route and locator even when test work fails', async () => {
  const owner = mkdtempSync(path.join(tmpdir(), 'starci-fixture-cleanup-'));
  const sessions = path.join(owner, '.worktrees', 'sessions'); mkdirSync(sessions, { recursive: true });
  let files;
  try {
    await assert.rejects(async () => {
      try {
        const opened = await openSession(sessions, { project: 'cleanup-proof', hostBinding: { kind: 'codex-task', hostId: `cleanup-${path.basename(owner)}`, worktree: owner, sourcePromptRef: 'user:fixture' }, mission: { language: 'en', goal: 'Prove fixture cleanup', target: 'metadata', includes: ['fixture metadata'], outputs: ['cleanup proof'], doneWhen: [{ evidence: 'metadata is removed', producedBy: 'environment.preflight' }], verification: 'inspect owned metadata', sourceRef: 'user:fixture' } });
        const state = JSON.parse(readFileSync(path.join(opened.session, 'state.json')));
        const source = state.workflowOwner.sourceRoot;
        files = [path.join(source, state.workflowOwner.declarationRef), path.join(source, state.workflowOwner.routeRef), path.join(source, '.workspaces/local/workflows', `${state.id}.json`)];
        assert.ok(files.every(file => existsSync(file)));
        throw Error('simulated test failure');
      } finally { cleanupFixtureOwners(owner); }
    }, /simulated test failure/);
    assert.ok(files.every(file => !existsSync(file)), 'fixture must leave no host declaration, local route or locator');
    assert.equal(existsSync(path.dirname(files[0])), false);
    cleanupFixtureOwners(owner);
  } finally { cleanupFixtureOwners(owner); rmSync(owner, { recursive: true, force: true }); }
});

test('fixture cleanup removes only files it created and preserves unrelated and pre-existing declarations', () => {
  const source = mkdtempSync(path.join(tmpdir(), 'starci-fixture-existing-')); const owner = path.join(source, 'owner'); mkdirSync(owner);
  const project = path.join(source, '.workspaces/projects/sample'); mkdirSync(project, { recursive: true });
  const declaration = path.join(project, 'workflow.json'); const existing = JSON.stringify({ version: 1, project: 'sample', ownerRole: 'be' }); writeFileSync(declaration, existing);
  const unrelated = path.join(project, 'keep.txt'); writeFileSync(unrelated, 'unrelated');
  try {
    declareOwner(source, 'sample', owner);
    cleanupFixtureOwners(owner);
    assert.equal(readFileSync(declaration, 'utf8'), existing); assert.equal(readFileSync(unrelated, 'utf8'), 'unrelated');
    assert.equal(existsSync(path.join(source, '.workspaces/local/routes/sample/be/config.json')), false);
  } finally { cleanupFixtureOwners(owner); rmSync(source, { recursive: true, force: true }); }
});
