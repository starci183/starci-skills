import test from 'node:test';
import assert from 'node:assert/strict';
import {restartAll,waitForKernels,touchSupervisors,summaryVi} from '../scripts/kernel/restart-all.mjs';

// scripts/kernel/restart-all.mjs backs the `restart` skill the owner or the
// supervisor runs after a reboot or an Orca restart: Orca must be up (never
// launched from here), resume-all with the stray-terminal dedupe, wait for one
// live kernel per running workflow, reconcile orphan kernel jobs and the Orca
// Tasks of dead ops, count dead op workers, touch the supervisor channel, and
// say it in Vietnamese. Every host seam is injected.

const REPO='D:/Repositories/nivo-backend';
const resumed={ok:true,started:[{workflowId:'wf-a'}],present:[{workflowId:'wf-b'}],duplicate:[],
  dedupe:{ok:true,closed:[{handle:'term-old',tabTitle:'[Kernel] wf-a',ok:true}],kept:[],deferred:[]}};
const deps=(calls,{orca=true,ready=true,dead=['op-x']}={})=>({
  probe:()=>orca,
  resume:opts=>{calls.push(['resume',opts.dedupe,opts.dryRun]);return resumed;},
  wait:(repos,{waitMs})=>{calls.push(['wait',waitMs]);return {ready,kernels:[{workflowId:'wf-nivo-app-auth-mudqjob3',live:ready,state:ready?'turn-idle':'dead'},{workflowId:'wf-b',live:true,state:'active'}]};},
  api:args=>{calls.push(['api',...args]);
    if(args.includes('--orphan-kernel-jobs'))return {ok:true,out:{ok:true,reconciled:[{jobId:'kernel-wf-old'}]}};
    if(args.includes('--orca-tasks'))return {ok:true,out:{ok:true,totals:{closed:15,unclosable:0,rebound:2,ledgerClosed:3,errors:0}}};
    return {ok:true,out:{ok:true,frontier:{deadWorkerJobs:args.includes('wf-a')?dead:[]}}};},
  workflowsOf:()=>[{workflowId:'wf-a'},{workflowId:'wf-b'}],
  touch:s=>{calls.push(['touch',s.id]);return [{id:'sup-1',action:'heartbeat',ok:true}];},
});

test('Orca not answering: nothing runs and the owner is told to open it (never launched from here)',()=>{
  const calls=[];
  const r=restartAll({repos:[REPO],deps:deps(calls,{orca:false})});
  assert.equal(r.ok,false);
  assert.equal(r.orca,'not-running');
  assert.deepEqual(calls,[]);
  assert.match(summaryVi(r),/Orca chưa chạy\. Thầy mở Orca/);
});

test('a restart resumes with the dedupe, waits for the kernels, reconciles through the api, counts dead workers and touches the channel',()=>{
  const calls=[];
  const r=restartAll({repos:[REPO],waitMs:1234,supervisor:{id:'sup-1'},deps:deps(calls)});
  assert.equal(r.ok,true);
  assert.deepEqual(calls.slice(0,2),[['resume',true,false],['wait',1234]]);
  assert.deepEqual(calls.filter(c=>c[0]==='api').map(c=>c.slice(1,4)),[
    ['reconcile','--repo',REPO],['reconcile','--repo',REPO],['status','--repo',REPO],['status','--repo',REPO]]);
  assert.ok(calls.some(c=>c.includes('--orphan-kernel-jobs'))&&calls.some(c=>c.includes('--orca-tasks')));
  assert.deepEqual(calls.at(-1),['touch','sup-1']);
  assert.deepEqual(r.deadWorkers.map(w=>[w.workflowId,w.count]),[['wf-a',1],['wf-b',0]]);
  const text=summaryVi(r);
  assert.match(text,/Dọn terminal thừa: đã đóng 1 \(\[Kernel\] wf-a\)/);
  assert.match(text,/Kernel: 2\/2 workflow có đúng một kernel sống/);
  assert.match(text,/Job kernel mồ côi .*kernel-wf-old/);
  assert.match(text,/đã đóng 15, gắn lại 2 Run vào kernel mới/);
  assert.match(text,/Worker op đã chết \(kernel tự xử lý\): a 1/);
  assert.match(text,/Kênh supervisor: sup-1 heartbeat/);
});

test('a kernel that never came back fails the pass and is named in the summary',()=>{
  const r=restartAll({repos:[REPO],deps:deps([],{ready:false})});
  assert.equal(r.ok,false);
  assert.match(summaryVi(r),/chưa ổn: nivo-app-auth \(dead\)/);
});

test('--dry-run passes --dry-run to every api verb, does not wait and touches no channel',()=>{
  const calls=[];
  restartAll({repos:[REPO],dryRun:true,deps:deps(calls)});
  assert.deepEqual(calls[0],['resume',true,true]);
  assert.deepEqual(calls[1],['wait',0]);
  for(const c of calls.filter(c=>c[0]==='api'&&c[1]==='reconcile'))assert.ok(c.includes('--dry-run'));
  assert.ok(!calls.some(c=>c[0]==='touch'));
});

test('waitForKernels polls the census until each running workflow has one live kernel, bounded by waitMs',()=>{
  let clock=0,round=0;
  const census=()=>{round+=1;return round<3?[{workflowId:'wf-a',live:false},{workflowId:'wf-b',live:true,duplicate:['t1','t2']}]:[{workflowId:'wf-a',live:true},{workflowId:'wf-b',live:true}];};
  const ok=waitForKernels(['r'],{waitMs:60000,pollMs:20000,census,sleep:ms=>{clock+=ms;},now:()=>clock});
  assert.deepEqual({ready:ok.ready,rounds:ok.rounds,waitedMs:ok.waitedMs},{ready:true,rounds:3,waitedMs:40000});
  clock=0;
  const never=waitForKernels(['r'],{waitMs:50000,pollMs:20000,census:()=>[{workflowId:'wf-a',live:false}],sleep:ms=>{clock+=ms;},now:()=>clock});
  assert.equal(never.ready,false);
  assert.equal(clock,50000,'never waits past the bound');
});

test('the supervisor channel: heartbeat a registered id, register with a label, else name the command; no id only lists the registered supervisors',()=>{
  const beats=[];
  const d={get:id=>id==='sup-1'?{id}:null,heartbeat:id=>{beats.push(id);return {id};},register:()=>({}),list:()=>[{id:'sup-1',online:true},{id:'sup-2',online:false}]};
  assert.deepEqual(touchSupervisors({id:'sup-1'},d),[{id:'sup-1',action:'heartbeat',ok:true}]);
  assert.deepEqual(touchSupervisors({id:'sup-9',label:'Supervisor'},d),[{id:'sup-9',action:'registered',ok:true}]);
  assert.equal(touchSupervisors({id:'sup-9'},d)[0].action,'not-registered');
  beats.length=0;
  assert.deepEqual(touchSupervisors({},d).map(s=>[s.id,s.action,s.online]),[['sup-1','listed',true],['sup-2','listed',false]]);
  assert.deepEqual(beats,[],'no id: nobody is marked online');
});
