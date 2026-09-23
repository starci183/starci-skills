import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {orcaTreeFindings,readTerminals,FINDING_CODES} from '../scripts/checks/check-orca-tree.mjs';

// scripts/checks/check-orca-tree.mjs is the only thing that reads the ledger
// and Orca's terminal listing at once. modules/kernel/start-workflow.yaml
// orcaTree is the rule it enforces; a finding is always a sentence about one
// workflow, never a diff of two dumps.
const ROOT=path.resolve(import.meta.dirname,'..');
const CHECK=path.join(ROOT,'scripts','checks','check-orca-tree.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

const KERNEL='term-kernel-1';
const listing=terminals=>({ok:true,terminals});
const term=(handle,title,live=true)=>({handle,title,connected:live});
// Findings are always read through readTerminals, exactly as the CLI reads a
// receipt — the projection never sees a raw Orca row.
const seen=(...rows)=>readTerminals(rows);

// One healthy workflow: a live kernel terminal the signal and the kernel job
// agree on, and one running op with its own terminal in the workflow's Run.
const healthy=(ledger,{workflowId='wf-tree',runId='run-1'}={})=>seedWorkflow(ledger,{
  id:workflowId,
  state:{phase:'running'},
  signals:[{scope:'kernel',key:workflowId,token:'kernel-1',value:{terminal:KERNEL}}],
  jobs:[
    {jobId:`kernel-${workflowId}`,kind:'kernel',status:'running',worker_id:KERNEL,
      payload:{orca:{runId},hierarchy:{runtime:{runId,terminalHandle:KERNEL}}}},
    {jobId:'job-op-1',kind:'op',op_id:'code.refactor',status:'running',worker_id:'term-op-1',
      payload:{orca:{runId,taskId:'task-1',agentTerminalHandle:'term-op-1'}}},
  ],
});
const healthyTerminals=()=>[term(KERNEL,'[Kernel] wf-tree'),term('term-op-1','[Op] code.refactor a1 · wf-tree')];

test('the codes are the six the contract names, and a matching tree is clean',t=>{
  assert.deepEqual(FINDING_CODES,['DUPLICATE_KERNEL','ORPHAN_TERMINAL','STRAY_TERMINAL','DEAD_KERNEL','TITLE_DRIFT','TASK_OUTSIDE_RUN']);
  withLedger(t,({ledger})=>{
    healthy(ledger);
    assert.deepEqual(orcaTreeFindings(ledger.db,seen(...healthyTerminals())),[]);
  });
});

test('DUPLICATE_KERNEL: a second live [Kernel] terminal for one workflow',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    const findings=orcaTreeFindings(ledger.db,seen(...healthyTerminals(),term('term-kernel-old','[Kernel] wf-tree')));
    assert.deepEqual(findings.map(f=>f.code),['DUPLICATE_KERNEL']);
    assert.deepEqual(findings[0].terminals.sort(),[KERNEL,'term-kernel-old'].sort());
    assert.equal(findings[0].workflowId,'wf-tree');
  });
});

test('DUPLICATE_KERNEL: the kernel signal terminal is not the kernel job worker_id',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    ledger.db.prepare("UPDATE jobs SET worker_id='term-kernel-other' WHERE job_id='kernel-wf-tree'").run();
    const findings=orcaTreeFindings(ledger.db,seen(...healthyTerminals()));
    assert.ok(findings.some(f=>f.code==='DUPLICATE_KERNEL'&&/is not the kernel job/.test(f.detail)));
  });
});

test('ORPHAN_TERMINAL: a live terminal whose job already failed, and one no job owns',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    ledger.db.prepare("UPDATE jobs SET status='failed' WHERE job_id='job-op-1'").run();
    const findings=orcaTreeFindings(ledger.db,seen(...healthyTerminals(),term('term-stray','[Op] interface.audit a4 · wf-tree')));
    const orphans=findings.filter(f=>f.code==='ORPHAN_TERMINAL');
    assert.deepEqual(orphans.map(f=>f.terminal).sort(),['term-op-1','term-stray']);
    assert.match(orphans.find(f=>f.terminal==='term-op-1').detail,/job job-op-1 is failed/);
    assert.equal(orphans.find(f=>f.terminal==='term-op-1').jobId,'job-op-1');
  });
});

