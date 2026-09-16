import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {checkScopedLint} from '../scripts/check-scoped-lint.mjs';

const require=createRequire(import.meta.url);

test('aggregate dispatches real Nest test rules with exact subject context and cannot conceal missing public calls',async t=>{
  const fixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-nest-test-aggregate-'));
  const write=(relative,value)=>{
    const file=path.join(fixtureRoot,relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));
    return file;
  };
  t.after(()=>{
    const cleanup=path.resolve(fixtureRoot);
    assert.equal(path.dirname(cleanup),path.resolve(os.tmpdir()));
    assert.ok(path.basename(cleanup).startsWith('starci-nest-test-aggregate-'));
    fs.rmSync(cleanup,{recursive:true,force:true});
  });
  const source=write('src/sample.service.ts','export class SampleService { read():number { return 1 } }');
  const valid=`import { SampleService } from './sample.service';
describe('SampleService',
  () => { it('returns a value',
    () => { expect(new SampleService().read()).toBe(1); }); });`;
  const spec=write('src/sample.service.spec.ts',valid);
  write('package.json',{private:true});
  write('architecture.json',{schema:'starci/architecture-config@1',kinds:['backend'],tsconfig:'tsconfig.json'});
  write('tsconfig.json',{compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler'},include:['src/**/*.ts']});
  for(const packageName of ['typescript','@types/jest']){
    const link=path.join(fixtureRoot,'node_modules',packageName);
    fs.mkdirSync(path.dirname(link),{recursive:true});
    fs.symlinkSync(path.dirname(require.resolve(`${packageName}/package.json`)),link,'junction');
  }
  const digest='a'.repeat(64),profileCatalog={schema:'starci/code-pattern-profile@1',profiles:{nest:{
    title:'Nest test adapter integration',canon:{package:'@starci/eslint-canon-be',version:'1.2.1',contentDigest:{algorithm:'sha256',include:['**/*.mjs'],exclude:[],framing:'sorted-posix-relative-path-null-raw-bytes-null',value:digest,files:1}},
    sourceRuleRoots:['knowledge/patterns/be'],expectedSourceRuleIds:['BE-TEST-2','BE-TEST-6'],sourceGlobs:['src/**/*.ts'],inputGlobs:['package.json','architecture.json','tsconfig.json'],
    obligations:[{id:'NEST-TEST-CODE-FORM',sourceRuleIds:['BE-TEST-2','BE-TEST-6'],applicability:{include:['**/*.spec.ts']},
      mechanical:{requirement:'Check actual selected test source form.',check:{kind:'script',ruleIds:['NEST_TEST_SUBJECT_FORM','NEST_TEST_NAME_FORM']}},
      semantic:{guidance:'docs/nest-test-code-check.md',review:'Verify execution separately.'},status:'implemented'}],semanticOnly:[],
  }}};
  // Isolate routing and source binding; this fake ESLint result makes no lint-engine compatibility claim.
  const runtime={package:{name:'@starci/eslint-canon-be',version:'1.2.1',digest,files:1},canon:{rules:{},recommended:{}},builtinRules:new Map(),typescriptRules:{},eslintVersion:'fixture',eslint:{
    isPathIgnored:async()=>false,
    calculateConfigForFile:async()=>({linterOptions:{noInlineConfig:true},rules:{},plugins:{}}),
    lintFiles:async()=>[source,spec].map(filePath=>({filePath,messages:[],suppressedMessages:[],errorCount:0,warningCount:0,fatalErrorCount:0})),
  }};
  const options={profile:'nest',profileCatalog,runtime,architectureConfig:'architecture.json',all:true};
  const clean=await checkScopedLint(fixtureRoot,[],options);
  assert.equal(clean.status,'clean',JSON.stringify(clean.issues));
  assert.deepEqual(clean.coverage.covered,['NEST-TEST-CODE-FORM']);
  assert.deepEqual(clean.machineResults[0].files,['src/sample.service.spec.ts']);
  assert.deepEqual(clean.machineResults[0].checkedRuleIds,['NEST_TEST_NAME_FORM','NEST_TEST_SUBJECT_FORM']);
  write('src/sample.service.spec.ts',valid.replace('new SampleService().read()','1'));
  const findings=await checkScopedLint(fixtureRoot,[],options);
  assert.equal(findings.status,'findings',JSON.stringify(findings.issues));
  assert.ok(findings.issues.some(issue=>issue.ruleId==='NEST_TEST_SUBJECT_FORM'));
  profileCatalog.profiles.nest.obligations[0].mechanical.check.ruleIds.push('NEST_ENV_ACCESS');
  const mixed=await checkScopedLint(fixtureRoot,[],options);
  assert.equal(mixed.status,'unavailable');
});
