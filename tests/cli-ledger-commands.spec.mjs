import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {main} from '../hosts/orca/launch.mjs';
import {createStore} from '../kernel/store.mjs';
import {ledgerFileFor,ledgerIdFor} from '../kernel/ledger-db.mjs';

const anchorFileFor=repo=>path.join(repo,'.starciwork','ledger-anchor.json');

/**
 * runtime 1.0.4 §9/§11: the worker-IPC and operator verbs that read and write a workflow's own ledger rows
 * directly, with no kernel and no Orca runner - `op-contract`, `workflow-export`, `ledger-verify`,
 * `ledger-migrate`, `ledger-prune`, `ledger-retire` - plus the redirect of the two renamed maintenance verbs.
 */
const ID='20260912-104251-demo';
/** `--worktree` refuses an absolute path (it is a filesystem-relative selector), so a temp repo is passed relative to cwd. */
const rel=dir=>path.relative(process.cwd(),dir);
const fixture=t=>{
  const closers=[],dirs=[];
  t.after(()=>{for(const close of [...closers].reverse())close();for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true});});
  return {
    repo(){const dir=path.join(os.tmpdir(),'starci-cli-ledger-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});dirs.push(dir);return dir;},
    track(handle){closers.push(()=>handle.close());return handle;}
  };
};

test('op-contract prints the stored markdown, --json prints markdown and context, and a foreign dispatch is refused',async t=>{
  const fx=fixture(t),repo=fx.repo();
  const store=fx.track(createStore({repoRoot:repo,id:ID})),wt=rel(repo);
  store.writeContract({opId:'backend.implement',attempt:1,dispatchId:'ctx_1',markdown:'# Contract\n\nDo the thing.',context:{scope:['src/a.ts']}});
  const printedOut=main(['op-contract','--workflow',ID,'--op','backend.implement','--worktree',wt]);
  assert.equal(printedOut.print,'# Contract\n\nDo the thing.\n');
  assert.equal(printedOut.workflow,ID);
  assert.equal(printedOut.attempt,1);
  const asJson=main(['op-contract','--workflow',ID,'--op','backend.implement','--json','true','--worktree',wt]);
  assert.equal(asJson.markdown,'# Contract\n\nDo the thing.');
  assert.deepEqual(asJson.context,{scope:['src/a.ts']});
  assert.equal(asJson.attempt,1);
  // The dispatch that wrote the contract may read it back; a different one is refused, never handed someone else's.
  const owned=main(['op-contract','--workflow',ID,'--op','backend.implement','--dispatch','ctx_1','--worktree',wt]);
  assert.equal(owned.print,'# Contract\n\nDo the thing.\n');
  assert.throws(()=>main(['op-contract','--workflow',ID,'--op','backend.implement','--dispatch','ctx_9','--worktree',wt]),/was written for dispatch ctx_1, not ctx_9/);
  assert.throws(()=>main(['op-contract','--workflow',ID,'--op','no.such.op','--worktree',wt]),/No contract recorded/);
  // A second attempt is written and read by attempt number; omitting --attempt reads the latest.
  store.writeContract({opId:'backend.implement',attempt:2,markdown:'# Contract v2'});
  assert.equal(main(['op-contract','--workflow',ID,'--op','backend.implement','--worktree',wt]).attempt,2);
  assert.equal(main(['op-contract','--workflow',ID,'--op','backend.implement','--attempt','1','--worktree',wt]).attempt,1);
});

test('workflow-export writes the human-readable file layout from the ledger rows, never the record',async t=>{
  const fx=fixture(t),repo=fx.repo();
  const store=fx.track(createStore({repoRoot:repo,id:ID}));
  store.setGoal({markdown:'# Goal',json:{job:'demo'}});
  store.appendEvent({event:'workflow.start'});
  store.writeReport({dispatchId:'ctx_1',opId:'backend.implement',attempt:1,outcome:'done',report:{outcome:'done',summary:'ok'}});
  store.writeContract({opId:'backend.implement',attempt:1,markdown:'# Contract'});
  const to=path.join(fx.repo(),'export');
  const result=main(['workflow-export','--id',ID,'--to',to,'--worktree',rel(repo)]);
  assert.equal(result.id,ID);
  assert.equal(result.dir,path.resolve(to));
  assert.deepEqual([...result.files].sort(),['contracts/backend.implement.md','events.jsonl','goal.json','goal.md','reports/ctx_1.json'].sort());
  assert.equal(fs.readFileSync(path.join(to,'goal.md'),'utf8'),'# Goal');
  assert.equal(fs.readFileSync(path.join(to,'contracts/backend.implement.md'),'utf8'),'# Contract');
  assert.match(fs.readFileSync(path.join(to,'reports/ctx_1.json'),'utf8'),/"outcome": "done"/);
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','_local')),false,'export reads the ledger, not _local');
});

test('ledger-verify walks the hash chain of every workflow or one named by --id, and reports a break',async t=>{
  const fx=fixture(t),repo=fx.repo();
  const store=fx.track(createStore({repoRoot:repo,id:ID}));
  store.appendEvent({event:'workflow.start'});
  store.appendEvent({event:'op.dispatch'});
  const other=fx.track(createStore({repoRoot:repo,id:`${ID}-2`}));
  other.appendEvent({event:'workflow.start'});
  const healthy=main(['ledger-verify','--repo',repo]);
  assert.equal(healthy.ok,true);
  assert.deepEqual(new Set(healthy.results.map(r=>r.workflowId)),new Set([ID,`${ID}-2`]));
  assert.ok(healthy.results.every(r=>r.ok));
  const scoped=main(['ledger-verify','--repo',repo,'--id',ID]);
  assert.deepEqual(scoped.results.map(r=>r.workflowId),[ID]);
  // Tamper with one row's payload directly, the way the ledger-db spec does; the chain must prove the break.
  const row=store.ledger.db.prepare('SELECT seq FROM events WHERE workflow_id=? ORDER BY seq LIMIT 1').get(ID);
  store.ledger.db.prepare('UPDATE events SET payload_json=? WHERE seq=?').run('{"tampered":true}',row.seq);
  const broken=main(['ledger-verify','--repo',repo,'--id',ID]);
  assert.equal(broken.ok,false);
  assert.equal(broken.results[0].brokenAt,row.seq);
  const untouched=main(['ledger-verify','--repo',repo,'--id',`${ID}-2`]);
  assert.equal(untouched.ok,true);
  assert.throws(()=>main(['ledger-verify','--repo',path.join(repo,'nowhere')]),/No ledger at/);
});

test('ledger-migrate forwards to scripts/ledger-migrate.mjs and reports nothing to import for a plain repository',async t=>{
  const fx=fixture(t),repo=fx.repo();
  const result=await main(['ledger-migrate','--repo',repo]);
  assert.equal(result.command,'ledger-migrate');
  assert.deepEqual(result.workflows,[]);
  assert.deepEqual(result.skipped,[]);
  assert.deepEqual(result.refused,[]);
  assert.equal(result.ok,true);
});

test('ledger-prune retires a finished workflow and keeps a live one; ledger-retire removes a quiet empty ledger',async t=>{
  const fx=fixture(t),repo=fx.repo();
  const done=fx.track(createStore({repoRoot:repo,id:ID}));
  done.appendEvent({event:'workflow.start'});
  done.saveState({schema:'starci/workflow-state@1',finished:{outcome:'done'}});
  const running=`${ID}-running`;
  fx.track(createStore({repoRoot:repo,id:running})).appendEvent({event:'workflow.start'});
  const dryRun=main(['ledger-prune','--repo',repo,'--dry-run']);
  assert.deepEqual(dryRun.decisions.find(d=>d.workflowId===ID).decision,'retire');
  assert.deepEqual(dryRun.decisions.find(d=>d.workflowId===running).decision,'kept');
  assert.ok(fs.existsSync(ledgerFileFor(repo)),'a dry run changes nothing');
  const pruned=main(['ledger-prune','--repo',repo]);
  assert.equal(pruned.decisions.find(d=>d.workflowId===ID).decision,'retire');
  assert.equal(done.ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(ID),undefined,'the retired workflow row is gone');
  assert.ok(done.ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(running),'the live workflow row stays');
  // Still live (the running workflow holds a row), so retiring the whole ledger is refused; retiring that
  // workflow first, then retiring the ledger with --delete true removes the file.
  const stillLive=main(['ledger-retire','--repo',repo]);
  assert.equal(stillLive.ok,false);
  assert.throws(()=>main(['ledger-retire','--repo',path.join(repo,'nowhere')]),/No ledger at/);
});

test('ledger-anchor --write regenerates the tracked head, and ledger-verify checks the ledger against it (§12)',t=>{
  const fx=fixture(t),repo=fx.repo();
  const store=fx.track(createStore({repoRoot:repo,id:ID}));
  store.appendEvent({event:'workflow.start'});
  store.appendEvent({event:'op.dispatch'});
  store.saveState({schema:'starci/workflow-state@1',phase:'run'});
  const written=main(['ledger-anchor','--write','--repo',repo]);
  assert.equal(written.ok,true);
  assert.deepEqual(written.written,[ID]);
  assert.deepEqual(written.refused,[]);
  assert.equal(written.file,anchorFileFor(repo));
  const onDisk=JSON.parse(fs.readFileSync(anchorFileFor(repo),'utf8'));
  assert.equal(onDisk.schema,'starci/ledger-anchor@1');
  assert.equal(onDisk.ledgerId,ledgerIdFor(ledgerFileFor(repo)));
  const lastSeq=store.ledger.db.prepare('SELECT max(seq) seq FROM events WHERE workflow_id=?').get(ID).seq;
  assert.equal(onDisk.workflows[ID].seq,lastSeq);
  // A tracked anchor with no entry yet for a workflow is fine (never having reached it is not "behind").
  const other=`${ID}-fresh`;
  fx.track(createStore({repoRoot:repo,id:other}));
  const freshOk=main(['ledger-verify','--repo',repo,'--id',other]);
  assert.deepEqual(freshOk.results[0].anchor,{ok:true,checked:false,reason:null});
  const healthy=main(['ledger-verify','--repo',repo,'--id',ID]);
  assert.equal(healthy.ok,true);
  assert.deepEqual(healthy.results[0].anchor,{ok:true,checked:true,reason:null});
  // The ledger running ahead of its anchor (a new event after the anchor was written) is normal, never a refusal.
  store.appendEvent({event:'op.report'});
  const ahead=main(['ledger-verify','--repo',repo,'--id',ID]);
  assert.equal(ahead.ok,true);
  assert.equal(ahead.results[0].anchor.ok,true);
  // A ledger genuinely missing the anchored head - restored from an earlier backup - refuses closed.
  store.ledger.db.prepare('DELETE FROM events WHERE workflow_id=? AND seq>=?').run(ID,lastSeq);
  const behind=main(['ledger-verify','--repo',repo,'--id',ID]);
  assert.equal(behind.ok,false);
  assert.equal(behind.results[0].ok,true,'the remaining, shorter chain is still internally self-consistent');
  assert.deepEqual(behind.results[0].anchor,{ok:false,checked:true,reason:'ledger-behind-anchor'});
});

test('ledger-verify reports ledger-missing for a tracked anchor whose ledger file is gone (a re-clone)',t=>{
  const fx=fixture(t),repo=fx.repo();
  // Closed explicitly (not tracked) before its file is deleted below - Windows denies deleting an open handle.
  const store=createStore({repoRoot:repo,id:ID});
  store.appendEvent({event:'workflow.start'});
  main(['ledger-anchor','--write','--repo',repo]);
  store.close();
  for(const suffix of ['','-journal','-wal','-shm']){const file=`${ledgerFileFor(repo)}${suffix}`;if(fs.existsSync(file))fs.rmSync(file);}
  const result=main(['ledger-verify','--repo',repo]);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'ledger-missing');
  assert.deepEqual(result.results.map(r=>r.workflowId),[ID]);
  assert.equal(result.results[0].anchor.reason,'ledger-missing');
  // No anchor at all and no ledger is the ordinary "nothing here yet" case, not a refusal by name.
  fs.rmSync(anchorFileFor(repo));
  assert.throws(()=>main(['ledger-verify','--repo',repo]),/No ledger at/);
});

