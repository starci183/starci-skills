import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { aliasTarget, aliasesOf, apiApps, appModulePath, snapshotPath, snapshotText } from '../packages/hfs/emit/contracts.mjs';
import { createGraphReader } from '../packages/hfs/emit/static-graph.mjs';
import { contractEmitFindings, CONTRACT_SNAPSHOT_DRIFT } from '../scripts/lib/hfs-rules/contract.mjs';

// `hfs emit-contracts`: the pure parts (packages/hfs/emit/contracts.mjs), the static module-graph reader that decides what an app
// serves (static-graph.mjs, run here over virtual files) and the full-pass check that the committed snapshots are current
// (contractEmitFindings). The schema itself is built by Nest in a child process of the repository under emission and is proved
// by the committed snapshots of the examples and of the product repositories.

const ts = createRequire(import.meta.url)('typescript');

test('the paths of an app root and of its snapshot follow the slots', () => {
  assert.equal(appModulePath('identity'), 'apps/identity/src/app.module.ts');
  assert.equal(snapshotPath('identity'), 'contracts/identity/schema.graphql');
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

// ------------------------------------------------------------------------------------------------ the static module graph

const COMMON = "import { Module, forwardRef } from '@nestjs/common';";
const GQL = "import { GraphQLModule, Resolver, Query, Scalar } from '@nestjs/graphql';";
/** A virtual repository: `files` maps 'src/x.ts' to text; `@app/*` aliases `src/*`; anything else without a dot is external. */
const composeOf = (files, appFile = 'src/app.module.ts') => {
  const table = new Map(Object.entries(files));
  const host = {
    read: (file) => table.get(file) ?? null,
    resolve(from, specifier) {
      const base = specifier.startsWith('@app/') ? `src/${specifier.slice(5)}` : specifier.startsWith('.') ? path.posix.join(path.posix.dirname(from), specifier) : null;
      if (base === null) return null;
      const found = [base, `${base}.ts`, `${base}/index.ts`].find((candidate) => table.has(candidate));
      if (!found) throw new Error(`cannot resolve ${specifier} from ${from}`);
      return found;
    },
  };
  return createGraphReader({ ts, host }).compose(appFile);
};
const names = (list) => list.map((item) => item.name);
const resolverClass = (name) => `${GQL}\n@Resolver()\nexport class ${name} { @Query(() => String) hello() { return ''; } }\n`;
const SERVER = "GraphQLModule.forRoot({ autoSchemaFile: true })";

test('static graph: resolvers of modules imported by modules imported by the root are served, however deep', () => {
  const composition = composeOf({
    'src/app.module.ts': `${COMMON}\n${GQL}\nimport { OuterModule } from '@app/outer';\n@Module({ imports: [${SERVER}, OuterModule] })\nexport class AppModule {}\n`,
    'src/outer.ts': `${COMMON}\nimport { InnerModule } from './inner';\n@Module({ imports: [InnerModule] })\nexport class OuterModule {}\n`,
    'src/inner.ts': `${COMMON}\nimport { DeepResolver } from './deep.resolver';\n@Module({ providers: [DeepResolver] })\nexport class InnerModule {}\n`,
    'src/deep.resolver.ts': resolverClass('DeepResolver'),
  });
  assert.deepEqual(names(composition.resolvers), ['DeepResolver']);
});

test('static graph: barrel re-exports and aliased imports lead to the declaring class', () => {
  const composition = composeOf({
    'src/app.module.ts': `${COMMON}\n${GQL}\nimport { FeatureModule as Renamed } from '@app/features';\n@Module({ imports: [${SERVER}, Renamed] })\nexport class AppModule {}\n`,
    'src/features/index.ts': "export { FeatureModule } from './feature.module';\nexport * from './other';\n",
    'src/features/other.ts': 'export const unused = 1;\n',
    'src/features/feature.module.ts': `${COMMON}\nimport { FeatureResolver } from './feature.resolver';\n@Module({ providers: [FeatureResolver] })\nexport class FeatureModule {}\n`,
    'src/features/feature.resolver.ts': resolverClass('FeatureResolver'),
  });
  assert.deepEqual(names(composition.resolvers), ['FeatureResolver']);
});

test('static graph: static registration methods that use their options, spreads, conditionals and forwardRef are followed', () => {
  const composition = composeOf({
    'src/app.module.ts': [
      COMMON, GQL, "import { Ingress } from '@app/ingress';", "import { Late } from '@app/late';", "import { LIST } from '@app/list';",
      "import { OptionalFeature } from '@app/optional';", "import { A } from '@app/a';",
      '@Module({})',
      'export class AppModule {',
      '  static register(options: { withOptional: boolean }) {',
      `    return { module: AppModule, imports: [${SERVER}, Ingress.register({ receivers: [A] }), forwardRef(() => Late), ...LIST, ...(options.withOptional ? [OptionalFeature] : [])] };`,
      '  }',
      '}',
    ].join('\n'),
    'src/ingress.ts': `${COMMON}\n@Module({})\nexport class Ingress {\n  static register(options: { receivers: unknown[] }) {\n    return { module: Ingress, imports: options.receivers };\n  }\n}\n`,
    'src/a.ts': `${COMMON}\nimport { AResolver } from './a.resolver';\n@Module({ providers: [AResolver] })\nexport class A {}\n`,
    'src/a.resolver.ts': resolverClass('AResolver'),
    'src/late.ts': `${COMMON}\nimport { LateResolver } from './late.resolver';\n@Module({ providers: [LateResolver] })\nexport class Late {}\n`,
    'src/late.resolver.ts': resolverClass('LateResolver'),
    'src/list.ts': `import { L1 } from './l1';\nexport const LIST = [L1];\n`,
    'src/l1.ts': `${COMMON}\nimport { L1Resolver } from './l1.resolver';\n@Module({ providers: [{ provide: 'x', useClass: L1Resolver }] })\nexport class L1 {}\n`,
    'src/l1.resolver.ts': resolverClass('L1Resolver'),
    'src/optional.ts': `${COMMON}\nimport { OptionalResolver } from './optional.resolver';\n@Module({ providers: [OptionalResolver] })\nexport class OptionalFeature {}\n`,
    'src/optional.resolver.ts': resolverClass('OptionalResolver'),
  });
  assert.deepEqual(names(composition.resolvers).sort(), ['AResolver', 'L1Resolver', 'LateResolver', 'OptionalResolver']);
});

test('static graph: a dynamic module built on super.register (the configurable-module pattern) and forRootAsync options are followed', () => {
  const composition = composeOf({
    'src/app.module.ts': `${COMMON}\nimport { Boundary } from '@app/boundary';\n@Module({})\nexport class AppModule {\n  static register() {\n    return { module: AppModule, imports: [Boundary.register({ origins: [] })] };\n  }\n}\n`,
    'src/boundary.ts': [
      COMMON, GQL, "import { ConfigurableModuleClass } from './definition';", "import { Scope } from '@app/scope';", "import { driverOptions } from './driver';",
      '@Module({})',
      'export class Boundary extends ConfigurableModuleClass {',
      '  static override register(options: { origins: string[] }) {',
      '    const definition = super.register(options);',
      '    return {',
      '      ...definition,',
      "      imports: [...(definition.imports ?? []), Scope, GraphQLModule.forRootAsync({ driver: null, inject: ['authenticator'], useFactory: driverOptions })],",
      '    };',
      '  }',
      '}',
    ].join('\n'),
    'src/definition.ts': "export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder().build();\n",
    'src/driver.ts': 'export const driverOptions = (authenticator: unknown) => ({ autoSchemaFile: true, playground: false, context: () => authenticator });\n',
    'src/scope.ts': `${COMMON}\nimport { ScopeResolver } from './scope.resolver';\n@Module({ providers: [ScopeResolver] })\nexport class Scope {}\n`,
    'src/scope.resolver.ts': resolverClass('ScopeResolver'),
  });
  assert.deepEqual(names(composition.resolvers), ['ScopeResolver']);
});

test('static graph: an object-literal module with its own imports and providers, and non-resolver providers, are handled', () => {
  const composition = composeOf({
    'src/app.module.ts': `${COMMON}\n${GQL}\nimport { Host } from '@app/host';\nimport { Inner } from '@app/inner';\nimport { Service } from '@app/service';\n@Module({ imports: [${SERVER}, { module: Host, global: true, imports: [Inner], providers: [Service] }] })\nexport class AppModule {}\n`,
    'src/host.ts': `${COMMON}\n@Module({})\nexport class Host {}\n`,
    'src/inner.ts': `${COMMON}\nimport { InnerResolver } from './inner.resolver';\n@Module({ providers: [InnerResolver] })\nexport class Inner {}\n`,
    'src/inner.resolver.ts': resolverClass('InnerResolver'),
    'src/service.ts': `import { Injectable } from '@nestjs/common';\n@Injectable()\nexport class Service {}\n`,
  });
  assert.deepEqual(names(composition.resolvers), ['InnerResolver']);
});

test('static graph: a resolver decorator is recognised by where it was imported from, not by its name; scalars are collected too', () => {
  const composition = composeOf({
    'src/app.module.ts': `${COMMON}\n${GQL}\nimport { Wrapped } from '@app/wrapped';\nimport { DateScalar } from '@app/date.scalar';\n@Module({ imports: [${SERVER}], providers: [Wrapped, DateScalar] })\nexport class AppModule {}\n`,
    'src/wrapped.ts': "import { Resolver as Look } from './fake';\nexport class Wrapped {}\n@Look()\nclass NotGraphql {}\n",
    'src/fake.ts': 'export const Resolver = () => () => undefined;\n',
    'src/date.scalar.ts': "import { Scalar } from '@nestjs/graphql';\n@Scalar('Date')\nexport class DateScalar {}\n",
  });
  assert.deepEqual(names(composition.resolvers), []);
  assert.deepEqual(names(composition.scalars), ['DateScalar']);
});

test('static graph: GraphQLModule include limits the served providers to the listed modules and their imports', () => {
  const files = (include) => ({
    'src/app.module.ts': `${COMMON}\n${GQL}\nimport { Listed } from '@app/listed';\nimport { Unlisted } from '@app/unlisted';\n@Module({ imports: [GraphQLModule.forRoot({ autoSchemaFile: true, ${include} }), Listed, Unlisted] })\nexport class AppModule {}\n`,
    'src/listed.ts': `${COMMON}\nimport { Below } from './below';\nimport { ListedResolver } from './listed.resolver';\n@Module({ imports: [Below], providers: [ListedResolver] })\nexport class Listed {}\n`,
    'src/below.ts': `${COMMON}\nimport { BelowResolver } from './below.resolver';\n@Module({ providers: [BelowResolver] })\nexport class Below {}\n`,
    'src/unlisted.ts': `${COMMON}\nimport { UnlistedResolver } from './unlisted.resolver';\n@Module({ providers: [UnlistedResolver] })\nexport class Unlisted {}\n`,
    'src/listed.resolver.ts': resolverClass('ListedResolver'),
    'src/below.resolver.ts': resolverClass('BelowResolver'),
    'src/unlisted.resolver.ts': resolverClass('UnlistedResolver'),
  });
  assert.deepEqual(names(composeOf(files('include: [Listed]')).resolvers).sort(), ['BelowResolver', 'ListedResolver']);
  assert.deepEqual(names(composeOf(files('')).resolvers).sort(), ['BelowResolver', 'ListedResolver', 'UnlistedResolver']);
});

test('static graph: an app whose graph holds no GraphQL server composes nothing', () => {
  const composition = composeOf({
    'src/app.module.ts': `${COMMON}\nimport { Http } from '@app/http';\n@Module({ imports: [Http] })\nexport class AppModule {}\n`,
    'src/http.ts': `${COMMON}\nimport { R } from './r';\n@Module({ providers: [R] })\nexport class Http {}\n`,
    'src/r.ts': resolverClass('R'),
  });
  assert.equal(composition, null);
});

test('static graph: what cannot be decided is an error naming the module, never a silent gap', () => {
  const broken = (imports) => () => composeOf({ 'src/app.module.ts': `${COMMON}\n${GQL}\nimport { compute } from './compute';\n@Module({ imports: [${SERVER}, ${imports}] })\nexport class AppModule {}\n`, 'src/compute.ts': 'export const compute = () => 1;\n' });
  assert.throws(broken('compute()'), /cannot be decided/);
  assert.throws(broken('Missing'), /cannot be decided/);
  assert.throws(() => composeOf({ 'src/app.module.ts': `${COMMON}\n${GQL}\n@Module({ imports: [GraphQLModule.forRoot({ autoSchemaFile: true, buildSchemaOptions: {} })] })\nexport class AppModule {}\n` }), /buildSchemaOptions .* not modeled/);
  assert.throws(() => composeOf({ 'src/app.module.ts': `${COMMON}\n${GQL}\n@Module({ imports: [GraphQLModule.forRoot({ typePaths: [] })] })\nexport class AppModule {}\n` }), /not code-first/);
  assert.throws(() => composeOf({ 'src/app.module.ts': `${COMMON}\n${GQL}\n@Module({ imports: [GraphQLModule.forRoot({ autoSchemaFile: true }), GraphQLModule.forRoot({ autoSchemaFile: true, path: '/b' })] })\nexport class AppModule {}\n` }), /2 GraphQL servers/);
  assert.equal(composeOf({ 'src/app.module.ts': 'export const AppModule = 1;\n' }), null, 'a root that exports no AppModule class serves nothing');
});

// ------------------------------------------------------------------------------------------------ the committed snapshot is current

const SNAPSHOT = 'contracts/core/schema.graphql';
const withRepo = (committed, body) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-contract-emit-'));
  try {
    if (committed !== null) {
      fs.mkdirSync(path.join(dir, 'contracts', 'core'), { recursive: true });
      fs.writeFileSync(path.join(dir, SNAPSHOT), committed);
    }
    return body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};
const emitting = (text) => ({ declaration, outDir }) => {
  const [app] = declaration.apps;
  if (text === null) return { written: [], skipped: [app.name] };
  fs.mkdirSync(path.join(outDir, 'contracts', app.name), { recursive: true });
  fs.writeFileSync(path.join(outDir, snapshotPath(app.name)), text);
  return { written: [snapshotPath(app.name)], skipped: [] };
};
const BE_REPO = { profile: 'be', apps: [{ name: 'core', kind: 'api' }, { name: 'worker', kind: 'worker' }] };

test('HFS_CONTRACT_SNAPSHOT_DRIFT: a committed snapshot equal to what the app emits now is fresh (line endings folded)', () => {
  withRepo('type Query {\r\n  a: Int\r\n}\r\n', (dir) => {
    const result = contractEmitFindings({ repoRoot: dir, files: [SNAPSHOT], repo: BE_REPO, emit: emitting('type Query {\n  a: Int\n}\n') });
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.apps, [{ app: 'core', status: 'fresh' }]);
  });
});

test('HFS_CONTRACT_SNAPSHOT_DRIFT: a stale committed snapshot names both hashes and npm run contract:emit', () => {
  withRepo('type Query {\n  a: Int\n}\n', (dir) => {
    const result = contractEmitFindings({ repoRoot: dir, files: [SNAPSHOT], repo: BE_REPO, emit: emitting('type Query {\n  a: Int\n  b: Int\n}\n') });
    assert.equal(result.findings.length, 1);
    const [finding] = result.findings;
    assert.equal(finding.code, CONTRACT_SNAPSHOT_DRIFT);
    assert.equal(finding.path, SNAPSHOT);
    assert.match(finding.message, /\([0-9a-f]{12}\) differs from what core emits now \([0-9a-f]{12}\)/);
    assert.match(finding.message, /npm run contract:emit/);
    assert.deepEqual(result.apps, [{ app: 'core', status: 'stale' }]);
  });
});

test('HFS_CONTRACT_SNAPSHOT_DRIFT: an emit that cannot run is a finding with its error, never a silent skip', () => {
  withRepo('type Query {\n  a: Int\n}\n', (dir) => {
    const emit = () => { throw new Error('hfs emit-contracts: core failed (exit 1): Cannot find module typescript'); };
    const result = contractEmitFindings({ repoRoot: dir, files: [SNAPSHOT], repo: BE_REPO, emit });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].code, CONTRACT_SNAPSHOT_DRIFT);
    assert.match(result.findings[0].message, /cannot be verified.*Cannot find module typescript/);
    assert.deepEqual(result.apps, [{ app: 'core', status: 'emit-failed' }]);
  });
});

