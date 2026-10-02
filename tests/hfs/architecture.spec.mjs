import test from 'node:test';
import { hfsReadme } from '../helpers/hfs-tree-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { checkArchitecture } from '../../scripts/hfs/architecture.mjs';
import { HFS_MACHINE_RULE_IDS as MACHINE_RULE_IDS } from '../../scripts/hfs/architecture/index.mjs';
import { loadArchitectureConfig } from '../../scripts/hfs/architecture/config.mjs';
import { appDeclaration } from '../helpers/hfs-arch-fixture.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// The architecture rules exercised through hfs.json fixtures. The declaration is hfs.json (profile be|fe plus
// apps); owners, roots, registration and the Grammar contract are derived, so a rule is exercised by shaping the tree.
// The HFS machine (tier direction, reachability, dead exports, required files, size growth, duplicate blocks) runs on every
// fixture too and has its own specs (as do the backend composition and data checks); check() below drops its findings so this spec judges the rules it is about.
const HFS_MACHINE_RULE_IDS = new Set(MACHINE_RULE_IDS);

function scoped(report) {
  const violations = report.violations.filter(item => !HFS_MACHINE_RULE_IDS.has(item.ruleId));
  return { ...report, violations, ok: report.errors.length === 0 && violations.length === 0 };
}

/**
 * The files of a side written in the app shape: `package.json` is the app's one manifest at the app root and its workspaces the
 * side's apps and packages (`apps/*` becomes `<side>/apps/*`, `packages/*` becomes `<side>/packages/*`); each app keeps its own
 * package.json (an npm workspace, HFS_MONO_FE_WORKSPACE).
 */
function appShaped(side, files) {
  const out = { ...files };
  const manifest = JSON.parse(out['package.json'] ?? '{"private":true}');
  delete out['package.json'];
  if (Array.isArray(manifest.workspaces)) {
    manifest.workspaces = manifest.workspaces.map(pattern => `${side}/${pattern}`);
    if (!manifest.workspaces.length) delete manifest.workspaces;
  }
  out['../package.json'] = JSON.stringify(manifest);
  return out;
}

function fixture(t, kind, files = {}, apps = kind === 'backend' ? [{ name: 'core', kind: 'api' }] : [{ name: 'web', kind: 'next' }]) {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), `starci-architecture-${kind}-`));
  t.after(() => fs.rmSync(appRoot, { recursive: true, force: true }));
  const side = kind === 'backend' ? 'be' : 'fe';
  const root = path.join(appRoot, side);
  const app = apps[0].name;
  const declaration = appDeclaration(side, { apps });
  const tsconfig = `${JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'preserve',
      baseUrl: '.',
      paths: {
        '@modules/*': ['src/modules/domain/*'],
        '@features/*': ['src/features/*'],
        '@/*': [kind === 'frontend' ? `apps/${app}/src/*` : 'src/*'],
      },
      allowJs: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ['src/**/*', 'apps/**/*'],
  }, null, 2)}\n`;
  const baseline = {
    '../.gitattributes': '* text=auto eol=lf\n',
    '../.github/workflows/check.yml': 'name: check\n',
    '../.gitignore': 'node_modules/\n',
    '../.husky/pre-commit': 'exit 0\n',
    '../README.md': hfsReadme(appRoot),
    'eslint.config.mjs': 'export default [];\n',
    '../package-lock.json': '{}\n',
    'package.json': JSON.stringify({ private: true }),
    '../sonar-project.properties': 'sonar.projectKey=fixture\n',
    '../hfs.json': `${JSON.stringify(declaration, null, 2)}
