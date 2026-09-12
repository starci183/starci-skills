import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PROOF_POLICY,isSpecPath,policyFor,proofFinding,proofPlan,runAtBase} from '../execution/verify-proof.mjs';

const tmp=()=>{
  const dir=path.join(os.tmpdir(),'starci-verify-proof-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dir,{recursive:true});
  return dir;
};
const git=(cwd,...args)=>{
  const result=spawnSync('git',args,{cwd,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,`git ${args.join(' ')}: ${result.stderr}`);
  return (result.stdout??'').trim();
};
const write=(dir,file,body)=>{fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),body);};

const PASSING_SPEC=`import test from 'node:test';
import assert from 'node:assert/strict';
import {double} from './lib.mjs';
test('double doubles',()=>{assert.equal(double(2),4);});
`;
const TRIVIAL_SPEC=`import test from 'node:test';
import assert from 'node:assert/strict';
import {double} from './lib.mjs';
test('double is a function',()=>{assert.equal(typeof double,'function');});
`;
const FAILING_SPEC=`import test from 'node:test';
import assert from 'node:assert/strict';
import {double} from './lib.mjs';
test('double triples',()=>{assert.equal(double(2),6);});
`;

/**
 * A tiny Node project in a real git repo: the base commit returns the wrong value and has no spec, the
 * working tree carries the fix plus the spec under test. The op worktree stays dirty on purpose - that is
 * exactly the state the kernel runs the proof in.
 */
function repo({spec,fixed=true}){
  const dir=tmp();
  git(dir,'init','--quiet','-b','main');
  git(dir,'config','user.email','proof@starci.local');
  git(dir,'config','user.name','StarCi Proof');
  git(dir,'config','commit.gpgsign','false');
  write(dir,'lib.mjs','export const double=value=>value+1;\n');
  git(dir,'add','-A');
  git(dir,'commit','--quiet','-m','base: lib returns the wrong value');
  const baseHead=git(dir,'rev-parse','HEAD');
  write(dir,'lib.mjs',fixed?'export const double=value=>value*2;\n':'export const double=value=>value+1;\n');
  write(dir,'lib.spec.mjs',spec);
  git(dir,'add','-A');
  git(dir,'commit','--quiet','-m','op: double doubles');
  return {dir,baseHead,opHead:git(dir,'rev-parse','HEAD')};
}

const commands=[{name:'unit',command:'node --test lib.spec.mjs'}];
/**
 * `node --test` marks its children with NODE_TEST_CONTEXT, and a nested runner then reports its failures to
 * this parent instead of exiting non-zero. The proof commands are real, they just run with that marker cleared.
 */
const clean=(()=>{const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_OPTIONS;
  return (command,options)=>spawnSync(command,{...options,env});})();
const proof=project=>runAtBase({worktree:project.dir,baseHead:project.baseHead,opHead:project.opHead,
  specs:['lib.spec.mjs'],commands,exec:clean,timeoutMs:120000});

test('a spec path is recognized across the suites the runtime drives',()=>{
  for(const file of ['lib.spec.mjs','src/app.test.ts','a/b.e2e-spec.ts','x.container-spec.js','c.spec.tsx','d.spec.cjs'])
    assert.equal(isSpecPath(file),true,file);
  for(const file of ['lib.mjs','docs/spec.md','src/specify.ts','spec.ts'])assert.equal(isSpecPath(file),false,file);
});

test('the plan keeps the changed specs and the checks that run them',()=>{
  const op={kind:'backend.implement',checks:[
    {name:'unit',command:'npm run test:unit -- src/users/users.service.spec.ts'},
    {name:'scoped',command:'npm run test:unit',scope:'src/orders/**'},
    {name:'lint',command:'npm run lint'}]};
  const plan=proofPlan(op,{changedFiles:['src/users/users.service.ts','src/users/users.service.spec.ts','src/orders/orders.spec.ts','README.md']});
  assert.equal(plan.mode,'fail-before');
  assert.equal(plan.policy,'fail-before');
  assert.deepEqual(plan.specs,['src/users/users.service.spec.ts','src/orders/orders.spec.ts']);
  assert.deepEqual(plan.commands.map(check=>check.name),['unit','scoped']);
});

test('no changed spec, a checks-only kind and an unreferenced spec all fall back to checks-only',()=>{
  const checks=[{name:'unit',command:'npm run test:unit -- src/users/users.service.spec.ts'}];
  const bare=proofPlan({kind:'backend.implement',checks},{changedFiles:['src/users/users.service.ts']});
  assert.equal(bare.mode,'checks-only');
  assert.deepEqual(bare.specs,[]);
  assert.match(bare.reason,/no spec file/);
  const operate=proofPlan({kind:'runtime.operate',checks},{changedFiles:['src/users/users.service.spec.ts']});
  assert.equal(operate.mode,'checks-only');
  assert.equal(operate.policy,'checks-only');
  const unreferenced=proofPlan({kind:'interface.implement',checks:[{name:'lint',command:'npm run lint'}]},
    {changedFiles:['src/app/page.spec.tsx']});
  assert.equal(unreferenced.mode,'checks-only');
  assert.match(unreferenced.reason,/no declared check runs/);
  assert.equal(policyFor('interface.implement'),'fail-before');
  assert.equal(PROOF_POLICY.default,'checks-only');
});

