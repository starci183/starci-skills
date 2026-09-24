import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {changedFilesOf,declaredPushGateLint,parseEslintCommand,patternReaches,pushGateProof,shellWords} from '../scripts/kernel/push-gate.mjs';

// settle's push-gate half (modules/kernel/api.yaml commands.settle, push-gate-red): a committing
// op's pass also runs the target repository's own declared pre-push lint over the files the job
// changed. The target is a tmp git checkout with a stand-in `eslint` package whose bin speaks
// ESLint's JSON format: a line containing LINT_ERROR is an error, LINT_WARN a warning.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=v=>JSON.stringify(v??null);
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

const FAKE_ESLINT=`#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const argv=process.argv.slice(2),at=argv.indexOf('--'),files=at<0?[]:argv.slice(at+1);
fs.appendFileSync(path.join(process.cwd(),'eslint-calls.log'),JSON.stringify(argv)+'\\n');
if(files.some(f=>f.includes('CRASH'))){process.stderr.write('Oops! Something went wrong');process.exit(2);}
const out=files.map(f=>{const text=fs.readFileSync(path.resolve(f),'utf8');const messages=[];
  text.split('\\n').forEach((line,i)=>{if(line.includes('LINT_ERROR'))messages.push({ruleId:'house/no-error',severity:2,message:'error here',line:i+1});
    if(line.includes('LINT_WARN'))messages.push({ruleId:'house/no-warn',severity:1,message:'warn here',line:i+1});});
  return {filePath:path.resolve(f),messages,errorCount:messages.filter(m=>m.severity===2).length,warningCount:messages.filter(m=>m.severity===1).length};});
process.stdout.write(JSON.stringify(out));process.exit(out.some(r=>r.errorCount)?1:0);
`;

// A checkout whose .husky/pre-push runs `npm run lint:check` (eslint over src/**/*.ts), with the
// stand-in eslint installed under node_modules (ignored by git).
const checkout=(t,{hook='npm run lint:check && npm run test:unit\n',lintCheck='eslint "src/**/*.ts" --max-warnings=0',eslint=true}={})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-push-gate-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(dir,'work');
  fs.mkdirSync(path.join(repo,'src'),{recursive:true});
  git(repo,'init','--quiet');
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  fs.writeFileSync(path.join(repo,'package.json'),json({name:'target',private:true,scripts:{'lint:check':lintCheck,'test:unit':'jest'}}));
  if(hook!==null){fs.mkdirSync(path.join(repo,'.husky'));fs.writeFileSync(path.join(repo,'.husky','pre-push'),hook);}
  if(eslint){
    const pkg=path.join(repo,'node_modules','eslint');
    fs.mkdirSync(path.join(pkg,'bin'),{recursive:true});
    fs.writeFileSync(path.join(pkg,'package.json'),json({name:'eslint',version:'9.1.0',bin:{eslint:'bin/eslint.js'}}));
    fs.writeFileSync(path.join(pkg,'bin','eslint.js'),FAKE_ESLINT);
  }
  fs.writeFileSync(path.join(repo,'.gitignore'),'node_modules/\n.starciwork/\neslint-calls.log\n');
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = 1;\n');
  fs.writeFileSync(path.join(repo,'src','untouched.ts'),'// LINT_ERROR left by someone else\n');
  git(repo,'add','.');
  // the baseline predates every admission time a spec uses, so it is never the job's change
  const old='2020-01-01T00:00:00Z';
  const init=spawnSync('git',['-C',repo,'commit','--quiet','-m','init'],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_AUTHOR_DATE:old,GIT_COMMITTER_DATE:old}});
  assert.equal(init.status,0,init.stderr);
  const commit=(file,body)=>{
    fs.mkdirSync(path.dirname(path.join(repo,file)),{recursive:true});
    fs.writeFileSync(path.join(repo,file),body);
    git(repo,'add',file);
    git(repo,'commit','--quiet','-m',`edit ${file}`);
    return git(repo,'rev-parse','HEAD');
  };
  const calls=()=>{try{return fs.readFileSync(path.join(repo,'eslint-calls.log'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return [];}};
  return {dir,repo,commit,calls};
};

// A running backend.implement job (commitPolicy scoped-local-commit, push false) owning src/,
// admitted at `admittedAt`, with a filed done report naming `head` and green recorded checks.
const seedJob=(repo,{head,files,admittedAt=Date.now(),jobId='op-gate-1',wf='wf-gate'})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.ensureWorkflow({workflowId:wf,title:'gate'});
    ledger.enqueueJob({jobId,workflowId:wf,opId:'backend.implement',kind:'op',payload:{
      opId:'backend.implement',owned_paths:['src/'],orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},
    }});
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,'backend.implement',1,`ctx-${jobId}`,'# contract',json({worktree:repo}),admittedAt);
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,`ctx-${jobId}`,'backend.implement',1,0,'done',json({outcome:'done',summary:'landed',head,branch:'main',...(files?{files}:{})}),null,admittedAt);
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(wf,'backend.implement',1,json({checks:[{name:'unit',exitCode:0}]}),admittedAt);
  }finally{ledger.close();}
  return jobId;
};
// The contract-change registry the settle reads (STARCI_CONTRACT_CHANGES), with settle-push-gate-lint
// in force from `effectiveAt`: the past for a leg admitted under it, the future for an older leg.
const registryAt=(dir,effectiveAt)=>{
  const file=path.join(dir,'contract-changes.yaml');
  fs.writeFileSync(file,`schema: starci/contract-changes@1\nchanges:\n  - id: settle-push-gate-lint\n    effectiveAt: '${new Date(effectiveAt).toISOString()}'\n    summary: spec\n    reach: new-legs\n`);
  return {STARCI_CONTRACT_CHANGES:file};
};
const settlePass=(repo,jobId,env={})=>{
  const r=spawnSync(process.execPath,[API,'settle','--repo',repo,'--job',jobId,'--verdict','pass','--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,...env}});
  let body=null;try{body=JSON.parse(r.stdout);}catch{}
  return {r,body};
};
const statusOf=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}finally{l.close();}};

