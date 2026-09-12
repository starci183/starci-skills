import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  changedProtected,gitQueue,gitQueueIdle,parseSharedChangePaths,preflight,protectedPaths,
  resourceLocks,resourcesClash,revertProtected
} from '../execution/kernel-guards.mjs';

const NODE={id:'demo.billing.implementation.backend',kind:'implementation',path:'features/billing/implementation/index.yaml'};
const INDEX=`schema: work/node@2
id: demo.billing.implementation.backend
kind: implementation
state: todo
`;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** An isolated repository: global and system git config are neutralised so a fact is this repo's own. */
function repository(t,name){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`starci-guards-${name}-`));
  t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-guards-'));fs.rmSync(dir,{recursive:true,force:true});});
  const empty=path.join(dir,'empty.gitconfig');
  fs.writeFileSync(empty,'');
  const git=(executable,args,options={})=>spawnSync(executable,args,{...options,env:{...process.env,GIT_CONFIG_GLOBAL:empty,GIT_CONFIG_SYSTEM:empty,GIT_CONFIG_NOSYSTEM:'1',
    GIT_AUTHOR_NAME:'StarCi kernel',GIT_AUTHOR_EMAIL:'kernel@starci.test',GIT_COMMITTER_NAME:'StarCi kernel',GIT_COMMITTER_EMAIL:'kernel@starci.test'}});
  const repo=path.join(dir,'repo');
  fs.mkdirSync(repo);
  assert.equal(git('git',['init','--quiet',repo],{encoding:'utf8'}).status,0);
  const run=(...args)=>{const out=git('git',args,{cwd:repo,encoding:'utf8'});assert.equal(out.status,0,`${args.join(' ')}: ${out.stderr}`);return (out.stdout??'').trim();};
  const write=(relative,body)=>{const file=path.join(repo,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);return file;};
  return {dir,repo,git,run,write};
}

test('the kernel owns a node index.yaml and its evidence folder, and nothing else in the worktree', t => {
  const {repo,git,run,write}=repository(t,'protected');
  write('.starciwork/features/billing/implementation/index.yaml',INDEX);
  write('src/app.ts','export const app=1;\n');
  run('add','-A');
  run('commit','-q','-m','init');

  const paths=protectedPaths(NODE,repo);
  assert.deepEqual(paths,['.starciwork/features/billing/implementation/index.yaml','.starciwork/features/billing/implementation/evidence/**']);
  assert.deepEqual(changedProtected(git,{cwd:repo,paths}),[],'a clean worktree changed nothing protected');

  // The operation agent writes its own completion, drops an evidence manifest, and does its real work.
  write('.starciwork/features/billing/implementation/index.yaml',`${INDEX}completion:\n  claimedBy: the operation agent\n`);
  write('.starciwork/features/billing/implementation/evidence/op-1/manifest.yaml','schema: work/evidence@1\noutcome: pass\n');
  write('src/app.ts','export const app=2;\n');

  assert.deepEqual(changedProtected(git,{cwd:repo,paths}),[
    '.starciwork/features/billing/implementation/evidence/op-1/manifest.yaml',
    '.starciwork/features/billing/implementation/index.yaml'
  ]);

  const {reverted,removed}=revertProtected(git,{cwd:repo,paths});
  assert.deepEqual(reverted,['.starciwork/features/billing/implementation/index.yaml']);
  assert.deepEqual(removed,['.starciwork/features/billing/implementation/evidence/op-1/manifest.yaml']);
  assert.equal(fs.readFileSync(path.join(repo,'.starciwork/features/billing/implementation/index.yaml'),'utf8'),INDEX);
  assert.equal(fs.existsSync(path.join(repo,'.starciwork/features/billing/implementation/evidence/op-1/manifest.yaml')),false);
  assert.equal(fs.readFileSync(path.join(repo,'src/app.ts'),'utf8'),'export const app=2;\n','the operation keeps its own change');
  assert.deepEqual(changedProtected(git,{cwd:repo,paths}),[]);
  const porcelain=git('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'});
  assert.match(porcelain.stdout,/src\/app\.ts/);
  assert.doesNotMatch(porcelain.stdout,/\.starciwork/);
});

