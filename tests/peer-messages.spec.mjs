import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';

// Cross-workflow peer messages (modules/kernel/api.yaml peers/notify/inbox, driver-loop.yaml peers).
// One product ledger holds several running workflows that build in the same source: nivo's Collab
// Kernel needed phone verification the Login workflow owns and had to ask the owner who should do
// it, workflows edited overlapping areas, and a repo-wide migration was owned by nobody. Peers now
// message each other through inbox rows of kind peer-message, a pending one wakes the Kernel
// through status frontier.actionable, and enqueue sends a heads-up when owned_paths overlap.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastLine=text=>json(String(text).trim().split('\n').at(-1));

const LOGIN='wf-a-login',COLLAB='wf-b-collab',DONE='wf-c-done',ELSEWHERE='wf-d-elsewhere',ROOTLESS='wf-e-rootless';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-peers-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const base={...process.env};
  // The suite may itself run inside an Orca or op terminal: start from a caller with no identity.
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete base[key];
  const api=(args,env={})=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...base,...env}});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    const workflow=(workflowId,title,phase,sourceRoots)=>{
      ledger.ensureWorkflow({workflowId,title,ledgerMode:'durable',sourceRoots});
      ledger.db.prepare('UPDATE workflows SET phase=? WHERE workflow_id=?').run(phase,workflowId);
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
        .run(workflowId,0,`goal-${workflowId}`,'# goal',JSON.stringify({derivedFrom:'peer-spec'}),at);
    };
    workflow(LOGIN,'nivo-app-auth','running',[repo]);
    workflow(COLLAB,'nivo-collab-group-chat','running',[repo]);
    workflow(DONE,'nivo-finished','finished',[repo]);
    workflow(ELSEWHERE,'another-product','running',[path.join(root,'other-repo')]);
    workflow(ROOTLESS,'no-roots-recorded','running',null);
    const job=(jobId,workflowId,opId,paths,status,updatedAt=at)=>{
      ledger.enqueueJob({jobId,workflowId,opId,kind:'op',payload:{opId,owned_paths:paths}});
      ledger.db.prepare('UPDATE jobs SET status=?,updated_at=? WHERE job_id=?').run(status,updatedAt,jobId);
    };
    // Login: a queued phone job and a leased (in-flight) auth job - the current leg.
    job('job-login-phone',LOGIN,'interface.implement',['src/auth/phone'],'queued');
    job('job-login-auth',LOGIN,'code.refactor',['src/auth','nivo-fe/apps/login'],'leased',at+1000);
    job('job-login-old',LOGIN,'docs.author',['src/auth'],'succeeded');
    // Collab: one in-flight job, so its frontier is engaged and not actionable on its own.
    job('job-collab-chat',COLLAB,'code.refactor',['src/chat'],'leased');
    // Not peers: a finished workflow and a workflow of another source root, both owning src/auth.
    job('job-done-auth',DONE,'code.refactor',['src/auth'],'queued');
    job('job-elsewhere-auth',ELSEWHERE,'code.refactor',['src/auth'],'queued');
    // A peer with no recorded roots owns all of src.
    job('job-rootless-src',ROOTLESS,'code.refactor',['src'],'leased');
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const ok=(args,env)=>{const r=api(args,env);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  const refused=(args,code,env)=>{
    const r=api(args,env);
    assert.equal(r.status,1,`${args.join(' ')} must be refused: ${r.stdout}`);
    assert.equal(lastLine(r.stderr)?.code,code,r.stderr);
  };
  const peerRows=()=>read(db=>db.prepare("SELECT * FROM inbox WHERE kind='peer-message' ORDER BY inbox_id").all());
  return {repo,api,ok,refused,read,peerRows};
};

