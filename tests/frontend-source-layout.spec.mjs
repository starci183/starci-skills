import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {checkArchitecture} from '../scripts/checks/architecture.mjs';
import {FRAMEWORK_PINNED_KNOWLEDGE,frameworkPinnedRootFiles} from '../scripts/checks/architecture/frontend.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {hfsReadme} from './_hfs-tree-fixture.mjs';

const require=createRequire(import.meta.url);
const ts=require('typescript');

function fixture(t,files){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-frontend-layout-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const written=new Set();
  const write=(relative,value)=>{written.add(relative);const target=path.join(root,...relative.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
  // HFS: a frontend repository is an apps/<app>/ monorepo on npm; all source lives under apps/web/src.
  write('.gitattributes','* text=auto eol=lf\n');
  write('.github/workflows/check.yml','name: check\n');
  write('.gitignore','node_modules/\n');
  write('.husky/pre-commit','exit 0\n');
  write('README.md',hfsReadme(root));
  write('codecov.yml','coverage: {}\n');
  write('eslint.config.mjs','export default [];\n');
  write('package-lock.json','{}\n');
  write('sonar-project.properties','sonar.projectKey=fixture\n');
  write('package.json','{"private":true,"workspaces":["apps/*"]}\n');
  write('apps/web/package.json','{"name":"@fixture/web","private":true}\n');
  write('apps/web/next.config.ts','export default {};\n');
  write('apps/web/postcss.config.mjs','export default {};\n');
  write('apps/web/tsconfig.json',JSON.stringify({extends:'../../tsconfig.json',include:['src/**/*']}));
  write('architecture.json',JSON.stringify({schema:'starci/architecture-config@1',kinds:['frontend'],tsconfig:'tsconfig.json'},null,2));
  write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',jsx:'preserve',baseUrl:'.',paths:{'@/*':['apps/web/src/*']},noEmit:true},include:['apps/web/src/**/*']},null,2));
  for(const [relative,value] of Object.entries(files))write(relative,value);
  execFileSync('git',['init','-q'],{cwd:root});
  execFileSync('git',['add','--',...written],{cwd:root});
  return {root,check:()=>checkArchitecture({repositoryRoot:root,configFile:'architecture.json',injectedTypeScript:ts})};
}

const acceptedFiles={
  'apps/web/src/app/page.tsx':'import {HomePage} from "@/features/pages/HomePage";const Route=()=> <HomePage/>;export default Route;',
  'apps/web/src/features/pages/HomePage/index.tsx':'import {CatalogBlock} from "@/components/blocks/catalog/CatalogBlock";export const HomePage=()=> <CatalogBlock/>;',
  'apps/web/src/features/layouts/AppLayout/index.tsx':'export const AppLayout=({children}:{children:unknown})=> <main>{children}</main>;',
  'apps/web/src/features/overlays/CheckoutOverlay/index.tsx':'export const CheckoutOverlay=()=> <aside/>;',
  'apps/web/src/components/blocks/catalog/CatalogBlock/index.tsx':'"use client";import {useCatalog} from "@/hooks";import {CatalogBlockView} from "./component";export const CatalogBlock=()=>{const value=useCatalog();return <CatalogBlockView value={value}/>};',
  'apps/web/src/components/blocks/catalog/CatalogBlock/component.tsx':'import {CatalogLeaf} from "@/components/leaves/CatalogLeaf";export const CatalogBlockView=({value}:{readonly value:string})=> <CatalogLeaf value={value}/>;',
  'apps/web/src/components/leaves/CatalogLeaf/index.tsx':'import {useState} from "react";import {useAutoScroll} from "@/hooks";export const CatalogLeaf=({value}:{readonly value:string})=>{const ref=useAutoScroll();const [open,setOpen]=useState(false);return <button ref={ref} onClick={()=>setOpen(!open)}>{open?value:"closed"}</button>};',
  'apps/web/src/hooks/index.ts':'export {useCatalog} from "./catalog/use-catalog";export {useAutoScroll} from "./ui/use-auto-scroll";',
  'apps/web/src/hooks/catalog/use-catalog.ts':'import {readCatalog} from "@/modules/catalog/read-catalog";export const useCatalog=()=>readCatalog();',
  'apps/web/src/hooks/ui/use-auto-scroll.ts':'import {useRef} from "react";export const useAutoScroll=()=>useRef(null);',
  'apps/web/src/modules/catalog/read-catalog.ts':'export const readCatalog=()=>"ready";',
};

test('accepted Next layout keeps app on feature entries and connected blocks on sibling render owners',t=>{
  const result=fixture(t,acceptedFiles).check();
  assert.equal(result.ok,true,JSON.stringify(result,null,2));
  for(const id of ['FE_SOURCE_LAYOUT_INVALID','FE_APP_INTERNAL_IMPORT_OUTSIDE_FEATURES','FE_FEATURE_DEPENDENCY_DIRECTION',
    'FE_CONNECTED_BLOCK_RENDER_PAIR','FE_COMPONENT_WORLD_OWNERSHIP','FE_BLOCK_PRODUCT_HOOK_DEFINITION','FE_CUSTOM_HOOK_LOCATION']) {
    assert.ok(result.coverage.checkedRuleIds.includes(id),id);
  }
});

test('layout, dependency, hook ownership and connected-block pair checks resolve aliases and type-only edges',t=>{
  const files={...acceptedFiles,
    'apps/web/src/app/page.tsx':'import type {CatalogValue} from "@/modules/catalog/types";import type {PrivateValue} from "@/features/pages/HomePage/internal";import {HomePage} from "@/features/pages/HomePage/component";const Route=()=> <HomePage/>;export default Route;export type RouteValue=CatalogValue|PrivateValue;',
    'apps/web/src/features/pages/HomePage/component.tsx':'export const HomePage=()=> <main/>;',
    'apps/web/src/features/pages/HomePage/internal/index.ts':'export type PrivateValue="private";',
    'apps/web/src/components/blocks/catalog/CatalogBlock/index.tsx':'import {useCatalog} from "@/hooks";const useBlockData=()=>useCatalog();const LocalView=({value}:{value:unknown})=> <span>{String(value)}</span>;export const CatalogBlock=()=>{const value=useBlockData();return <LocalView value={value}/>};',
    'apps/web/src/components/blocks/catalog/CatalogBlock/component.tsx':'export const CatalogBlockView=({value}:{readonly value:string})=> <div>{value}</div>;',
    'apps/web/src/components/leaves/WorldLeaf/index.tsx':'import {useCatalog} from "@/hooks";export const WorldLeaf=()=>{const value=useCatalog();return <span>{value}</span>};',
    'apps/web/src/components/leaves/BadUiLeaf/index.tsx':'import {useBadScroll} from "@/hooks/ui/use-bad-scroll";export const BadUiLeaf=()=>{const value=useBadScroll();return <span>{value}</span>};',
    'apps/web/src/components/leaves/DynamicUiLeaf/index.tsx':'import {useDynamicScroll} from "@/hooks/ui/use-dynamic-scroll";export const DynamicUiLeaf=()=>{const value=useDynamicScroll();return <span>{String(value)}</span>};',
    'apps/web/src/components/leaves/Intrinsic/index.tsx':'import {useRef} from "react";const intrinsic=()=>useRef(null);export {intrinsic as useAutoScroll};',
    'apps/web/src/components/pages/Legacy/index.tsx':'export const Legacy=()=> <main/>;',
    'apps/web/src/modules/catalog/types.ts':'import {useCatalog} from "@/hooks";export type CatalogValue=ReturnType<typeof useCatalog>;',
    'apps/web/src/hooks/ui/use-bad-scroll.ts':'import {readCatalog} from "@/modules/catalog/read-catalog";export const useBadScroll=()=>readCatalog();',
    'apps/web/src/hooks/ui/use-dynamic-scroll.ts':'import {useEffect} from "react";export const useDynamicScroll=()=>{useEffect(()=>{void import("@/modules/catalog/read-catalog")},[]);return null};',
  };
  const result=fixture(t,files).check(),rules=new Set(result.violations.map(item=>item.ruleId));
  for(const id of ['FE_SOURCE_LAYOUT_INVALID','FE_APP_INTERNAL_IMPORT_OUTSIDE_FEATURES','FE_FEATURE_DEPENDENCY_DIRECTION',
    'FE_CONNECTED_BLOCK_RENDER_PAIR','FE_COMPONENT_WORLD_OWNERSHIP','FE_BLOCK_PRODUCT_HOOK_DEFINITION','FE_CUSTOM_HOOK_LOCATION']) {
    assert.ok(rules.has(id),`${id}: ${JSON.stringify(result,null,2)}`);
  }
  assert.ok(result.violations.some(item=>item.ruleId==='FE_APP_INTERNAL_IMPORT_OUTSIDE_FEATURES'&&item.specifier==='@/modules/catalog/types'));
  assert.ok(result.violations.some(item=>item.ruleId==='FE_APP_INTERNAL_IMPORT_OUTSIDE_FEATURES'&&item.specifier==='@/features/pages/HomePage/internal'));
  assert.ok(result.violations.some(item=>item.ruleId==='FE_CONNECTED_BLOCK_RENDER_PAIR'&&item.path.endsWith('/CatalogBlock/index.tsx')));
  assert.ok(result.violations.some(item=>item.ruleId==='FE_CUSTOM_HOOK_LOCATION'&&item.path.endsWith('/Intrinsic/index.tsx')));
  assert.ok(result.violations.some(item=>item.ruleId==='FE_COMPONENT_WORLD_OWNERSHIP'&&item.path.endsWith('/BadUiLeaf/index.tsx')));
  assert.ok(result.violations.some(item=>item.ruleId==='FE_COMPONENT_WORLD_OWNERSHIP'&&item.path.endsWith('/DynamicUiLeaf/index.tsx')));
});

test('declared feature entries are closed and frontend role roots cannot overlap',t=>{
  const f=fixture(t,{
    'apps/web/src/app/page.tsx':'import {HomePage} from "@/features/pages/HomePage";import {HiddenPage} from "@/features/pages/HiddenPage";export default function Route(){return <HomePage/>}export const hidden=HiddenPage;',
    'apps/web/src/features/pages/HomePage/index.tsx':'export const HomePage=()=> <main/>;',
    'apps/web/src/features/pages/HiddenPage/index.tsx':'export const HiddenPage=()=> <aside/>;',
  });
  const configFile=path.join(f.root,'architecture.json');
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  config.owners=[{id:'home-page',root:'apps/web/src/features/pages/HomePage',entry:'apps/web/src/features/pages/HomePage/index.tsx'}];
  fs.writeFileSync(configFile,JSON.stringify(config));
  const closed=f.check();
  assert.ok(closed.violations.some(item=>item.ruleId==='FE_APP_INTERNAL_IMPORT_OUTSIDE_FEATURES'
    && item.resolvedPath==='apps/web/src/features/pages/HiddenPage/index.tsx'),JSON.stringify(closed,null,2));
  config.frontend={routes:['apps/web/src']};
  fs.writeFileSync(configFile,JSON.stringify(config));
  const overlapping=f.check();
  assert.ok(overlapping.errors.some(item=>item.ruleId==='ARCH_CONFIG_INVALID'&&/must be disjoint/.test(item.message)),JSON.stringify(overlapping));
});

// Supervisor ruling, nivo wf-nivo-fe-debt-mug06w7h inc-2e42a24b74e4: Next.js loads middleware,
// instrumentation and instrumentation-client (and next-env.d.ts) only from the source root, so those exact
// names are framework adapters there - listed in knowledge, kept thin, and nothing else joins them.
test('framework-pinned root files are read from knowledge FE-FOLDER-1, exact and nonempty',t=>{
  const names=frameworkPinnedRootFiles();
  const authored=parseYaml(fs.readFileSync(FRAMEWORK_PINNED_KNOWLEDGE,'utf8')).rules.find(rule=>rule.id==='FE-FOLDER-1').frameworkPinnedRootFiles;
  assert.deepEqual([...names].sort(),[...authored].sort());
  for(const name of ['middleware.ts','middleware.js','middleware.mjs','instrumentation.ts','instrumentation.js','instrumentation.mjs',
    'instrumentation-client.ts','instrumentation-client.js','instrumentation-client.mjs','next-env.d.ts',
    'proxy.ts','proxy.js','proxy.mjs'])assert.ok(names.has(name),name);
  assert.equal(names.has('proxy.tsx'),false);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-pinned-knowledge-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const bad=path.join(dir,'folder.yaml');
  fs.writeFileSync(bad,'rules:\n  - id: FE-FOLDER-1\n    frameworkPinnedRootFiles: ["src/*.ts"]\n');
  assert.throws(()=>frameworkPinnedRootFiles(bad),/^Error: ARCH_KNOWLEDGE_UNAVAILABLE/);
  fs.writeFileSync(bad,'rules:\n  - id: FE-FOLDER-1\n');
  assert.throws(()=>frameworkPinnedRootFiles(bad),/^Error: ARCH_KNOWLEDGE_UNAVAILABLE/);
  assert.throws(()=>frameworkPinnedRootFiles(path.join(dir,'missing.yaml')),/^Error: ARCH_KNOWLEDGE_UNAVAILABLE/);
  fs.writeFileSync(bad,'rules:\n  - id: FE-FOLDER-1\n    frameworkPinnedRootFiles: [middleware.ts]\n');
  assert.throws(()=>frameworkPinnedRootFiles(bad),/frameworkPinnedRootExports/,'the mandated-export map is part of the same contract');
  fs.writeFileSync(bad,'rules:\n  - id: FE-FOLDER-1\n    frameworkPinnedRootFiles: [middleware.ts]\n    frameworkPinnedRootExports: {proxy: [config]}\n');
  assert.throws(()=>frameworkPinnedRootFiles(bad),/no frameworkPinnedRootFiles entry pins/);
  fs.writeFileSync(bad,'rules:\n  - id: FE-FOLDER-1\n    frameworkPinnedRootFiles: [middleware.ts]\n    frameworkPinnedRootExports: {middleware: [config]}\n');
  assert.deepEqual([...frameworkPinnedRootFiles(bad)],['middleware.ts'],'an explicit file is read afresh, never the cached install list');
});

test('framework-pinned files at the source root are thin adapters, not layout findings',t=>{
  const result=fixture(t,{...acceptedFiles,
    'apps/web/src/middleware.ts':'import {routing} from "@/modules/i18n/routing";import {HomePage} from "./features/pages/HomePage";export default function middleware(){return routing(String(HomePage))}export const config={matcher:["/"]};',
    'apps/web/src/instrumentation.ts':'import {register as start} from "./modules/telemetry/register";export function register(){start()}',
    'apps/web/src/instrumentation-client.ts':'export const onRouterTransitionStart=()=>undefined;',
    'apps/web/src/modules/i18n/routing.ts':'export const routing=(value:string)=>value;',
    'apps/web/src/modules/telemetry/register.ts':'export const register=()=>undefined;',
  }).check();
  assert.equal(result.ok,true,JSON.stringify(result.violations,null,2));
  assert.ok(result.coverage.checkedRuleIds.includes('FE_FRAMEWORK_ADAPTER_IMPORT'));
  assert.ok(result.coverage.sourceFiles.includes('apps/web/src/middleware.ts'),'the pinned file is in the checked program, not excluded');
});

test('only the exact pinned names directly in the source root are accepted; everything else at the root stays refused',t=>{
  const result=fixture(t,{...acceptedFiles,
    'apps/web/src/middleware.ts':'export default function middleware(){return null}',
    'apps/web/src/middleware/standalone-self-proxy.ts':'export const selfProxy=()=>false;',
    'apps/web/src/i18n/request.ts':'export const request=()=>"vi";',
    'apps/web/src/config.ts':'export const config=1;',
    'apps/web/src/instrumentation.tsx':'export const register=()=>null;',
    'apps/web/src/proxy.ts':'export const config={matcher:["/"]};export function proxy(){return null}',
    'apps/web/src/server.ts':'export const server=()=>null;',
    'apps/web/src/lib/middleware.ts':'export const nested=()=>null;',
    'apps/web/src/app/instrumentation.ts':'export function register(){}',
  }).check();
  const layout=new Set(result.violations.filter(item=>item.ruleId==='FE_SOURCE_LAYOUT_INVALID').map(item=>item.path));
  for(const refused of ['apps/web/src/middleware/standalone-self-proxy.ts','apps/web/src/i18n/request.ts','apps/web/src/config.ts','apps/web/src/instrumentation.tsx','apps/web/src/server.ts','apps/web/src/lib/middleware.ts'])
    assert.ok(layout.has(refused),`${refused}: ${JSON.stringify([...layout])}`);
  assert.equal(layout.has('apps/web/src/middleware.ts'),false);
  assert.equal(layout.has('apps/web/src/proxy.ts'),false,'proxy.ts is the Next 16 name of middleware (nivo inc-846867b9a34e)');
  assert.equal(layout.has('apps/web/src/app/instrumentation.ts'),false,'a file under app/ is a route-root file, judged as before');
  assert.equal(result.violations.some(item=>item.ruleId==='FE_FRAMEWORK_ADAPTER_IMPORT'&&item.path==='apps/web/src/app/instrumentation.ts'),false);
});

test('a pinned adapter importing anything but modules or a feature public entry is FE_FRAMEWORK_ADAPTER_IMPORT',t=>{
  const result=fixture(t,{...acceptedFiles,
    'apps/web/src/middleware.ts':[
      'import {routing} from "./i18n/routing";',
      'import {selfProxy} from "./middleware/standalone-self-proxy";',
      'import type {CatalogValue} from "@/components/leaves/CatalogLeaf";',
      'import {useCatalog} from "@/hooks";',
      'import {Private} from "@/features/pages/HomePage/internal";',
      'import {readCatalog} from "@/modules/catalog/read-catalog";',
      'export default function middleware(){return [routing,selfProxy,useCatalog,Private,readCatalog] as unknown as CatalogValue}',
    ].join(''),
    'apps/web/src/i18n/routing.ts':'export const routing=1;',
    'apps/web/src/middleware/standalone-self-proxy.ts':'export const selfProxy=()=>false;',
    'apps/web/src/features/pages/HomePage/internal/index.ts':'export const Private=1;',
  }).check();
  const adapter=result.violations.filter(item=>item.ruleId==='FE_FRAMEWORK_ADAPTER_IMPORT');
  assert.deepEqual(adapter.map(item=>item.specifier).sort(),
    ['./i18n/routing','./middleware/standalone-self-proxy','@/components/leaves/CatalogLeaf','@/features/pages/HomePage/internal','@/hooks'].sort(),JSON.stringify(adapter,null,2));
  assert.ok(adapter.every(item=>item.path==='apps/web/src/middleware.ts'&&item.resolvedPath&&item.line===1));
  assert.equal(result.violations.some(item=>item.ruleId==='FE_SOURCE_LAYOUT_INVALID'&&item.path==='apps/web/src/middleware.ts'),false);
});