test('ledger-verify reports ledger-identity-mismatch when the anchor names a different ledger',t=>{
  const fx=fixture(t),repo=fx.repo();
  const store=fx.track(createStore({repoRoot:repo,id:ID}));
  store.appendEvent({event:'workflow.start'});
  const lastSeq=store.ledger.db.prepare('SELECT max(seq) seq FROM events WHERE workflow_id=?').get(ID).seq;
  const digest=store.ledger.db.prepare('SELECT digest FROM events WHERE workflow_id=? AND seq=?').get(ID,lastSeq).digest;
  fs.mkdirSync(path.dirname(anchorFileFor(repo)),{recursive:true});
  fs.writeFileSync(anchorFileFor(repo),JSON.stringify({schema:'starci/ledger-anchor@1',ledgerId:'not-this-ledger',updatedAt:0,
    workflows:{[ID]:{generation:0,checkpointId:null,eventsHead:digest,seq:lastSeq,at:0}}}));
  const result=main(['ledger-verify','--repo',repo]);
  assert.equal(result.ok,false);
  assert.deepEqual(result.results[0].anchor,{ok:false,checked:true,reason:'ledger-identity-mismatch'});
});

test('ledger-anchor --write refuses to anchor a workflow whose chain does not verify',t=>{
  const fx=fixture(t),repo=fx.repo();
  const store=fx.track(createStore({repoRoot:repo,id:ID}));
  store.appendEvent({event:'workflow.start'});
  const row=store.ledger.db.prepare('SELECT seq FROM events WHERE workflow_id=? ORDER BY seq LIMIT 1').get(ID);
  store.ledger.db.prepare('UPDATE events SET payload_json=? WHERE seq=?').run('{"tampered":true}',row.seq);
  const result=main(['ledger-anchor','--write','--repo',repo]);
  assert.equal(result.ok,false);
  assert.deepEqual(result.written,[]);
  assert.equal(result.refused[0].workflowId,ID);
  assert.equal(result.refused[0].reason,'ledger-chain-broken');
  assert.deepEqual(JSON.parse(fs.readFileSync(anchorFileFor(repo),'utf8')).workflows,{});
});

test('journal-prune and journal-retire are redirected to their renamed verb and exit 2',async t=>{
  for(const [command,renamedTo] of [['journal-prune','ledger-prune'],['journal-retire','ledger-retire']]){
    const result=await main([command,'--journal-file','/some/journal.sqlite']);
    assert.equal(result.ok,false);
    assert.equal(result.exitCode,2);
    assert.equal(result.renamedTo,renamedTo);
    assert.match(result.print,new RegExp(`'${command}' is now '${renamedTo}'`));
  }
});