test('the declared push-gate lint is read from .husky/pre-push through package scripts, else lint:check',t=>{
  assert.deepEqual(shellWords(`npm run lint:check && eslint "{src,apps}/**/*.ts" --max-warnings=0; npx jest`),
    ['npm','run','lint:check','&&','eslint','{src,apps}/**/*.ts','--max-warnings=0',';','npx','jest']);
  assert.deepEqual(parseEslintCommand(['npx','eslint','.','--fix','--max-warnings','3','-c','eslint.config.mjs','--format','stylish']),
    {patterns:['.'],options:['-c=eslint.config.mjs'],maxWarnings:3});
  assert.equal(parseEslintCommand(['jest','--selectProjects','unit']),null);

  const {repo}=checkout(t);
  const hooked=declaredPushGateLint(repo);
  assert.equal(hooked.source,'.husky/pre-push');
  assert.deepEqual(hooked.commands.map(c=>[c.script,c.patterns,c.maxWarnings]),[['lint:check',['src/**/*.ts'],0]]);

  const {repo:bare}=checkout(t,{hook:null,lintCheck:'eslint . --max-warnings=0'});
  assert.equal(declaredPushGateLint(bare).source,'package.json#scripts.lint:check');
  assert.deepEqual(declaredPushGateLint(bare).commands[0].patterns,['.']);

  const {repo:none}=checkout(t,{hook:'npx lint-staged\n',lintCheck:'tsc --noEmit'});
  assert.equal(declaredPushGateLint(none),null,'a hook with no eslint declares no push-gate lint');

  assert.equal(patternReaches('{src,apps}/**/*.ts','apps/core/src/main.ts'),true);
  assert.equal(patternReaches('{src,apps}/**/*.ts','test/a.ts'),false);
  assert.equal(patternReaches('src','src/deep/a.ts'),true);
  assert.equal(patternReaches('.','anything.js'),true);
});

test('changed files are the report files plus commits since admission, inside the owned paths only',t=>{
  const {repo,commit}=checkout(t);
  const before=Date.now()-60_000;
  commit('src/b.ts','export const b = 1;\n');
  commit('docs/readme.md','outside the owned paths\n');
  const files=changedFilesOf({root:repo,specs:['src'],reportFiles:['src/a.ts','src/gone.ts',path.join(repo,'docs','readme.md')],sinceMs:before,timeoutMs:15000});
  assert.deepEqual(files,['src/a.ts','src/b.ts'],'reported + committed, existing, under src only');
  assert.deepEqual(changedFilesOf({root:repo,specs:['src'],reportFiles:[],sinceMs:null,timeoutMs:15000}),[],'no admission time and no report files: nothing');
});

test('pushGateProof: red on an error in a changed file, green otherwise; an untouched red file is not the job\'s',t=>{
  const {repo,commit,calls}=checkout(t);
  const since=Date.now()-60_000;
  commit('src/clean.ts','export const c = 1;\n');
  const green=pushGateProof({root:repo,specs:['src'],reportFiles:[],sinceMs:since,timeoutMs:60000});
  assert.equal(green.checked,true);
  assert.equal(green.ok,true,JSON.stringify(green));
  assert.deepEqual(green.detail.linted,['src/clean.ts'],'src/untouched.ts is red but the job never changed it');
  assert.ok(calls().every(argv=>!argv.includes('--max-warnings')&&argv.includes('--no-warn-ignored')&&argv.includes('json')),'check-only JSON run, the cap applied by the gate itself');

  commit('src/bad.ts','export const d = 1; // LINT_ERROR\n');
  const red=pushGateProof({root:repo,specs:['src'],reportFiles:[],sinceMs:since,timeoutMs:60000});
  assert.equal(red.ok,false);
  assert.equal(red.reason,'push-gate-red');
  assert.equal(red.detail.errorCount,1);
  assert.deepEqual(red.detail.findings,[{file:'src/bad.ts',line:1,rule:'house/no-error',severity:'error',message:'error here'}]);

  const {repo:warned,commit:commitWarn}=checkout(t);
  commitWarn('src/w.ts','// LINT_WARN\n');
  const capped=pushGateProof({root:warned,specs:['src'],reportFiles:[],sinceMs:since,timeoutMs:60000});
  assert.equal(capped.reason,'push-gate-red','--max-warnings=0 makes one warning red');
  assert.equal(capped.detail.maxWarnings,0);
  const {repo:uncapped,commit:commitUncapped}=checkout(t,{lintCheck:'eslint "src/**/*.ts"'});
  commitUncapped('src/w.ts','// LINT_WARN\n');
  assert.equal(pushGateProof({root:uncapped,specs:['src'],reportFiles:[],sinceMs:since,timeoutMs:60000}).ok,true,'an uncapped warning passes, as it does ESLint');
});