`,
    'tsconfig.json': tsconfig,
    ...(kind === 'backend' ? {
      '../.sops.yaml': 'creation_rules: []\n',
      '../.starcistacks/application-stacks.yaml': 'environments: []\n',
      '../.starciwork/.gitignore': 'runtime.sqlite\n',
      'tsconfig.build.json': '{}\n',
      'jest.config.js': 'module.exports = {};\n',
      'nest-cli.json': '{}\n',
      'src/tests/fixtures/.keep': '',
      [`apps/${app}/src/main.ts`]: 'void 0\n',
      [`apps/${app}/src/app.module.ts`]: 'export const AppModule = 1\n',
    } : {
      'stylelint.config.mjs': 'export default {};\n',
      [`apps/${app}/next.config.ts`]: 'export default {};\n',
      [`apps/${app}/postcss.config.mjs`]: 'export default {};\n',
      [`apps/${app}/tsconfig.json`]: JSON.stringify({ extends: '../../tsconfig.json', include: ['src/**/*'] }),
      [`apps/${app}/src/.keep`]: '',
      // every fe app is an npm workspace with its own manifest (HFS_MONO_FE_WORKSPACE)
      ...Object.fromEntries(apps.map((entry) => [`apps/${entry.name}/package.json`, JSON.stringify({ name: `@fixture/${entry.name}`, private: true })])),
    }),
  };
  // A null entry removes a baseline file (a test that needs the tree without it).
  const fixtureFiles = appShaped(side, Object.fromEntries(Object.entries({ ...baseline, ...files }).filter(([, content]) => content !== null)));
  writeFiles(root, fixtureFiles);
  execFileSync('git', ['init', '-q'], { cwd: appRoot });
  execFileSync('git', ['add', '-A'], { cwd: appRoot });
  return root;
}

function check(root) {
  return scoped(checkArchitecture({ repositoryRoot: root, injectedTypeScript: ts }));
}

/** The unfiltered report, tier-direction findings included (check() drops them). */
function checkAll(root) {
  return checkArchitecture({ repositoryRoot: root, injectedTypeScript: ts });
}

/** The derived owner ids of a fixture (slot id and root), the way the loader lists them. */
function ownerIds(root) {
  return loadArchitectureConfig(root).owners.map(owner => owner.id);
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
  return fixture(t, 'frontend', {
    'package.json': JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'] }),
    'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './apps/web' }, { path: './packages/ui' }] }),
    'apps/web/package.json': JSON.stringify({ name: '@fixture/app', private: true }),
    'apps/web/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@/*': ['apps/web/src/*'], '@fixture/ui': ['packages/ui/src/index.ts'], '@fixture/ui/*': ['packages/ui/src/*'] }, noEmit: true }, include: ['src/**/*'] }),
    'packages/ui/package.json': JSON.stringify({ name: '@fixture/ui', private: true, exports: { '.': './src/index.ts', './leaves/*': './src/leaves/*/index.tsx' } }),
    'packages/ui/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@fixture/app/*': ['apps/web/src/*'] }, noEmit: true }, include: ['src/**/*'] }),
    ...files,
  });
}

test('backend accepts inward composition and narrow bootstrap configuration', t => {
  const root = fixture(t, 'backend', {
    'src/modules/domain/catalog/value.ts': 'export const value = 1\n',
    'src/features/api/http/feature.ts': 'import { value } from "@modules/catalog/value"; export const feature = value\n',
    'apps/core/src/core.options.ts': 'export const runtime = { port: 3000 }\n',
    'apps/core/src/app.module.ts': 'import { feature } from "@features/api/http/feature"; export const AppModule = feature\n',
    'apps/core/src/main.ts': 'import { AppModule } from "./app.module"; void AppModule\n',
  });
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.files, 5);
  assert.deepEqual(result.coverage.sourceFiles, [
    'apps/core/src/app.module.ts',
    'apps/core/src/core.options.ts',
    'apps/core/src/main.ts',
    'src/features/api/http/feature.ts',
    'src/modules/domain/catalog/value.ts',
  ]);
  assert.ok(result.coverage.checkedRuleIds.includes('BE_TIER_DIRECTION'));
  assert.ok(result.coverage.checkedRuleIds.includes('ARCH_INTERNAL_IMPORT_UNRESOLVED'));
  assert.equal(result.coverage.checkedRuleIds.some(ruleId => ruleId.startsWith('FE_')), false);
});

test('backend resolves aliases, relative imports, and re-export barrels before enforcing direction', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/http/feature.ts': 'export const feature = 1\n',
    'src/modules/domain/shared/barrel.ts': 'export * from "../../../features/api/http/feature"\n',
    'src/modules/domain/shared/consumer.ts': 'import { feature } from "@modules/shared/barrel"; export const value = feature\n',
    'src/features/api/http/app-link.ts': 'export * from "../../../../apps/core/src/app.module"\n',
    'apps/core/src/app.module.ts': 'export const AppModule = 1\n',
    'apps/core/src/main.ts': 'void 0\n',
    'apps/core/src/orders.controller.ts': 'export class OrdersController {}\n',
    'apps/core/src/helper.ts': 'export const business = 1\n',
  });
  const result = check(root);
  const rules = new Set(result.violations.map(item => item.ruleId));
  assert.ok(rules.has('BE_APP_BUSINESS_ROLE'));
  assert.ok(rules.has('BE_APP_COMPOSITION_ONLY'));
  const all = checkAll(root);
  const barrel = all.violations.find(item => item.ruleId === 'BE_TIER_DIRECTION' && item.path.endsWith('barrel.ts'));
  assert.ok(barrel, JSON.stringify(all, null, 2));
  assert.ok(barrel.line > 0 && barrel.column > 0);
  assert.ok(all.violations.some(item => item.ruleId === 'BE_TIER_DIRECTION' && item.path.endsWith('app-link.ts')), JSON.stringify(all, null, 2));
});

test('frontend accepts a one-page route, downward tiers, connected hook barrel, and hook-owned transport', t => {
  const root = fixture(t, 'frontend', {
    'apps/web/src/app/home/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; const Route = () => <HomePage {...{}} />; export default Route\n',
    'apps/web/src/features/pages/HomePage/index.tsx': '"use client"; import { useThing } from "@/hooks"; import { HomePageBase } from "./component"; export const HomePage=()=>{useThing();return <HomePageBase />};\n',
    'apps/web/src/features/pages/HomePage/component.tsx': 'import { Card } from "@/components/blocks/home/Card"; export const HomePageBase=()=> <Card />\n',
    'apps/web/src/components/blocks/home/Card/index.tsx': 'import { Leaf } from "@/components/leaves/Leaf"; export const Card=()=> <Leaf />\n',
    'apps/web/src/components/leaves/Leaf/index.tsx': 'export const Leaf=()=> <span />\n',
    'apps/web/src/hooks/index.ts': 'export { useThing } from "./swr/useThing"\n',
    'apps/web/src/hooks/swr/useThing.ts': 'import { query } from "@/modules/api/query"; export const useThing=()=>query()\n',
    'apps/web/src/modules/api/query.ts': 'export const query=()=>fetch("/graphql")\n',
  });
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
});

test('frontend catches route drawing, upward tiers, direct/deep data access, barrel bypass, world hooks, and raw fetch', t => {
  const root = fixture(t, 'frontend', {
    'apps/web/src/app/home/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; import { Leaf } from "@/components/leaves/Leaf"; const Route=()=> <><Leaf/><HomePage /></>; export default Route\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'export const HomePage=()=> <main />\n',
    'apps/web/src/components/blocks/home/Card/index.tsx': 'import { useThing } from "@/hooks/swr/useThing"; export const Card=()=>{useThing();return <div/>}\n',
    'apps/web/src/components/leaves/Leaf/index.tsx': 'import { Card } from "../../blocks/home/Card"; export const Leaf=()=> <Card/>\n',
    'apps/web/src/components/blocks/home/Pure/component.tsx': '"use client"; import { useContext } from "react"; import { query } from "../../../../bridge"; export const Pure=()=>{useContext(null as never);fetch("/x");return <div>{query()}</div>}\n',
    'apps/web/src/bridge.ts': 'export * from "./hooks/swr/useThing"\n',
    'apps/web/src/hooks/index.ts': 'export { useThing } from "./swr/useThing"\n',
    'apps/web/src/hooks/swr/useThing.ts': 'import { query } from "@/modules/api/query"; export const useThing=()=>query()\n',
    'apps/web/src/modules/api/query.ts': 'export const query=()=>1\n',
  });
  const result = check(root);
  const rules = new Set(result.violations.map(item => item.ruleId));
  assert.ok(checkAll(root).violations.some(item => item.ruleId === 'FE_TIER_DIRECTION' && item.path.endsWith('Leaf/index.tsx')), JSON.stringify(result, null, 2));
  for (const expected of ['FE_ROUTE_ONE_PAGE', 'FE_COMPONENT_DEEP_HOOK_IMPORT',
    'FE_PURE_REACHES_DATA', 'FE_PURE_WORLD_HOOK']) assert.ok(rules.has(expected), `${expected}: ${JSON.stringify(result, null, 2)}`);
  // FE_TRANSPORT_OWNER belongs to the frontend repository machine (check() drops it): read it from the unfiltered report.
  assert.ok(checkAll(root).violations.some(item => item.ruleId === 'FE_TRANSPORT_OWNER' && item.path.endsWith('Pure/component.tsx')), 'raw fetch outside the transport client');
  assert.ok(result.violations.find(item => item.ruleId === 'FE_PURE_REACHES_DATA').dependencyChain.some(item => item.endsWith('bridge.ts')));
});

test('frontend world owners may use resolved same-file, re-exported, and wrapped pure render boundaries', t => {
  const root = fixture(t, 'frontend', {
    'apps/web/src/components/blocks/demo/World/index.tsx': `"use client";
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
    'apps/web/src/components/blocks/demo/World/views.tsx': 'export { ReadyView as ResolvedView } from "./ready";\n',
    'apps/web/src/components/blocks/demo/World/ready.tsx': 'export const ReadyView=({value}:{value:string})=> <div>{value}</div>;\n',
    'apps/web/src/components/leaves/Disclosure/index.tsx': 'import { useEffect,useRef,useState } from "react"; export const Disclosure=()=>{const ref=useRef(null);const [open,setOpen]=useState(false);useEffect(()=>{},[]);return <button ref={ref} onClick={()=>setOpen(!open)}>{open}</button>};\n',
    'apps/web/src/hooks/index.ts': 'export { useThing } from "./use-thing";\n',
    'apps/web/src/hooks/use-thing.ts': 'import { query } from "@/modules/api/query"; export const useThing=()=>query();\n',
    'apps/web/src/modules/api/query.ts': 'export const query=()=>"ready";\n',
    'apps/web/src/modules/providers.tsx': 'export const ProjectionProvider=({children}:{children:any})=> <section>{children}</section>; export const DataProvider=({content:Content,contentProps}:{content:any,contentProps:any})=> <Content {...contentProps}/>;\n',
  });
  const result = check(root);
  assert.equal(result.violations.some(item => item.ruleId === 'FE_WORLD_OWNER_RENDER_BOUNDARY'), false, JSON.stringify(result, null, 2));
  assert.ok(result.coverage.checkedRuleIds.includes('FE_WORLD_OWNER_RENDER_BOUNDARY'));
});

test('frontend world owners cannot draw inline, capture owner state, choose a connected child, or hide a dynamic target', t => {
  const root = fixture(t, 'frontend', {
    'apps/web/src/components/blocks/demo/Inline/index.tsx': 'import { useThing } from "@/hooks"; const read=useThing; export const Inline=()=>{const value=read();return <div>{value}</div>};\n',
    'apps/web/src/components/blocks/demo/Captured/index.tsx': 'import { useThing } from "@/hooks"; export const Captured=()=>{const value=useThing();const View=()=> <span>{value}</span>;return <View/>};\n',
    'apps/web/src/components/blocks/demo/Child/index.tsx': 'import { useThing } from "@/hooks"; import { ChildView } from "./view"; export const Child=()=>{const value=useThing();return <ChildView value={value}/>};\n',
    'apps/web/src/components/blocks/demo/Child/view.tsx': 'export const ChildView=({value}:{value:string})=> <span>{value}</span>;\n',
    'apps/web/src/components/blocks/demo/Parent/index.tsx': 'import { useThing } from "@/hooks"; import { Child } from "../Child"; import { ChildView } from "../Child/view"; export const Parent=()=>{const value=useThing();return value==="child"?<Child/>:<ChildView value={value}/>};\n',
    'apps/web/src/components/blocks/demo/Dynamic/index.tsx': 'import * as Hooks from "@/hooks"; import { ChildView } from "../Child/view"; const views={ready:ChildView}; export const Dynamic=({kind}:{kind:string})=>{Hooks.useThing();const Target=views[kind as keyof typeof views];return <Target value="ready"/>};\n',
    'apps/web/src/components/blocks/demo/DynamicProvider/index.tsx': 'import { useThing } from "@/hooks"; import { DataProvider } from "@/modules/providers"; import { ChildView } from "../Child/view"; const views={ready:ChildView}; export const DynamicProvider=({kind}:{kind:string})=>{const value=useThing();return <DataProvider content={views[kind as keyof typeof views]} contentProps={{value}}/>};\n',
    'apps/web/src/components/blocks/demo/Frame/index.tsx': 'export const Frame=({children,render}:{children?:any,render?:()=>any})=> <section>{render?.()}{children}</section>;\n',
    'apps/web/src/components/blocks/demo/Aliased/index.tsx': 'import { useThing } from "@/hooks"; const first=useThing; const second=first; export const Aliased=()=>{const value=second();return <div>{value}</div>};\n',
    'apps/web/src/components/blocks/demo/RenderProp/index.tsx': 'import { useThing } from "@/hooks"; import { Frame } from "../Frame"; export const RenderProp=()=>{const value=useThing();return <Frame render={()=><div>{value}</div>}/>};\n',
    'apps/web/src/components/blocks/demo/ChildDraw/index.tsx': 'import { useThing } from "@/hooks"; import { Frame } from "../Frame"; export const ChildDraw=()=>{const value=useThing();return <Frame><div>{value}</div></Frame>};\n',
    'apps/web/src/components/blocks/demo/Created/index.tsx': 'import * as React from "react"; import { useThing } from "@/hooks"; export const Created=()=>{const value=useThing();return React.createElement("div",null,value)};\n',
    'apps/web/src/hooks/index.ts': 'export { useThing } from "./use-thing";\n',
    'apps/web/src/hooks/use-thing.ts': 'export const useThing=()=>"ready";\n',
    'apps/web/src/modules/providers.tsx': 'export const DataProvider=({content:Content,contentProps}:{content:any,contentProps:any})=> <Content {...contentProps}/>;\n',
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
    'src/modules/domain/broken.ts': 'import { missing } from "@features/api/missing"; export const value=missing\n',
    'src/features/api/present.ts': 'export const present=1\n',
  });
  const result = check(root);
  assert.equal(result.ok, false);
  const unresolved = result.errors.find(item => item.ruleId === 'ARCH_INTERNAL_IMPORT_UNRESOLVED');
  assert.equal(unresolved.specifier, '@features/api/missing');
  assert.equal(unresolved.path, 'src/modules/domain/broken.ts');
  assert.ok(unresolved.line > 0 && unresolved.column > 0);
});

