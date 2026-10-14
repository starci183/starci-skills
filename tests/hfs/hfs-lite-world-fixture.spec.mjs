import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { testWorldShape, testsNoOverride } from '../../packages/eslint/be/test-world.mjs';
import { capabilityModuleShape } from '../../packages/eslint/be/module-shape.mjs';
import { hfsFromDeclaration } from '../../packages/eslint/be/lib/hfs.mjs';
import { createSlotResolver, loadSlotManifest, readRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { loadLiteFixture } from '../helpers/lite-slot-typescript.mjs';

const root = fileURLToPath(new URL('../fixtures/hfs-lite-slots/', import.meta.url));
const declaration = JSON.parse(fs.readFileSync(path.join(root, 'hfs.json'), 'utf8'));
const worldFiles = ['global-setup.ts', 'test-world.config.ts', 'test-world.error.ts', 'use-test-world.ts'];
const integrationPath = 'src/tests/integration/world/primary.integration-spec.ts';
const integrationSource = fs.readFileSync(path.join(root, 'be', integrationPath), 'utf8');

function findings(source, relative) {
  return new Linter().verify(source, [{
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    settings: { starci: { hfs: hfsFromDeclaration(declaration, path.join(root, 'be')) } },
    plugins: { fixture: { rules: { shape: testWorldShape, overrides: testsNoOverride, capability: capabilityModuleShape } } },
    rules: { 'fixture/shape': 'error', 'fixture/overrides': 'error', 'fixture/capability': 'error' },
  }], { filename: path.join(root, 'be', relative) });
}

function runtimeBoundary({ queryFailure } = {}) {
  const hooks = { before: [], after: [] };
  const observed = { connections: [], imports: [], queries: [], initialized: 0, closed: 0 };
  const manager = { async query(statement) {
    observed.queries.push(statement);
    if (queryFailure) throw queryFailure;
    return [{ session_replication_role: 'origin' }];
  } };
  const connectionUrl = 'postgresql://app_be@127.0.0.1:54322/postgres';
  const overrides = {
    '@jest/globals': {
      beforeAll: (hook) => hooks.before.push(hook),
      afterAll: (hook) => hooks.after.push(hook),
    },
    '@modules/platform/config': { EnvSource: { fromProcess: () => ({
      secret: (key) => {
        assert.equal(key, 'PRIMARY_DB_URL');
        return { reveal: () => connectionUrl };
      },
      string: (key) => {
        assert.equal(key, 'PRIMARY_DB_SCHEMA');
        return 'public';
      },
    }) } },
    '@nestjs/typeorm': {
      getDataSourceToken: (name) => `DataSource:${name}`,
      TypeOrmModule: { forRoot: (options) => {
        observed.connections.push(options);
        return { connection: options };
      } },
    },
    '@nestjs/testing': { Test: { createTestingModule: ({ imports }) => {
      observed.imports.push(imports);
      const provider = imports[0].providers.find((candidate) => candidate.inject?.includes('DataSource:primary'));
      assert.ok(provider);
      assert.deepEqual(Array.from(provider.inject), ['DataSource:primary']);
      return { compile: async () => ({
        init: async () => { observed.initialized += 1; },
        get: (token) => {
          assert.equal(token, provider.provide);
          return provider.useFactory({ manager });
        },
        close: async () => { observed.closed += 1; },
      }) };
    } } },
  };
  return { hooks, observed, overrides, manager, connectionUrl };
}

test('lite world fixture matches the dedicated slot and integration requests capability modules', () => {
  const manifest = loadSlotManifest();
  const repo = readRepoDeclaration(manifest, root);
  const resolver = createSlotResolver(manifest, repo);
  assert.equal(repo.edition, 'lite');
  assert.deepEqual(declaration.sides.be.connections, [{
    name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'schema', provider: 'supabase',
  }]);
  for (const file of worldFiles) {
    const relative = `src/tests/world/${file}`;
    assert.equal(resolver.classifyPath(`be/${relative}`).slot, 'be.tests.world');
    assert.deepEqual(findings(fs.readFileSync(path.join(root, 'be', relative), 'utf8'), relative), []);
  }
  assert.equal(resolver.classifyPath(`be/${integrationPath}`).slot, 'be.tests.integration');
  assert.deepEqual(findings(integrationSource, integrationPath), []);
  const violating = integrationSource.replace('modules: [DatabaseModule]', 'apps: { api: DatabaseModule }');
  assert.deepEqual(findings(violating, integrationPath).map((finding) => finding.messageId), ['modules']);
});

test('the world database follows the canonical configurable capability shape', () => {
  const modulePath = 'src/modules/platform/database/database.module.ts';
  const definitionPath = 'src/modules/platform/database/database.module-definition.ts';
  const source = fs.readFileSync(path.join(root, 'be', modulePath), 'utf8');
  const definition = fs.readFileSync(path.join(root, 'be', definitionPath), 'utf8');
  assert.deepEqual(findings(source, modulePath), []);
  assert.deepEqual(findings(definition, definitionPath), []);
  const violating = source.replace('options: typeof OPTIONS_TYPE', 'options: DatabaseOptions');
  assert.deepEqual(findings(violating, modulePath).map((finding) => finding.messageId), ['registerSignature']);
});

test('lite world exposes the platform manager through the local Supabase connection and closes it', async () => {
  const boundary = runtimeBoundary();
  const { useTestWorld } = loadLiteFixture('src/tests/world/use-test-world.ts', boundary.overrides);
  class CapabilityModule {}
  const world = useTestWorld({ modules: [CapabilityModule] });
  assert.throws(() => world.db, { code: 'TEST_WORLD_NOT_READY' });
  assert.deepEqual(Object.keys(world), ['db']);
  await boundary.hooks.before[0]();
  assert.deepEqual(Object.keys(world.db), ['primary']);
  assert.equal(world.db.primary, boundary.manager);
  assert.equal(boundary.observed.imports[0][1], CapabilityModule);
  assert.deepEqual(boundary.observed.connections, [{
    name: 'primary', type: 'postgres', url: boundary.connectionUrl,
    schema: 'public', synchronize: false, retryAttempts: 2,
  }]);
  assert.deepEqual(await world.db.primary.query('show session_replication_role'), [{ session_replication_role: 'origin' }]);
  await boundary.hooks.after[0]();
  assert.equal(boundary.observed.initialized, 1);
  assert.equal(boundary.observed.closed, 1);
  assert.throws(() => world.db, { code: 'TEST_WORLD_NOT_READY' });
});

function assertSetupClosed(boundary) {
  assert.deepEqual(boundary.observed.queries, ['select 1']);
  assert.equal(boundary.observed.imports[0].length, 1);
  assert.equal(boundary.observed.initialized, 1);
  assert.equal(boundary.observed.closed, 1);
}

test('global setup checks the existing Supabase stack and releases the manager on success', async () => {
  const boundary = runtimeBoundary();
  const { default: globalSetup } = loadLiteFixture('src/tests/world/global-setup.ts', boundary.overrides);
  await globalSetup();
  assertSetupClosed(boundary);
});

test('global setup releases the manager when the existing Supabase stack refuses its query', async () => {
  const queryFailure = new Error('database unavailable');
  const boundary = runtimeBoundary({ queryFailure });
  const { default: globalSetup } = loadLiteFixture('src/tests/world/global-setup.ts', boundary.overrides);
  await assert.rejects(globalSetup, queryFailure);
  assertSetupClosed(boundary);
});
