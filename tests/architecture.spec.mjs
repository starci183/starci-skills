import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkArchitecture } from '../scripts/checks/architecture.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');

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

function installNestTypes(root) {
  writeFiles(root, {
    'node_modules/@nestjs/common/package.json': '{"name":"@nestjs/common","types":"index.d.ts"}',
    'node_modules/@nestjs/common/index.d.ts': 'export declare function Module(metadata: Record<string, unknown>): ClassDecorator;\n',
    'node_modules/@nestjs/cqrs/package.json': '{"name":"@nestjs/cqrs","types":"index.d.ts"}',
    'node_modules/@nestjs/cqrs/index.d.ts': 'export declare function CommandHandler(message: unknown): ClassDecorator; export declare function QueryHandler(message: unknown): ClassDecorator;\n',
  });
}

function installSourceShapeTypes(root) {
  writeFiles(root, {
    'node_modules/@nestjs/graphql/package.json': '{"name":"@nestjs/graphql","types":"index.d.ts"}',
    'node_modules/@nestjs/graphql/index.d.ts': 'export declare const Args:(...args:any[])=>any; export declare const ArgsType:(...args:any[])=>any; export declare const InputType:(...args:any[])=>any; export declare const Mutation:(...args:any[])=>any; export declare const ObjectType:(...args:any[])=>any; export declare const Query:(...args:any[])=>any; export declare const Resolver:(...args:any[])=>any; export declare const registerEnumType:(...args:any[])=>any;\n',
    'node_modules/typeorm/package.json': '{"name":"typeorm","types":"index.d.ts"}',
    'node_modules/typeorm/index.d.ts': 'export declare const Entity:(...args:any[])=>any; export declare const ViewEntity:(...args:any[])=>any; export declare class EntitySchema<T=unknown>{constructor(options:unknown)} export interface MigrationInterface { up():unknown; down():unknown }\n',
  });
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
    'src/app/home/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; const Route = () => <HomePage {...{}} />; export default Route\n',
    'src/features/pages/HomePage/index.tsx': '"use client"; import { useThing } from "@/hooks"; import { HomePageBase } from "./component"; export const HomePage=()=>{useThing();return <HomePageBase />};\n',
    'src/features/pages/HomePage/component.tsx': 'import { Card } from "@/components/blocks/home/Card"; export const HomePageBase=()=> <Card />\n',
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
    'src/app/home/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; import { Leaf } from "@/components/leaves/Leaf"; const Route=()=> <><Leaf/><HomePage /></>; export default Route\n',
    'src/features/pages/HomePage/index.tsx': 'export const HomePage=()=> <main />\n',
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

test('frontend world owners may use resolved same-file, re-exported, and wrapped pure render boundaries', t => {
  const root = fixture(t, 'frontend', {
    'src/components/blocks/demo/World/index.tsx': `"use client";
import { Suspense, createElement } from "react";
import { useThing } from "@/hooks";
import { DataProvider, ProjectionProvider } from "@/modules/providers";
import { ResolvedView } from "./views";
const LoadingView=()=> <span>Loading</span>;
const renderError=()=> <p>Error</p>;
export const World=()=>{const state=useThing();if(state==="hidden")return null;if(state==="error")return renderError();return <Suspense fallback={<LoadingView/>}><ResolvedView value={state}/></Suspense>};
export const OptionalWorld=()=>{const state=useThing();return state&&<ResolvedView value={state}/>};
export const MappedWorld=()=>{const state=useThing();return [state].map((value)=><ResolvedView key={value} value={value}/>)};
export const ProjectedWorld=()=>{const state=useThing();return <ProjectionProvider content={state}><ResolvedView value={state}/></ProjectionProvider>};
export const InjectedWorld=()=>{const state=useThing();return <DataProvider content={ResolvedView} contentProps={{value:state}}/>};
export const CreatedWorld=()=>{const state=useThing();return createElement(ResolvedView,{value:state})};
export const RenderedWorld=()=>{useThing();return <ResolvedView render={()=><LoadingView/>} value="ready"/>};
`,
    'src/components/blocks/demo/World/views.tsx': 'export { ReadyView as ResolvedView } from "./ready";\n',
    'src/components/blocks/demo/World/ready.tsx': 'export const ReadyView=({value}:{value:string})=> <div>{value}</div>;\n',
    'src/components/leaves/Disclosure/index.tsx': 'import { useEffect,useRef,useState } from "react"; export const Disclosure=()=>{const ref=useRef(null);const [open,setOpen]=useState(false);useEffect(()=>{},[]);return <button ref={ref} onClick={()=>setOpen(!open)}>{open}</button>};\n',
    'src/hooks/index.ts': 'export { useThing } from "./use-thing";\n',
    'src/hooks/use-thing.ts': 'import { query } from "@/modules/api/query"; export const useThing=()=>query();\n',
    'src/modules/api/query.ts': 'export const query=()=>"ready";\n',
    'src/modules/providers.tsx': 'export const ProjectionProvider=({children}:{children:any})=> <section>{children}</section>; export const DataProvider=({content:Content,contentProps}:{content:any,contentProps:any})=> <Content {...contentProps}/>;\n',
  });
  const result = check(root);
  assert.equal(result.violations.some(item => item.ruleId === 'FE_WORLD_OWNER_RENDER_BOUNDARY'), false, JSON.stringify(result, null, 2));
  assert.ok(result.coverage.checkedRuleIds.includes('FE_WORLD_OWNER_RENDER_BOUNDARY'));
});

test('frontend world owners cannot draw inline, capture owner state, choose a connected child, or hide a dynamic target', t => {
  const root = fixture(t, 'frontend', {
    'src/components/blocks/demo/Inline/index.tsx': 'import { useThing } from "@/hooks"; const read=useThing; export const Inline=()=>{const value=read();return <div>{value}</div>};\n',
    'src/components/blocks/demo/Captured/index.tsx': 'import { useThing } from "@/hooks"; export const Captured=()=>{const value=useThing();const View=()=> <span>{value}</span>;return <View/>};\n',
    'src/components/blocks/demo/Child/index.tsx': 'import { useThing } from "@/hooks"; import { ChildView } from "./view"; export const Child=()=>{const value=useThing();return <ChildView value={value}/>};\n',
    'src/components/blocks/demo/Child/view.tsx': 'export const ChildView=({value}:{value:string})=> <span>{value}</span>;\n',
    'src/components/blocks/demo/Parent/index.tsx': 'import { useThing } from "@/hooks"; import { Child } from "../Child"; import { ChildView } from "../Child/view"; export const Parent=()=>{const value=useThing();return value==="child"?<Child/>:<ChildView value={value}/>};\n',
    'src/components/blocks/demo/Dynamic/index.tsx': 'import * as Hooks from "@/hooks"; import { ChildView } from "../Child/view"; const views={ready:ChildView}; export const Dynamic=({kind}:{kind:string})=>{Hooks.useThing();const Target=views[kind as keyof typeof views];return <Target value="ready"/>};\n',
    'src/components/blocks/demo/DynamicProvider/index.tsx': 'import { useThing } from "@/hooks"; import { DataProvider } from "@/modules/providers"; import { ChildView } from "../Child/view"; const views={ready:ChildView}; export const DynamicProvider=({kind}:{kind:string})=>{const value=useThing();return <DataProvider content={views[kind as keyof typeof views]} contentProps={{value}}/>};\n',
    'src/components/blocks/demo/Frame/index.tsx': 'export const Frame=({children,render}:{children?:any,render?:()=>any})=> <section>{render?.()}{children}</section>;\n',
    'src/components/blocks/demo/Aliased/index.tsx': 'import { useThing } from "@/hooks"; const first=useThing; const second=first; export const Aliased=()=>{const value=second();return <div>{value}</div>};\n',
    'src/components/blocks/demo/RenderProp/index.tsx': 'import { useThing } from "@/hooks"; import { Frame } from "../Frame"; export const RenderProp=()=>{const value=useThing();return <Frame render={()=><div>{value}</div>}/>};\n',
    'src/components/blocks/demo/ChildDraw/index.tsx': 'import { useThing } from "@/hooks"; import { Frame } from "../Frame"; export const ChildDraw=()=>{const value=useThing();return <Frame><div>{value}</div></Frame>};\n',
    'src/components/blocks/demo/Created/index.tsx': 'import * as React from "react"; import { useThing } from "@/hooks"; export const Created=()=>{const value=useThing();return React.createElement("div",null,value)};\n',
    'src/hooks/index.ts': 'export { useThing } from "./use-thing";\n',
    'src/hooks/use-thing.ts': 'export const useThing=()=>"ready";\n',
    'src/modules/providers.tsx': 'export const DataProvider=({content:Content,contentProps}:{content:any,contentProps:any})=> <Content {...contentProps}/>;\n',
  });
  const result = check(root);
  const findings = result.violations.filter(item => item.ruleId === 'FE_WORLD_OWNER_RENDER_BOUNDARY');
  for (const owner of ['Inline', 'Captured', 'Parent', 'Dynamic', 'DynamicProvider', 'Aliased', 'RenderProp', 'ChildDraw', 'Created']) {
    assert.ok(findings.some(item => item.path.includes(`/${owner}/`)), `${owner}: ${JSON.stringify(result, null, 2)}`);
  }
  assert.equal(findings.some(item => item.path.includes('/Child/')), false, JSON.stringify(result, null, 2));
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

test('check emits one actionable JSON record and uses target-local TypeScript', t => {
  const root = fixture(t, 'backend', {
    'src/modules/value.ts': 'export const value=1\n',
    'src/features/feature.ts': 'import { value } from "@modules/value"; export const feature=value\n',
  });
  const targetModules = path.join(root, 'node_modules');
  fs.mkdirSync(targetModules);
  const installedTypeScript = path.dirname(require.resolve('typescript/package.json'));
  fs.cpSync(installedTypeScript, path.join(targetModules, 'typescript'), { recursive: true });
  const result = checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json' });
  assert.equal(result.schema, 'starci/architecture-check@1');
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(path.resolve(result.compiler.resolved).startsWith(path.resolve(targetModules)));
});

test('config has layout fields but rejects waiver and baseline fields', t => {
  const root = fixture(t, 'frontend', {
    'src/app/home/page.tsx': 'const Route=()=>null; export default Route\n',
    'src/features/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
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
    'src/app/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'src/features/pages/HomePage/index.tsx': 'export const HomePage=()=> <main/>\n',
  });
  const frontendResult = check(frontend);
  assert.equal(frontendResult.coverage.ownerPublicApi.status, 'unavailable');
  assert.equal(frontendResult.coverage.grammarContract.status, 'unavailable');
});

test('solution tsconfig references merge workspace programs and honor declared package exports', t => {
  const root = monorepoFixture(t, {
    'apps/web/src/app/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'import { Card } from "@fixture/ui"; export const HomePage=()=> <Card/>\n',
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
    'apps/web/src/app/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'import { Leaf } from "@fixture/ui/leaves/Leaf"; export const HomePage=()=> <Leaf/>\n',
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
    'src/app/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'src/features/pages/HomePage/index.tsx': 'import { Public } from "@fixture/ui/public"; export const HomePage=()=> <Public/>\n',
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
  fs.writeFileSync(path.join(root, 'src/features/pages/HomePage/index.tsx'), 'import { Public } from "@fixture/ui/public"; import { Private } from "@fixture/ui/private"; export const HomePage=()=> <><Public/><Private/></>\n');
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
    'apps/web/src/app/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'import { Public } from "@fixture/ui/public"; export const HomePage=()=> <Public/>\n',
    'packages/ui/package.json': JSON.stringify({ name: '@fixture/ui', private: true, exports: { './public': './src/Public/index.tsx' } }),
    'packages/ui/src/Public/index.tsx': 'export const Public=()=> <span/>\n',
    'packages/ui/src/private/index.tsx': 'export const Public=()=> <span/>\n',
  });
  const result = check(root);
  assert.ok(result.errors.some(item => item.ruleId === 'ARCH_PACKAGE_EXPORT_BYPASS' && item.specifier === '@fixture/ui/public'), JSON.stringify(result, null, 2));
});

test('single-application composition root excludes nested feature/module roots from app containment', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/value.ts': 'export const value = 1\n',
    'src/modules/catalog/consumer.ts': 'import { value } from "@features/orders/value"; export const consumer = value\n',
    'src/app.module.ts': 'import { value } from "@features/orders/value"; export const AppModule = value\n',
    'src/main.ts': 'import { AppModule } from "./app.module"; void AppModule\n',
  });
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.backend = { apps: ['src'] };
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  const result = check(root);
  assert.equal(result.violations.some(item => item.ruleId === 'BE_MODULE_IMPORTS_APP'), false, JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_MODULE_IMPORTS_FEATURE'), JSON.stringify(result, null, 2));
});

test('single-application composition root still refuses a business-role file placed directly at its root', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/value.ts': 'export const value = 1\n',
    'src/modules/catalog/value.ts': 'export const catalogValue = 1\n',
    'src/app.module.ts': 'export const AppModule = 1\n',
    'src/main.ts': 'import { AppModule } from "./app.module"; void AppModule\n',
    'src/leaky.service.ts': 'export class LeakyService { run(){return 1} }\n',
  });
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.backend = { apps: ['src'] };
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path.endsWith('/leaky.service.ts')), JSON.stringify(result, null, 2));
});

