import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import {checkScopedLint} from '../scripts/check-scoped-lint.mjs';

const require=createRequire(import.meta.url);
const digest='a'.repeat(64);
const obligation=(id,sourceRuleIds,ruleIds)=>({
  id,sourceRuleIds,applicability:{include:['**/*.{ts,tsx}']},
  mechanical:{requirement:'Verify the selected Next error contract.',check:{kind:'script',sourceOnly:true,ruleIds}},
  semantic:{guidance:'knowledge/patterns/fe/error.yaml',review:'Review product recovery separately.'},status:'implemented',
});
const architectureObligation={
  id:'SOURCE',sourceRuleIds:['FE-ARCHITECTURE-1'],applicability:{include:['**/*.{ts,tsx}']},
  mechanical:{requirement:'Bind the canonical TypeScript project authority.',check:{kind:'architecture',sourceOnly:true,ruleIds:['ARCH_SYNTAX_INVALID']}},
  semantic:{guidance:'docs/architecture-check.md',review:'Review framework behavior separately.'},status:'implemented',
};

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-next-required-aggregate-'));
  t.after(()=>{
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-next-required-aggregate-'));
    fs.rmSync(root,{recursive:true,force:true});
  });
  const write=(relative,value)=>{
    const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value));
  };
  fs.mkdirSync(path.join(root,'node_modules'),{recursive:true});
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')),path.join(root,'node_modules','typescript'),'junction');
  const contract={
    schema:'starci/next-error-state@1',sourceRoots:['src'],worldMappings:[],writes:[],boundaries:[],
    transports:[{root:'src/api',mode:'envelope',envelopeIds:['read']}],
    envelopes:[{id:'read',type:{path:'src/api/envelope.ts',export:'ReadEnvelope'},discriminator:{field:'ok',success:true},dataField:'data',errorFields:['error'],readers:[{path:'src/api/read.ts',export:'readCourse',emptyData:'valid'}]}],
    requiredValues:[{id:'course',owner:{path:'src/api/required.ts',export:'requireCourse'},binding:'value',absence:'undefined'}],
  };
  const manifest={private:true,starci:{codePatterns:{next:{errorState:contract}}}};
  write('package.json',manifest);write('package-lock.json',{lockfileVersion:3});
  write('architecture.scope.json',{schema:'starci/architecture-config@1',kinds:['frontend'],tsconfig:'tsconfig.json'});
  write('tsconfig.json',{compilerOptions:{module:'ESNext',moduleResolution:'Bundler',target:'ES2022',strict:true},include:['src/**/*.ts']});
  write('jest.config.ts',`import type {ReadEnvelope} from './src/api/envelope';
export function uncheckedMetadata(value:ReadEnvelope){return value.data}`);
  write('src/api/envelope.ts',`export type ReadEnvelope=
  |{readonly ok:true;readonly data:string|null;readonly error?:never}
  |{readonly ok:false;readonly data:null;readonly error:string};`);
  write('src/api/read.ts',`import type {ReadEnvelope} from './envelope';
export function readCourse(result:ReadEnvelope){if(!result.ok)throw new Error(result.error);return result.data??null}`);
  write('src/api/required.ts',`export function requireCourse(value:string|undefined):string{
  if(value===undefined)throw new Error('Course is required');return value
}`);
  const obligations=[architectureObligation,
    obligation('REQUIRED',['FE-ERROR-3'],['FE_REQUIRED_VALUE_FAILURE']),
    obligation('ENVELOPE',['FE-ERROR-2'],['FE_ERROR_ENVELOPE_POLICY']),
  ];
  const profileCatalog={schema:'starci/code-pattern-profile@1',profiles:{next:{
    title:'Required-value aggregate integration',
    canon:{package:'@starci/eslint-canon-fe',version:'1.0.0',contentDigest:{algorithm:'sha256',include:['**/*.mjs'],exclude:[],framing:'sorted-posix-relative-path-null-raw-bytes-null',value:digest,files:1}},
    sourceRuleRoots:['knowledge/patterns/fe'],expectedSourceRuleIds:['FE-ARCHITECTURE-1','FE-ERROR-2','FE-ERROR-3'],
    sourceGlobs:['src/**/*.ts'],inputGlobs:['package.json','package-lock.json','architecture.scope.json','tsconfig.json','jest.config.ts'],
    obligations,semanticOnly:[],
  }}};
  // ESLint is isolated; checkScopedLint's default script dispatcher and TypeScript programs remain real.
  const runtime={package:{name:'@starci/eslint-canon-fe',version:'1.0.0',digest,files:1},canon:{rules:{},recommended:{}},builtinRules:new Map(),typescriptRules:{},eslintVersion:'fixture',eslint:{
    isPathIgnored:async()=>false,calculateConfigForFile:async()=>({linterOptions:{noInlineConfig:true},rules:{},plugins:{}}),
    lintFiles:async files=>files.map(filePath=>({filePath,messages:[],suppressedMessages:[],errorCount:0,warningCount:0,fatalErrorCount:0})),
  }};
  const options={profile:'next',profileCatalog,runtime,architectureConfig:'architecture.scope.json',all:true};
  return {root,write,contract,manifest,check:()=>checkScopedLint(root,[],options)};
}