test('production loader reports missing target TypeScript without borrowing StarCi test TypeScript', t => {
  const root = fixture(t, 'backend', {
    'src/modules/domain/value.ts': 'export const value=1\n',
    'src/features/api/feature.ts': 'export const feature=1\n',
  });
  const result = checkArchitecture({ repositoryRoot: root });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].ruleId, 'ARCH_TYPESCRIPT_MISSING');
  assert.match(result.errors[0].message, /checked repository/);
});

test('check emits one actionable JSON record and uses target-local TypeScript', t => {
  const root = fixture(t, 'backend', {
    'src/modules/domain/value.ts': 'export const value=1\n',
    'src/features/api/feature.ts': 'import { value } from "@modules/value"; export const feature=value\n',
  });
  const targetModules = path.join(root, '..', 'node_modules');
  fs.mkdirSync(targetModules);
  const installedTypeScript = path.dirname(require.resolve('typescript/package.json'));
  fs.cpSync(installedTypeScript, path.join(targetModules, 'typescript'), { recursive: true });
  const result = scoped(checkArchitecture({ repositoryRoot: root }));
  assert.equal(result.schema, 'starci/architecture-check@1');
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(path.resolve(result.compiler.resolved).startsWith(path.resolve(targetModules)));
});

test('hfs.json has no waiver or baseline field: an unknown key is refused as an invalid declaration', t => {
  const root = fixture(t, 'frontend', {
    'apps/web/src/app/home/page.tsx': 'const Route=()=>null; export default Route\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
  });
  const file = path.join(root, '..', 'hfs.json');
  const declaration = JSON.parse(fs.readFileSync(file, 'utf8'));
  declaration.waivers = ['apps/web/src/app/home/page.tsx'];
  fs.writeFileSync(file, JSON.stringify(declaration));
  const result = check(root);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].ruleId, 'HFS_DECLARATION_INVALID');
  assert.match(result.errors[0].message, /unknown key waivers/);
});

test('owner coverage is derived from slot owners; the Grammar contract is unavailable without a globals.css', t => {
  const backend = fixture(t, 'backend', {
    'apps/core/src/app.module.ts': null,
    'src/modules/domain/value.ts': 'export const value=1\n',
    'src/features/api/feature.ts': 'export const feature=1\n',
  });
  const backendResult = check(backend);
  assert.deepEqual(ownerIds(backend), []);
  assert.deepEqual(backendResult.coverage.ownerPublicApi, { status: 'unavailable', reason: 'no slot owner instance with an entry file exists in the repository' });
  assert.deepEqual(backendResult.coverage.grammarContract, { status: 'not-applicable' });
  assert.deepEqual(backendResult.coverage.sourceFiles, [
    'apps/core/src/main.ts', 'src/features/api/feature.ts', 'src/modules/domain/value.ts',
  ]);
  assert.equal(backendResult.coverage.checkedRuleIds.includes('ARCH_OWNER_EXPORT_BYPASS'), false);
  const frontend = fixture(t, 'frontend', {
    'apps/web/src/app/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'export const HomePage=()=> <main/>\n',
  });
  const frontendResult = check(frontend);
  assert.ok(ownerIds(frontend).includes('fe.feature:apps/web/src/features/pages/HomePage'), JSON.stringify(ownerIds(frontend)));
  assert.deepEqual(frontendResult.coverage.ownerPublicApi, { status: 'checked', declarations: ownerIds(frontend).length });
  assert.equal(frontendResult.coverage.grammarContract.status, 'unavailable');
  assert.match(frontendResult.coverage.grammarContract.reason, /globals.css/);
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
    'apps/web/src/app/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'import { Public } from "@fixture/ui/public"; export const HomePage=()=> <Public/>\n',
    'apps/web/src/contracts/app.ts': 'export type AppContract = string\n',
    'packages/ui/package.json': JSON.stringify({ name: '@fixture/ui', private: true, exports: { './public': './src/public/index.tsx' } }),
    'packages/ui/tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@fixture/app/*': ['apps/web/src/*'] }, noEmit: true }, include: ['src/**/*'] }),
    'packages/ui/src/public/index.tsx': 'export const Public=()=> <span/>\n',
  });
  const packageFile = path.join(root, '..', 'package.json');
  fs.writeFileSync(packageFile, JSON.stringify({ name: '@fixture/app', private: true, dependencies: { '@fixture/ui': 'file:fe/packages/ui' } }));
  const tsconfigFile = path.join(root, 'tsconfig.json'), config = JSON.parse(fs.readFileSync(tsconfigFile, 'utf8'));
  Object.assign(config.compilerOptions.paths, { '@fixture/ui/*': ['packages/ui/src/*'], '@fixture/app/*': ['apps/web/src/*'] });
  fs.writeFileSync(tsconfigFile, JSON.stringify(config));
  let result = check(root);
  assert.equal(result.errors.some(item => item.ruleId.startsWith('ARCH_PACKAGE_')), false, JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(root, 'apps/web/src/features/pages/HomePage/index.tsx'), 'import { Public } from "@fixture/ui/public"; import { Private } from "@fixture/ui/private"; export const HomePage=()=> <><Public/><Private/></>\n');
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
    'src/features/api/orders/value.ts': 'export const value = 1\n',
    'src/modules/domain/catalog/consumer.ts': 'import { value } from "@features/api/orders/value"; export const consumer = value\n',
    'apps/core/src/app.module.ts': 'import { value } from "@features/api/orders/value"; export const AppModule = value\n',
    'apps/core/src/main.ts': 'import { AppModule } from "./app.module"; void AppModule\n',
  });
  const result = checkAll(root);
  assert.equal(result.violations.some(item => item.ruleId === 'BE_TIER_DIRECTION' && item.path.endsWith('apps/core/src/app.module.ts')), false, JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_TIER_DIRECTION' && item.path.endsWith('catalog/consumer.ts')), JSON.stringify(result, null, 2));
});

test('single-application composition root still refuses a business-role file placed directly at its root', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/orders/value.ts': 'export const value = 1\n',
    'src/modules/domain/catalog/value.ts': 'export const catalogValue = 1\n',
    'apps/core/src/app.module.ts': 'export const AppModule = 1\n',
    'apps/core/src/main.ts': 'import { AppModule } from "./app.module"; void AppModule\n',
    'apps/core/src/leaky.service.ts': 'export class LeakyService { run(){return 1} }\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path.endsWith('/leaky.service.ts')), JSON.stringify(result, null, 2));
});

test('single-application layout derives its composition root from apps/<app>/src', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/orders/value.ts': 'export const value = 1\n',
    'src/modules/domain/catalog/value.ts': 'export const catalogValue = 1\n',
    'apps/core/src/app.module.ts': 'import { value } from "@features/api/orders/value"; export const AppModule = value\n',
    'apps/core/src/main.ts': 'import { AppModule } from "./app.module"; void AppModule\n',
    'apps/core/src/leaky.service.ts': 'export class LeakyService { run(){return 1} }\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path.endsWith('/leaky.service.ts')), JSON.stringify(result, null, 2));
  assert.equal(checkAll(root).violations.some(item => item.ruleId === 'BE_TIER_DIRECTION' && item.path.endsWith('apps/core/src/app.module.ts')), false, JSON.stringify(result, null, 2));
});