test('single-application layout infers its composition root without a declared apps entry', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/value.ts': 'export const value = 1\n',
    'src/modules/catalog/value.ts': 'export const catalogValue = 1\n',
    'src/app.module.ts': 'import { value } from "@features/orders/value"; export const AppModule = value\n',
    'src/main.ts': 'import { AppModule } from "./app.module"; void AppModule\n',
    'src/leaky.service.ts': 'export class LeakyService { run(){return 1} }\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path.endsWith('/leaky.service.ts')), JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.ruleId === 'BE_MODULE_IMPORTS_APP'), false, JSON.stringify(result, null, 2));
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

test('TypeScript import types join the dependency graph and direct dynamic module names fail coverage', t => {
  const root = fixture(t, 'backend', {
    'src/features/private.ts': 'export interface Private { value:string }\n',
    'src/modules/import-type.ts': 'export type Hidden = import("@features/private").Private\n',
    'src/modules/dynamic.ts': 'const selected="@features/private"; export const load=()=>import(selected); export const loadCjs=()=>require(selected)\n',
    'src/modules/shadow.ts': 'const require=(value:string)=>value; const selected="local"; export const local=require(selected)\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_MODULE_IMPORTS_FEATURE' && item.path.endsWith('/import-type.ts')), JSON.stringify(result, null, 2));
  const dynamic = result.errors.filter(item => item.ruleId === 'ARCH_DYNAMIC_DEPENDENCY_UNPROVEN');
  assert.equal(dynamic.length, 2, JSON.stringify(result, null, 2));
  assert.ok(dynamic.every(item => item.path.endsWith('/dynamic.ts') && item.line > 0 && item.column > 0));
  assert.equal(result.errors.some(item => item.path?.endsWith('/shadow.ts')), false, JSON.stringify(result, null, 2));
  assert.ok(result.coverage.checkedRuleIds.includes('ARCH_DYNAMIC_DEPENDENCY_UNPROVEN'));
});

test('feature application use cases may use Nest injection but cannot reach transport DTOs or protocol framework surfaces', t => {
  const root = fixture(t, 'backend', {
    'src/modules/orders/service.ts': 'export class OrdersService { create(input: {name:string}) { return input } }\n',
    'src/features/orders/application/valid.use-case.ts': 'import * as Nest from "@nestjs/common"; import { OrdersService } from "@modules/orders/service"; interface ValidParams {name:string} interface ValidResult {name:string} @Nest.Injectable() export class ValidUseCase { constructor(private readonly orders: OrdersService) {} execute(input:ValidParams):ValidResult { return this.orders.create(input) } }\n',
    'src/features/orders/application/valid-cjs.use-case.ts': 'import Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidCjsUseCase {}\n',
    'src/features/orders/application/valid-require.use-case.ts': 'const Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidRequireUseCase {}\n',
    'src/features/orders/application/valid-shadow-es.use-case.ts': 'import * as Nest from "@nestjs/common"; @Nest.Injectable() export class ValidShadowEsUseCase { execute(value:unknown):unknown { function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
    'src/features/orders/application/valid-shadow-cjs.use-case.ts': 'import Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidShadowCjsUseCase { execute(value:unknown):unknown { function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
    'src/features/orders/application/valid-shadow-require.use-case.ts': 'const Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidShadowRequireUseCase { execute(value:unknown):unknown { function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
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

test('Nest registration derives exported class-token ownership and selected CQRS handlers', t => {
  const root = fixture(t, 'backend', {
    'src/framework.ts': 'export { Module as NestModule } from "@nestjs/common"; export { CommandHandler as HandlesCommand } from "@nestjs/cqrs";\n',
    'src/modules/catalog/catalog.service.ts': 'export class CatalogService {}\n',
    'src/modules/catalog/catalog.module.ts': 'import { NestModule } from "../../framework"; import { CatalogService } from "./catalog.service"; const StaticModule=NestModule; @StaticModule({providers:[CatalogService],exports:[CatalogService]}) export class CatalogModule {}\n',
    'src/features/orders/application/create.command.ts': 'export class CreateOrderCommand {}\n',
    'src/features/orders/application/create.handler.ts': 'import { HandlesCommand } from "../../../framework"; import { CreateOrderCommand } from "./create.command"; const SelectedHandler=HandlesCommand; @SelectedHandler(CreateOrderCommand) export class CreateOrderHandler {}\n',
    'src/features/orders/orders.module.ts': 'import { NestModule } from "../../framework"; import { CatalogModule } from "@modules/catalog/catalog.module"; import { CatalogService } from "@modules/catalog/catalog.service"; import { CreateOrderHandler } from "./application/create.handler"; @NestModule({imports:[CatalogModule],providers:[CreateOrderHandler,{provide:"LOCAL_CATALOG",useClass:CatalogService}]}) export class OrdersModule {}\n',
  });
  installNestTypes(root);
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.backend = { moduleRegistration: { providerIdentity: 'exported-class-token', handlerDecorators: ['CommandHandler', 'QueryHandler'] } };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.deepEqual(result.coverage.moduleRegistration, { status: 'checked', modules: 2, exportedClassTokenProviders: 1,
    handlers: 1, selectedHandlerDecorators: ['CommandHandler', 'QueryHandler'] });
  assert.ok(result.coverage.checkedRuleIds.includes('BE_MODULE_PROVIDER_REREGISTRATION'));
  assert.ok(result.coverage.checkedRuleIds.includes('BE_MODULE_HANDLER_REGISTRATION'));
});

test('Nest registration rejects same class-token provider duplication and missing handler registration', t => {
  const root = fixture(t, 'backend', {
    'src/modules/catalog/catalog.service.ts': 'export class CatalogService {}\n',
    'src/modules/catalog/catalog.module.ts': 'import { Module } from "@nestjs/common"; import { CatalogService } from "./catalog.service"; @Module({providers:[CatalogService,CatalogService],exports:[CatalogService]}) export class CatalogModule {}\n',
    'src/features/orders/create.command.ts': 'export class CreateOrderCommand {}\n',
    'src/features/orders/create.handler.ts': 'import { CommandHandler } from "@nestjs/cqrs"; import { CreateOrderCommand } from "./create.command"; @CommandHandler(CreateOrderCommand) export class CreateOrderHandler {}\n',
    'src/features/orders/orders.module.ts': 'import { Module } from "@nestjs/common"; import { CatalogService } from "@modules/catalog/catalog.service"; import { CreateOrderHandler } from "./create.handler"; @Module({providers:[{provide:CatalogService as unknown as typeof CatalogService,useClass:CatalogService},CreateOrderHandler,CreateOrderHandler]}) export class OrdersModule {}\n',
  });
  installNestTypes(root);
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.backend = { moduleRegistration: { providerIdentity: 'exported-class-token', handlerDecorators: ['CommandHandler', 'QueryHandler'] } };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_MODULE_PROVIDER_REREGISTRATION'
    && item.path.endsWith('/orders.module.ts') && item.ownerPath.endsWith('/catalog.module.ts')), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_MODULE_PROVIDER_REREGISTRATION'
    && item.path.endsWith('/catalog.module.ts') && item.ownerPath.endsWith('/catalog.module.ts')), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_MODULE_HANDLER_REGISTRATION'
    && item.path.endsWith('/create.handler.ts') && item.modules.length === 2), JSON.stringify(result, null, 2));
  assert.equal(result.coverage.moduleRegistration.status, 'checked');
});

test('Nest registration does not force CQRS when no recognized handler exists', t => {
  const root = fixture(t, 'backend', {
    'src/modules/plain/plain.module.ts': 'import { Module } from "@nestjs/common"; @Module({}) export class PlainModule {}\n',
  });
  installNestTypes(root);
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.backend = { moduleRegistration: { providerIdentity: 'exported-class-token', handlerDecorators: [] } };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.coverage.moduleRegistration.status, 'checked');
  assert.equal(result.coverage.moduleRegistration.handlers, 0);
});