test('default Next dispatcher proves required values while sourceOnly excludes bound Jest metadata',async t=>{
  const f=fixture(t),report=await f.check();
  assert.equal(report.status,'clean',JSON.stringify(report.issues));
  assert.ok(report.coverage.expectedFiles.includes('jest.config.ts'));
  assert.ok(report.inputs.before.files.some(item=>item.path==='jest.config.ts'));
  assert.ok(!report.coverage.lintedFiles.includes('jest.config.ts'));
  for(const id of ['REQUIRED','ENVELOPE']){
    const selected=report.obligations.find(item=>item.id===id).files;
    assert.ok(selected.includes('src/api/required.ts'));
    assert.ok(!selected.includes('jest.config.ts'));
  }
  const required=report.machineResults.find(item=>item.obligation==='REQUIRED');
  assert.deepEqual(required.checkedRuleIds,['FE_REQUIRED_VALUE_FAILURE']);
  assert.equal(required.compiler.architectureConfig,'architecture.scope.json');
});

test('missing required-value guard reaches the aggregate as a finding',async t=>{
  const f=fixture(t);f.write('src/api/required.ts',`export function requireCourse(value:string|undefined):string{return value??'fallback'}`);
  const report=await f.check();
  assert.equal(report.status,'findings',JSON.stringify(report.issues));
  assert.ok(report.issues.some(item=>item.code==='SCRIPT_PATTERN_VIOLATION'&&item.ruleId==='FE_REQUIRED_VALUE_FAILURE'));
});

test('a cast Error lookalike cannot produce a clean aggregate result',async t=>{
  const f=fixture(t);f.write('src/api/required.ts',`class LocalLookalike{}
const Spoofed=LocalLookalike as typeof Error;
export function requireCourse(value:string|undefined):string{if(value===undefined)throw new Spoofed();return value}`);
  const report=await f.check();
  assert.equal(report.status,'unavailable',JSON.stringify(report.issues));
  assert.ok(report.issues.some(item=>item.code==='SCRIPT_INPUT_UNAVAILABLE'&&item.ruleId==='FE_REQUIRED_VALUE_FAILURE'));
});

test('an opaque undeclared envelope consumer makes the aggregate unavailable',async t=>{
  const f=fixture(t);f.write('src/api/opaque.ts',`import type {ReadEnvelope} from './envelope';
export class StoredEnvelope{constructor(readonly value:ReadEnvelope){}}`);
  const report=await f.check();
  assert.equal(report.status,'unavailable',JSON.stringify(report.issues));
  assert.ok(report.issues.some(item=>item.code==='SCRIPT_INPUT_UNAVAILABLE'&&item.ruleId==='FE_ERROR_ENVELOPE_POLICY'));
});
