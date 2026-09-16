import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { checkArchitecture } from '../checks/architecture.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const runtimeRoot = path.resolve(import.meta.dirname, '..');

function fixture(t, kind, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `starci-architecture-${kind}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = {
    schema: 'starci/architecture-config@1',
    kinds: [kind],
    tsconfig: 'tsconfig.json',
  };
  fs.writeFileSync(path.join(root, 'architecture.json'), `${JSON.stringify(config, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'package.json'), '{"private":true}\n');
  fs.writeFileSync(path.join(root, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'preserve',
      baseUrl: '.',
      paths: {
        '@modules/*': ['src/modules/*'],
        '@features/*': ['src/features/*'],
        '@/*': ['src/*'],
      },
      allowJs: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ['src/**/*', 'apps/**/*'],
  }, null, 2)}\n`);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

function check(root) {
  return checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json', injectedTypeScript: ts });
}

function writeFiles(root, files) {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

function monorepoFixture(t, files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-architecture-monorepo-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeFiles(root, {
    'architecture.json': `${JSON.stringify({ schema: 'starci/architecture-config@1', kinds: ['frontend'], projects: ['tsconfig.json'] }, null, 2)}\n`,
    'package.json': JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'] }),
    'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './apps/web' }, { path: './packages/ui' }] }),
    'apps/web/package.json': JSON.stringify({ name: '@fixture/app', private: true }),
    'apps/web/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@/*': ['apps/web/src/*'], '@fixture/ui': ['packages/ui/src/index.ts'], '@fixture/ui/*': ['packages/ui/src/*'] }, noEmit: true }, include: ['src/**/*'] }),
    'packages/ui/package.json': JSON.stringify({ name: '@fixture/ui', private: true, exports: { '.': './src/index.ts', './leaves/*': './src/leaves/*/index.tsx' } }),
    'packages/ui/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@fixture/app/*': ['apps/web/src/*'] }, noEmit: true }, include: ['src/**/*'] }),
    ...files,
  });
  return root;
}

test('backend accepts inward composition and narrow bootstrap configuration', t => {
  const root = fixture(t, 'backend', {
    'src/modules/catalog/value.ts': 'export const value = 1\n',
    'src/features/http/feature.ts': 'import { value } from "@modules/catalog/value"; export const feature = value\n',
    'apps/core/src/config/runtime.config.ts': 'export const runtime = { port: 3000 }\n',
    'apps/core/src/app.module.ts': 'import { feature } from "@features/http/feature"; export const AppModule = feature\n',
    'apps/core/src/main.ts': 'import { AppModule } from "./app.module"; void AppModule\n',
  });
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.files, 5);
  assert.deepEqual(result.coverage.sourceFiles, [
    'apps/core/src/app.module.ts',
    'apps/core/src/config/runtime.config.ts',
    'apps/core/src/main.ts',
    'src/features/http/feature.ts',
    'src/modules/catalog/value.ts',
  ]);
  assert.ok(result.coverage.checkedRuleIds.includes('BE_MODULE_IMPORTS_FEATURE'));
  assert.ok(result.coverage.checkedRuleIds.includes('ARCH_INTERNAL_IMPORT_UNRESOLVED'));
  assert.equal(result.coverage.checkedRuleIds.some(ruleId => ruleId.startsWith('FE_')), false);
});

test('backend resolves aliases, relative imports, and re-export barrels before enforcing direction', t => {
  const root = fixture(t, 'backend', {
    'src/features/http/feature.ts': 'export const feature = 1\n',
    'src/modules/shared/barrel.ts': 'export * from "../../features/http/feature"\n',
    'src/modules/shared/consumer.ts': 'import { feature } from "@modules/shared/barrel"; export const value = feature\n',
    'src/features/http/app-link.ts': 'export * from "../../../apps/core/src/app.module"\n',
    'apps/core/src/app.module.ts': 'export const AppModule = 1\n',
    'apps/core/src/main.ts': 'void 0\n',
    'apps/core/src/orders.controller.ts': 'export class OrdersController {}\n',
    'apps/core/src/helper.ts': 'export const business = 1\n',
  });
  const result = check(root);
  const rules = new Set(result.violations.map(item => item.ruleId));
  assert.ok(rules.has('BE_MODULE_IMPORTS_FEATURE'), JSON.stringify(result, null, 2));
  assert.ok(rules.has('BE_FEATURE_IMPORTS_APP'));
  assert.ok(rules.has('BE_APP_BUSINESS_ROLE'));
  assert.ok(rules.has('BE_APP_COMPOSITION_ONLY'));
  const barrel = result.violations.find(item => item.path.endsWith('consumer.ts') && item.ruleId === 'BE_MODULE_IMPORTS_FEATURE');
  assert.deepEqual(barrel.dependencyChain.map(item => path.posix.basename(item)), ['consumer.ts', 'barrel.ts', 'feature.ts']);
  assert.ok(barrel.line > 0 && barrel.column > 0);
});

test('frontend accepts a one-page route, downward tiers, connected hook barrel, and hook-owned transport', t => {
  const root = fixture(t, 'frontend', {
    'src/app/home/page.tsx': 'import { HomePage } from "@/components/pages/HomePage"; const Route = () => <HomePage {...{}} />; export default Route\n',
    'src/components/pages/HomePage/index.tsx': '"use client"; import { useThing } from "@/hooks"; import { HomePageBase } from "./component"; export const HomePage=()=>{useThing();return <HomePageBase />};\n',
    'src/components/pages/HomePage/component.tsx': 'import { Card } from "@/components/blocks/home/Card"; export const HomePageBase=()=> <Card />\n',
    'src/components/blocks/home/Card/index.tsx': 'import { Leaf } from "@/components/leaves/Leaf"; export const Card=()=> <Leaf />\n',
    'src/components/leaves/Leaf/index.tsx': 'export const Leaf=()=> <span />\n',
    'src/hooks/index.ts': 'export { useThing } from "./swr/useThing"\n',
    'src/hooks/swr/useThing.ts': 'import { query } from "@/modules/api/query"; export const useThing=()=>query()\n',
    'src/modules/api/query.ts': 'export const query=()=>fetch("/graphql")\n',
  });
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
});

test('frontend catches route drawing, upward tiers, direct/deep data access, barrel bypass, world hooks, and raw fetch', t => {
  const root = fixture(t, 'frontend', {
    'src/app/home/page.tsx': 'import { HomePage } from "@/components/pages/HomePage"; import { Leaf } from "@/components/leaves/Leaf"; const Route=()=> <><Leaf/><HomePage /></>; export default Route\n',
    'src/components/pages/HomePage/index.tsx': 'export const HomePage=()=> <main />\n',
    'src/components/blocks/home/Card/index.tsx': 'import { useThing } from "@/hooks/swr/useThing"; export const Card=()=>{useThing();return <div/>}\n',
    'src/components/leaves/Leaf/index.tsx': 'import { Card } from "../../blocks/home/Card"; export const Leaf=()=> <Card/>\n',
    'src/components/blocks/home/Pure/component.tsx': '"use client"; import { useContext } from "react"; import { query } from "../../../../bridge"; export const Pure=()=>{useContext(null as never);fetch("/x");return <div>{query()}</div>}\n',
    'src/bridge.ts': 'export * from "./hooks/swr/useThing"\n',
    'src/hooks/index.ts': 'export { useThing } from "./swr/useThing"\n',
    'src/hooks/swr/useThing.ts': 'import { query } from "@/modules/api/query"; export const useThing=()=>query()\n',
    'src/modules/api/query.ts': 'export const query=()=>1\n',
  });
  const result = check(root);
  const rules = new Set(result.violations.map(item => item.ruleId));
  for (const expected of ['FE_ROUTE_ONE_PAGE', 'FE_TIER_IMPORTS_UPWARD', 'FE_COMPONENT_DEEP_HOOK_IMPORT',
    'FE_PURE_REACHES_DATA', 'FE_PURE_WORLD_HOOK', 'FE_FETCH_OUTSIDE_TRANSPORT']) assert.ok(rules.has(expected), `${expected}: ${JSON.stringify(result, null, 2)}`);
  assert.ok(result.violations.find(item => item.ruleId === 'FE_PURE_REACHES_DATA').dependencyChain.some(item => item.endsWith('bridge.ts')));
});

test('unresolved internal aliases fail clearly instead of returning a false green result', t => {
  const root = fixture(t, 'backend', {
    'src/modules/broken.ts': 'import { missing } from "@features/missing"; export const value=missing\n',
    'src/features/present.ts': 'export const present=1\n',
  });
  const result = check(root);
  assert.equal(result.ok, false);
  const unresolved = result.errors.find(item => item.ruleId === 'ARCH_INTERNAL_IMPORT_UNRESOLVED');
  assert.equal(unresolved.specifier, '@features/missing');
  assert.equal(unresolved.path, 'src/modules/broken.ts');
  assert.ok(unresolved.line > 0 && unresolved.column > 0);
});

test('production loader reports missing target TypeScript without borrowing StarCi test TypeScript', t => {
  const root = fixture(t, 'backend', {
    'src/modules/value.ts': 'export const value=1\n',
    'src/features/feature.ts': 'export const feature=1\n',
  });
  const result = checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json' });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].ruleId, 'ARCH_TYPESCRIPT_MISSING');
  assert.match(result.errors[0].message, /checked repository/);
});

test('CLI emits one actionable JSON record and uses target-local TypeScript', t => {
  const root = fixture(t, 'backend', {
    'src/modules/value.ts': 'export const value=1\n',
    'src/features/feature.ts': 'import { value } from "@modules/value"; export const feature=value\n',
  });
  const targetModules = path.join(root, 'node_modules');
  fs.mkdirSync(targetModules);
  const installedTypeScript = path.dirname(require.resolve('typescript/package.json'));
  fs.cpSync(installedTypeScript, path.join(targetModules, 'typescript'), { recursive: true });
  const cli = path.join(runtimeRoot, 'cli/main.mjs');
  const run = spawnSync(process.execPath, [cli, 'architecture', 'check', root, '--config', 'architecture.json'], { encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(run.stderr, '');
  const result = JSON.parse(run.stdout);
  assert.equal(result.schema, 'starci/architecture-check@1');
  assert.equal(result.ok, true);
  assert.ok(path.resolve(result.compiler.resolved).startsWith(path.resolve(targetModules)));
});

test('config has layout fields but rejects waiver and baseline fields', t => {
  const root = fixture(t, 'frontend', {
    'src/app/home/page.tsx': 'const Route=()=>null; export default Route\n',
    'src/components/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
  });
  const file = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  config.waivers = ['src/app/home/page.tsx'];
  fs.writeFileSync(file, JSON.stringify(config));
  const result = check(root);
  assert.equal(result.errors[0].ruleId, 'ARCH_CONFIG_INVALID');
  assert.match(result.errors[0].message, /unsupported fields: waivers/);
});

test('omitted owner and Grammar declarations remain explicit unavailable coverage', t => {
  const backend = fixture(t, 'backend', {
    'src/modules/value.ts': 'export const value=1\n',
    'src/features/feature.ts': 'export const feature=1\n',
  });
  const backendResult = check(backend);
  assert.deepEqual(backendResult.coverage.ownerPublicApi, { status: 'unavailable', reason: 'architecture.json does not declare owners and public entries' });
  assert.deepEqual(backendResult.coverage.grammarContract, { status: 'not-applicable' });
  assert.deepEqual(backendResult.coverage.sourceFiles, ['src/features/feature.ts', 'src/modules/value.ts']);
  assert.equal(backendResult.coverage.checkedRuleIds.includes('ARCH_OWNER_EXPORT_BYPASS'), false);
  const frontend = fixture(t, 'frontend', {
    'src/app/page.tsx': 'import { HomePage } from "@/components/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'src/components/pages/HomePage/index.tsx': 'export const HomePage=()=> <main/>\n',
  });
  const frontendResult = check(frontend);
  assert.equal(frontendResult.coverage.ownerPublicApi.status, 'unavailable');
  assert.equal(frontendResult.coverage.grammarContract.status, 'unavailable');
});

test('solution tsconfig references merge workspace programs and honor declared package exports', t => {
  const root = monorepoFixture(t, {
    'apps/web/src/app/page.tsx': 'import { HomePage } from "@/components/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/components/pages/HomePage/index.tsx': 'import { Card } from "@fixture/ui"; export const HomePage=()=> <Card/>\n',
    'packages/ui/src/index.ts': 'export { Card } from "./blocks/Card"\n',
    'packages/ui/src/blocks/Card/index.tsx': 'import { Leaf } from "../../leaves/Leaf"; export const Card=()=> <Leaf/>\n',
    'packages/ui/src/leaves/Leaf/index.tsx': 'export const Leaf=()=> <span/>\n',
  });
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.deepEqual(result.compiler.projects.sort(), ['apps/web/tsconfig.json', 'packages/ui/tsconfig.json', 'tsconfig.json']);
  assert.equal(result.files, 5);
});

test('monorepo rejects package export aliases, package to app imports, and type-only barrel bypasses', t => {
  const root = monorepoFixture(t, {
    'apps/web/src/app/page.tsx': 'import { HomePage } from "@/components/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/components/pages/HomePage/index.tsx': 'import { Leaf } from "@fixture/ui/leaves/Leaf"; export const HomePage=()=> <Leaf/>\n',
    'apps/web/src/contracts/secret.ts': 'export type AppSecret = string\n',
    'packages/ui/src/index.ts': 'export type { AppSecret } from "@fixture/app/contracts/secret"\n',
    'packages/ui/src/leaves/Leaf/index.tsx': 'export const Leaf=()=> <span/>\n',
  });
  const result = check(root);
  const rules = new Set(result.errors.map(item => item.ruleId));
  assert.ok(rules.has('ARCH_PACKAGE_IMPORTS_APP'), JSON.stringify(result, null, 2));
  assert.ok(rules.has('ARCH_PACKAGE_EXPORT_BYPASS'), JSON.stringify(result, null, 2));
});

test('single-app file dependencies participate in package export and package-to-app boundaries', t => {
  const root = fixture(t, 'frontend', {
    'src/app/page.tsx': 'import { HomePage } from "@/components/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'src/components/pages/HomePage/index.tsx': 'import { Public } from "@fixture/ui/public"; export const HomePage=()=> <Public/>\n',
    'src/contracts/app.ts': 'export type AppContract = string\n',
    'packages/ui/package.json': JSON.stringify({ name: '@fixture/ui', private: true, exports: { './public': './src/public/index.tsx' } }),
    'packages/ui/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@fixture/app/*': ['src/*'] }, noEmit: true }, include: ['src/**/*'] }),
    'packages/ui/src/public/index.tsx': 'export const Public=()=> <span/>\n',
  });
  const packageFile = path.join(root, 'package.json');
  fs.writeFileSync(packageFile, JSON.stringify({ name: '@fixture/app', private: true, dependencies: { '@fixture/ui': 'file:packages/ui' } }));
  const tsconfigFile = path.join(root, 'tsconfig.json'), config = JSON.parse(fs.readFileSync(tsconfigFile, 'utf8'));
  Object.assign(config.compilerOptions.paths, { '@fixture/ui/*': ['packages/ui/src/*'], '@fixture/app/*': ['src/*'] });
  fs.writeFileSync(tsconfigFile, JSON.stringify(config));
  let result = check(root);
  assert.equal(result.errors.some(item => item.ruleId.startsWith('ARCH_PACKAGE_')), false, JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(root, 'src/components/pages/HomePage/index.tsx'), 'import { Public } from "@fixture/ui/public"; import { Private } from "@fixture/ui/private"; export const HomePage=()=> <><Public/><Private/></>\n');
  fs.mkdirSync(path.join(root, 'packages/ui/src/private'), { recursive: true });
  fs.writeFileSync(path.join(root, 'packages/ui/src/private/index.tsx'), 'export const Private=()=> <span/>\n');
  fs.writeFileSync(path.join(root, 'packages/ui/src/public/index.tsx'), 'export type { AppContract } from "@fixture/app/contracts/app"; export const Public=()=> <span/>\n');
  result = check(root);
  const rules = new Set(result.errors.map(item => item.ruleId));
  assert.ok(rules.has('ARCH_PACKAGE_EXPORT_BYPASS'), JSON.stringify(result, null, 2));
  assert.ok(rules.has('ARCH_PACKAGE_IMPORTS_APP'), JSON.stringify(result, null, 2));
});

test('declared package export key must resolve to its declared target rather than a private alias target', t => {
  const root = monorepoFixture(t, {
    'apps/web/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@/*': ['apps/web/src/*'], '@fixture/ui/public': ['packages/ui/src/private/index.tsx'] }, noEmit: true }, include: ['src/**/*'] }),
    'apps/web/src/app/page.tsx': 'import { HomePage } from "@/components/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/components/pages/HomePage/index.tsx': 'import { Public } from "@fixture/ui/public"; export const HomePage=()=> <Public/>\n',
    'packages/ui/package.json': JSON.stringify({ name: '@fixture/ui', private: true, exports: { './public': './src/Public/index.tsx' } }),
    'packages/ui/src/Public/index.tsx': 'export const Public=()=> <span/>\n',
    'packages/ui/src/private/index.tsx': 'export const Public=()=> <span/>\n',
  });
  const result = check(root);
  assert.ok(result.errors.some(item => item.ruleId === 'ARCH_PACKAGE_EXPORT_BYPASS' && item.specifier === '@fixture/ui/public'), JSON.stringify(result, null, 2));
});

test('backend workspace packages cannot reach executable app packages through type exports', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-architecture-be-workspaces-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeFiles(root, {
    'architecture.json': JSON.stringify({ schema: 'starci/architecture-config@1', kinds: ['backend'], projects: ['tsconfig.json'], backend: { apps: 'apps/api/src' } }),
    'package.json': JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'] }),
    'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './apps/api' }, { path: './packages/domain' }] }),
    'apps/api/package.json': JSON.stringify({ name: '@fixture/api', private: true, exports: { '.': './src/main.ts', './contract': './src/contract.ts' } }),
    'apps/api/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', noEmit: true }, include: ['src/**/*'] }),
    'apps/api/src/main.ts': 'export {}\n',
    'apps/api/src/contract.ts': 'export type AppContract = string\n',
    'packages/domain/package.json': JSON.stringify({ name: '@fixture/domain', private: true, exports: { '.': './src/index.ts' } }),
    'packages/domain/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', baseUrl: '../..', paths: { '@fixture/api/*': ['apps/api/src/*'] }, noEmit: true }, include: ['src/**/*'] }),
    'packages/domain/src/index.ts': 'export type { AppContract } from "@fixture/api/contract"\n',
  });
  const result = check(root);
  assert.ok(result.errors.some(item => item.ruleId === 'ARCH_PACKAGE_IMPORTS_APP'), JSON.stringify(result, null, 2));
});

test('backend direction traverses multi-hop type-only imports and barrels', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/contract.ts': 'export type FeatureContract = string\n',
    'src/shared/barrel.ts': 'export type { FeatureContract } from "../features/orders/contract"\n',
    'src/modules/catalog/types.ts': 'import type { FeatureContract } from "../../shared/barrel"; export type CatalogContract = FeatureContract\n',
  });
  const result = check(root), violation = result.violations.find(item => item.ruleId === 'BE_MODULE_IMPORTS_FEATURE');
  assert.ok(violation, JSON.stringify(result, null, 2));
  assert.deepEqual(violation.dependencyChain.map(item => path.posix.basename(item)), ['types.ts', 'barrel.ts', 'contract.ts']);
});

test('backend direction includes static dynamic imports that use import attributes', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/contract.ts': 'export const feature = 1\n',
    'src/modules/catalog/load.ts': 'export const load = () => import("@features/orders/contract", { with: { type: "json" } })\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_MODULE_IMPORTS_FEATURE'), JSON.stringify(result, null, 2));
});

test('feature application use cases may use Nest injection but cannot reach transport DTOs or protocol framework surfaces', t => {
  const root = fixture(t, 'backend', {
    'src/modules/orders/service.ts': 'export class OrdersService { create(input: {name:string}) { return input } }\n',
    'src/features/orders/application/valid.use-case.ts': 'import * as Nest from "@nestjs/common"; import { OrdersService } from "@modules/orders/service"; @Nest.Injectable() export class ValidUseCase { constructor(private readonly orders: OrdersService) {} execute(input:{name:string}) { return this.orders.create(input) } }\n',
    'src/features/orders/application/valid-cjs.use-case.ts': 'import Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidCjsUseCase {}\n',
    'src/features/orders/application/valid-require.use-case.ts': 'const Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidRequireUseCase {}\n',
    'src/features/orders/application/valid-shadow-es.use-case.ts': 'import * as Nest from "@nestjs/common"; @Nest.Injectable() export class ValidShadowEsUseCase { execute(value:unknown){ function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
    'src/features/orders/application/valid-shadow-cjs.use-case.ts': 'import Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidShadowCjsUseCase { execute(value:unknown){ function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
    'src/features/orders/application/valid-shadow-require.use-case.ts': 'const Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidShadowRequireUseCase { execute(value:unknown){ function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
    'src/features/orders/transport/graphql/create.input.ts': 'export class CreateInput { name!: string }\n',
    'src/features/orders/transport/index.ts': 'export type { CreateInput } from "./graphql/create.input"\n',
    'src/features/orders/shared/transport-types.ts': 'export type { CreateInput } from "../transport"\n',
    'src/features/orders/application/invalid.use-case.ts': 'import * as Nest from "@nestjs/common"; import { ArgsType } from "@nestjs/graphql"; import type { CreateInput } from "../shared/transport-types"; @ArgsType() export class InvalidUseCase { execute(@Nest.Body() input:CreateInput){ return input } }\n',
    'src/features/orders/application/invalid-cjs.use-case.ts': 'import Nest = require("@nestjs/common"); export class InvalidCjsUseCase { execute(@Nest.Body() input:unknown){ return input } }\n',
    'src/features/orders/application/invalid-require.use-case.ts': 'const Nest = require("@nestjs/common"); export class InvalidRequireUseCase { execute(@Nest.Body() input:unknown){ return input } }\n',
    'src/features/orders/application/invalid-require-destructured.use-case.ts': 'const { Body } = require("@nestjs/common"); export class InvalidRequireDestructuredUseCase { execute(@Body() input:unknown){ return input } }\n',
    'src/features/orders/application/invalid-direct-require.use-case.ts': 'const DirectBody = require("@nestjs/common").Body; export class InvalidDirectRequireUseCase { execute(@DirectBody() input:unknown){ return input } }\n',
    'src/features/orders/application/invalid-destructured.use-case.ts': 'import * as Nest from "@nestjs/common"; const { Body } = Nest; export class InvalidDestructuredUseCase { execute(@Body() input:unknown){ return input } }\n',
  });
  const result = check(root), rules = result.violations.map(item => item.ruleId);
  assert.ok(rules.includes('BE_APPLICATION_IMPORTS_TRANSPORT'), JSON.stringify(result, null, 2));
  assert.ok(rules.filter(item => item === 'BE_APPLICATION_TRANSPORT_FRAMEWORK').length >= 7, JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.path.endsWith('/valid.use-case.ts')), false, JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.path.endsWith('/valid-cjs.use-case.ts')), false, JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.path.endsWith('/valid-require.use-case.ts')), false, JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.path.includes('/valid-shadow-')), false, JSON.stringify(result, null, 2));
  const dependency = result.violations.find(item => item.ruleId === 'BE_APPLICATION_IMPORTS_TRANSPORT');
  assert.deepEqual(dependency.dependencyChain.map(item => path.posix.basename(item)), ['invalid.use-case.ts', 'transport-types.ts', 'index.ts']);
});

test('feature application cannot import a protocol decorator re-exported by an internal barrel', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/shared/protocol.ts': 'export { Body } from "@nestjs/common"; export { ArgsType as Input } from "@nestjs/graphql"\n',
    'src/features/orders/shared/capability.ts': 'export const execute = (value: unknown) => value\n',
    'src/features/orders/application/valid.use-case.ts': 'import { execute } from "../shared/capability"; export class ValidUseCase { execute(value:unknown){ return execute(value) } }\n',
    'src/features/orders/application/invalid.use-case.ts': 'import { Body, Input } from "../shared/protocol"; @Input() export class InvalidUseCase { execute(@Body() input:unknown){ return input } }\n',
  });
  const result = check(root);
  const violations = result.violations.filter(item => item.ruleId === 'BE_APPLICATION_TRANSPORT_FRAMEWORK');
  assert.ok(violations.some(item => item.path.endsWith('/invalid.use-case.ts') && item.dependencyChain?.at(-1).endsWith('/shared/protocol.ts')), JSON.stringify(result, null, 2));
  assert.equal(violations.some(item => item.path.endsWith('/valid.use-case.ts')), false, JSON.stringify(result, null, 2));
});

test('declared same-source owners require named public entries without export-star barrels', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/index.ts': 'export * from "./public"\n',
    'src/features/orders/public.ts': 'export const publicOrder = 1\n',
    'src/features/orders/private.ts': 'export const secretOrder = 2\n',
    'src/features/orders/internal.ts': 'import { secretOrder } from "./private"; export const internal = secretOrder\n',
    'src/features/catalog/valid.ts': 'import { publicOrder } from "../orders"; export const valid = publicOrder\n',
    'src/features/catalog/invalid.ts': 'import { secretOrder } from "../orders/private"; export const invalid = secretOrder\n',
    'src/shared/orders.ts': 'export { secretOrder } from "../features/orders/private"\n',
    'src/features/catalog/indirect.ts': 'import { secretOrder } from "../../shared/orders"; export const indirect = secretOrder\n',
  });
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.owners = [{ id: 'feature:orders', root: 'src/features/orders', entry: 'src/features/orders/index.ts' }];
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const result = check(root);
  assert.deepEqual(result.coverage.ownerPublicApi, { status: 'checked', declarations: 1 });
  assert.ok(result.violations.some(item => item.ruleId === 'ARCH_OWNER_EXPORT_STAR' && item.path === 'src/features/orders/index.ts'), JSON.stringify(result, null, 2));
  const bypasses = result.violations.filter(item => item.ruleId === 'ARCH_OWNER_EXPORT_BYPASS');
  assert.ok(bypasses.some(item => item.path.endsWith('/invalid.ts')));
  assert.ok(bypasses.some(item => item.path.endsWith('/indirect.ts') && item.dependencyChain.some(part => part.endsWith('/shared/orders.ts'))));
  assert.equal(bypasses.some(item => item.path.endsWith('/valid.ts') || item.path.endsWith('/internal.ts')), false, JSON.stringify(result, null, 2));
});

test('owner coverage is unavailable when a declared entry is outside the checked production program', t => {
  const root = fixture(t, 'backend', {
    'src/modules/value.ts': 'export const value=1\n',
    'declared/index.ts': 'export const outsideProgram=1\n',
  });
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.owners = [{ id: 'declared:outside-program', root: 'declared', entry: 'declared/index.ts' }];
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const result = check(root);
  assert.equal(result.ok, false);
  assert.equal(result.coverage.ownerPublicApi.status, 'unavailable');
  assert.deepEqual(result.coverage.ownerPublicApi.missingEntries, ['declared/index.ts']);
  assert.ok(result.violations.some(item => item.ruleId === 'ARCH_OWNER_EXPORT_BYPASS'
    && item.path === 'declared/index.ts' && /outside the configured TypeScript programs/.test(item.message)), JSON.stringify(result, null, 2));
});

test('owner entries must be production TypeScript or JavaScript sources', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/README.md': '# Orders\n',
    'src/features/orders/value.ts': 'export const value=1\n',
  });
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.owners = [{ id: 'feature:orders', root: 'src/features/orders', entry: 'src/features/orders/README.md' }];
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const result = check(root);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].ruleId, 'ARCH_CONFIG_INVALID');
  assert.match(result.errors[0].message, /production TypeScript or JavaScript source file/);
});

test('declared Grammar contract binds public code, style entry, peers, and product imports', t => {
  const root = fixture(t, 'frontend', {
    'src/app/page.tsx': 'import { ProductPage } from "@/components/pages/ProductPage"; export default function Route(){ return <ProductPage/> }\n',
    'src/app/globals.css': '@import "@fixture/grammar/core/styles.css";\n',
    'src/components/pages/ProductPage/index.tsx': 'import { Button } from "@fixture/grammar/common"; export const ProductPage=()=> <Button/>\n',
    'src/components/pages/ProductPage/shadow.ts': 'const require=(value:string)=>value; export const local=require("@fixture/grammar/private")\n',
    'packages/grammar/src/common/index.tsx': 'export const Button=()=> <button/>\n',
    'packages/grammar/src/private.tsx': 'export const Button=()=> <button data-private/>\n',
    'packages/grammar/src/core/styles.css': ':root{}\n',
  });
  const packageFile = path.join(root, 'package.json');
  fs.writeFileSync(packageFile, JSON.stringify({ private: true, dependencies: { '@fixture/grammar': 'file:packages/grammar', react: '19.0.0', '@fixture/theme': '1.0.0' } }));
  fs.writeFileSync(path.join(root, 'packages/grammar/package.json'), JSON.stringify({ name: '@fixture/grammar',
    exports: { './common': './src/common/index.tsx', './core/styles.css': './src/core/styles.css' },
    peerDependencies: { react: '>=18', '@fixture/theme': '>=1' } }));
  const tsconfigFile = path.join(root, 'tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigFile, 'utf8'));
  tsconfig.compilerOptions.paths['@fixture/grammar/common'] = ['packages/grammar/src/common/index.tsx'];
  fs.writeFileSync(tsconfigFile, `${JSON.stringify(tsconfig, null, 2)}\n`);
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.owners = [];
  config.frontend = { grammar: { package: '@fixture/grammar', entry: '@fixture/grammar/common',
    styleEntry: '@fixture/grammar/core/styles.css', styleSources: ['src/app/globals.css'], consumerManifests: ['package.json'],
    peers: ['react', '@fixture/theme'] } };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const valid = check(root);
  assert.equal(valid.ok, true, JSON.stringify(valid, null, 2));
  assert.deepEqual(valid.coverage.ownerPublicApi, { status: 'checked', declarations: 0 });
  assert.deepEqual(valid.coverage.grammarContract, { status: 'checked', package: '@fixture/grammar' });
  for (const ruleId of ['ARCH_OWNER_EXPORT_BYPASS', 'ARCH_OWNER_EXPORT_STAR', 'ARCH_GRAMMAR_EXPORT_BYPASS', 'ARCH_GRAMMAR_CONTRACT_INVALID']) {
    assert.ok(valid.coverage.checkedRuleIds.includes(ruleId));
  }

  fs.writeFileSync(path.join(root, 'src/components/pages/ProductPage/shadow.ts'), 'export const direct=require("@fixture/grammar/private")\n');
  const realRequireBypass = check(root);
  assert.ok(realRequireBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'
    && item.path.endsWith('/shadow.ts')), JSON.stringify(realRequireBypass, null, 2));
  fs.writeFileSync(path.join(root, 'src/components/pages/ProductPage/shadow.ts'), 'const require=(value:string)=>value; export const local=require("@fixture/grammar/private")\n');

  tsconfig.compilerOptions.paths['@fixture/grammar/common'] = ['packages/grammar/src/private.tsx'];
  fs.writeFileSync(tsconfigFile, `${JSON.stringify(tsconfig, null, 2)}\n`);
  const misresolved = check(root);
  assert.ok(misresolved.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'), JSON.stringify(misresolved, null, 2));
  tsconfig.compilerOptions.paths['@fixture/grammar/common'] = ['packages/grammar/src/common/index.tsx'];
  fs.writeFileSync(tsconfigFile, `${JSON.stringify(tsconfig, null, 2)}\n`);

  fs.writeFileSync(path.join(root, 'src/app/globals.css'), '@import "@fixture/grammar/core/styles.css";\n@import "@fixture/grammar/heritage/styles.css";\n');
  const styleBypass = check(root);
  assert.ok(styleBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS' && item.specifier === '@fixture/grammar/heritage/styles.css'), JSON.stringify(styleBypass, null, 2));
  assert.ok(styleBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID' && /heritage\/styles\.css/.test(item.message)), JSON.stringify(styleBypass, null, 2));
  fs.writeFileSync(path.join(root, 'src/app/globals.css'), '@import url(@fixture/grammar/core/styles.css);\n@import url(@fixture/grammar/heritage/styles.css);\n');
  const unquotedStyleBypass = check(root);
  assert.ok(unquotedStyleBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS' && item.specifier === '@fixture/grammar/heritage/styles.css'), JSON.stringify(unquotedStyleBypass, null, 2));
  fs.writeFileSync(path.join(root, 'src/app/globals.css'), '@import "@fixture/grammar/core/styles.css";\n');

  fs.writeFileSync(path.join(root, 'src/components/pages/ProductPage/index.tsx'), 'import { Button } from "@fixture/grammar/core"; export const ProductPage=()=> <Button/>\n');
  const bypass = check(root);
  assert.ok(bypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'), JSON.stringify(bypass, null, 2));

  fs.writeFileSync(path.join(root, 'packages/grammar/package.json'), JSON.stringify({ name: '@fixture/grammar',
    exports: { './common': './src/common/index.tsx', './core/styles.css': './src/core/styles.css' },
    peerDependencies: { react: '>=18', '@fixture/theme': '>=1', '@fixture/extra': '>=1' } }));
  fs.writeFileSync(path.join(root, 'src/components/pages/ProductPage/index.tsx'), 'import { Button } from "@fixture/grammar/common"; export const ProductPage=()=> <Button/>\n');
  const extraPeer = check(root);
  assert.ok(extraPeer.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID' && /exactly match/.test(item.message)), JSON.stringify(extraPeer, null, 2));

  fs.writeFileSync(path.join(root, 'packages/grammar/package.json'), JSON.stringify({ name: '@fixture/grammar', exports: { './common': './src/common/index.tsx' }, peerDependencies: { react: '>=18' } }));
  fs.writeFileSync(path.join(root, 'src/app/globals.css'), ':root{}\n');
  const invalid = check(root);
  assert.ok(invalid.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID'), JSON.stringify(invalid, null, 2));
});

test('internal aliases and relative imports cannot resolve outside the checked repository', t => {
  const root = fixture(t, 'backend', {
    'src/modules/alias.ts': 'import { outside } from "@outside/value"; export const alias=outside\n',
    'src/modules/relative.ts': '',
    'src/features/present.ts': 'export const present=1\n',
  });
  const outside = `${root}-outside`;
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'value.ts'), 'export const outside=1\n');
  fs.writeFileSync(path.join(root, 'src/modules/relative.ts'), `import { outside } from "../../../${path.basename(outside)}/value"; export const relative=outside\n`);
  let linked = false;
  try {
    fs.symlinkSync(outside, path.join(root, 'src/outside-link'), 'junction');
    fs.writeFileSync(path.join(root, 'src/modules/symlink.ts'), 'import { outside } from "../outside-link/value"; export const symlink=outside\n');
    linked = true;
  } catch { /* Link creation can be unavailable on a locked-down Windows host. */ }
  const configFile = path.join(root, 'tsconfig.json'), config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.compilerOptions.paths['@outside/*'] = [`../${path.basename(outside)}/*`];
  fs.writeFileSync(configFile, JSON.stringify(config));
  const result = check(root), outsideErrors = result.errors.filter(item => item.ruleId === 'ARCH_INTERNAL_IMPORT_OUTSIDE');
  const expected = new Set(['@outside/value', `../../../${path.basename(outside)}/value`]);
  if (linked) expected.add('../outside-link/value');
  assert.deepEqual(new Set(outsideErrors.map(item => item.specifier)), expected);
});

test('workspace discovery supports exact and deep bounded entries and rejects unsupported local patterns', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-architecture-deep-workspaces-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeFiles(root, {
    'architecture.json': JSON.stringify({ schema: 'starci/architecture-config@1', kinds: ['frontend'], projects: ['tsconfig.json'] }),
    'package.json': JSON.stringify({ private: true, workspaces: ['apps/web', 'packages/*/plugins/*'] }),
    'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './apps/web' }, { path: './packages/domain/plugins/ui' }] }),
    'apps/web/package.json': JSON.stringify({ name: '@fixture/app', private: true }),
    'apps/web/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@fixture/ui': ['packages/domain/plugins/ui/src/index.tsx'] }, noEmit: true }, include: ['src/**/*'] }),
    'apps/web/src/app/page.tsx': 'import { HomePage } from "../components/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/app/components/pages/HomePage.tsx': 'import { Ui } from "@fixture/ui"; export const HomePage=()=> <Ui/>\n',
    'packages/domain/plugins/ui/package.json': JSON.stringify({ name: '@fixture/ui', private: true, exports: { '.': './src/index.tsx' } }),
    'packages/domain/plugins/ui/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', noEmit: true }, include: ['src/**/*'] }),
    'packages/domain/plugins/ui/src/index.tsx': 'export const Ui=()=> <span/>\n',
  });
  let result = check(root);
  assert.equal(result.errors.some(item => item.ruleId.startsWith('ARCH_PACKAGE_')), false, JSON.stringify(result, null, 2));
  const packageFile = path.join(root, 'package.json'), pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  pkg.workspaces = ['packages/**'];
  fs.writeFileSync(packageFile, JSON.stringify(pkg));
  result = check(root);
  assert.equal(result.errors[0]?.ruleId, 'ARCH_CONFIG_INVALID', JSON.stringify(result, null, 2));
});