test('Nest registration becomes unavailable for hidden metadata or unselected discovered handlers', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/find.query.ts': 'export class FindOrderQuery {}\n',
    'src/features/orders/find.handler.ts': 'import { QueryHandler } from "@nestjs/cqrs"; import { FindOrderQuery } from "./find.query"; @QueryHandler(FindOrderQuery) export class FindOrderHandler {}\n',
    'src/features/orders/orders.module.ts': 'import { Module } from "@nestjs/common"; import { FindOrderHandler } from "./find.handler"; const providers=[FindOrderHandler]; @Module({providers}) export class OrdersModule {}\n',
    'src/features/orders/legacy.module.ts': 'const {Module}=require("@nestjs/common"); @Module({}) export class LegacyModule {}\n',
    'src/features/orders/mutable.module.ts': 'import { Module } from "@nestjs/common"; let MutableModule=Module; @MutableModule({}) export class MutableIdentityModule {}\n',
  });
  installNestTypes(root);
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.backend = { moduleRegistration: { providerIdentity: 'exported-class-token', handlerDecorators: ['CommandHandler'] } };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const result = check(root);
  assert.equal(result.coverage.moduleRegistration.status, 'unavailable', JSON.stringify(result, null, 2));
  assert.ok(result.coverage.moduleRegistration.details.some(item => /dynamic or unresolvable/.test(item)));
  assert.ok(result.coverage.moduleRegistration.details.some(item => /unselected QueryHandler/.test(item)));
  assert.ok(result.coverage.moduleRegistration.details.some(item => /CommonJS Nest framework binding/.test(item)));
  assert.ok(result.coverage.moduleRegistration.details.some(item => /mutable Module decorator identity/.test(item)));
  assert.equal(result.coverage.checkedRuleIds.includes('BE_MODULE_HANDLER_REGISTRATION'), false);
});

