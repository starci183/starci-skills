import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml} from '../core/yaml.mjs';
import {checkScopedLint} from '../scripts/check-scoped-lint.mjs';
import {checkArchitecture} from '../checks/architecture/index.mjs';

const require=createRequire(import.meta.url);
const digest='a'.repeat(64);
const swrRules=['FE_SWR_KEY_IDENTITY','FE_SWR_MUTATION_RESOURCE_IDENTITY'];
const obligation=(id,kind,ruleIds,include=['**/*.ts'])=>({id,sourceRuleIds:['FE-ERROR-2'],applicability:{include},
  mechanical:{requirement:'Verify the selected adapter contract.',check:{kind,ruleIds}},
  semantic:{guidance:'docs/next-error-state-check.md',review:'Run separate behavior checks.'},status:'implemented'});

function fixture(t,obligations){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-next-aggregate-'));
  t.after(()=>{
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-next-aggregate-'));
    fs.rmSync(root,{recursive:true,force:true});
  });
  const write=(relative,value)=>{
    const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value));
  };
  const link=name=>{
    const target=path.join(root,'node_modules',name);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.symlinkSync(path.dirname(require.resolve(`${name}/package.json`)),target,'junction');
  };
  link('typescript');
  const manifest={private:true};
  write('package.json',manifest);write('package-lock.json',{lockfileVersion:3});
  write('architecture.scope.json',{schema:'starci/architecture-config@1',kinds:['frontend'],tsconfig:'tsconfig.scope.json'});
  write('tsconfig.scope.json',{compilerOptions:{module:'ESNext',moduleResolution:'Bundler',target:'ES2022',strict:true},include:['src/**/*.ts']});
  const profileCatalog={schema:'starci/code-pattern-profile@1',profiles:{next:{
    title:'Next adapter integration',canon:{package:'@starci/eslint-canon-fe',version:'1.0.0',contentDigest:{algorithm:'sha256',include:['**/*.mjs'],exclude:[],framing:'sorted-posix-relative-path-null-raw-bytes-null',value:digest,files:1}},
    sourceRuleRoots:['knowledge/patterns/fe'],expectedSourceRuleIds:['FE-ERROR-2'],sourceGlobs:['src/**/*.ts'],
    inputGlobs:['package.json','package-lock.json','architecture.scope.json','tsconfig.scope.json'],obligations,semanticOnly:[],
  }}};
  // This ESLint stub isolates aggregate binding. TypeScript, architecture and selected script adapters are real.
  const runtime={package:{name:'@starci/eslint-canon-fe',version:'1.0.0',digest,files:1},canon:{rules:{},recommended:{}},builtinRules:new Map(),typescriptRules:{},eslintVersion:'fixture',eslint:{
    isPathIgnored:async()=>false,calculateConfigForFile:async()=>({linterOptions:{noInlineConfig:true},rules:{},plugins:{}}),
    lintFiles:async files=>files.map(filePath=>({filePath,messages:[],suppressedMessages:[],errorCount:0,warningCount:0,fatalErrorCount:0})),
  }};
  const options={profile:'next',profileCatalog,runtime,all:true,architectureConfig:'architecture.scope.json'};
  return {root,write,link,manifest,profileCatalog,runtime,options,check:overrides=>checkScopedLint(root,[],{...options,...overrides})};
}

test('aggregate executes real SWR identity checks, rejects omitted metadata, and accepts proven absence',async t=>{
  const f=fixture(t,[obligation('DATA','architecture',swrRules)]);f.link('swr');
  f.manifest.starci={codePatterns:{next:{schema:'starci/next-code-pattern-contract@1',owners:[],closedVocabularies:[],dataLifecycle:{
    schema:'starci/next-data-lifecycle@1',swr:{package:'swr',major:2},hooks:[{id:'item',path:'src/hooks/item/useItem.ts',export:'useItem',kind:'query',identities:[{id:'item',binding:'id',gatesRequest:true,resource:true}]}],
  }}}};
  f.write('package.json',f.manifest);
  const source="import useSWR from 'swr'; export const useItem=(id?:string)=>useSWR(id===undefined?null:['item',id],async()=>null);";
  f.write('src/hooks/item/useItem.ts',source);
  let report=await f.check();assert.equal(report.status,'clean',JSON.stringify(report.issues));
  assert.equal(report.machineResults[0].coverage.frontendDataLifecycle.status,'checked');
  f.write('src/hooks/item/useItem.ts',source.replace("['item',id]","['item']"));
  report=await f.check();assert.equal(report.status,'findings',JSON.stringify(report.issues));
  assert.ok(report.issues.some(item=>item.ruleId==='FE_SWR_KEY_IDENTITY'));
  delete f.manifest.starci.codePatterns.next.dataLifecycle;f.write('package.json',f.manifest);
  report=await f.check();assert.equal(report.status,'unavailable');
  f.write('src/hooks/item/useItem.ts','export const item=1;');
  report=await f.check();assert.equal(report.status,'clean',JSON.stringify(report.issues));
  assert.equal(report.machineResults[0].coverage.frontendDataLifecycle.status,'not-applicable');
});