test("ORPHAN_TERMINAL never fires on a terminal that is not StarCi's",t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    const findings=orcaTreeFindings(ledger.db,seen(...healthyTerminals(),
      term('term-owner','pwsh — notes'),term('term-owner-2',null)));
    assert.deepEqual(findings,[],'the owner keeps their own terminals without being told about them');
  });
});

test('DEAD_KERNEL: the signal holds a handle the listing has lost',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    const findings=orcaTreeFindings(ledger.db,seen(term('term-op-1','[Op] code.refactor a1 · wf-tree')));
    assert.deepEqual(findings.map(f=>f.code),['DEAD_KERNEL']);
    assert.equal(findings[0].terminal,KERNEL);
    assert.match(findings[0].detail,/not in the terminal listing/);
  });
});

test('DEAD_KERNEL: a listed but disconnected kernel terminal counts as lost',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    const findings=orcaTreeFindings(ledger.db,seen(term(KERNEL,'[Kernel] wf-tree',false),term('term-op-1','[Op] code.refactor a1 · wf-tree')));
    assert.deepEqual(findings.map(f=>f.code),['DEAD_KERNEL']);
    assert.match(findings[0].detail,/listed but not live/);
  });
});

test('TASK_OUTSIDE_RUN: an open Task in a Run the workflow no longer uses',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    ledger.db.prepare("UPDATE jobs SET payload_json=? WHERE job_id='job-op-1'")
      .run(JSON.stringify({managed:{runId:'run-0',taskId:'task-orphan'}}));
    const findings=orcaTreeFindings(ledger.db,seen(term(KERNEL,'[Kernel] wf-tree')));
    const outside=findings.find(f=>f.code==='TASK_OUTSIDE_RUN');
    assert.ok(outside,`expected TASK_OUTSIDE_RUN, got ${findings.map(f=>f.code)}`);
    assert.deepEqual([outside.jobId,outside.runId,outside.expectedRunId,outside.taskId],
      ['job-op-1','run-0','run-1','task-orphan']);
  });
});

test('a Task the settle already closed is out of the tree, not a finding',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    ledger.db.prepare("UPDATE jobs SET status='succeeded',worker_id=NULL,payload_json=? WHERE job_id='job-op-1'")
      .run(JSON.stringify({managed:{runId:'run-0',taskId:'task-old'},taskClosed:{taskId:'task-old',status:'done',ok:true}}));
    assert.deepEqual(orcaTreeFindings(ledger.db,seen(term(KERNEL,'[Kernel] wf-tree'))),[]);
  });
});

test('a finished workflow owes Orca nothing',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id='wf-tree'").run();
    ledger.db.prepare("UPDATE jobs SET status='succeeded'").run();
    assert.deepEqual(orcaTreeFindings(ledger.db,seen()),[],'no DEAD_KERNEL for a workflow that is over');
  });
});

test('readTerminals accepts the wrapper receipt, the raw envelope and a bare array',()=>{
  const rows=[{handle:'t1',title:'[Kernel] wf'}];
  for(const source of [listing(rows),{result:{terminals:rows}},rows])
    assert.deepEqual(readTerminals(source),[{handle:'t1',title:'[Kernel] wf',live:true}]);
  assert.equal(readTerminals({ok:false,error:'boom'}),null);
  assert.deepEqual(readTerminals([{id:'t2',display_name:'x',status:'exited'}]),
    [{handle:'t2',title:'x',live:false}]);
});

test('the CLI exits 1 on findings, 0 clean, 2 on a bad invocation',t=>{
  withLedger(t,({repoRoot,ledger})=>{
    healthy(ledger);
    const file=path.join(repoRoot,'terminals.json');
    const run=(...args)=>spawnSync(process.execPath,[CHECK,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});

    fs.writeFileSync(file,JSON.stringify(listing(healthyTerminals())));
    const clean=run('--repo',repoRoot,'--terminals',file,'--json');
    assert.equal(clean.status,0,clean.stderr||clean.stdout);
    assert.deepEqual(json(clean.stdout)?.findings,[]);
    assert.equal(json(clean.stdout)?.schema,'starci/orca-tree-check@1');

    fs.writeFileSync(file,JSON.stringify(listing([...healthyTerminals(),term('term-kernel-old','[Kernel] wf-tree')])));
    const dirty=run('--repo',repoRoot,'--terminals',file,'--json');
    assert.equal(dirty.status,1,'a finding is a red check');
    assert.deepEqual(json(dirty.stdout)?.findings.map(f=>f.code),['DUPLICATE_KERNEL']);
    const text=run('--repo',repoRoot,'--terminals',file);
    assert.equal(text.status,1);
    assert.match(text.stdout,/^DUPLICATE_KERNEL wf-tree: /m);

    assert.equal(run('--terminals',file).status,2,'no --repo is a usage error');
    assert.equal(run('--repo',repoRoot).status,2,'neither --terminals nor --live is a usage error');
    assert.equal(run('--repo',repoRoot,'--terminals',file,'--live').status,2,'--terminals and --live conflict');
    assert.equal(run('--repo',repoRoot,'--terminals',path.join(repoRoot,'absent.json')).status,2);
  });
});