test('backend workspace packages cannot reach executable app packages through type exports', t => {
  const root = fixture(t, 'backend', {
    'package.json': JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'] }),
    'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './apps/api' }, { path: './packages/domain' }] }),
    'apps/api/package.json': JSON.stringify({ name: '@fixture/api', private: true, exports: { '.': './src/main.ts', './contract': './src/contract.ts' } }),
    'apps/api/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', noEmit: true }, include: ['src/**/*'] }),
    'apps/api/src/main.ts': 'export {}\n',
    'apps/api/src/app.module.ts': 'export class AppModule {}\n',
    'apps/api/src/contract.ts': 'export type AppContract = string\n',
    'packages/domain/package.json': JSON.stringify({ name: '@fixture/domain', private: true, exports: { '.': './src/index.ts' } }),
    'packages/domain/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', baseUrl: '../..', paths: { '@fixture/api/*': ['apps/api/src/*'] }, noEmit: true }, include: ['src/**/*'] }),
    'packages/domain/src/index.ts': 'export type { AppContract } from "@fixture/api/contract"\n',
  }, [{ name: 'api', kind: 'api' }]);
  const result = check(root);
  assert.ok(result.errors.some(item => item.ruleId === 'ARCH_PACKAGE_IMPORTS_APP'), JSON.stringify(result, null, 2));
});

test('backend direction traverses multi-hop type-only imports and barrels', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/orders/contract.ts': 'export type FeatureContract = string\n',
    'src/modules/platform/shared/barrel.ts': 'export type { FeatureContract } from "../../../features/api/orders/contract"\n',
    'src/modules/domain/catalog/types.ts': 'import type { FeatureContract } from "../../platform/shared/barrel"; export type CatalogContract = FeatureContract\n',
  });
  const result = checkAll(root), violation = result.violations.find(item => item.ruleId === 'BE_TIER_DIRECTION' && item.path.endsWith('barrel.ts'));
  assert.ok(violation, JSON.stringify(result, null, 2));
  assert.equal(violation.typeOnly, true);
});

test('backend direction includes static dynamic imports that use import attributes', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/orders/contract.ts': 'export const feature = 1\n',
    'src/modules/domain/catalog/load.ts': 'export const load = () => import("@features/api/orders/contract", { with: { type: "json" } })\n',
  });
  const result = checkAll(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_TIER_DIRECTION'), JSON.stringify(result, null, 2));
});

test('TypeScript import types join the dependency graph and direct dynamic module names fail coverage', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/private.ts': 'export interface Private { value:string }\n',
    'src/modules/domain/import-type.ts': 'export type Hidden = import("@features/api/private").Private\n',
    'src/modules/domain/dynamic.ts': 'const selected="@features/api/private"; export const load=()=>import(selected); export const loadCjs=()=>require(selected)\n',
    'src/modules/domain/shadow.ts': 'const require=(value:string)=>value; const selected="local"; export const local=require(selected)\n',
  });
  const result = checkAll(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_TIER_DIRECTION' && item.path.endsWith('/import-type.ts')), JSON.stringify(result, null, 2));
  const dynamic = result.errors.filter(item => item.ruleId === 'ARCH_DYNAMIC_DEPENDENCY_UNPROVEN');
  assert.equal(dynamic.length, 2, JSON.stringify(result, null, 2));
  assert.ok(dynamic.every(item => item.path.endsWith('/dynamic.ts') && item.line > 0 && item.column > 0));
  assert.equal(result.errors.some(item => item.path?.endsWith('/shadow.ts')), false, JSON.stringify(result, null, 2));
  assert.ok(result.coverage.checkedRuleIds.includes('ARCH_DYNAMIC_DEPENDENCY_UNPROVEN'));
});

test('feature application use cases may use Nest injection but cannot reach transport DTOs or protocol framework surfaces', t => {
  const root = fixture(t, 'backend', {
    'src/modules/domain/orders/service.ts': 'export class OrdersService { create(input: {name:string}) { return input } }\n',
    'src/features/api/orders/application/valid.use-case.ts': 'import * as Nest from "@nestjs/common"; import { OrdersService } from "@modules/orders/service"; interface ValidParams {name:string} interface ValidResult {name:string} @Nest.Injectable() export class ValidUseCase { constructor(private readonly orders: OrdersService) {} execute(input:ValidParams):ValidResult { return this.orders.create(input) } }\n',
    'src/features/api/orders/application/valid-cjs.use-case.ts': 'import Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidCjsUseCase {}\n',
    'src/features/api/orders/application/valid-require.use-case.ts': 'const Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidRequireUseCase {}\n',
    'src/features/api/orders/application/valid-shadow-es.use-case.ts': 'import * as Nest from "@nestjs/common"; @Nest.Injectable() export class ValidShadowEsUseCase { execute(value:unknown):unknown { function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
    'src/features/api/orders/application/valid-shadow-cjs.use-case.ts': 'import Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidShadowCjsUseCase { execute(value:unknown):unknown { function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
    'src/features/api/orders/application/valid-shadow-require.use-case.ts': 'const Nest = require("@nestjs/common"); @Nest.Injectable() export class ValidShadowRequireUseCase { execute(value:unknown):unknown { function normalize(Nest:{Body:unknown}) { return Nest.Body }; return normalize({Body:value}) } }\n',
    'src/features/api/orders/transport/graphql/create.input.ts': 'export class CreateInput { name!: string }\n',
    'src/features/api/orders/transport/index.ts': 'export type { CreateInput } from "./graphql/create.input"\n',
    'src/features/api/orders/shared/transport-types.ts': 'export type { CreateInput } from "../transport"\n',
    'src/features/api/orders/application/invalid.use-case.ts': 'import * as Nest from "@nestjs/common"; import { ArgsType } from "@nestjs/graphql"; import type { CreateInput } from "../shared/transport-types"; @ArgsType() export class InvalidUseCase { execute(@Nest.Body() input:CreateInput){ return input } }\n',
    'src/features/api/orders/application/invalid-cjs.use-case.ts': 'import Nest = require("@nestjs/common"); export class InvalidCjsUseCase { execute(@Nest.Body() input:unknown){ return input } }\n',
    'src/features/api/orders/application/invalid-require.use-case.ts': 'const Nest = require("@nestjs/common"); export class InvalidRequireUseCase { execute(@Nest.Body() input:unknown){ return input } }\n',
    'src/features/api/orders/application/invalid-require-destructured.use-case.ts': 'const { Body } = require("@nestjs/common"); export class InvalidRequireDestructuredUseCase { execute(@Body() input:unknown){ return input } }\n',
    'src/features/api/orders/application/invalid-direct-require.use-case.ts': 'const DirectBody = require("@nestjs/common").Body; export class InvalidDirectRequireUseCase { execute(@DirectBody() input:unknown){ return input } }\n',
    'src/features/api/orders/application/invalid-destructured.use-case.ts': 'import * as Nest from "@nestjs/common"; const { Body } = Nest; export class InvalidDestructuredUseCase { execute(@Body() input:unknown){ return input } }\n',
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
    'src/features/api/orders/shared/protocol.ts': 'export { Body } from "@nestjs/common"; export { ArgsType as Input } from "@nestjs/graphql"\n',
    'src/features/api/orders/shared/capability.ts': 'export const execute = (value: unknown) => value\n',
    'src/features/api/orders/application/valid.use-case.ts': 'import { execute } from "../shared/capability"; export class ValidUseCase { execute(value:unknown){ return execute(value) } }\n',
    'src/features/api/orders/application/invalid.use-case.ts': 'import { Body, Input } from "../shared/protocol"; @Input() export class InvalidUseCase { execute(@Body() input:unknown){ return input } }\n',
  });
  const result = check(root);
  const violations = result.violations.filter(item => item.ruleId === 'BE_APPLICATION_TRANSPORT_FRAMEWORK');
  assert.ok(violations.some(item => item.path.endsWith('/invalid.use-case.ts') && item.dependencyChain?.at(-1).endsWith('/shared/protocol.ts')), JSON.stringify(result, null, 2));
  assert.equal(violations.some(item => item.path.endsWith('/valid.use-case.ts')), false, JSON.stringify(result, null, 2));
});