test('peers lists every running workflow sharing a source root, with its current leg and open owned paths',t=>{
  const fx=fixture(t);
  const out=fx.ok(['peers','--workflow',COLLAB]);
  assert.match(out.rule,/running/);
  assert.deepEqual(out.peers.map(p=>p.workflowId).sort(),[LOGIN,ROOTLESS],'finished and other-source workflows are not peers');
  const login=out.peers.find(p=>p.workflowId===LOGIN);
  assert.equal(login.title,'nivo-app-auth');
  assert.equal(login.phase,'running');
  assert.deepEqual(login.currentLeg,{jobId:'job-login-auth',op:'code.refactor',status:'leased',attempt:1},'the in-flight job is the current leg');
  assert.deepEqual(login.ownedPaths.map(j=>[j.jobId,j.paths]).sort(),[
    ['job-login-auth',['src/auth','nivo-fe/apps/login']],['job-login-phone',['src/auth/phone']]],'settled jobs own nothing');
  assert.deepEqual(login.pending,{toPeer:[],fromPeer:[]});

  const sent=fx.ok(['notify','--workflow',COLLAB,'--to',LOGIN,'--kind','request','--subject','phone verification','--body','Collab needs it']);
  const again=fx.ok(['peers','--workflow',COLLAB]).peers.find(p=>p.workflowId===LOGIN);
  assert.deepEqual(again.pending.toPeer.map(m=>m.key),[sent.sent[0].key]);
  const mirrored=fx.ok(['peers','--workflow',LOGIN]).peers.find(p=>p.workflowId===COLLAB);
  assert.deepEqual(mirrored.pending.fromPeer.map(m=>m.key),[sent.sent[0].key]);
  assert.equal(mirrored.currentLeg.jobId,'job-collab-chat');
});

test('notify, inbox and ack round trip: a request, a reply, and each disposition visible to its sender',t=>{
  const fx=fixture(t);
  const request=fx.ok(['notify','--workflow',COLLAB,'--to',LOGIN,'--kind','request','--subject','phone verification',
    '--body','Collab group invites need a verified phone; it belongs to the Login workflow. Can you build it?','--refs','src/auth/phone,job-collab-chat']);
  assert.equal(request.sent.length,1);
  const key=request.sent[0].key;
  assert.match(key,/^pm-[0-9a-f]{12}$/);
  const row=fx.peerRows()[0];
  assert.deepEqual([row.workflow_id,row.status],[LOGIN,'pending']);
  const payload=JSON.parse(row.payload_json);
  assert.deepEqual({...payload,at:typeof payload.at},{from:COLLAB,fromTitle:'nivo-collab-group-chat',kind:'request',subject:'phone verification',
    body:'Collab group invites need a verified phone; it belongs to the Login workflow. Can you build it?',replyTo:null,
    refs:['src/auth/phone','job-collab-chat'],at:'number'});

  // A Kernel re-sending the same pending message after a crash does not duplicate it.
  const resent=fx.ok(['notify','--workflow',COLLAB,'--to',LOGIN,'--kind','request','--subject','phone verification',
    '--body','Collab group invites need a verified phone; it belongs to the Login workflow. Can you build it?']);
  assert.deepEqual([resent.sent[0].key,resent.sent[0].deduped],[key,true]);
  assert.equal(fx.peerRows().length,1);

  const inbox=fx.ok(['inbox','--workflow',LOGIN]);
  assert.deepEqual(inbox.pending.map(m=>[m.key,m.from,m.kind,m.subject]),[[key,COLLAB,'request','phone verification']]);
  assert.deepEqual(fx.ok(['inbox','--workflow',COLLAB]).pending,[],'the sender has nothing pending');

  // Login answers with a reply and acks the request with what it did.
  const reply=fx.ok(['notify','--workflow',LOGIN,'--to',COLLAB,'--kind','reply','--reply-to',key,'--subject','re: phone verification',
    '--body','Queued as job-login-phone; expect it after the auth leg.']);
  const replyKey=reply.sent[0].key;
  const acked=fx.ok(['inbox','--workflow',LOGIN,'--ack',key,'--disposition','queued as job-login-phone, replied '+replyKey]);
  assert.deepEqual([acked.acked.key,acked.acked.from,acked.pending],[key,COLLAB,0]);
  fx.refused(['inbox','--workflow',LOGIN,'--ack',key,'--disposition','again'],'peer-message-not-pending');
  fx.refused(['inbox','--workflow',LOGIN,'--ack','pm-000000000000','--disposition','x'],'peer-message-unknown');

  // Collab sees the reply pending and its request's disposition in its sent list.
  const collab=fx.ok(['inbox','--workflow',COLLAB]);
  assert.deepEqual(collab.pending.map(m=>[m.key,m.kind,m.replyTo,m.from]),[[replyKey,'reply',key,LOGIN]]);
  const mine=collab.sent.find(m=>m.key===key);
  assert.equal(mine.status,'applied');
  assert.equal(mine.disposition.disposition,'queued as job-login-phone, replied '+replyKey);
  assert.equal(mine.disposition.by,LOGIN);
  fx.ok(['inbox','--workflow',COLLAB,'--ack',replyKey,'--disposition','waiting on job-login-phone']);
  assert.deepEqual(fx.ok(['inbox','--workflow',COLLAB]).pending,[]);

  const events=fx.read(db=>db.prepare("SELECT workflow_id,kind FROM events WHERE kind LIKE 'peer-message-%' ORDER BY seq").all().map(e=>`${e.workflow_id}:${e.kind}`));
  assert.deepEqual(events,[`${COLLAB}:peer-message-sent`,`${LOGIN}:peer-message-sent`,`${LOGIN}:peer-message-acked`,`${COLLAB}:peer-message-acked`]);

  // --to peers reaches every running peer.
  const broadcast=fx.ok(['notify','--workflow',COLLAB,'--to','peers','--kind','heads-up','--subject','chat contract v2','--body','The chat DTO gains a phone field.']);
  assert.deepEqual(broadcast.sent.map(m=>m.to).sort(),[LOGIN,ROOTLESS]);
});

