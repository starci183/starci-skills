import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import {checkScopedLint} from '../scripts/checks/check-scoped-lint.mjs';
import {createTypeScriptProgram,typeScriptProgramRun} from '../scripts/checks/typescript-programs.mjs';
import {loadArchitectureConfig} from '../scripts/checks/architecture/config.mjs';
import {buildTypeScriptContext} from '../scripts/checks/architecture/typescript.mjs';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const digest='a'.repeat(64);

function project(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-ts-programs-'));
  t.after(()=>{
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-ts-programs-'));
    fs.rmSync(root,{recursive:true,force:true});
  });
  const write=(relative,value)=>{const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value));};
  return {root,write};
}

test('a program run builds one program per compiler input and a released or absent run builds fresh ones',t=>{
  const {root,write}=project(t);write('src/a.ts','export const a=1;');
  const input=(options={strict:true,noEmit:true})=>({rootNames:[path.join(root,'src/a.ts')],options,projectReferences:undefined});
  const outside=[createTypeScriptProgram(ts,input()),createTypeScriptProgram(ts,input())];
  assert.notEqual(outside[0],outside[1]);
  const programs=typeScriptProgramRun();
  const first=programs.run(()=>createTypeScriptProgram(ts,input()));
  assert.equal(programs.run(()=>createTypeScriptProgram(ts,input({noEmit:true,strict:true}))),first);
  assert.notEqual(programs.run(()=>createTypeScriptProgram(ts,input({strict:false,noEmit:true}))),first);
  assert.notEqual(createTypeScriptProgram(ts,input()),first);
  programs.release();
  assert.notEqual(programs.run(()=>createTypeScriptProgram(ts,input())),first);
});

test('a run shares programs across async work and another run never sees them',async()=>{
  const programs=typeScriptProgramRun(),other=typeScriptProgramRun();
  const input={rootNames:[],options:{noEmit:true},projectReferences:undefined};
  const first=await programs.run(async()=>{await new Promise(resolve=>setImmediate(resolve));return createTypeScriptProgram(ts,input);});
  assert.equal(await programs.run(async()=>createTypeScriptProgram(ts,input)),first);
  assert.notEqual(other.run(()=>createTypeScriptProgram(ts,input)),first);
});

test('a run builds the architecture context once and hands every caller its own error list',t=>{
  const {root,write}=project(t);
  write('package.json',{private:true});
  write('architecture.json',{schema:'starci/architecture-config@1',kinds:['frontend'],tsconfig:'tsconfig.json'});
  write('tsconfig.json',{compilerOptions:{module:'ESNext',moduleResolution:'Bundler',target:'ES2022',strict:true,noEmit:true},include:['src/**/*.ts']});
  write('src/a.ts',"import {b} from './missing'; export const a=b;");
  const config=loadArchitectureConfig(root,'architecture.json');
  const outside=[buildTypeScriptContext(config,ts),buildTypeScriptContext(config,ts)];
  assert.notEqual(outside[0].program,outside[1].program);
  const programs=typeScriptProgramRun();
  const [first,second]=programs.run(()=>[buildTypeScriptContext(config,ts),buildTypeScriptContext(loadArchitectureConfig(root,'architecture.json'),ts)]);
  assert.equal(first.program,second.program);assert.equal(first.edges,second.edges);
  assert.ok(first.errors.length>0);assert.deepEqual(first.errors,second.errors);assert.notEqual(first.errors,second.errors);
  first.errors.push({ruleId:'X',message:'caller-owned'});
  assert.equal(programs.run(()=>buildTypeScriptContext(config,ts)).errors.length,second.errors.length);
  programs.release();
  assert.notEqual(programs.run(()=>buildTypeScriptContext(config,ts)).program,first.program);
});