test('same-source owners are derived from slots and require named public entries without export-star barrels', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/orders/index.ts': 'export * from "./public"\n',
    'src/features/api/orders/public.ts': 'export const publicOrder = 1\n',
    'src/features/api/orders/private.ts': 'export const secretOrder = 2\n',
    'src/features/api/orders/internal.ts': 'import { secretOrder } from "./private"; export const internal = secretOrder\n',
    'src/features/api/catalog/valid.ts': 'import { publicOrder } from "../orders"; export const valid = publicOrder\n',
    'src/features/api/catalog/invalid.ts': 'import { secretOrder } from "../orders/private"; export const invalid = secretOrder\n',
    'src/modules/platform/orders/barrel.ts': 'export { secretOrder } from "../../../features/api/orders/private"\n',
    'src/features/api/catalog/indirect.ts': 'import { secretOrder } from "../../../modules/platform/orders/barrel"; export const indirect = secretOrder\n',
  });
  const result = check(root);
  const owners = ownerIds(root);
  assert.ok(owners.includes('be.feature:src/features/api/orders'), JSON.stringify(owners));
  assert.deepEqual(result.coverage.ownerPublicApi, { status: 'checked', declarations: owners.length });
  assert.ok(result.violations.some(item => item.ruleId === 'ARCH_OWNER_EXPORT_STAR' && item.path === 'src/features/api/orders/index.ts'), JSON.stringify(result, null, 2));
  const bypasses = result.violations.filter(item => item.ruleId === 'ARCH_OWNER_EXPORT_BYPASS');
  assert.ok(bypasses.some(item => item.path.endsWith('/invalid.ts')));
  assert.ok(bypasses.some(item => item.path.endsWith('/indirect.ts') && item.dependencyChain.some(part => part.endsWith('/platform/orders/barrel.ts'))));
  assert.equal(bypasses.some(item => item.path.endsWith('/valid.ts') || item.path.endsWith('/internal.ts')), false, JSON.stringify(result, null, 2));
});

test('owner coverage is unavailable when a derived owner entry is outside the checked production program', t => {
  // packages/lib is a package owner (entry src/index.ts) that neither the root include nor any import reaches.
  const root = fixture(t, 'backend', {
    'src/modules/domain/value.ts': 'export const value=1\n',
    'packages/lib/src/index.ts': 'export const outsideProgram=1\n',
  });
  const result = check(root);
  assert.ok(ownerIds(root).includes('repo.packages:packages/lib'), JSON.stringify(ownerIds(root)));
  assert.equal(result.ok, false);
  assert.equal(result.coverage.ownerPublicApi.status, 'unavailable');
  assert.deepEqual(result.coverage.ownerPublicApi.missingEntries, ['packages/lib/src/index.ts']);
  assert.ok(result.violations.some(item => item.ruleId === 'ARCH_OWNER_EXPORT_BYPASS'
    && item.path === 'packages/lib/src/index.ts' && /outside the configured TypeScript programs/.test(item.message)), JSON.stringify(result, null, 2));
});

test('Nest registration derives exported class-token ownership and selected CQRS handlers', t => {
  const root = fixture(t, 'backend', {
    'src/modules/platform/framework/index.ts': 'export { Module as NestModule } from "@nestjs/common"; export { CommandHandler as HandlesCommand } from "@nestjs/cqrs";\n',
    'src/modules/domain/catalog/catalog.service.ts': 'export class CatalogService {}\n',
    'src/modules/domain/catalog/catalog.module.ts': 'import { NestModule } from "../../platform/framework"; import { CatalogService } from "./catalog.service"; const StaticModule=NestModule; @StaticModule({providers:[CatalogService],exports:[CatalogService]}) export class CatalogModule {}\n',
    'src/features/api/orders/application/create.command.ts': 'export class CreateOrderCommand {}\n',
    'src/features/api/orders/application/create.handler.ts': 'import { HandlesCommand } from "../../../../modules/platform/framework"; import { CreateOrderCommand } from "./create.command"; const SelectedHandler=HandlesCommand; @SelectedHandler(CreateOrderCommand) export class CreateOrderHandler {}\n',
    'src/features/api/orders/orders.module.ts': 'import { NestModule } from "../../../modules/platform/framework"; import { CatalogModule } from "@modules/catalog/catalog.module"; import { CatalogService } from "@modules/catalog/catalog.service"; import { CreateOrderHandler } from "./application/create.handler"; @NestModule({imports:[CatalogModule],providers:[CreateOrderHandler,{provide:"LOCAL_CATALOG",useClass:CatalogService}]}) export class OrdersModule {}\n',
  });
  installNestTypes(root);
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.deepEqual(result.coverage.moduleRegistration, { status: 'checked', modules: 2, exportedClassTokenProviders: 1,
    handlers: 1, selectedHandlerDecorators: ['CommandHandler', 'QueryHandler'] });
  assert.ok(result.coverage.checkedRuleIds.includes('BE_MODULE_PROVIDER_REREGISTRATION'));
  assert.ok(result.coverage.checkedRuleIds.includes('BE_MODULE_HANDLER_REGISTRATION'));
});

test('Nest registration rejects same class-token provider duplication and missing handler registration', t => {
  const root = fixture(t, 'backend', {
    'src/modules/domain/catalog/catalog.service.ts': 'export class CatalogService {}\n',
    'src/modules/domain/catalog/catalog.module.ts': 'import { Module } from "@nestjs/common"; import { CatalogService } from "./catalog.service"; @Module({providers:[CatalogService,CatalogService],exports:[CatalogService]}) export class CatalogModule {}\n',
    'src/features/api/orders/create.command.ts': 'export class CreateOrderCommand {}\n',
    'src/features/api/orders/create.handler.ts': 'import { CommandHandler } from "@nestjs/cqrs"; import { CreateOrderCommand } from "./create.command"; @CommandHandler(CreateOrderCommand) export class CreateOrderHandler {}\n',
    'src/features/api/orders/orders.module.ts': 'import { Module } from "@nestjs/common"; import { CatalogService } from "@modules/catalog/catalog.service"; import { CreateOrderHandler } from "./create.handler"; @Module({providers:[{provide:CatalogService as unknown as typeof CatalogService,useClass:CatalogService},CreateOrderHandler,CreateOrderHandler]}) export class OrdersModule {}\n',
  });
  installNestTypes(root);
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
    'src/modules/domain/plain/plain.module.ts': 'import { Module } from "@nestjs/common"; @Module({}) export class PlainModule {}\n',
  });
  installNestTypes(root);
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.coverage.moduleRegistration.status, 'checked');
  assert.equal(result.coverage.moduleRegistration.handlers, 0);
});

test('Nest registration becomes unavailable for hidden or dynamic module metadata', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/orders/find.query.ts': 'export class FindOrderQuery {}\n',
    'src/features/api/orders/find.handler.ts': 'import { QueryHandler } from "@nestjs/cqrs"; import { FindOrderQuery } from "./find.query"; @QueryHandler(FindOrderQuery) export class FindOrderHandler {}\n',
    'src/features/api/orders/orders.module.ts': 'import { Module } from "@nestjs/common"; import { FindOrderHandler } from "./find.handler"; const providers=[FindOrderHandler]; @Module({providers}) export class OrdersModule {}\n',
    'src/features/api/orders/legacy.module.ts': 'const {Module}=require("@nestjs/common"); @Module({}) export class LegacyModule {}\n',
    'src/features/api/orders/mutable.module.ts': 'import { Module } from "@nestjs/common"; let MutableModule=Module; @MutableModule({}) export class MutableIdentityModule {}\n',
  });
  installNestTypes(root);
  const result = check(root);
  assert.equal(result.coverage.moduleRegistration.status, 'unavailable', JSON.stringify(result, null, 2));
  assert.ok(result.coverage.moduleRegistration.details.some(item => /dynamic or unresolvable/.test(item)));
  assert.ok(result.coverage.moduleRegistration.details.some(item => /CommonJS Nest framework binding/.test(item)));
  assert.ok(result.coverage.moduleRegistration.details.some(item => /mutable Module decorator identity/.test(item)));
  assert.equal(result.coverage.checkedRuleIds.includes('BE_MODULE_HANDLER_REGISTRATION'), false);
});