test('a deleted index.yaml is restored and an untracked evidence tree is removed whole', t => {
  const {repo,git,run,write}=repository(t,'restore');
  write('.starciwork/features/billing/implementation/index.yaml',INDEX);
  run('add','-A');
  run('commit','-q','-m','init');
  const paths=protectedPaths(NODE,repo);
  fs.rmSync(path.join(repo,'.starciwork/features/billing/implementation/index.yaml'));
  write('.starciwork/features/billing/implementation/evidence/op-2/steps/one.json','{}');
  const {reverted,removed}=revertProtected(git,{cwd:repo,paths});
  assert.deepEqual(reverted,['.starciwork/features/billing/implementation/index.yaml']);
  assert.deepEqual(removed,['.starciwork/features/billing/implementation/evidence/op-2/steps/one.json']);
  assert.equal(fs.readFileSync(path.join(repo,'.starciwork/features/billing/implementation/index.yaml'),'utf8'),INDEX);
});

test('an operation declares some locks and its own checks prove the rest', () => {
  assert.deepEqual(resourceLocks({kind:'backend.implement',checks:[{name:'integration',command:'npm run test:container -- billing'}]}),[],'testcontainers isolate their own database');
  assert.deepEqual(resourceLocks({kind:'backend.implement',checks:[{name:'integration',command:'npx testcontainers up'}]}),[]);
  assert.deepEqual(resourceLocks({kind:'backend.implement',checks:[{name:'stack',command:'psql -h localhost:5432'}]}),['local-stack']);
  assert.deepEqual(resourceLocks({kind:'uat.verify',resources:['fe-slot'],checks:[{name:'walk',command:'npx playwright test uat/sign-in.spec.ts'}]}),['e2e-runtime','fe-slot']);
  assert.deepEqual(resourceLocks({kind:'uat.execute',checks:[{name:'flow',command:'npm run test:e2e'}]}),['e2e-runtime']);
  assert.deepEqual(resourceLocks({kind:'operations.apply',checks:[{name:'deploy',command:'kubectl apply -f k8s/billing.yaml'}]}),['cluster']);
  assert.deepEqual(resourceLocks({kind:'operations.apply',checks:[{name:'chart',command:'KUBECONFIG=./kube.yaml helm upgrade billing .'}]}),['cluster']);
  assert.deepEqual(resourceLocks({kind:'uat.verify'}),['e2e-runtime'],'the kind alone can prove a lock');
  assert.deepEqual(resourceLocks({kind:'backend.implement',checks:[{name:'unit',command:'npx vitest run src/billing.spec.ts'}]}),[]);
  assert.deepEqual(resourceLocks({}),[]);
  assert.deepEqual(resourceLocks({kind:'backend.implement',resources:'docker'}),[],'a malformed resources field declares nothing');

  const container={kind:'backend.implement',checks:[{name:'integration',command:'npm run test:container'}]};
  const docker={kind:'backend.implement',checks:[{name:'compose',command:'docker compose up -d'}]};
  const cluster={kind:'operations.apply',checks:[{name:'deploy',command:'kubectl rollout status deploy/billing'}]};
  const unit={kind:'backend.implement',checks:[{name:'unit',command:'npx vitest run src/x.spec.ts'}]};
  assert.equal(resourcesClash(container,docker),false,'a testcontainers suite does not need the shared local stack');
  const stack={kind:'backend.implement',checks:[{name:'e2e-db',command:'psql -h localhost:5432 -c select'}]};
  assert.equal(resourcesClash(stack,docker),true,'docker compose and the fixed-port stack are the same exclusive resource');
  assert.equal(resourcesClash(container,cluster),false);
  assert.equal(resourcesClash(container,unit),false);
  assert.equal(resourcesClash(unit,unit),false,'two operations that need nothing exclusive never clash');
  assert.equal(resourcesClash(['local-stack'],docker),true);
  assert.equal(resourcesClash(['e2e-runtime'],container),false);
});