test('backend source shape accepts adopted application, transport, persistence, enum, and GraphQL naming forms', t => {
  const root = fixture(t, 'backend', {
    'src/framework.ts': 'export { Args as GqlArgs, InputType as GqlInput, Mutation as GqlMutation, Query as GqlQuery, registerEnumType as registerGraphQlEnum } from "@nestjs/graphql"; export { Entity as DatabaseEntity } from "typeorm";\n',
    'src/features/orders/index.ts': 'export { CreateOrderUseCase } from "./application/create-order.use-case";\n',
    'src/features/orders/orders.module.ts': 'export class OrdersModule {}\n',
    'src/features/orders/application/create-order.contracts.ts': 'export interface CreateOrderParams { readonly itemId:string } export interface CreateOrderResult { readonly id:string }\n',
    'src/features/orders/application/create-order.use-case.ts': 'import type { CreateOrderParams,CreateOrderResult } from "./create-order.contracts"; export class CreateOrderUseCase { execute(input:CreateOrderParams):CreateOrderResult{return {id:input.itemId}} }\n',
    'src/features/orders/transport/graphql/dto/create-order.request.ts': 'import { GqlInput } from "../../../../../framework"; @GqlInput() export class CreateOrderRequest { itemId!:string }\n',
    'src/features/orders/transport/graphql/create-order.resolver.ts': 'import { GqlArgs,GqlMutation } from "../../../../framework"; import { CreateOrderRequest } from "./dto/create-order.request"; export class CreateOrderResolver { @GqlMutation(()=>String,{name:"createOrder"}) create(@GqlArgs("request") request:CreateOrderRequest){return request.itemId} }\n',
    'src/modules/platform/database/entities/order.entity.ts': 'import { DatabaseEntity } from "../../../../framework"; @DatabaseEntity() export class OrderEntity {}\n',
    'src/modules/catalog/enums/order-status.ts': 'import { registerGraphQlEnum } from "../../../framework"; export enum OrderStatus { Pending="pending", Complete="complete" } registerGraphQlEnum(OrderStatus,{name:"OrderStatus"});\n',
    'src/modules/catalog/errors/challenge-not-found.ts': 'export class ChallengeNotFoundException extends Error {}\n',
  });
  installSourceShapeTypes(root);
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.deepEqual(result.coverage.backendSourceShape, {
    files: 9, legacyFiles: [], layout: { status: 'checked' }, naming: { status: 'checked' },
  });
  assert.ok(result.coverage.checkedRuleIds.includes('BE_FEATURE_LAYOUT_INVALID'));
  assert.ok(result.coverage.checkedRuleIds.includes('BE_SOURCE_NAME_INVALID'));
});