test('backend source shape accepts adopted application, transport, persistence, enum, and GraphQL naming forms', t => {
  const root = fixture(t, 'backend', {
    'src/modules/platform/framework/index.ts': 'export { Args as GqlArgs, InputType as GqlInput, Mutation as GqlMutation, Query as GqlQuery, registerEnumType as registerGraphQlEnum } from "@nestjs/graphql"; export { Entity as DatabaseEntity } from "typeorm";\n',
    'src/features/api/orders/index.ts': 'export { CreateOrderHandler } from "./application/create-order.handler";\n',
    'src/features/api/orders/orders.module.ts': 'export class OrdersModule {}\n',
    'src/features/api/orders/application/create-order.contracts.ts': 'export interface CreateOrderParams { readonly itemId:string } export interface CreateOrderResult { readonly id:string }\n',
    'src/features/api/orders/application/create-order.handler.ts': 'import type { CreateOrderParams,CreateOrderResult } from "./create-order.contracts"; export class CreateOrderHandler { execute(input:CreateOrderParams):CreateOrderResult{return {id:input.itemId}} }\n',
    'src/features/api/orders/transport/graphql/dto/create-order.request.ts': 'import { GqlInput } from "../../../../../../modules/platform/framework"; @GqlInput() export class CreateOrderRequest { itemId!:string }\n',
    'src/features/api/orders/transport/graphql/create-order.resolver.ts': 'import { GqlArgs,GqlMutation } from "../../../../../modules/platform/framework"; import { CreateOrderRequest } from "./dto/create-order.request"; export class CreateOrderResolver { @GqlMutation(()=>String,{name:"createOrder"}) create(@GqlArgs("input") request:CreateOrderRequest){return request.itemId} }\n',
    'src/modules/platform/database/entities/order.entity.ts': 'import { DatabaseEntity } from "../../framework"; @DatabaseEntity() export class OrderEntity {}\n',
    'src/modules/domain/catalog/enums/order-status.ts': 'import { registerGraphQlEnum } from "../../../platform/framework"; export enum OrderStatus { Pending="pending", Complete="complete" } registerGraphQlEnum(OrderStatus,{name:"OrderStatus"});\n',
    'src/modules/domain/catalog/errors/challenge-not-found.ts': 'export class ChallengeNotFoundException extends Error {}\n',
  });
  installSourceShapeTypes(root);
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.deepEqual(result.coverage.backendSourceShape, {
    files: 10, layout: { status: 'checked' }, naming: { status: 'checked' },
  });
  assert.ok(result.coverage.checkedRuleIds.includes('BE_FEATURE_LAYOUT_INVALID'));
  assert.ok(result.coverage.checkedRuleIds.includes('BE_SOURCE_FORM'));
});

test('backend source shape locates layer, class, enum, contract, and GraphQL naming violations', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/orders/application/create-order.request.ts': 'export class CreateOrderRequest {}\n',
    'src/features/api/orders/application/create-order.contracts.ts': 'interface CreateOrderData { readonly itemId:string } type WrappedWrong=Readonly<{readonly value:string}>; type Shape={readonly x:string}; type AliasWrong=Shape; type Pick<T,K extends keyof T>=string; type Scalar=Pick<{readonly ignored:string},"ignored">; export {CreateOrderData,WrappedWrong,AliasWrong,Scalar};\n',
    'src/modules/domain/catalog/bad_Name.service.ts': 'export class WrongName {}\n',
    'src/modules/domain/catalog/export-list.service.ts': 'class ExportListWrong {} export {ExportListWrong};\n',
    'src/modules/domain/catalog/class-expression.service.ts': 'export const Wrong=class {};\n',
    'src/modules/domain/catalog/named-expression.service.ts': 'const Value=class InnerWrong {}; export {Value};\n',
    'src/features/api/orders/transport/http/run.handler.ts': 'export class RunHandler {}\n',
    'src/features/api/orders/transport/graphql/dto/order.entity.ts': 'import { Entity } from "typeorm"; @Entity() export class OrderEntity {}\n',
    'src/features/api/orders/migrations/1790000000000-CreateOrders.ts': 'export class CreateOrders { up(){} down(){} }\n',
    'src/features/api/orders/transport/graphql/order-view.mapper.ts': 'import { ViewEntity } from "typeorm"; @ViewEntity() export class OrderViewMapper {}\n',
    'src/features/api/orders/application/order-schema.handler.ts': 'import { EntitySchema } from "typeorm"; const make=()=>new EntitySchema({name:"order"}); export const schema=make();\n',
    'src/features/api/orders/transport/graphql/create-order.input.ts': 'import { InputType } from "@nestjs/graphql"; @InputType() export class CreateOrderInput {}\n',
    'src/features/api/orders/transport/graphql/create-order.resolver.ts': 'import { Args,Mutation } from "@nestjs/graphql"; export class CreateOrderResolver { @Mutation(()=>String,{name:"Create_Order"}) create(@Args("itemId") itemId:string){return itemId} }\n',
    'src/modules/domain/catalog/enums/order-status.ts': 'export const enum orderStatus { pending=1 }\n',
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
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_FORM' && /Source basename/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_FORM' && /Exported class WrongName/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_FORM' && item.path.endsWith('/export-list.service.ts')), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_FORM' && item.path.endsWith('/class-expression.service.ts')), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_FORM' && item.path.endsWith('/named-expression.service.ts')), JSON.stringify(result, null, 2));
  // Domain values in *.contracts.ts carry no suffix (BE-CONVENTION 1.15): only transport file roles name their object contracts.
  assert.equal(result.violations.some(item => /CreateOrderData|WrappedWrong|AliasWrong/.test(item.message)), false, JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => /Scalar/.test(item.message)), false, JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_FORM' && /Enums must/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_FORM' && /GraphQL field name/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === 'BE_SOURCE_FORM' && /literal name input/.test(item.message)), JSON.stringify(result, null, 2));
});

test('backend source shape: domain values and port implementations pass, transport object contracts and unported classes fail', t => {
  const root = fixture(t, 'backend', {
    'src/modules/platform/clock/clock.port.ts': 'export interface Clock { now():Date }\n',
    'src/modules/platform/clock/system-clock.service.ts': 'import type { Clock } from "./clock.port"; export class SystemClock implements Clock { now():Date { return new Date(0) } }\n',
    'src/modules/platform/clock/wrong.service.ts': 'import type { Clock } from "./clock.port"; export class Wrong implements Clock { now():Date { return new Date(0) } }\n',
    'src/modules/platform/clock/local.contracts.ts': 'export interface Local { now():Date }\n',
    'src/modules/platform/clock/other.service.ts': 'import type { Local } from "./local.contracts"; export class Other implements Local { now():Date { return new Date(0) } }\n',
    'src/modules/platform/clock/plain.service.ts': 'export class Plain {}\n',
    'src/modules/platform/clock/index.ts': 'export { SystemClock } from "./system-clock.service";\n',
    'src/modules/domain/catalog/cart.contracts.ts': 'export interface CartLine { readonly sku:string } export type Outcome = { readonly ok:boolean };\n',
    'src/modules/domain/catalog/cache.options.ts': 'export interface CacheKey { readonly name:string }\n',
    'src/modules/domain/catalog/order.rows.ts': 'export interface OrderRow { readonly id:string } export interface Order { readonly id:string }\n',
    'src/modules/domain/catalog/add.input.ts': 'export interface AddInput { readonly id:string } export interface Add { readonly id:string }\n',
  });
  installSourceShapeTypes(root);
  const result = check(root);
  const form = result.violations.filter(item => item.ruleId === 'BE_SOURCE_FORM');
  const named = name => form.some(item => item.message.includes(name));
  assert.equal(named('SystemClock'), false, JSON.stringify(form, null, 2));
  assert.equal(named('CartLine') || named('Outcome') || named('CacheKey') || named('OrderRow') || named('AddInput'), false, JSON.stringify(form, null, 2));
  assert.ok(named('Wrong'), JSON.stringify(form, null, 2));
  assert.ok(named('Other'), JSON.stringify(form, null, 2));
  assert.ok(named('Plain'), JSON.stringify(form, null, 2));
  assert.ok(form.some(item => /Order\b/.test(item.message) && /must end in Row/.test(item.message)), JSON.stringify(form, null, 2));
  assert.ok(form.some(item => /Add\b/.test(item.message) && /must end in Input/.test(item.message)), JSON.stringify(form, null, 2));
  assert.equal(form.some(item => /^Exported class (?:Wrong|Other|Plain) must/.test(item.message) && /Adapter|Repository/.test(item.message)), false);
});