test('HFS_CONTRACT_SNAPSHOT_DRIFT: a snapshot left behind by an app that serves no GraphQL is refused; an uncommitted one is the static rule\'s finding', () => {
  withRepo('type Query {\n  a: Int\n}\n', (dir) => {
    const stale = contractEmitFindings({ repoRoot: dir, files: [SNAPSHOT], repo: BE_REPO, emit: emitting(null) });
    assert.match(stale.findings[0].message, /serves no GraphQL any more/);
  });
  withRepo(null, (dir) => {
    const none = contractEmitFindings({ repoRoot: dir, files: [], repo: BE_REPO, emit: emitting(null) });
    assert.deepEqual(none.findings, []);
    const uncommitted = contractEmitFindings({ repoRoot: dir, files: [], repo: BE_REPO, emit: emitting('type Query {\n  a: Int\n}\n') });
    assert.deepEqual(uncommitted.findings, []);
    assert.deepEqual(uncommitted.apps, [{ app: 'core', status: 'not-committed' }]);
  });
});

test('the emit check judges a back end only', () => {
  const result = contractEmitFindings({ repoRoot: os.tmpdir(), files: [], repo: { profile: 'fe', apps: [{ name: 'web', kind: 'next' }] }, emit: () => { throw new Error('never called'); } });
  assert.deepEqual(result, { findings: [], apps: [] });
});
