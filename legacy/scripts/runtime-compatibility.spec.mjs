import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assertRuntimeUpdateCompatible, discoverUpdateSessions } from './runtime-compatibility.mjs';

const write = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value)); };
function fixture(t) {
  const sourceRoot = mkdtempSync(path.join(tmpdir(), 'starci-compat-'));
  t.after(() => rmSync(sourceRoot, { recursive: true, force: true }));
  const installedRoot = path.join(sourceRoot, '.claude'), incomingRoot = path.join(sourceRoot, 'incoming');
  const policy = revision => ({ version: 1, execution: { contractVersion: 'starci/v2.2', runtimeRevision: revision } });
  write(path.join(installedRoot, 'resources/runtime-compatibility.json'), policy(3));
  write(path.join(incomingRoot, 'resources/runtime-compatibility.json'), policy(3));
  const session = path.join(sourceRoot, '.worktrees/sessions/current/state.json');
  write(session, { contractVersion: 'starci/v2.2', runtimeRevision: 3, lifecycle: { phase: 'active' }, accepted: 'retained' });
  return { sourceRoot, installedRoot, incomingRoot, session, policy };
}
test('a compatible update preserves active evidence byte for byte; incompatible update refuses without writes', t => {
  const f = fixture(t), before = readFileSync(f.session, 'utf8');
  assert.equal(assertRuntimeUpdateCompatible(f).sessions[0].compatibility, 'compatible');
  write(path.join(f.incomingRoot, 'resources/runtime-compatibility.json'), f.policy(4));
  assert.throws(() => assertRuntimeUpdateCompatible(f), /RUNTIME_UPDATE_INCOMPATIBLE/);
  assert.equal(readFileSync(f.session, 'utf8'), before);
  assert.equal(JSON.parse(readFileSync(path.join(f.installedRoot, 'resources/runtime-compatibility.json'))).execution.runtimeRevision, 3);
});
test('already incompatible history does not block compatible patches or become current proof', t => {
  const f = fixture(t);
  write(f.session, { contractVersion: 'starci/v2.2', runtimeRevision: 2, lifecycle: { phase: 'active' } });
  assert.equal(assertRuntimeUpdateCompatible(f).sessions[0].compatibility, 'historical-incompatible');
});
test('malformed or unclassified active evidence fails discovery instead of silently skipping it', t => {
  const f = fixture(t);
  writeFileSync(f.session, '{broken');
  assert.throws(() => assertRuntimeUpdateCompatible(f), /RUNTIME_UPDATE_DISCOVERY_FAILED/);
  write(f.session, { runtimeRevision: 3, lifecycle: { phase: 'active' } });
  assert.throws(() => assertRuntimeUpdateCompatible(f), /unclassified active session/);
});
test('pre-policy revision3 installs have the same continuity contract', t => {
  const f = fixture(t);
  rmSync(path.join(f.installedRoot, 'resources/runtime-compatibility.json'));
  mkdirSync(path.join(f.installedRoot, 'scripts'));
  writeFileSync(path.join(f.installedRoot, 'scripts/workflow-root.mjs'), 'export const RUNTIME_REVISION = 3;');
  assert.equal(assertRuntimeUpdateCompatible(f).sessions[0].compatibility, 'compatible');
});
test('session inventory follows declared workflow owners and verifies locator identity', t => {
  const f = fixture(t), owner = path.join(f.sourceRoot, 'owner');
  mkdirSync(owner);
  write(path.join(f.sourceRoot, '.workspaces/projects/demo/workflow.json'), { version: 1, project: 'demo', ownerRole: 'app' });
  write(path.join(f.sourceRoot, '.workspaces/local/routes/demo/app/config.json'), { project: 'demo', role: 'app', source: { path: f.sourceRoot }, repository: { diskPath: owner, gitRepository: 'example' } });
  const locator = path.join(f.sourceRoot, '.workspaces/local/workflows/remote.json');
  write(locator, { project: 'demo', ownerRoot: owner });
  write(path.join(owner, '.worktrees/sessions/remote/state.json'), { contractVersion: 'starci/v2.2', runtimeRevision: 3, lifecycle: { phase: 'draft' }, workflowOwner: { sourceRoot: f.sourceRoot } });
  assert.equal(discoverUpdateSessions(f.sourceRoot).length, 2);
  write(locator, { project: 'demo', ownerRoot: f.sourceRoot });
  assert.throws(() => assertRuntimeUpdateCompatible(f), /locator differs/);
});