test('frontend accepts redirect-only server routes and intrinsic client visual state', t => {
  const root = fixture(t, 'frontend', {
    'src/app/home/page.tsx': 'import { redirect } from "next/navigation"; export default async function Route({params}){const {lang}=await params;redirect(lang === "vi" ? "/next" : `/${lang}/next`)}\n',
    'src/components/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
    'src/app/guarded/page.tsx': 'import { redirect } from "next/navigation"; import { HomePage } from "@/components/pages/HomePage"; export default function Route({session,lang}){if(!session) redirect(lang === "vi" ? "/vi/login" : "/en/login");return <HomePage/>}\n',
    'src/components/leaves/Disclosure/component.tsx': '"use client"; import { useRef,useState,useEffect } from "react"; export const Disclosure=()=>{const r=useRef(null);const [open,setOpen]=useState(false);useEffect(()=>{},[]);return <button ref={r} onClick={()=>setOpen(!open)} /> }\n',
  });
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
});

test('frontend rejects a visual branch that selects a page versus no composition', t => {
  const root = fixture(t, 'frontend', {
    'src/app/home/page.tsx': 'import { HomePage } from "@/components/pages/HomePage"; export default function Route({show}){return show ? <HomePage/> : null}\n',
    'src/components/pages/HomePage/index.tsx': 'export const HomePage=()=> <main/>\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'FE_ROUTE_DRAWING_DECISION'), JSON.stringify(result, null, 2));
});

test('backend rejects decorator and declaration roles hidden in config-shaped app files', t => {
  const root = fixture(t, 'backend', {
    'src/modules/value.ts': 'export const value=1\n',
    'src/features/feature.ts': 'export const feature=1\n',
    'apps/core/src/main.ts': 'void 0\n',
    'apps/core/src/app.module.ts': 'export const AppModule=1\n',
    'apps/core/src/config/runtime.config.ts': 'function Injectable(){return ()=>{}}; @Injectable() export class PaymentProvider {}\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path.endsWith('runtime.config.ts')), JSON.stringify(result, null, 2));
});

test('backend composition roots support standard src and exact app source layouts without swallowing modules or features', t => {
  const standard = fixture(t, 'backend', {
    'src/modules/value.ts': 'export const value=1\n',
    'src/features/feature.ts': 'export const feature=1\n',
    'src/main.ts': 'void 0\n',
    'src/app.module.ts': 'export const AppModule=1\n',
    'src/orders.controller.ts': 'export class OrdersController {}\n',
  });
  let config = JSON.parse(fs.readFileSync(path.join(standard, 'architecture.json'), 'utf8'));
  config.backend = { apps: 'src' };fs.writeFileSync(path.join(standard, 'architecture.json'), JSON.stringify(config));
  let result = check(standard);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path === 'src/orders.controller.ts'), JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.path === 'src/modules/value.ts' || item.path === 'src/features/feature.ts'), false, JSON.stringify(result, null, 2));

  const exact = fixture(t, 'backend', {
    'src/modules/value.ts': 'export const value=1\n',
    'src/features/feature.ts': 'export const feature=1\n',
    'apps/core/src/main.ts': 'void 0\n',
    'apps/core/src/app.module.ts': 'export const AppModule=1\n',
    'apps/core/src/orders.controller.ts': 'export class OrdersController {}\n',
  });
  config = JSON.parse(fs.readFileSync(path.join(exact, 'architecture.json'), 'utf8'));
  config.backend = { apps: 'apps/core/src' };fs.writeFileSync(path.join(exact, 'architecture.json'), JSON.stringify(config));
  result = check(exact);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path.endsWith('orders.controller.ts')), JSON.stringify(result, null, 2));
});

test('explicit missing layout roots and empty project programs fail closed', t => {
  const root = fixture(t, 'frontend', {
    'src/app/home/page.tsx': 'export default function Route(){return null}\n',
    'src/components/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
  });
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.frontend = { components: 'src/componentz' };
  fs.writeFileSync(configFile, JSON.stringify(config));
  let result = check(root);
  assert.equal(result.errors[0].ruleId, 'ARCH_CONFIG_INVALID');
  assert.match(result.errors[0].message, /does not exist/);
  delete config.frontend;
  fs.writeFileSync(configFile, JSON.stringify(config));
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ files: [], compilerOptions: { noEmit: true } }));
  result = check(root);
  assert.ok(result.errors.some(item => ['ARCH_NO_SOURCE', 'ARCH_TSCONFIG_INVALID'].includes(item.ruleId)), JSON.stringify(result, null, 2));
});