test('the git queue serialises asynchronous callers in call order and lets synchronous work through', async () => {
  assert.equal(gitQueueIdle(),true);
  assert.equal(gitQueue(()=>'status'),'status','a synchronous call on an idle queue is not wrapped');
  const order=[];
  const first=gitQueue(async()=>{order.push('first-start');await delay(25);order.push('first-end');return 'first';});
  const second=gitQueue(async()=>{order.push('second-start');await delay(1);order.push('second-end');return 'second';});
  const third=gitQueue(()=>{order.push('third');return 'third';});
  assert.deepEqual(order,['first-start'],'only the first caller has started');
  assert.deepEqual(await Promise.all([first,second,third]),['first','second','third']);
  assert.deepEqual(order,['first-start','first-end','second-start','second-end','third']);
  assert.equal(gitQueueIdle(),true);
  const failing=gitQueue(async()=>{throw Error('git add failed');});
  const after=gitQueue(async()=>'still runs');
  await assert.rejects(()=>failing,/git add failed/);
  assert.equal(await after,'still runs','a rejected call does not wedge the queue');
  assert.throws(()=>gitQueue('git status'),/needs a function/);
});

test('preflight repairs core.longpaths, reports the facts and refuses main', t => {
  const {repo,git,run,write}=repository(t,'preflight');
  write('README.md','# fixture\n');
  run('add','-A');
  run('commit','-q','-m','init');
  run('branch','-M','main');

  const first=preflight({worktree:repo,git});
  assert.equal(first.facts.longpaths,'true');
  assert.equal(first.fixes.length,1);
  assert.match(first.fixes[0],/core\.longpaths/);
  assert.equal(git('git',['config','--get','core.longpaths'],{cwd:repo,encoding:'utf8'}).stdout.trim(),'true');
  assert.equal(first.facts.secretsGuard,false);
  assert.equal(first.facts.hooksPath,null);
  assert.equal(first.facts.autocrlf,null);
  assert.equal(first.ok,false);
  assert.ok(first.problems.some(problem=>/the workflow worktree is on main/.test(problem)),first.problems.join('; '));

  run('checkout','-q','-b','workflow/billing');
  run('config','core.hooksPath','.husky');
  write('.husky/pre-commit','#!/usr/bin/env sh\nnpm run secrets-guard\n');
  const second=preflight({worktree:repo,git});
  assert.deepEqual(second.fixes,[],'an already configured worktree needs no fix');
  assert.deepEqual(second.problems,[]);
  assert.equal(second.ok,true);
  assert.equal(second.facts.hooksPath,'.husky');
  assert.equal(second.facts.secretsGuard,true);
});

test('preflight reports a directory that is not a repository instead of throwing', t => {
  const {dir,git}=repository(t,'nonrepo');
  const outside=path.join(dir,'plain');
  fs.mkdirSync(outside);
  const result=preflight({worktree:outside,git});
  assert.equal(result.ok,false);
  assert.ok(result.problems.some(problem=>/git status does not run/.test(problem)),result.problems.join('; '));
  assert.equal(result.facts.secretsGuard,false);
});

test('shared-change paths are read out of prose, and a link is not a write scope', () => {
  assert.deepEqual(parseSharedChangePaths('Required typecheck and scoped lint failures are confined to the exact out-of-allowlist paths: apps/agentos-controlplane/src/instance-db/instance-data-source.ts and src/modules/shared/x.ts'),
    ['apps/agentos-controlplane/src/instance-db/instance-data-source.ts','src/modules/shared/x.ts']);
  assert.deepEqual(parseSharedChangePaths('The enrollment re-key needs one shared edit in .starciwork/features/billing/architecture/index.yaml before this slice compiles; the design note is at https://docs.example.com/starci/enrollment/rekey.html and needs no change.'),
    ['.starciwork/features/billing/architecture/index.yaml']);
  assert.deepEqual(parseSharedChangePaths('Two owners: packages/ui/** is the Grammar surface, libs/core/src/index.ts re-exports it, and nothing else (see and/or the note) is touched. Repeat: libs/core/src/index.ts.'),
    ['packages/ui/**','libs/core/src/index.ts']);
  assert.deepEqual(parseSharedChangePaths('No path is named in this detail at all.'),[]);
  assert.deepEqual(parseSharedChangePaths(null),[]);
  assert.deepEqual(parseSharedChangePaths('A Windows report wrote apps\\sales\\src\\billing.ts once.'),['apps/sales/src/billing.ts']);
});
