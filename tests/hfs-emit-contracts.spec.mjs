import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { aliasTarget, aliasesOf, apiApps, appModulePath, importedBindings, snapshotPath, snapshotText } from '../packages/hfs/emit/contracts.mjs';

// The pure parts of `hfs emit-contracts` (packages/hfs/emit/contracts.mjs). The schema itself is built by Nest in a child
// process of the repository under emission and is proved by the committed snapshots of the examples.

const ts = createRequire(import.meta.url)('typescript');

test('the paths of an app root and of its snapshot follow the slots', () => {
  assert.equal(appModulePath('identity'), 'apps/identity/src/app.module.ts');
  assert.equal(snapshotPath('identity'), 'contracts/identity/schema.graphql');
});

test('importedBindings lists the named value imports in source order and skips type-only ones', () => {
  const source = [
    "import { Module } from '@nestjs/common';",
    "import type { DynamicModule } from '@nestjs/common';",
    "import { type Options, IdentityGraphqlModule } from '@features/identity';",
    "import { CheckoutGraphqlModule as Checkout } from '@features/checkout';",
    "import defaultThing from './default';",
    "import * as everything from './all';",
  ].join('\n');
  assert.deepEqual(importedBindings(ts, source), [
    { name: 'Module', specifier: '@nestjs/common' },
    { name: 'IdentityGraphqlModule', specifier: '@features/identity' },
    { name: 'CheckoutGraphqlModule', specifier: '@features/checkout' },
  ]);
});

test('tsconfig path aliases resolve a specifier to its base, and a package specifier to nothing', () => {
  const root = path.resolve('/repo');
  const aliases = aliasesOf({ '@features/*': ['./src/features/*'], '@modules/*': ['./src/modules/*'], exact: ['./x.ts'] }, root);
  assert.equal(aliasTarget(aliases, '@features/identity'), path.join(root, 'src', 'features', 'identity'));
  assert.equal(aliasTarget(aliases, '@modules/platform/errors'), path.join(root, 'src', 'modules', 'platform', 'errors'));
  assert.equal(aliasTarget(aliases, '@nestjs/common'), null);
  assert.deepEqual(aliasesOf(undefined, root), []);
});

test('only api apps can serve GraphQL', () => {
  const declaration = { apps: [{ name: 'identity', kind: 'api' }, { name: 'worker', kind: 'worker' }, { name: 'migrate', kind: 'migrate' }, { name: 'order', kind: 'api' }] };
  assert.deepEqual(apiApps(declaration), ['identity', 'order']);
  assert.deepEqual(apiApps({}), []);
});

test('the snapshot text is the printed schema with exactly one final newline', () => {
  assert.equal(snapshotText('type Query {\n  a: Int\n}'), 'type Query {\n  a: Int\n}\n');
  assert.equal(snapshotText('type Query {\n  a: Int\n}\n\n\n'), 'type Query {\n  a: Int\n}\n');
});
