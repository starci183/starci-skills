import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {openLedger,inspectLedger,ledgerIdOf,anchorFileFor,readAnchor,writeAnchor,verifyAnchor} from '../engine/ledger-db.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

/**
 * §12: `.starciwork/ledger-anchor.json`, the small tracked counter-record proving which ledger history is
 * agreed, since the ledger file itself is untracked and self-consistent (anyone able to write it can
 * recompute its own chain). `writeAnchor`/`readAnchor`/`anchorFileFor`/`verifyAnchor` are kernel/ledger-db.mjs's
 * own exports (landed by s0 after this spec was first drafted against the contract text alone).
 * `verifyAnchor(ledger,repoRoot)` checks every workflow head the tracked anchor holds against `ledger` (a
 * handle exposing `.db`/`.ledgerId`, e.g. from `openLedger` or `inspectLedger`; `null`/`undefined` for a
 * ledger that could not be opened at all) - it is anchor-wide, not scoped to one workflow id.
 */

const checkpointFrom=(ledger,workflowId)=>{
  const head=ledger.eventsHead(workflowId),seqRow=ledger.db.prepare('SELECT seq FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(workflowId);
  const snap=ledger.db.prepare('SELECT checkpoint_id,generation FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id DESC LIMIT 1').get(workflowId);
  return {ledgerId:ledgerIdOf(ledger),workflowId,generation:snap.generation,checkpointId:snap.checkpoint_id,eventsHead:head,seq:seqRow.seq};
};
/** §3: every copy checkpoints WAL into the main file first, so a byte-copy of it alone is self-contained. */
const snapshotFile=(ledger,file)=>{ledger.checkpoint();return fs.readFileSync(file);};
const restoreFile=(file,bytes)=>{
  fs.writeFileSync(file,bytes);
  for(const suffix of ['-wal','-shm'])fs.rmSync(`${file}${suffix}`,{force:true});
};

test('§12 anchor: written at every checkpoint',async t=>{
  await withLedger(t,({repoRoot,ledger})=>{
    const id='wf-anchor-checkpoints';
    seedWorkflow(ledger,{id,state:{id,job:'anchor test',phase:'run'},events:[{event:'goal-approved'}],generation:1});
    const first=checkpointFrom(ledger,id);
    let anchor=writeAnchor(repoRoot,first);
    assert.equal(anchor.ledgerId,ledgerIdOf(ledger));
    assert.deepEqual(anchor.workflows[id],{generation:first.generation,checkpointId:first.checkpointId,eventsHead:first.eventsHead,seq:first.seq,at:anchor.workflows[id].at});
    assert.equal(fs.existsSync(anchorFileFor(repoRoot)),true);

    seedWorkflow(ledger,{id,events:[{event:'op-done',op:'op-1'}],generation:1});
    const second=checkpointFrom(ledger,id);
    assert.notEqual(second.eventsHead,first.eventsHead,'the fixture actually advanced the chain');
    anchor=writeAnchor(repoRoot,second);
    assert.equal(anchor.workflows[id].eventsHead,second.eventsHead,'the anchor tracks the newest checkpoint, not the first');
    assert.equal(readAnchor(repoRoot).workflows[id].seq,second.seq);
  });
});

test('§12 anchor: a ledger restored behind its anchor refuses with ledger-behind-anchor',async t=>{
  await withLedger(t,({repoRoot,ledger,ledgerFile})=>{
    const id='wf-anchor-restored';
    seedWorkflow(ledger,{id,state:{id,job:'restore test',phase:'run'},events:[{event:'goal-approved'}],generation:1});
    writeAnchor(repoRoot,checkpointFrom(ledger,id));
    const backup=snapshotFile(ledger,ledgerFile);   // a "backup" taken right after the first checkpoint's anchor

    seedWorkflow(ledger,{id,events:[{event:'op-done',op:'op-1'}],generation:1});
    writeAnchor(repoRoot,checkpointFrom(ledger,id));   // the anchor now tracks the LATEST checkpoint
    ledger.close();

    restoreFile(ledgerFile,backup);   // the checkout is restored from the earlier backup
    const inspection=inspectLedger({file:ledgerFile});
    try{
      const result=verifyAnchor(inspection,repoRoot);
      assert.equal(result.ok,false);
      assert.equal(result.reason,'ledger-behind-anchor');
    }finally{inspection.close();}
  });
});

test('§12 anchor: a missing ledger with a tracked anchor refuses with ledger-missing',async t=>{
  await withLedger(t,({repoRoot,ledger,ledgerFile})=>{
    const id='wf-anchor-missing';
    seedWorkflow(ledger,{id,state:{id,job:'missing test',phase:'run'},events:[{event:'goal-approved'}],generation:1});
    writeAnchor(repoRoot,checkpointFrom(ledger,id));
    ledger.close();
    fs.rmSync(ledgerFile);
    assert.equal(fs.existsSync(anchorFileFor(repoRoot)),true,'the anchor is tracked and survives the ledger file going away');
    const result=verifyAnchor(null,repoRoot);   // the continuation boundary could not open a ledger at all
    assert.equal(result.ok,false);
    assert.equal(result.reason,'ledger-missing');
  });
});

test('§12 anchor: a foreign ledger dropped into the checkout refuses with ledger-identity-mismatch',async t=>{
  await withLedger(t,({repoRoot,ledger,ledgerFile,root})=>{
    const id='wf-anchor-foreign';
    seedWorkflow(ledger,{id,state:{id,job:'foreign test',phase:'run'},events:[{event:'goal-approved'}],generation:1});
    writeAnchor(repoRoot,checkpointFrom(ledger,id));
    ledger.close();

    const foreignFile=path.join(root,'foreign.sqlite');
    const foreign=openLedger({file:foreignFile});
    seedWorkflow(foreign,{id,state:{id,job:'a different history',phase:'run'},events:[{event:'goal-approved'}],generation:1});
    const foreignBytes=snapshotFile(foreign,foreignFile);
    foreign.close();

    restoreFile(ledgerFile,foreignBytes);   // a different ledger's bytes now sit at the tracked path
    const inspection=inspectLedger({file:ledgerFile});
    try{
      assert.notEqual(inspection.ledgerId,readAnchor(repoRoot).ledgerId,'the dropped-in file really is a different ledger');
      const result=verifyAnchor(inspection,repoRoot);
      assert.equal(result.ok,false);
      assert.equal(result.reason,'ledger-identity-mismatch');
    }finally{inspection.close();}
  });
});

test('§12 anchor: an anchor-less first boot is legitimate',async t=>{
  await withLedger(t,({repoRoot,ledger})=>{
    assert.equal(fs.existsSync(anchorFileFor(repoRoot)),false,'no anchor was ever written in this checkout');
    assert.deepEqual(verifyAnchor(ledger,repoRoot),{ok:true,checked:0},'no tracked anchor at all is a legitimate first boot');

    seedWorkflow(ledger,{id:'wf-other',state:{id:'wf-other',job:'unrelated',phase:'run'},events:[{event:'goal-approved'}],generation:1});
    writeAnchor(repoRoot,checkpointFrom(ledger,'wf-other'));
    assert.equal(fs.existsSync(anchorFileFor(repoRoot)),true);
    const result=verifyAnchor(ledger,repoRoot);
    assert.equal(result.ok,true,'the one anchored workflow still matches its own ledger');
    assert.equal(result.checked,1);
  });
});
