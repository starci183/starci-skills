import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const trust = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.dirname(trust);
const entrypoint = '.claude/common/config/INDEX.md';

test('Claude and Codex bootstraps route to common config without duplicating it', () => {
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const text = readFileSync(path.join(source, name), 'utf8');
    assert.match(text, /\.claude\/common\/config\/INDEX\.md/);
    assert.ok(text.length < 1_000, `${name} must remain a small entry router`);
    assert.doesNotMatch(text, /\.workspace\/<project>|Frontend architecture|Backend architecture/);
  }
});

test('common config owns routing for exactly the common, fe, and be rule registries', () => {
  const index = readFileSync(path.join(trust, 'common', 'config', 'INDEX.md'), 'utf8');
  for (const registry of ['.claude/common/', '.claude/fe/', '.claude/be/']) {
    assert.match(index, new RegExp(registry.replaceAll('.', '\\.')));
  }
  for (const name of ['registry.md', 'workspace.md', 'frontend.md', 'backend.md', 'workspace.schema.json']) {
    assert.ok(existsSync(path.join(trust, 'common', 'config', name)), `missing common config: ${name}`);
  }
  assert.equal(existsSync(path.join(trust, 'context')), false, 'context must not become a fourth registry');
});

test('Claude and common role config block coding until applicable patterns are loaded', () => {
  const claude = readFileSync(path.join(source, 'CLAUDE.md'), 'utf8');
  const frontend = readFileSync(path.join(trust, 'common', 'config', 'frontend.md'), 'utf8');
  const backend = readFileSync(path.join(trust, 'common', 'config', 'backend.md'), 'utf8');
  assert.match(claude, /\.claude\/fe\/gates\/patterns\//);
  assert.match(claude, /\.claude\/be\/gates\/patterns\//);
  assert.match(frontend, /Before the first code write[\s\S]*\.claude\/fe\/gates\/patterns/);
  assert.match(backend, /Before the first code write[\s\S]*\.claude\/be\/gates\/patterns/);
});

test('workspace setup emits configs pointing back to the tracked common schema', () => {
  const setup = readFileSync(path.join(trust, 'skills', 'starci-setup-workspace', 'scripts', 'setup-workspace.mjs'), 'utf8');
  const schema = readFileSync(path.join(trust, 'common', 'config', 'workspace.schema.json'), 'utf8');
  const schemaRoute = '../../../.claude/common/config/workspace.schema.json';
  assert.match(setup, new RegExp(schemaRoute.replaceAll('.', '\\.')));
  assert.match(setup, /repository\.diskPath/);
  assert.match(setup, /gitRepository/);
  assert.doesNotMatch(setup, /ensureAlias|repository\.workspace|repository\.alias/);
  assert.equal(JSON.parse(schema).properties.$schema.const, schemaRoute);
  assert.deepEqual(JSON.parse(schema).properties.repository.required, ['diskPath', 'gitRepository', 'gitRoot', 'branch', 'head']);
  assert.doesNotMatch(setup, /\.claude\/context\/workspace\.schema\.json/);
});