test('check-scoped-lint builds each TypeScript project once for architecture and every script checker',async t=>{
  const {root,write}=project(t);
  // The target's TypeScript is a plain-file shim onto the spec's own compiler (no link) that counts the programs it builds.
  const created=[];globalThis[Symbol.for('starci.spec.programs')]=created;t.after(()=>{delete globalThis[Symbol.for('starci.spec.programs')];});
  write('node_modules/typescript/package.json',{name:'typescript',version:ts.version,main:'index.js'});
  write('node_modules/typescript/index.js',`const ts=require(${JSON.stringify(require.resolve('typescript'))});
module.exports=new Proxy(ts,{get:(target,key)=>key==='createProgram'?(...args)=>{const program=ts.createProgram(...args);globalThis[Symbol.for('starci.spec.programs')].push(program);return program;}:target[key]});`);
  const obligation=(id,kind,ruleIds)=>({id,sourceRuleIds:['FE-ERROR-2'],applicability:{include:['**/*.ts']},
    mechanical:{requirement:'Verify the selected contract.',check:{kind,ruleIds}},
    semantic:{guidance:'docs/next-error-state-check.md',review:'Run separate behavior checks.'},status:'implemented'});
  write('package.json',{private:true,starci:{codePatterns:{next:{schema:'starci/next-code-pattern-contract@1',owners:[],closedVocabularies:[],errorState:{schema:'starci/next-error-state@1',sourceRoots:['src'],worldMappings:[],writes:[],boundaries:[],
    transports:[{root:'src/modules/api',mode:'envelope',envelopeIds:['read']}],envelopes:[{id:'read',type:{path:'src/modules/api/envelope.ts',export:'Envelope'},discriminator:{field:'ok',success:true},dataField:'data',errorFields:['error'],readers:[{path:'src/modules/api/read.ts',export:'read',emptyData:'valid'}]}]}}}}});
  write('package-lock.json',{lockfileVersion:3});
  write('architecture.scope.json',{schema:'starci/architecture-config@1',kinds:['frontend'],tsconfig:'tsconfig.scope.json'});
  write('tsconfig.scope.json',{compilerOptions:{module:'ESNext',moduleResolution:'Bundler',target:'ES2022',strict:true,noEmit:true},include:['src/**/*.ts']});
  write('src/modules/api/envelope.ts','export type Envelope={readonly ok:true;readonly data:string|null;readonly error?:never}|{readonly ok:false;readonly data:null;readonly error:string};');
  write('src/modules/api/read.ts',"import type {Envelope} from './envelope'; export function read(result:Envelope):string|null{if(!result.ok)throw new Error(result.error);return result.data??null;}");
  const profileCatalog={schema:'starci/code-pattern-profile@1',profiles:{next:{
    title:'Program sharing',canon:{package:'@starci/eslint-canon-fe',version:'1.0.0',contentDigest:{algorithm:'sha256',include:['**/*.mjs'],exclude:[],framing:'sorted-posix-relative-path-null-raw-bytes-null',value:digest,files:1}},
    sourceRuleRoots:['knowledge/patterns/fe'],expectedSourceRuleIds:['FE-ERROR-2'],sourceGlobs:['src/**/*.ts'],
    inputGlobs:['package.json','package-lock.json','architecture.scope.json','tsconfig.scope.json'],semanticOnly:[],
    obligations:[obligation('SOURCE','architecture',['ARCH_SYNTAX_INVALID']),obligation('NAMES','script',['FE_SOURCE_NAME_SHAPE']),
      obligation('RETURNS','script',['FE_RETURN_TYPE_PROFILE']),obligation('ENVELOPE','script',['FE_ERROR_ENVELOPE_POLICY'])],
  }}};
  let beforeLint=null,lintPrograms=null;
  const runtime={package:{name:'@starci/eslint-canon-fe',version:'1.0.0',digest,files:1},canon:{rules:{},recommended:{}},builtinRules:new Map(),typescriptRules:{},eslintVersion:'fixture',eslint:{
    isPathIgnored:async()=>false,calculateConfigForFile:async()=>({linterOptions:{noInlineConfig:true},rules:{},plugins:{}}),
    lintFiles:async files=>{beforeLint=created.length;const input={rootNames:[],options:{noEmit:true},projectReferences:undefined};lintPrograms=[createTypeScriptProgram(ts,input),createTypeScriptProgram(ts,input)];
      return files.map(filePath=>({filePath,messages:[],suppressedMessages:[],errorCount:0,warningCount:0,fatalErrorCount:0}));},
  }};
  const report=await checkScopedLint(root,[],{profile:'next',profileCatalog,runtime,all:true,architectureConfig:'architecture.scope.json'});
  assert.deepEqual(report.machineResults.map(item=>[item.obligation??item.kind,item.ok]),[['architecture',true],['NAMES',true],['RETURNS',true],['ENVELOPE',true]],JSON.stringify(report.issues));
  assert.equal(beforeLint,1,'architecture, next.mjs twice and next-errors share the one declared project program');
  assert.notEqual(lintPrograms[0],lintPrograms[1],'the run is released before ESLint');
});