test('notify refuses a finished, foreign, unknown or self target and malformed messages, writing nothing',t=>{
  const fx=fixture(t);
  const send=(to,extra=[])=>['notify','--workflow',COLLAB,'--to',to,'--kind','request','--subject','s','--body','b',...extra];
  fx.refused(send(DONE),'peer-not-running');
  fx.refused(send(ELSEWHERE),'peer-not-shared-source');
  fx.refused(send('wf-nobody'),'peer-unknown');
  fx.refused(send(COLLAB),'peer-self');
  fx.refused(send(`${LOGIN},${DONE}`),'peer-not-running');
  fx.refused(['notify','--workflow',COLLAB,'--to',LOGIN,'--kind','gossip','--subject','s','--body','b'],'peer-kind-invalid');
  fx.refused(['notify','--workflow',COLLAB,'--to',LOGIN,'--kind','reply','--subject','s','--body','b'],'reply-to-missing');
  fx.refused(send(LOGIN,['--reply-to','pm-000000000000']),'reply-to-unknown');
  fx.refused(['notify','--workflow',DONE,'--to',LOGIN,'--kind','heads-up','--subject','s','--body','b'],'workflow-finished');
  assert.equal(fx.peerRows().length,0,'a refused notify writes no row for any target');
  // A reply goes back to the sender of the message it answers.
  const key=fx.ok(send(LOGIN)).sent[0].key;
  fx.refused(['notify','--workflow',LOGIN,'--to',ROOTLESS,'--kind','reply','--reply-to',key,'--subject','s','--body','b'],'reply-to-mismatch');
});

test('a pending peer message makes the frontier actionable and the ack returns it to its wait',t=>{
  const fx=fixture(t);
  const frontier=()=>fx.ok(['status','--workflow',COLLAB]).frontier;
  const before=frontier();
  assert.deepEqual([before.state,before.actionable,before.peerMessageKeys],['engaged',false,[]],'an in-flight job alone is a wait');

  const key=fx.ok(['notify','--workflow',LOGIN,'--to',COLLAB,'--kind','heads-up','--subject','auth guard renamed','--body','AuthGuard is now SessionGuard.']).sent[0].key;
  const status=fx.ok(['status','--workflow',COLLAB]);
  assert.deepEqual([status.frontier.state,status.frontier.actionable,status.frontier.peerMessageKeys],['peer-message',true,[key]]);
  assert.match(status.frontier.reason,/api inbox/);
  assert.match(status.frontier.reason,/--ack <key> --disposition/);
  assert.deepEqual(status.peerMessages.map(m=>[m.key,m.from,m.kind]),[[key,LOGIN,'heads-up']]);
  assert.equal(status.inboxPending,1);
  assert.equal(fx.ok(['status','--workflow',LOGIN]).frontier.peerMessageKeys.length,0,'the sender is not woken by its own message');

  fx.ok(['inbox','--workflow',COLLAB,'--ack',key,'--disposition','imports updated in the next chat slice']);
  const after=frontier();
  assert.deepEqual([after.state,after.actionable,after.peerMessageKeys],['engaged',false,[]]);
});

