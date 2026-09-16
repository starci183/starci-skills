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
    'src/features/orders/transport/graphql/create.input.ts': 'export class CreateInput { name!: string }\n',
    'src/features/orders/transport/index.ts': 'export type { CreateInput } from "./graphql/create.input"\n',
    'src/features/orders/shared/transport-types.ts': 'export type { CreateInput } from "../transport"\n',
    'src/features/orders/application/invalid.use-case.ts': 'import * as Nest from "@nestjs/common"; import { ArgsType } from "@nestjs/graphql"; import type { CreateInput } from "../shared/transport-types"; @ArgsType() export class InvalidUseCase { execute(@Nest.Body() input:CreateInput){ return input } }\n',
  });
  const result = check(root), rules = result.violations.map(item => item.ruleId);
  assert.ok(rules.includes('BE_APPLICATION_IMPORTS_TRANSPORT'), JSON.stringify(result, null, 2));
  assert.ok(rules.filter(item => item === 'BE_APPLICATION_TRANSPORT_FRAMEWORK').length >= 2, JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.path.endsWith('/valid.use-case.ts')), false, JSON.stringify(result, null, 2));
  const dependency = result.violations.find(item => item.ruleId === 'BE_APPLICATION_IMPORTS_TRANSPORT');
  assert.deepEqual(dependency.dependencyChain.map(item => path.posix.basename(item)), ['invalid.use-case.ts', 'transport-types.ts', 'index.ts']);
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
