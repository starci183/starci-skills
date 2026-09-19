import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {checkScopedLint} from '../scripts/checks/check-scoped-lint.mjs';
import {checkArchitecture} from '../scripts/checks/architecture/index.mjs';

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-architecture-input-scope-'));
  t.after(()=>{
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('starci-architecture-input-scope-'));
    fs.rmSync(root,{recursive:true,force:true});
  });
  const write=(relative,text)=>{
    const file=path.join(root,relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,text);
  };
  write('src/service.ts','export class Service {}');
  write('server/modules/store/store.ts','export class Store {}');
  write('jest.config.ts','export default {testEnvironment:"node"};');
  const digest='a'.repeat(64),sourceFiles=['server/modules/store/store.ts','src/service.ts'];
  const profileCatalog={schema:'starci/code-pattern-profile@1',profiles:{nest:{
    title:'Source and metadata role integration',
    canon:{package:'@starci/eslint-canon-be',version:'1.2.1',contentDigest:{algorithm:'sha256',include:['**/*.mjs'],exclude:[],framing:'sorted-posix-relative-path-null-raw-bytes-null',value:digest,files:1}},
    sourceRuleRoots:['knowledge/patterns/be'],expectedSourceRuleIds:['BE-TYPING-1','BE-IMPORTS-6'],
    sourceGlobs:['src/**/*.ts'],inputGlobs:['jest*.ts'],
    obligations:[
      {id:'CONTRACTS',sourceRuleIds:['BE-TYPING-1'],applicability:{include:['**/*.ts']},
        mechanical:{requirement:'Check source contracts.',check:{kind:'architecture',ruleIds:['BE_PUBLIC_CONTRACT_FORM']}},
        semantic:{guidance:'docs/nest-contract-check.md',review:'Review behavior separately.'},status:'implemented'},
      {id:'CONFIGURATION',sourceRuleIds:['BE-IMPORTS-6'],applicability:{include:['jest*.ts']},
        mechanical:{requirement:'Check metadata through its own adapter.',check:{kind:'script',ruleIds:['CONFIG_TEST_RULE']}},
        semantic:{guidance:'docs/architecture-input-scope.md',review:'Check actual configuration execution separately.'},status:'implemented'},
    ],semanticOnly:[],
  }}};
  const seen=[];
  // These adapters isolate subject selection, not TypeScript or ESLint behavior.
  const architecture=()=>({schema:'starci/architecture-check@1',ok:true,repository:root,kinds:['backend'],files:sourceFiles.length,
    compiler:{version:'fixture'},violations:[],errors:[],coverage:{sourceFiles:[...sourceFiles],checkedRuleIds:['BE_PUBLIC_CONTRACT_FORM'],backendContractTypeForm:{publicContracts:{status:'checked'}}},limitations:['static']} );
  const scriptChecker=async(_profile,input)=>{
    seen.push(input);
    return {schema:'starci/code-pattern-script@1',repository:root,files:input.files,checkedRuleIds:input.ruleIds,violations:[],errors:[],compiler:{version:'fixture',resolved:'fixture'}};
  };
  const runtime={package:{name:'@starci/eslint-canon-be',version:'1.2.1',digest,files:1},canon:{rules:{},recommended:{}},builtinRules:new Map(),typescriptRules:{},eslintVersion:'fixture',eslint:{
    isPathIgnored:async()=>false,calculateConfigForFile:async()=>({linterOptions:{noInlineConfig:true},rules:{},plugins:{}}),
    lintFiles:async files=>files.map(filePath=>({filePath,messages:[],suppressedMessages:[],errorCount:0,warningCount:0,fatalErrorCount:0})),
  }};
  return {root,write,seen,sourceFiles,runtime,options:{profile:'nest',profileCatalog,runtime,architecture,scriptChecker,all:true}};
}

test('metadata remains bound and script-checked while custom architecture roots remain source subjects',async t=>{
  const f=fixture(t),report=await checkScopedLint(f.root,[],f.options);
  assert.equal(report.status,'clean',JSON.stringify(report.issues));
  assert.deepEqual(report.obligations.find(item=>item.id==='CONTRACTS').files,f.sourceFiles);
  assert.deepEqual(report.obligations.find(item=>item.id==='CONFIGURATION').files,['jest.config.ts']);
  assert.ok(report.coverage.expectedFiles.includes('jest.config.ts'));
  assert.ok(report.inputs.before.files.includes('jest.config.ts'));
  assert.ok(f.seen[0].contextFiles.includes('jest.config.ts'));
  assert.ok(f.seen[0].contextFiles.includes('server/modules/store/store.ts'));
  assert.deepEqual(report.coverage.lintedFiles,f.sourceFiles);
});

test('omitting a profile source from architecture coverage still blocks conformance',async t=>{
  const f=fixture(t);
  f.sourceFiles.splice(f.sourceFiles.indexOf('src/service.ts'),1);
  const report=await checkScopedLint(f.root,[],f.options);
  assert.equal(report.status,'unavailable');
  assert.ok(report.issues.some(item=>item.code==='ARCHITECTURE_FILE_COVERAGE_UNAVAILABLE'&&item.files.includes('src/service.ts')));
});