test('aggregate rejects claimed SWR rule IDs without matching lifecycle coverage',async t=>{
  const f=fixture(t,[obligation('DATA','architecture',swrRules)]);f.write('src/item.ts','export const item=1;');
  const architecture=args=>{
    const report=checkArchitecture(args);report.coverage.frontendDataLifecycle={status:'unavailable'};
    report.coverage.checkedRuleIds.push(...swrRules);return report;
  };
  const report=await f.check({architecture});assert.equal(report.status,'unavailable');
  assert.ok(report.issues.some(item=>item.code==='ARCHITECTURE_DATA_LIFECYCLE_UNAVAILABLE'));
});

test('Next error adapter receives canonical project config and mixed overlapping source/metadata context',async t=>{
  const f=fixture(t,[obligation('SOURCE','architecture',['ARCH_SYNTAX_INVALID']),obligation('ENVELOPE','script',['FE_ERROR_ENVELOPE_POLICY'])]);
  f.manifest.starci={codePatterns:{next:{errorState:{schema:'starci/next-error-state@1',sourceRoots:['src'],worldMappings:[],writes:[],boundaries:[],
    transports:[{root:'src/modules/api',mode:'envelope',envelopeIds:['read']}],envelopes:[{id:'read',type:{path:'src/modules/api/envelope.ts',export:'Envelope'},discriminator:{field:'ok',success:true},dataField:'data',errorFields:['error'],readers:[{path:'src/modules/api/read.ts',export:'read',emptyData:'valid'}]}],
  }}}};f.write('package.json',f.manifest);
  f.write('src/modules/api/envelope.ts',"export type Envelope={readonly ok:true;readonly data:string|null;readonly error?:never}|{readonly ok:false;readonly data:null;readonly error:string};");
  const source="import type {Envelope} from './envelope'; export function read(result:Envelope){if(!result.ok)throw new Error(result.error);return result.data??null;}";
  f.write('src/modules/api/read.ts',source);
  let report=await f.check();assert.equal(report.status,'clean',JSON.stringify(report.issues));
  const result=report.machineResults.find(item=>item.obligation==='ENVELOPE');
  assert.equal(result.compiler.architectureConfig,'architecture.scope.json');
  assert.deepEqual(result.checkedRuleIds,['FE_ERROR_ENVELOPE_POLICY']);
  f.write('src/modules/api/read.ts',source.replace('if(!result.ok)throw new Error(result.error);',''));
  report=await f.check();assert.equal(report.status,'findings',JSON.stringify(report.issues));
  assert.ok(report.issues.some(item=>item.ruleId==='FE_ERROR_ENVELOPE_POLICY'));
});

test('Grammar execution evidence survives the aggregate and guard regression fails the same gate',async t=>{
  const f=fixture(t,[obligation('GRAMMAR','script',['FE_GRAMMAR_GUARD_BEHAVIOR'],['package.json'])]);
  f.write('src/item.ts','export const item=1;');
  f.manifest.starci={codePatterns:{next:{grammarGuards:{schema:'starci/grammar-guard-contract@1',package:'@starci/grammar',entry:'./common',source:{kind:'installed'},vectorProfile:'starci/grammar-guards-v1'}}}};
  f.write('package.json',f.manifest);
  f.write('node_modules/@starci/grammar/package.json',{name:'@starci/grammar',version:'1.0.0',type:'module',files:['dist'],exports:{'./common':'./dist/common.js'}});
  const source=`export const COMMON_UI_RULE_IDS=['A'];export const PRESENTATION_STATES=['ready'];
export function defineGrammarRuleConformance(value){const rules=[...value.inheritedCommonRules,...Object.keys(value.familyEvidence)];if(!rules.includes('A')||rules.some(item=>item!=='A'))throw new TypeError('invalid');return value;}
export function assertPresentationState(value){if(value!=='ready')throw new TypeError('invalid');}`;
  f.write('node_modules/@starci/grammar/dist/common.js',source);
  let report=await f.check({architectureConfig:null});assert.equal(report.status,'clean',JSON.stringify(report.issues));
  const validate=new Ajv2020({strict:true}).compile(parseYaml(fs.readFileSync(new URL('../schemas/code-pattern-check.schema.yaml',import.meta.url),'utf8')));
  assert.equal(validate(report),true,JSON.stringify(validate.errors));
  const proof=report.machineResults.find(item=>item.obligation==='GRAMMAR').execution;
  assert.equal(proof.engine,'node-esm-import');assert.equal(proof.vectors.requiredRules,1);assert.ok(proof.package.inputDigest);
  f.write('node_modules/@starci/grammar/dist/common.js',source.replace("if(value!=='ready')throw new TypeError('invalid');",''));
  report=await f.check({architectureConfig:null});assert.equal(report.status,'findings',JSON.stringify(report.issues));
  assert.ok(report.issues.some(item=>item.ruleId==='FE_GRAMMAR_GUARD_BEHAVIOR'));
});