test('a filed report still outranks a pending peer message',t=>{
  const fx=fixture(t);
  fx.ok(['notify','--workflow',LOGIN,'--to',COLLAB,'--kind','request','--subject','s','--body','b']);
  const l=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    l.db.prepare("INSERT INTO reports(workflow_id,op_id,attempt,dispatch_id,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(COLLAB,'code.refactor',1,'job-collab-chat','done','{}',Date.now());
  }finally{l.close();}
  const status=fx.ok(['status','--workflow',COLLAB]);
  assert.equal(status.frontier.state,'transition-ready');
  assert.equal(status.frontier.actionable,true);
  assert.equal(status.frontier.peerMessageKeys.length,1,'the message stays listed for after the report');
});

test('enqueue names owned_paths overlapping a running peer and sends each such peer one deduped heads-up',t=>{
  const fx=fixture(t);
  const disjoint=fx.ok(['enqueue','--workflow',COLLAB,'--op','docs.author','--paths','docs/chat']);
  assert.deepEqual([disjoint.status,disjoint.peerOverlap,disjoint.peerHeadsUp],['queued',[],[]]);
  assert.equal(fx.peerRows().length,0);

  // Two own paths hit the same Login jobs, and the rootless peer owns all of src.
  const out=fx.ok(['enqueue','--workflow',COLLAB,'--op','docs.author','--paths','src/auth/phone/otp,src/auth/phone/sms']);
  assert.equal(out.status,'queued','an overlap never blocks the enqueue');
  const hits=out.peerOverlap.map(h=>`${h.workflowId}/${h.jobId}:${h.path}`).sort();
  assert.deepEqual(hits,[`${LOGIN}/job-login-auth:src/auth`,`${LOGIN}/job-login-phone:src/auth/phone`,`${ROOTLESS}/job-rootless-src:src`],
    'finished, foreign-source and settled jobs are not overlaps');
  assert.deepEqual(out.peerHeadsUp.map(m=>m.to).sort(),[LOGIN,ROOTLESS],'one heads-up per peer');
  const rows=fx.peerRows();
  assert.equal(rows.length,2);
  const login=rows.find(r=>r.workflow_id===LOGIN),payload=JSON.parse(login.payload_json);
  assert.deepEqual([payload.from,payload.kind,payload.auto],[COLLAB,'heads-up','enqueue-overlap']);
  assert.deepEqual(payload.overlapPairs.sort(),[[out.job_id,'job-login-auth'].sort().join('|'),[out.job_id,'job-login-phone'].sort().join('|')].sort(),
    'each job pair once, although two own paths hit it');
  assert.match(payload.body,/job-login-phone/);
  assert.ok(payload.refs.includes(out.job_id));
  const sentEvents=fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE workflow_id=? AND kind='peer-message-sent'").get(COLLAB).n);
  assert.equal(sentEvents,2);

  // The Login Kernel is woken by it.
  assert.equal(fx.ok(['status','--workflow',LOGIN]).frontier.state,'peer-message');

  // Login now queues a job over Collab's new one: a new pair, announced once to Collab.
  const reverse=fx.ok(['enqueue','--workflow',LOGIN,'--op','docs.author','--paths','src/auth/phone/otp/ui']);
  assert.ok(reverse.peerOverlap.some(h=>h.workflowId===COLLAB&&h.jobId===out.job_id));
  assert.deepEqual(reverse.peerHeadsUp.map(m=>m.to).sort(),[COLLAB,ROOTLESS]);
  assert.equal(fx.peerRows().length,4);
});

test('an op caller is refused every peer verb',t=>{
  const fx=fixture(t);
  const asOp={STARCI_ROLE:'op',STARCI_OP_JOB:'job-collab-chat'};
  for(const args of [
    ['peers','--workflow',COLLAB],
    ['notify','--workflow',COLLAB,'--to',LOGIN,'--kind','request','--subject','s','--body','b'],
    ['inbox','--workflow',COLLAB],
    ['inbox','--workflow',COLLAB,'--ack','pm-000000000000','--disposition','x'],
  ])fx.refused(args,'op-context-refused',asOp);
  assert.equal(fx.peerRows().length,0);
  const refusals=fx.read(db=>db.prepare("SELECT count(*) n FROM events WHERE kind='op-caller-refused' AND entity_id='job-collab-chat'").get().n);
  assert.equal(refusals,4);
});