test('check-orca-tree is deliberately not part of npm run check — it needs a ledger',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  assert.doesNotMatch(pkg.scripts.check,/check-orca-tree/);
  const contract=fs.readFileSync(path.join(ROOT,'modules','kernel','start-workflow.yaml'),'utf8');
  assert.match(contract,/scripts\/checks\/check-orca-tree\.mjs/,'the rule cites the check that enforces it');
});

test('a [Kernel] terminal naming a workflow from another ledger is not an orphan here',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    const findings=orcaTreeFindings(ledger.db,seen(...healthyTerminals(),term('term-foreign','[Kernel] wf-elsewhere-bbbb2222')));
    assert.equal(findings.some(f=>f.terminal==='term-foreign'),false,'another project kernel sharing the Orca host is not this ledger orphan');
  });
});

// The owner's sidebar: agent CLIs overwrote every [Kernel]/[Op] title, and
// settled workers, old kernels and bare shells stayed live in the project.
test('TITLE_DRIFT names a live managed worker whose [Op] tab rename did not apply, never a pane title',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    const rows=seen(term(KERNEL,'devin.exe: Kernel orchestration for nivo'),term('term-op-1','Report task outcome | nivo-backend'));
    assert.deepEqual(orcaTreeFindings(ledger.db,rows).filter(x=>x.code==='TITLE_DRIFT'),[],'the pane title an agent CLI writes is not the sidebar tab title');
    ledger.db.prepare("UPDATE jobs SET payload_json=? WHERE job_id='job-op-1'").run(JSON.stringify({orca:{runId:'run-1',taskId:'task-1',agentTerminalHandle:'term-op-1'},managed:{assignee:'term-op-1',terminalTitle:{ok:false,title:'[Op] code.refactor a1 · wf-tree',error:'rename refused'}}}));
    const f=orcaTreeFindings(ledger.db,rows).filter(x=>x.code==='TITLE_DRIFT');
    assert.deepEqual(f.map(x=>[x.terminal,x.jobId]),[['term-op-1','job-op-1']]);
  });
});

test('STRAY_TERMINAL names a live terminal in the project worktree that is no live kernel or op',t=>{
  withLedger(t,({ledger})=>{
    healthy(ledger);
    const at=p=>x=>({...x,worktreePath:p});
    const rows=readTerminals([
      ...healthyTerminals().map(at('D:/Repositories/nivo-backend')),
      at(String.raw`D:\Repositories\nivo-backend`)(term('term-shell','nivo-backend')),
      at('D:/Repositories/nivo-backend')(term('term-old','worker-task_9572ffbea332')),
      at('D:/Repositories/mia-mia-backend')(term('term-other','x')),
    ]);
    const f=orcaTreeFindings(ledger.db,rows,{repo:'D:/Repositories/nivo-backend'});
    assert.deepEqual(f.filter(x=>x.code==='STRAY_TERMINAL').map(x=>x.terminal).sort(),['term-old','term-shell']);
    assert.equal(orcaTreeFindings(ledger.db,rows).filter(x=>x.code==='STRAY_TERMINAL').length,0,'without a repo the placement check is off');
    // A managed [Op] tab title names no workflow: in another project's worktree it is that project's worker.
    const other=readTerminals([...healthyTerminals().map(at('D:/Repositories/nivo-backend')),at('D:/Repositories/nivo-backend')(term('term-nivo-op','[Op] architecture.decide'))]);
    assert.equal(orcaTreeFindings(ledger.db,other,{repo:'D:/Repositories/starci-next'}).some(x=>x.terminal==='term-nivo-op'),false,'another project [Op] worker is not this ledger orphan');
    assert.equal(orcaTreeFindings(ledger.db,other,{repo:'D:/Repositories/nivo-backend'}).find(x=>x.terminal==='term-nivo-op')?.code,'ORPHAN_TERMINAL','in its own project it still is');
  });
});