test('a spec that fails at base and passes at head is proven',()=>{
  const project=repo({spec:PASSING_SPEC});
  const result=proof(project);
  assert.equal(result.mode,'fail-before');
  assert.equal(result.verdict,'proven');
  assert.equal(result.base.head,project.baseHead);
  assert.equal(result.base.results[0].exitCode!==0,true);
  assert.equal(result.head.results[0].exitCode,0);
  assert.deepEqual(result.copied,['lib.spec.mjs']);
  assert.equal(proofFinding(result),null);
  assert.equal(fs.existsSync(path.join(project.dir,'lib.mjs')),true);
  assert.equal(git(project.dir,'status','--porcelain'),'','the op worktree is untouched');
  assert.equal(git(project.dir,'rev-parse','HEAD'),project.opHead);
  assert.equal(git(project.dir,'worktree','list').split('\n').length,1,'the temporary worktree is gone');
});

test('a trivial spec that passes at base too is weak, and the finding says so',()=>{
  const project=repo({spec:TRIVIAL_SPEC});
  const result=proof(project);
  assert.equal(result.verdict,'weak');
  assert.equal(result.base.results[0].exitCode,0);
  assert.equal(result.head.results[0].exitCode,0);
  const finding=proofFinding(result);
  assert.match(finding,/lib\.spec\.mjs/);
  assert.match(finding,/also passes at base/);
  assert.match(finding,/does not prove the change/);
});

test('a spec that fails at the op head is a contradiction',()=>{
  const project=repo({spec:FAILING_SPEC});
  const result=proof(project);
  assert.equal(result.verdict,'contradiction');
  assert.equal(result.head.results[0].exitCode!==0,true);
  const finding=proofFinding(result);
  assert.match(finding,/contradicts/);
  assert.match(finding,/unit/);
});

test('the base run sees the new spec against the old code, never the op worktree',()=>{
  const project=repo({spec:PASSING_SPEC});
  const seen=[];
  const exec=(command,options)=>{
    seen.push({command,cwd:options.cwd,spec:fs.existsSync(path.join(options.cwd,'lib.spec.mjs')),
      lib:fs.readFileSync(path.join(options.cwd,'lib.mjs'),'utf8').trim()});
    return {status:0,stdout:'',stderr:''};
  };
  const result=runAtBase({worktree:project.dir,baseHead:project.baseHead,opHead:project.opHead,
    specs:['lib.spec.mjs'],commands,exec,timeoutMs:5000});
  assert.equal(seen.length,2);
  assert.equal(seen[0].spec,true);
  assert.match(seen[0].lib,/value\+1/,'base code is the old implementation');
  assert.notEqual(seen[0].cwd,project.dir);
  assert.equal(seen[1].cwd,project.dir);
  assert.match(seen[1].lib,/value\*2/);
  assert.equal(result.verdict,'weak','a scripted all-green run cannot discriminate');
});

test('a base worktree that cannot be built is a weak verdict with an explicit finding',()=>{
  const project=repo({spec:PASSING_SPEC});
  const result=runAtBase({worktree:project.dir,baseHead:'0000000000000000000000000000000000000000',
    opHead:project.opHead,specs:['lib.spec.mjs'],commands,
    exec:()=>assert.fail('no command runs when the base worktree is missing')});
  assert.equal(result.verdict,'weak');
  assert.equal(typeof result.error,'string');
  assert.match(proofFinding(result),/could not be built/);
});

test('a command that times out at base does not count as proof',()=>{
  const project=repo({spec:PASSING_SPEC});
  const exec=(command,options)=>options.cwd===project.dir
    ?{status:0,stdout:'ok',stderr:''}
    :{status:null,signal:'SIGTERM',stdout:'',stderr:'',error:Object.assign(Error('timed out'),{code:'ETIMEDOUT'})};
  const result=runAtBase({worktree:project.dir,baseHead:project.baseHead,opHead:project.opHead,
    specs:['lib.spec.mjs'],commands,exec});
  assert.equal(result.base.results[0].timedOut,true);
  assert.equal(result.verdict,'weak');
  assert.match(result.reason,/timed out at base/);
  assert.match(proofFinding(result),/does not prove the change/);
});

test('an empty plan is checks-only and runs nothing',()=>{
  const result=runAtBase({worktree:tmp(),baseHead:'HEAD',specs:[],commands,exec:()=>assert.fail('nothing to run')});
  assert.equal(result.verdict,'checks-only');
  assert.equal(result.mode,'checks-only');
  assert.deepEqual(result.base.results,[]);
  assert.equal(proofFinding(result),null);
});

test('the module is listed as a runtime module',()=>{
  const listed=fs.readFileSync(new URL('../scripts/runtime-modules.txt',import.meta.url),'utf8');
  assert.match(listed,/^execution\/verify-proof\.mjs$/m);
});