test('pushGateProof: no declared gate or no reached file is unchecked; a missing or crashing eslint is landed-unverifiable',t=>{
  const since=Date.now()-60_000;
  const {repo:none,commit:c1}=checkout(t,{hook:null,lintCheck:'tsc --noEmit'});
  c1('src/x.ts','// LINT_ERROR\n');
  assert.equal(pushGateProof({root:none,specs:['src'],reportFiles:[],sinceMs:since,timeoutMs:60000}).why,'no-declared-push-gate-lint');

  const {repo:md,commit:c2}=checkout(t);
  c2('src/notes.md','LINT_ERROR in prose\n');
  assert.equal(pushGateProof({root:md,specs:['src'],reportFiles:[],sinceMs:since,timeoutMs:60000}).why,'no-changed-file-in-gate');

  const {repo:missing,commit:c3}=checkout(t,{eslint:false});
  c3('src/y.ts','export const y = 1;\n');
  const unverifiable=pushGateProof({root:missing,specs:['src'],reportFiles:[],sinceMs:since,timeoutMs:60000});
  assert.equal(unverifiable.reason,'landed-unverifiable');
  assert.equal(unverifiable.detail.step,'push-gate');

  const {repo:crash,commit:c4}=checkout(t);
  c4('src/CRASH.ts','export const z = 1;\n');
  const crashed=pushGateProof({root:crash,specs:['src'],reportFiles:[],sinceMs:since,timeoutMs:60000});
  assert.equal(crashed.reason,'landed-unverifiable');
  assert.match(crashed.detail.error,/Something went wrong/);
});

test('api settle: a landed pass whose changed file breaks the repo push gate is refused push-gate-red and writes nothing',t=>{
  const {dir,repo,commit}=checkout(t);
  const admittedAt=Date.now()-60_000,env=registryAt(dir,admittedAt-60_000);
  const head=commit('src/a.ts','export const a = 2; // LINT_ERROR\n');
  const jobId=seedJob(repo,{head,admittedAt});
  const {r,body}=settlePass(repo,jobId,env);
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.equal(body.ok,false);
  assert.equal(body.reason,'push-gate-red');
  assert.equal(body.detail.head,head,'the landed proof itself passed');
  assert.equal(body.detail.pushGate.source,'.husky/pre-push');
  assert.deepEqual(body.detail.pushGate.linted,['src/a.ts']);
  assert.equal(body.detail.pushGate.findings[0].file,'src/a.ts');
  assert.match(body.hint,/fix the findings in detail\.pushGate/);
  assert.equal(statusOf(repo,jobId),'running','a refused settle writes nothing');

  commit('src/a.ts','export const a = 3;\n');
  const fixed=settlePass(repo,jobId,env);
  assert.equal(fixed.r.status,0,fixed.r.stderr||fixed.r.stdout);
  assert.equal(fixed.body.landed.pushGate.repos[0].errorCount,0);
  assert.equal(statusOf(repo,jobId),'succeeded');
});

test('api settle: a repository that declares no push-gate lint settles as before, recording the skip',t=>{
  const {dir,repo,commit}=checkout(t,{hook:null,lintCheck:'tsc --noEmit'});
  const head=commit('src/a.ts','export const a = 2; // LINT_ERROR\n');
  const jobId=seedJob(repo,{head,files:['src/a.ts'],admittedAt:Date.now()-60_000});
  const {r,body}=settlePass(repo,jobId,registryAt(dir,Date.now()-3_600_000));
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.landed.pushGate.repos[0].skipped,'no-declared-push-gate-lint');
});

test('api settle: a leg admitted before settle-push-gate-lint settles on the contract it was admitted under',t=>{
  const {dir,repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2; // LINT_ERROR\n');
  const jobId=seedJob(repo,{head,admittedAt:Date.now()-60_000});
  const {r,body}=settlePass(repo,jobId,registryAt(dir,Date.now()+3_600_000));
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.landed.pushGate.skipped,'admitted-before-change');
  assert.equal(statusOf(repo,jobId),'succeeded');
});