test('backend source shape exposes dynamic naming as unavailable coverage', t => {
  const root = fixture(t, 'backend', {
    'src/features/api/orders/application/run.workflow.ts': 'export const run=()=>"ok";\n',
    'src/features/api/orders/transport/graphql/order.resolver.ts': 'import { Query } from "@nestjs/graphql"; const FIELD="order"; export class OrderResolver { @Query(()=>String,{name:FIELD}) order(){return "order"} }\n',
    'src/features/api/orders/transport/graphql/wrapped.resolver.ts': 'import { Query } from "@nestjs/graphql"; const make=()=>Query; const Wrapped=make(); export class WrappedResolver { @Wrapped(()=>String,{name:"wrapped"}) wrapped(){return "wrapped"} }\n',
    'src/features/api/orders/transport/graphql/deep.resolver.ts': 'import { Query } from "@nestjs/graphql"; const q0=()=>Query; const q1=()=>q0(); const q2=()=>q1(); const q3=()=>q2(); const q4=()=>q3(); const q5=()=>q4(); const q6=()=>q5(); const q7=()=>q6(); const q8=()=>q7(); const q9=()=>q8(); const q10=()=>q9(); const q11=()=>q10(); const q12=()=>q11(); const Deep=q12(); export class DeepResolver { @Deep(()=>String,{name:"deep"}) deep(){return "deep"} }\n',
    'src/modules/domain/catalog/engine.workflow.ts': 'export class EngineWorkflow {}\n',
    'src/modules/domain/catalog/graphql-enum.adapter.ts': 'export const createEnumType=(value:unknown)=>value; createEnumType({ Pending:"pending" });\n',
    'src/modules/domain/catalog/index.ts': 'export const catalog=true;\n',
    'src/modules/domain/catalog/public.types.ts': 'interface Workspace { readonly id:string } export {Workspace};\n',
  });
  installSourceShapeTypes(root);
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
  assert.equal(result.coverage.backendSourceShape.layout.status, 'unavailable');
  assert.equal(result.coverage.backendSourceShape.naming.status, 'unavailable');
  assert.equal(result.coverage.checkedRuleIds.includes('BE_FEATURE_LAYOUT_INVALID'), false);
  assert.equal(result.coverage.checkedRuleIds.includes('BE_SOURCE_FORM'), false);
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /dynamic @Query field name/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /constructed Query decorator identity/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /unproven framework decorator identity/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /unclassified file role workflow/.test(item)));
  assert.ok(result.coverage.backendSourceShape.naming.details.some(item => /GraphQL enum adapter/.test(item)));
  assert.equal(result.coverage.backendSourceShape.naming.details.some(item => /object contract/.test(item)), false);
  assert.ok(result.coverage.backendSourceShape.layout.details.some(item => /role workflow is not a selected application-layer role/.test(item)));
  assert.equal(result.violations.some(item => item.path.endsWith('/engine.workflow.ts')), false);
});

test('derived Grammar contract binds public code, style entry, peers, and product imports', t => {
  // The contract is derived: package @starci/grammar (entry /common, style /common.css, peers react and @heroui/react),
  // styled from apps/web/src/app/globals.css and consumed by apps/web/package.json.
  const grammarManifest = (extra = {}) => JSON.stringify({ name: '@starci/grammar',
    exports: { './common': './src/common/index.tsx', './common.css': './src/common.css' },
    peerDependencies: { react: '>=18', '@heroui/react': '>=2', ...extra } });
  const shadow = 'apps/web/src/features/pages/ProductPage/shadow.ts';
  const product = 'apps/web/src/features/pages/ProductPage/index.tsx';
  const globals = 'apps/web/src/app/globals.css';
  const root = fixture(t, 'frontend', {
    'package.json': JSON.stringify({ name: 'fixture-fe', private: true, workspaces: ['apps/*', 'packages/*'] }),
    'apps/web/package.json': JSON.stringify({ name: '@fixture/web', private: true, dependencies: { '@starci/grammar': '1.0.0', react: '19.0.0', '@heroui/react': '2.0.0' } }),
    'apps/web/src/app/page.tsx': 'import { ProductPage } from "@/features/pages/ProductPage"; export default function Route(){ return <ProductPage/> }\n',
    [globals]: '@import "@starci/grammar/common.css";\n',
    [product]: 'import { Button } from "@starci/grammar/common"; export const ProductPage=()=> <Button/>\n',
    [shadow]: 'const require=(value:string)=>value; export const local=require("@starci/grammar/private")\n',
    'packages/grammar/package.json': grammarManifest(),
    'packages/grammar/src/common/index.tsx': 'export const Button=()=> <button/>\n',
    'packages/grammar/src/private.tsx': 'export const Button=()=> <button data-private/>\n',
    'packages/grammar/src/common.css': ':root{}\n',
  });
  const write = (relative, content) => fs.writeFileSync(path.join(root, relative), content);
  const tsconfigFile = path.join(root, 'tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigFile, 'utf8'));
  const bindCommon = target => {
    tsconfig.compilerOptions.paths['@starci/grammar/common'] = [target];
    fs.writeFileSync(tsconfigFile, `${JSON.stringify(tsconfig, null, 2)}\n`);
  };
  bindCommon('packages/grammar/src/common/index.tsx');
  const valid = check(root);
  assert.equal(valid.ok, true, JSON.stringify(valid, null, 2));
  const owners = ownerIds(root);
  assert.ok(owners.includes('fe.feature:apps/web/src/features/pages/ProductPage'), JSON.stringify(owners));
  assert.deepEqual(valid.coverage.ownerPublicApi, { status: 'checked', declarations: owners.length });
  assert.deepEqual(valid.coverage.grammarContract, { status: 'checked', package: '@starci/grammar' });
  for (const ruleId of ['ARCH_OWNER_EXPORT_BYPASS', 'ARCH_OWNER_EXPORT_STAR', 'ARCH_GRAMMAR_EXPORT_BYPASS', 'ARCH_GRAMMAR_CONTRACT_INVALID']) {
    assert.ok(valid.coverage.checkedRuleIds.includes(ruleId));
  }

  write(shadow, 'export const direct=require("@starci/grammar/private")\n');
  const realRequireBypass = check(root);
  assert.ok(realRequireBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'
    && item.path.endsWith('/shadow.ts')), JSON.stringify(realRequireBypass, null, 2));
  write(shadow, 'const require=(value:string)=>value; export const local=require("@starci/grammar/private")\n');

  bindCommon('packages/grammar/src/private.tsx');
  const misresolved = check(root);
  assert.ok(misresolved.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'), JSON.stringify(misresolved, null, 2));
  bindCommon('packages/grammar/src/common/index.tsx');

  write(globals, '@import "@starci/grammar/common.css";\n@import "@starci/grammar/heritage/styles.css";\n');
  const styleBypass = check(root);
  assert.ok(styleBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS' && item.specifier === '@starci/grammar/heritage/styles.css'), JSON.stringify(styleBypass, null, 2));
  assert.ok(styleBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID' && /heritage\/styles\.css/.test(item.message)), JSON.stringify(styleBypass, null, 2));
  write(globals, '@import url(@starci/grammar/common.css);\n@import url(@starci/grammar/heritage/styles.css);\n');
  const unquotedStyleBypass = check(root);
  assert.ok(unquotedStyleBypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS' && item.specifier === '@starci/grammar/heritage/styles.css'), JSON.stringify(unquotedStyleBypass, null, 2));
  write(globals, '@import "@starci/grammar/common.css";\n');

  write(product, 'import { Button } from "@starci/grammar/core"; export const ProductPage=()=> <Button/>\n');
  const bypass = check(root);
  assert.ok(bypass.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'), JSON.stringify(bypass, null, 2));

  write('packages/grammar/package.json', grammarManifest({ '@fixture/extra': '>=1' }));
  write(product, 'import { Button } from "@starci/grammar/common"; export const ProductPage=()=> <Button/>\n');
  const extraPeer = check(root);
  assert.ok(extraPeer.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID' && /exactly match/.test(item.message)), JSON.stringify(extraPeer, null, 2));

  write('packages/grammar/package.json', JSON.stringify({ name: '@starci/grammar', exports: { './common': './src/common/index.tsx' }, peerDependencies: { react: '>=18' } }));
  write(globals, ':root{}\n');
  const invalid = check(root);
  assert.ok(invalid.violations.some(item => item.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID'), JSON.stringify(invalid, null, 2));
});

test('internal aliases and relative imports cannot resolve outside the checked repository, nor into the other side of the app', t => {
  const root = fixture(t, 'backend', {
    'src/modules/domain/alias.ts': 'import { outside } from "@outside/value"; export const alias=outside\n',
    'src/modules/domain/relative.ts': '',
    'src/features/api/present.ts': 'export const present=1\n',
  });
  const outside = `${path.dirname(root)}-outside`;
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'value.ts'), 'export const outside=1\n');
  fs.writeFileSync(path.join(root, 'src/modules/domain/relative.ts'), `import { outside } from "../../../../../${path.basename(outside)}/value"; export const relative=outside\n`);
  // The fe side is inside the same checkout, so it is reviewable source, and still not this side's to import.
  fs.mkdirSync(path.join(root, '..', 'fe'), { recursive: true });
  fs.writeFileSync(path.join(root, '..', 'fe', 'shared.ts'), 'export const shared=1\n');
  fs.writeFileSync(path.join(root, 'src/modules/domain/cross.ts'), 'import { shared } from "../../../../fe/shared"; export const cross=shared\n');
  let linked = false;
  try {
    fs.symlinkSync(outside, path.join(root, 'src/outside-link'), 'junction');
    fs.writeFileSync(path.join(root, 'src/modules/domain/symlink.ts'), 'import { outside } from "../../outside-link/value"; export const symlink=outside\n');
    linked = true;
  } catch { /* Link creation can be unavailable on a locked-down Windows host. */ }
  const configFile = path.join(root, 'tsconfig.json'), config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.compilerOptions.paths['@outside/*'] = [`../../${path.basename(outside)}/*`];
  fs.writeFileSync(configFile, JSON.stringify(config));
  const result = check(root), outsideErrors = result.errors.filter(item => item.ruleId === 'ARCH_INTERNAL_IMPORT_OUTSIDE');
  const expected = new Set(['@outside/value', `../../../../../${path.basename(outside)}/value`, '../../../../fe/shared']);
  if (linked) expected.add('../../outside-link/value');
  assert.deepEqual(new Set(outsideErrors.map(item => item.specifier)), expected);
});

test('workspace discovery supports exact and bounded entries and rejects unsupported local patterns', t => {
  const root = fixture(t, 'frontend', {
    'package.json': JSON.stringify({ private: true, workspaces: ['apps/web', 'packages/*'] }),
    'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './apps/web' }, { path: './packages/ui' }] }),
    'apps/web/package.json': JSON.stringify({ name: '@fixture/app', private: true }),
    'apps/web/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', baseUrl: '../..', paths: { '@fixture/ui': ['packages/ui/src/index.tsx'] }, noEmit: true }, include: ['src/**/*'] }),
    'apps/web/src/app/page.tsx': 'import { HomePage } from "../components/pages/HomePage"; export default function Route(){return <HomePage/>}\n',
    'apps/web/src/app/components/pages/HomePage.tsx': 'import { Ui } from "@fixture/ui"; export const HomePage=()=> <Ui/>\n',
    'packages/ui/package.json': JSON.stringify({ name: '@fixture/ui', private: true, exports: { '.': './src/index.tsx' } }),
    'packages/ui/tsconfig.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve', noEmit: true }, include: ['src/**/*'] }),
    'packages/ui/src/index.tsx': 'export const Ui=()=> <span/>\n',
  });
  let result = check(root);
  assert.equal(result.errors.some(item => item.ruleId.startsWith('ARCH_PACKAGE_')), false, JSON.stringify(result, null, 2));
  const packageFile = path.join(root, '..', 'package.json'), pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  pkg.workspaces = ['fe/packages/**'];
  fs.writeFileSync(packageFile, JSON.stringify(pkg));
  result = check(root);
  assert.equal(result.errors[0]?.ruleId, 'ARCH_CONFIG_INVALID', JSON.stringify(result, null, 2));
});