test('backend source shape locates layer, class, enum, contract, and GraphQL naming violations', t => {
  const root = fixture(t, 'backend', {
    'src/features/orders/application/create-order.request.ts': 'export class CreateOrderRequest {}\n',
    'src/features/orders/application/create-order.contracts.ts': 'interface CreateOrderData { readonly itemId:string } type WrappedWrong=Readonly<{readonly value:string}>; type Shape={readonly x:string}; type AliasWrong=Shape; type Pick<T,K extends keyof T>=string; type Scalar=Pick<{readonly ignored:string},"ignored">; export {CreateOrderData,WrappedWrong,AliasWrong,Scalar};\n',
    'src/modules/catalog/bad_Name.service.ts': 'export class WrongName {}\n',
    'src/modules/catalog/export-list.service.ts': 'class ExportListWrong {} export {ExportListWrong};\n',
    'src/modules/catalog/class-expression.service.ts': 'export const Wrong=class {};\n',
    'src/modules/catalog/named-expression.service.ts': 'const Value=class InnerWrong {}; export {Value};\n',
    'src/features/orders/transport/http/run.use-case.ts': 'export class RunUseCase {}\n',
    'src/features/orders/transport/graphql/dto/order.entity.ts': 'import { Entity } from "typeorm"; @Entity() export class OrderEntity {}\n',
    'src/features/orders/migrations/1790000000000-CreateOrders.ts': 'export class CreateOrders { up(){} down(){} }\n',
    'src/features/orders/transport/graphql/order-view.mapper.ts': 'import { ViewEntity } from "typeorm"; @ViewEntity() export class OrderViewMapper {}\n',
    'src/features/orders/application/order-schema.use-case.ts': 'import { EntitySchema } from "typeorm"; const make=()=>new EntitySchema({name:"order"}); export const schema=make();\n',
    'src/features/orders/transport/graphql/create-order.input.ts': 'import { InputType } from "@nestjs/graphql"; @InputType() export class CreateOrderInput {}\n',
    'src/features/orders/transport/graphql/create-order.resolver.ts': 'import { Args,Mutation } from "@nestjs/graphql"; export class CreateOrderResolver { @Mutation(()=>String,{name:"Create_Order"}) create(@Args("itemId") itemId:string){return itemId} }\n',
    'src/modules/catalog/enums/order-status.ts': 'export const enum orderStatus { pending=1 }\n',
  });
  installSourceShapeTypes(root);
  const result = check(root);
  assert.equal(result.coverage.backendSourceShape.layout.status, 'checked', JSON.stringify(result, null, 2));
  assert.equal(result.coverage.backendSourceShape.naming.status, 'checked', JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_FEATURE_LAYOUT_INVALID' && /request source/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_FEATURE_LAYOUT_INVALID' && /TypeORM entities/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_FEATURE_LAYOUT_INVALID' && item.path.endsWith('/order-view.mapper.ts')), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_FEATURE_LAYOUT_INVALID' && /Migration source/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_FEATURE_LAYOUT_INVALID' && /EntitySchema/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && /Source basename/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && /Exported class WrongName/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && item.path.endsWith('/export-list.service.ts')), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && item.path.endsWith('/class-expression.service.ts')), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && item.path.endsWith('/named-expression.service.ts')), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && /CreateOrderData/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && /WrappedWrong/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && /AliasWrong/.test(item.message)), JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => /Scalar/.test(item.message)), false, JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && /Enums must/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && /GraphQL field name/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_NAME_INVALID' && /literal name request/.test(item.message)), JSON.stringify(result, null, 2));
});