test('configuration changed during checking still invalidates the source result',async t=>{
  const f=fixture(t),lintFiles=f.runtime.eslint.lintFiles;
  f.runtime.eslint.lintFiles=async files=>{
    f.write('jest.config.ts','export default {testEnvironment:"jsdom"};');
    return lintFiles(files);
  };
  const report=await checkScopedLint(f.root,[],f.options);
  assert.equal(report.status,'unavailable');
  assert.equal(report.inputs.stable,false);
  assert.ok(report.issues.some(item=>item.code==='INPUTS_CHANGED_DURING_CHECK'));
});

test('source-only script includes custom production roots while retaining metadata as context',async t=>{
  const f=fixture(t),profile=f.options.profileCatalog.profiles.nest;
  profile.obligations.push({id:'SOURCE-SCRIPT',sourceRuleIds:['BE-TYPING-1'],applicability:{include:['**/*.ts']},
    mechanical:{requirement:'Check selected source contracts.',check:{kind:'script',sourceOnly:true,ruleIds:['SOURCE_TEST_RULE']}},
    semantic:{guidance:'docs/architecture-input-scope.md',review:'Review behavior separately.'},status:'implemented'});
  const report=await checkScopedLint(f.root,[],f.options);
  assert.equal(report.status,'clean',JSON.stringify(report.issues));
  const input=f.seen.find(item=>item.ruleIds.includes('SOURCE_TEST_RULE'));
  assert.deepEqual(input.files,f.sourceFiles);
  assert.ok(input.contextFiles.includes('jest.config.ts'));
  assert.ok(report.inputs.before.files.includes('jest.config.ts'));
});

test('source-only subject selection rejects non-boolean values instead of silently narrowing scope',async t=>{
  const f=fixture(t);
  f.options.profileCatalog.profiles.nest.obligations[1].mechanical.check.sourceOnly='true';
  const report=await checkScopedLint(f.root,[],f.options);
  assert.notEqual(report.status,'clean');
  assert.ok(report.issues.some(item=>item.code==='PROFILE_SUBJECT_SELECTION_INVALID'));
});

test('real broad TypeScript programs retain explicit configuration roles without hiding custom source roots',async t=>{
  const f=fixture(t),profile=f.options.profileCatalog.profiles.nest;
  f.write('package.json',JSON.stringify({private:true}));
  f.write('architecture.json',JSON.stringify({schema:'starci/architecture-config@1',kinds:['backend'],tsconfig:'tsconfig.json'}));
  f.write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',strict:true},include:['**/*.ts']}));
  f.write('apps/api/src/main.ts','export {}');
  f.write('apps/api/jest.config.ts','export default {testEnvironment:"node"};');
  fs.mkdirSync(path.join(f.root,'node_modules'),{recursive:true});
  const require=createRequire(import.meta.url);
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')),path.join(f.root,'node_modules/typescript'),'junction');
  profile.sourceGlobs.push('apps/*/src/**/*.ts');profile.inputGlobs.push('apps/*/jest*.ts');
  profile.obligations[0].mechanical.check.ruleIds=['ARCH_SYNTAX_INVALID'];
  profile.obligations.push({id:'SOURCE-SCRIPT',sourceRuleIds:['BE-TYPING-1'],applicability:{include:['**/*.ts']},
    mechanical:{requirement:'Check selected source contracts.',check:{kind:'script',sourceOnly:true,ruleIds:['SOURCE_TEST_RULE']}},
    semantic:{guidance:'docs/architecture-input-scope.md',review:'Review behavior separately.'},status:'implemented'});
  const options={...f.options,architecture:checkArchitecture,architectureConfig:'architecture.json'};
  let report=await checkScopedLint(f.root,[],options);
  assert.equal(report.status,'clean',JSON.stringify(report.issues));
  const expected=['apps/api/src/main.ts','server/modules/store/store.ts','src/service.ts'];
  assert.deepEqual(report.obligations.find(item=>item.id==='SOURCE-SCRIPT').files,expected);
  const input=f.seen.find(item=>item.ruleIds.includes('SOURCE_TEST_RULE'));
  assert.deepEqual(input.sourceContextFiles,expected);
  for(const file of ['jest.config.ts','apps/api/jest.config.ts']){
    assert.ok(input.contextFiles.includes(file));assert.ok(report.inputs.before.files.includes(file));
    assert.ok(!report.coverage.lintedFiles.includes(file));
  }
  profile.sourceGlobs.push('jest.config.ts');
  report=await checkScopedLint(f.root,[],options);
  assert.equal(report.status,'clean',JSON.stringify(report.issues));
  assert.ok(report.obligations.find(item=>item.id==='SOURCE-SCRIPT').files.includes('jest.config.ts'));
});