test('frontend accepts redirect-only server routes and intrinsic client visual state', t => {
  const root = fixture(t, 'frontend', {
    'apps/web/src/app/home/page.tsx': 'import { redirect } from "next/navigation"; export default async function Route({params}){const {lang}=await params;redirect(lang === "vi" ? "/next" : `/${lang}/next`)}\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
    'apps/web/src/app/guarded/page.tsx': 'import { redirect } from "next/navigation"; import { HomePage } from "@/features/pages/HomePage"; export default function Route({session,lang}){if(!session) redirect(lang === "vi" ? "/vi/login" : "/en/login");return <HomePage/>}\n',
    'apps/web/src/components/leaves/Disclosure/component.tsx': '"use client"; import { useRef,useState,useEffect } from "react"; export const Disclosure=()=>{const r=useRef(null);const [open,setOpen]=useState(false);useEffect(()=>{},[]);return <button ref={r} onClick={()=>setOpen(!open)} /> }\n',
  });
  const result = check(root);
  assert.equal(result.ok, true, JSON.stringify(result, null, 2));
});

test('frontend rejects a visual branch that selects a page versus no composition', t => {
  const root = fixture(t, 'frontend', {
    'apps/web/src/app/home/page.tsx': 'import { HomePage } from "@/features/pages/HomePage"; export default function Route({show}){return show ? <HomePage/> : null}\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'export const HomePage=()=> <main/>\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'FE_ROUTE_DRAWING_DECISION'), JSON.stringify(result, null, 2));
});

test('backend rejects decorator and declaration roles hidden in config-shaped app files', t => {
  const root = fixture(t, 'backend', {
    'src/modules/domain/value.ts': 'export const value=1\n',
    'src/features/api/feature.ts': 'export const feature=1\n',
    'apps/core/src/main.ts': 'void 0\n',
    'apps/core/src/app.module.ts': 'export const AppModule=1\n',
    'apps/core/src/core.options.ts': 'function Injectable(){return ()=>{}}; @Injectable() export class PaymentProvider {}\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path.endsWith('core.options.ts')), JSON.stringify(result, null, 2));
});

test('backend composition roots support app source layouts without swallowing modules or features', t => {
  const root = fixture(t, 'backend', {
    'src/modules/domain/value.ts': 'export const value=1\n',
    'src/features/api/feature.ts': 'export const feature=1\n',
    'apps/core/src/main.ts': 'void 0\n',
    'apps/core/src/app.module.ts': 'export const AppModule=1\n',
    'apps/core/src/orders.controller.ts': 'export class OrdersController {}\n',
  });
  const result = check(root);
  assert.ok(result.violations.some(item => item.ruleId === 'BE_APP_BUSINESS_ROLE' && item.path === 'apps/core/src/orders.controller.ts'), JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.path === 'src/modules/domain/value.ts' || item.path === 'src/features/api/feature.ts'), false, JSON.stringify(result, null, 2));
});

test('an empty project program fails closed', t => {
  const root = fixture(t, 'frontend', {
    'apps/web/src/app/home/page.tsx': 'export default function Route(){return null}\n',
    'apps/web/src/features/pages/HomePage/index.tsx': 'export const HomePage=()=>null\n',
  });
  // Both the root project and the app workspace project (which would include apps/web/src) select nothing.
  const empty = JSON.stringify({ files: [], compilerOptions: { noEmit: true } });
  fs.writeFileSync(path.join(root, 'tsconfig.json'), empty);
  fs.writeFileSync(path.join(root, 'apps/web/tsconfig.json'), empty);
  const result = check(root);
  assert.ok(result.errors.some(item => ['ARCH_NO_SOURCE', 'ARCH_TSCONFIG_INVALID'].includes(item.ruleId)), JSON.stringify(result, null, 2));
});

test('the architecture CLI exits on the record: 0 ok, 1 violations or errors, 2 bad arguments; it never passes silently', async (t) => {
  const { spawnSync } = await import('node:child_process');
  const { architectureMain } = await import('../../scripts/hfs/architecture.mjs');
  const { fileURLToPath } = await import('node:url');
  const cli = fileURLToPath(new URL('../../scripts/hfs/architecture.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(run().status, 2, 'no repository root is a usage error');
  assert.equal(run('.', '--config').status, 2, '--config no longer exists: it is an unexpected argument');
  assert.equal(run('.', '--base').status, 2, '--base without a commit is a usage error');
  const root = fixture(t, 'frontend', { 'apps/web/src/app/page.tsx': 'export default function Page() { return null; }\n' });
  assert.equal(run(root, '--config', 'architecture.json').status, 2, 'the retired --config file flag is refused');
  const unavailable = run(root);
  assert.equal(unavailable.status, 1, 'a check that cannot load the target TypeScript fails');
  const record = JSON.parse(unavailable.stdout);
  assert.equal(record.schema, 'starci/architecture-check@1');
  assert.equal(record.ok, false);
  assert.equal(record.errors[0].ruleId, 'ARCH_TYPESCRIPT_MISSING');
  const out = [];
  const main = (check) => architectureMain([root], { check, write: (text) => out.push(text), fail: () => {} });
  assert.equal(main(() => ({ schema: 'starci/architecture-check@1', ok: true, violations: [], errors: [] })), 0);
  assert.equal(main(() => ({ schema: 'starci/architecture-check@1', ok: false, violations: [{ ruleId: 'FE_TIER_DIRECTION' }], errors: [] })), 1);
  assert.equal(main(() => { throw Error('boom'); }), 1, 'a crashing check fails closed');
  assert.equal(JSON.parse(out.at(-1)).errors[0].ruleId, 'ARCH_EXECUTION_UNAVAILABLE');
});