test('backend source shape exposes legacy and dynamic naming as unavailable coverage', t => {
  const root = fixture(t, 'backend', {
    'src/features/legacy/old.service.ts': 'export class OldService {}\n',
    'src/features/orders/application/run.workflow.ts': 'export const run=()=>"ok";\n',
    'src/features/orders/transport/graphql/order.resolver.ts': 'import { Query } from "@nestjs/graphql"; const FIELD="order"; export class OrderResolver { @Query(()=>String,{name:FIELD}) order(){return "order"} }\n',
    'src/features/orders/transport/graphql/wrapped.resolver.ts': 'import { Query } from "@nestjs/graphql"; const make=()=>Query; const Wrapped=make(); export class WrappedResolver { @Wrapped(()=>String,{name:"wrapped"}) wrapped(){return "wrapped"} }\n',
    'src/features/orders/transport/graphql/deep.resolver.ts': 'import { Query } from "@nestjs/graphql"; const q0=()=>Query; const q1=()=>q0(); const q2=()=>q1(); const q3=()=>q2(); const q4=()=>q3(); const q5=()=>q4(); const q6=()=>q5(); const q7=()=>q6(); const q8=()=>q7(); const q9=()=>q8(); const q10=()=>q9(); const q11=()=>q10(); const q12=()=>q11(); const Deep=q12(); export class DeepResolver { @Deep(()=>String,{name:"deep"}) deep(){return "deep"} }\n',
    'src/modules/catalog/engine.workflow.ts': 'export class EngineWorkflow {}\n',
    'src/modules/catalog/graphql-enum.adapter.ts': 'export const createEnumType=(value:unknown)=>value; createEnumType({ Pending:"pending" });\n',
    'src/modules/catalog/index.ts': 'export const catalog=true;\n',
    'src/modules/catalog/public.types.ts': 'interface Workspace { readonly id:string } export {Workspace};\n',
  });
  installSourceShapeTypes(root);
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.backend = { legacyRoots: ['src/features/legacy'] };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.coverage.backendSourceShape.layout.status, 'unavailable');
  assert.equal(result.coverage.backendSourceShape.naming.status, 'unavailable');
  assert.deepEqual(result.coverage.backendSourceShape.legacyFiles, ['src/features/legacy/old.service.ts']);
  assert.equal(result.coverage.checkedRuleIds.includes('BE_FEATURE_LAYOUT_INVALID'), false);
  assert.equal(result.coverage.checkedRuleIds.includes('BE_SOURCE_NAME_INVALID'), false);
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /dynamic @Query field name/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /constructed Query decorator identity/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /unproven framework decorator identity/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /unclassified file role workflow/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /GraphQL enum adapter/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /object contract Workspace/.test(item)));
  assert.ok(result.coverage.backendSourceShape.layout.details.some(item => /role workflow is not a selected application-layer role/.test(item)));
  assert.equal(result.violations.some(item => item.path.endsWith('/engine.workflow.ts')), false);
});

