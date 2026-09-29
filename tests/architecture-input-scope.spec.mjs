import test from 'node:test';
import { hfsReadme } from './_hfs-tree-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {checkScopedLint,settingMatches} from '../scripts/checks/check-scoped-lint.mjs';
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
  write('src/modules/domain/store/service.ts','export class Service {}');
  write('packages/store/src/store.ts','export class Store {}');
  write('jest.config.js','export default {testEnvironment:"node"};');
  const digest='a'.repeat(64),sourceFiles=['packages/store/src/store.ts','src/modules/domain/store/service.ts'];
  const profileCatalog={schema:'starci/code-pattern-profile@1',profiles:{nest:{
    title:'Source and metadata role integration',
    canon:{package:'@starci/eslint-canon-be',version:'1.2.1',contentDigest:{algorithm:'sha256',include:['**/*.mjs'],exclude:[],framing:'sorted-posix-relative-path-null-raw-bytes-null',value:digest,files:1}},
    sourceRuleRoots:['knowledge/patterns/be'],expectedSourceRuleIds:['BE-TYPING-1','BE-IMPORTS-6'],
    sourceGlobs:['src/**/*.ts'],inputGlobs:['jest*.js'],
    obligations:[
      {id:'CONTRACTS',sourceRuleIds:['BE-TYPING-1'],applicability:{include:['**/*.ts']},
        mechanical:{requirement:'Check source contracts.',check:{kind:'architecture',ruleIds:['BE_PUBLIC_CONTRACT_FORM']}},
        semantic:{guidance:'docs/nest-contract-check.md',review:'Review behavior separately.'},status:'implemented'},
      {id:'CONFIGURATION',sourceRuleIds:['BE-IMPORTS-6'],applicability:{include:['jest*.js']},
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
  assert.deepEqual(report.obligations.find(item=>item.id==='CONFIGURATION').files,['jest.config.js']);
  assert.ok(report.coverage.expectedFiles.includes('jest.config.js'));
  assert.ok(report.inputs.before.files.includes('jest.config.js'));
  assert.ok(f.seen[0].contextFiles.includes('jest.config.js'));
  assert.ok(f.seen[0].contextFiles.includes('packages/store/src/store.ts'));
  assert.deepEqual(report.coverage.lintedFiles,f.sourceFiles);
});

test('omitting a profile source from architecture coverage still blocks conformance',async t=>{
  const f=fixture(t);
  f.sourceFiles.splice(f.sourceFiles.indexOf('src/modules/domain/store/service.ts'),1);
  const report=await checkScopedLint(f.root,[],f.options);
  assert.equal(report.status,'unavailable');
  assert.ok(report.issues.some(item=>item.code==='ARCHITECTURE_FILE_COVERAGE_UNAVAILABLE'&&item.files.includes('src/modules/domain/store/service.ts')));
});

test('configuration changed during checking still invalidates the source result',async t=>{
  const f=fixture(t),lintFiles=f.runtime.eslint.lintFiles;
  f.runtime.eslint.lintFiles=async files=>{
    f.write('jest.config.js','export default {testEnvironment:"jsdom"};');
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
  assert.ok(input.contextFiles.includes('jest.config.js'));
  assert.ok(report.inputs.before.files.includes('jest.config.js'));
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
  // HFS backend tree: the repository root holds only the allowlisted entries and every app is an apps/<app>/ composition.
  for(const [file,text] of Object.entries({'.gitattributes':'* text=auto eol=lf\n','.github/workflows/check.yml':'name: check\n','.gitignore':'node_modules/\n',
    '.husky/pre-commit':'exit 0\n','.sops.yaml':'creation_rules: []\n','.starcistacks/application-stacks.yaml':'environments: []\n','.starciwork/.gitignore':'runtime.sqlite\n',
    'README.md':hfsReadme(f.root),'codecov.yml':'coverage: {}\n','eslint.config.mjs':'export default [];\n','nest-cli.json':'{}\n','package-lock.json':'{}\n',
    'sonar-project.properties':'sonar.projectKey=fixture\n','apps/api/package.json':'{"name":"@fixture/api","private":true}\n','apps/api/src/app.module.ts':'export const AppModule=1;\n'}))f.write(file,text);
  f.write('package.json',JSON.stringify({private:true}));
  f.write('architecture.json',JSON.stringify({schema:'starci/architecture-config@1',kinds:['backend'],tsconfig:'tsconfig.json'}));
  f.write('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',strict:true,allowJs:true},include:['**/*.ts','jest.config.js']}));
  f.write('apps/api/src/main.ts','export {}');
  f.write('apps/api/jest.config.js','export default {testEnvironment:"node"};');
  fs.mkdirSync(path.join(f.root,'node_modules'),{recursive:true});
  const require=createRequire(import.meta.url);
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')),path.join(f.root,'node_modules/typescript'),'junction');
  execFileSync('git',['init','-q'],{cwd:f.root});execFileSync('git',['add','-A','.'],{cwd:f.root});
  profile.sourceGlobs.push('apps/*/src/**/*.ts');profile.inputGlobs.push('apps/*/jest*.js');
  profile.obligations[0].mechanical.check.ruleIds=['ARCH_SYNTAX_INVALID'];
  profile.obligations.push({id:'SOURCE-SCRIPT',sourceRuleIds:['BE-TYPING-1'],applicability:{include:['**/*.ts','**/*.js']},
    mechanical:{requirement:'Check selected source contracts.',check:{kind:'script',sourceOnly:true,ruleIds:['SOURCE_TEST_RULE']}},
    semantic:{guidance:'docs/architecture-input-scope.md',review:'Review behavior separately.'},status:'implemented'});
  const options={...f.options,architecture:checkArchitecture,architectureConfig:'architecture.json'};
  let report=await checkScopedLint(f.root,[],options);
  assert.equal(report.status,'clean',JSON.stringify(report.issues));
  const expected=['apps/api/src/app.module.ts','apps/api/src/main.ts','packages/store/src/store.ts','src/modules/domain/store/service.ts'];
  assert.deepEqual(report.obligations.find(item=>item.id==='SOURCE-SCRIPT').files,expected);
  const input=f.seen.find(item=>item.ruleIds.includes('SOURCE_TEST_RULE'));
  assert.deepEqual(input.sourceContextFiles,expected);
  for(const file of ['jest.config.js','apps/api/jest.config.js']){
    assert.ok(input.contextFiles.includes(file));assert.ok(report.inputs.before.files.includes(file));
    assert.ok(!report.coverage.lintedFiles.includes(file));
  }
  profile.sourceGlobs.push('jest.config.js');
  report=await checkScopedLint(f.root,[],options);
  assert.equal(report.status,'clean',JSON.stringify(report.issues));
  assert.ok(report.obligations.find(item=>item.id==='SOURCE-SCRIPT').files.includes('jest.config.js'));
});

test('an effective setting that only adds a rule\'s own ESLint defaultOptions still matches the expected setting',()=>{
  assert.equal(settingMatches([2,{}],[2],[{}]),true,'no-console folds its [{}] default into the effective config');
  assert.equal(settingMatches([2,{default:'generic',readonly:'generic'}],[2,{default:'generic',readonly:'generic'}],[{default:'array'}]),true);
  assert.equal(settingMatches([2,{allow:['warn']}],[2],[{}]),false,'options beyond the defaults stay a mismatch');
  assert.equal(settingMatches([1,{}],[2],[{}]),false,'severity never folds');
  assert.equal(settingMatches([2,{}],[2],undefined),false,'without declared defaults the comparison stays exact');
});
