import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import {checkArchitecture} from '../checks/architecture.mjs';

const require=createRequire(import.meta.url);
const ts=require('typescript');

function fixture(t,files){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-frontend-layout-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(relative,value)=>{const target=path.join(root,...relative.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
  write('package.json','{"private":true}\n');
  write('architecture.json',JSON.stringify({schema:'starci/architecture-config@1',kinds:['frontend'],tsconfig:'tsconfig.json'},null,2));
  write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',jsx:'preserve',baseUrl:'.',paths:{'@/*':['src/*']},noEmit:true},include:['src/**/*']},null,2));
  for(const [relative,value] of Object.entries(files))write(relative,value);
  return {root,check:()=>checkArchitecture({repositoryRoot:root,configFile:'architecture.json',injectedTypeScript:ts})};
}

const acceptedFiles={
  'src/app/page.tsx':'import {HomePage} from "@/features/pages/HomePage";const Route=()=> <HomePage/>;export default Route;',
  'src/features/pages/HomePage/index.tsx':'import {CatalogBlock} from "@/components/blocks/catalog/CatalogBlock";export const HomePage=()=> <CatalogBlock/>;',
  'src/features/layouts/AppLayout/index.tsx':'export const AppLayout=({children}:{children:unknown})=> <main>{children}</main>;',
  'src/features/overlays/CheckoutOverlay/index.tsx':'export const CheckoutOverlay=()=> <aside/>;',
  'src/components/blocks/catalog/CatalogBlock/index.tsx':'"use client";import {useCatalog} from "@/hooks";import {CatalogBlockView} from "./component";export const CatalogBlock=()=>{const value=useCatalog();return <CatalogBlockView value={value}/>};',
  'src/components/blocks/catalog/CatalogBlock/component.tsx':'import {CatalogLeaf} from "@/components/leaves/CatalogLeaf";export const CatalogBlockView=({value}:{readonly value:string})=> <CatalogLeaf value={value}/>;',
  'src/components/leaves/CatalogLeaf/index.tsx':'import {useState} from "react";import {useAutoScroll} from "@/hooks";export const CatalogLeaf=({value}:{readonly value:string})=>{const ref=useAutoScroll();const [open,setOpen]=useState(false);return <button ref={ref} onClick={()=>setOpen(!open)}>{open?value:"closed"}</button>};',
  'src/hooks/index.ts':'export {useCatalog} from "./catalog/use-catalog";export {useAutoScroll} from "./ui/use-auto-scroll";',
  'src/hooks/catalog/use-catalog.ts':'import {readCatalog} from "@/modules/catalog/read-catalog";export const useCatalog=()=>readCatalog();',
  'src/hooks/ui/use-auto-scroll.ts':'import {useRef} from "react";export const useAutoScroll=()=>useRef(null);',
  'src/modules/catalog/read-catalog.ts':'export const readCatalog=()=>"ready";',
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
    'src/app/page.tsx':'import type {CatalogValue} from "@/modules/catalog/types";import type {PrivateValue} from "@/features/pages/HomePage/internal";import {HomePage} from "@/features/pages/HomePage/component";const Route=()=> <HomePage/>;export default Route;export type RouteValue=CatalogValue|PrivateValue;',
    'src/features/pages/HomePage/component.tsx':'export const HomePage=()=> <main/>;',
    'src/features/pages/HomePage/internal/index.ts':'export type PrivateValue="private";',
    'src/components/blocks/catalog/CatalogBlock/index.tsx':'import {useCatalog} from "@/hooks";const useBlockData=()=>useCatalog();const LocalView=({value}:{value:unknown})=> <span>{String(value)}</span>;export const CatalogBlock=()=>{const value=useBlockData();return <LocalView value={value}/>};',
    'src/components/blocks/catalog/CatalogBlock/component.tsx':'export const CatalogBlockView=({value}:{readonly value:string})=> <div>{value}</div>;',
    'src/components/leaves/WorldLeaf/index.tsx':'import {useCatalog} from "@/hooks";export const WorldLeaf=()=>{const value=useCatalog();return <span>{value}</span>};',
    'src/components/leaves/BadUiLeaf/index.tsx':'import {useBadScroll} from "@/hooks/ui/use-bad-scroll";export const BadUiLeaf=()=>{const value=useBadScroll();return <span>{value}</span>};',
    'src/components/leaves/DynamicUiLeaf/index.tsx':'import {useDynamicScroll} from "@/hooks/ui/use-dynamic-scroll";export const DynamicUiLeaf=()=>{const value=useDynamicScroll();return <span>{String(value)}</span>};',
    'src/components/leaves/Intrinsic/index.tsx':'import {useRef} from "react";const intrinsic=()=>useRef(null);export {intrinsic as useAutoScroll};',
    'src/components/pages/Legacy/index.tsx':'export const Legacy=()=> <main/>;',
    'src/modules/catalog/types.ts':'import {useCatalog} from "@/hooks";export type CatalogValue=ReturnType<typeof useCatalog>;',
    'src/hooks/ui/use-bad-scroll.ts':'import {readCatalog} from "@/modules/catalog/read-catalog";export const useBadScroll=()=>readCatalog();',
    'src/hooks/ui/use-dynamic-scroll.ts':'import {useEffect} from "react";export const useDynamicScroll=()=>{useEffect(()=>{void import("@/modules/catalog/read-catalog")},[]);return null};',
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
    'src/app/page.tsx':'import {HomePage} from "@/features/pages/HomePage";import {HiddenPage} from "@/features/pages/HiddenPage";export default function Route(){return <HomePage/>}export const hidden=HiddenPage;',
    'src/features/pages/HomePage/index.tsx':'export const HomePage=()=> <main/>;',
    'src/features/pages/HiddenPage/index.tsx':'export const HiddenPage=()=> <aside/>;',
  });
  const configFile=path.join(f.root,'architecture.json');
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  config.owners=[{id:'home-page',root:'src/features/pages/HomePage',entry:'src/features/pages/HomePage/index.tsx'}];
  fs.writeFileSync(configFile,JSON.stringify(config));
  const closed=f.check();
  assert.ok(closed.violations.some(item=>item.ruleId==='FE_APP_INTERNAL_IMPORT_OUTSIDE_FEATURES'
    && item.resolvedPath==='src/features/pages/HiddenPage/index.tsx'),JSON.stringify(closed,null,2));
  config.frontend={routes:['src']};
  fs.writeFileSync(configFile,JSON.stringify(config));
  const overlapping=f.check();
  assert.ok(overlapping.errors.some(item=>item.ruleId==='ARCH_CONFIG_INVALID'&&/must be disjoint/.test(item.message)),JSON.stringify(overlapping));
});