test('backend legacy roots must be bounded, existing, and non-overlapping', t => {
  const root = fixture(t, 'backend', {
    'src/features/legacy/nested/old.service.ts': 'export class OldService {}\n',
    'src/modules/catalog/index.ts': 'export const catalog=true;\n',
  });
  const configFile = path.join(root, 'architecture.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.backend = { legacyRoots: ['src/features/legacy', 'src/features/legacy/nested'] };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const overlap = check(root);
  assert.equal(overlap.ok, false);
  assert.equal(overlap.errors[0].ruleId, 'ARCH_CONFIG_INVALID');
  assert.match(overlap.errors[0].message, /cannot overlap/);
  config.backend = { legacyRoots: ['src'] };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const outside = check(root);
  assert.equal(outside.ok, false);
  assert.equal(outside.errors[0].ruleId, 'ARCH_CONFIG_INVALID');
  assert.match(outside.errors[0].message, /must stay inside/);
});

test('declared Grammar contract binds public code, style entry, peers, and product imports', t => {
  const root = fixture(t, 'frontend', {
    'src/app/page.tsx': 'import { ProductPage } from "@/features/pages/ProductPage"; export default function Route(){ return <ProductPage/> }\n',
    'src/app/globals.css': '@import "@fixture/grammar/core/styles.css";\n',
    'src/features/pages/ProductPage/index.tsx': 'import { Button } from "@fixture/grammar/common"; export const ProductPage=()=> <Button/>\n',
    'src/features/pages/ProductPage/shadow.ts': 'const require=(value:string)=>value; export const local=require("@fixture/grammar/private")\n',
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
  config.owners = [{ id: 'product-page', root: 'src/features/pages/ProductPage', entry: 'src/features/pages/ProductPage/index.tsx' }];
  config.frontend = { grammar: { package: '@fixture/grammar', entry: '@fixture/grammar/common',
    styleEntry: '@fixture/grammar/core/styles.css', styleSources: ['src/app/globals.css'], consumerManifests: ['package.json'],
    peers: ['react', '@fixture/theme'] } };
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const valid = check(root);
  assert.equal(valid.ok, true, JSON.stringify(valid, null, 2));
  assert.deepEqual(valid.coverage.ownerPublicApi, { status: 'checked', declarations: 1 });
  assert.deepEqual(valid.coverage.grammarContract, { status: 'checked', package: '@fixture/grammar' });
  for (const ruleId of ['ARCH_OWNER_EXPORT_BYPASS', 'ARCH_OWNER_EXPORT_STAR', 'ARCH_GRAMMAR_EXPORT_BYPASS', 'ARCH_GRAMMAR_CONTRACT_INVALID']) {
    assert.ok(valid.coverage.checkedRuleIds.includes(ruleId));
  }

  fs.writeFileSync(path.join(root, 'src/features/pages/ProductPage/shadow.ts'), 'export const direct=require("@fixture/grammar/private")\n');
  const realRequireBypass = check(root);
  assert.ok(realRequireBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'
    && item.path.endsWith('/shadow.ts')), JSON.stringify(realRequireBypass, null, 2));
  fs.writeFileSync(path.join(root, 'src/features/pages/ProductPage/shadow.ts'), 'const require=(value:string)=>value; export const local=require("@fixture/grammar/private")\n');

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

  fs.writeFileSync(path.join(root, 'src/features/pages/ProductPage/index.tsx'), 'import { Button } from "@fixture/grammar/core"; export const ProductPage=()=> <Button/>\n');
  const bypass = check(root);
  assert.ok(bypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'), JSON.stringify(bypass, null, 2));

  fs.writeFileSync(path.join(root, 'packages/grammar/package.json'), JSON.stringify({ name: '@fixture/grammar',
    exports: { './common': './src/common/index.tsx', './core/styles.css': './src/core/styles.css' },
    peerDependencies: { react: '>=18', '@fixture/theme': '>=1', '@fixture/extra': '>=1' } }));
  fs.writeFileSync(path.join(root, 'src/features/pages/ProductPage/index.tsx'), 'import { Button } from "@fixture/grammar/common"; export const ProductPage=()=> <Button/>\n');
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
    'src/features/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
    'src/app/guarded/page.tsx': 'import { redirect } from "next/navigation"; import { HomePage } from "@/features/pages/HomePage"; export default function Route({session,lang}){if(!session) redirect(lang === "vi" ? "/vi/login" : "/en/login");return <HomePage/>}\n',
    'src/components/leaves/Disclosure/component.tsx': '"use client"; import { useRef,useState,useEffect } from "react"; export const Disclosure=()=>{const r=useRef(null);const [open,setOpen]=useState(false);useEffect(()=>{},[]);return <button ref={r} onClick={()=>setOpen(!open)} /> }\n',
  });
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
});

test('frontend rejects a visual branch that selects a page versus no composition', t => {
  const root = fixture(t, 'frontend', {
    'src/app/home/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route({show}){return show ? <HomePage/> : null}\n',
    'src/features/pages/HomePage/index.tsx': 'export const HomePage=()=> <main/>\n',
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
    'src/features/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
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

test('the architecture CLI exits on the record: 0 ok, 1 violations or errors, 2 bad arguments; it never passes silently', async (t) => {
  const { spawnSync } = await import('node:child_process');
  const { architectureMain } = await import('../scripts/checks/architecture.mjs');
  const { fileURLToPath } = await import('node:url');
  const cli = fileURLToPath(new URL('../scripts/checks/architecture.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(run().status, 2, 'no repository root is a usage error');
  assert.equal(run('.', '--config').status, 2, '--config without a file is a usage error');
  const root = fixture(t, 'frontend', { 'src/app/page.tsx': 'export default function Page() { return null; }\n' });
  const unavailable = run(root, '--config', 'architecture.json');
  assert.equal(unavailable.status, 1, 'a check that cannot load the target TypeScript fails');
  const record = JSON.parse(unavailable.stdout);
  assert.equal(record.schema, 'starci/architecture-check@1');
  assert.equal(record.ok, false);
  assert.equal(record.errors[0].ruleId, 'ARCH_TYPESCRIPT_MISSING');
  const out = [];
  const main = (check) => architectureMain([root], { check, write: (text) => out.push(text), fail: () => {} });
  assert.equal(main(() => ({ schema: 'starci/architecture-check@1', ok: true, violations: [], errors: [] })), 0);
  assert.equal(main(() => ({ schema: 'starci/architecture-check@1', ok: false, violations: [{ ruleId: 'FE_TIER_IMPORTS_UPWARD' }], errors: [] })), 1);
  assert.equal(main(() => { throw Error('boom'); }), 1, 'a crashing check fails closed');
  assert.equal(JSON.parse(out.at(-1)).errors[0].ruleId, 'ARCH_EXECUTION_UNAVAILABLE');
});
