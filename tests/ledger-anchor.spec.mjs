import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ledgerFileFor,openLedger,inspectLedger,ledgerIdOf,anchorFileFor,readAnchor,writeAnchor,checkAnchor} from '../kernel/ledger-db.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

/**
 * §12 assumed surface (kernel/ledger-db.mjs does not implement the anchor yet - this spec is written
 * against the contract, flagged in notes/s8.md for s0):
 *   anchorFileFor(repoRoot) -> <repoRoot>/.starciwork/ledger-anchor.json
 *   readAnchor(repoRoot) -> {schema,ledgerId,updatedAt,workflows:{<id>:{generation,checkpointId,eventsHead,seq,at}}} | null
 *   writeAnchor(repoRoot,{ledgerId,workflowId,generation,checkpointId,eventsHead,seq,at}) -> the full anchor
 *     object, atomically written (temp+rename), merging into any existing workflows map.
 *   checkAnchor({repoRoot,workflowId}) -> {ok:true} | {ok:false,reason:'ledger-missing'|'ledger-identity-mismatch'|'ledger-behind-anchor'}
 *     - no anchor file, or no entry for workflowId: {ok:true} (first boot).
 *     - anchor entry present, ledgerFileFor(repoRoot) absent: {ok:false,reason:'ledger-missing'}.
 *     - anchor entry present, the ledger's own meta.ledger_id (ledgerIdOf) differs from the anchor's
 *       ledgerId: {ok:false,reason:'ledger-identity-mismatch'}.
 *     - anchor entry present, ledger identity matches, but the anchor's (seq,eventsHead) is not the
 *       digest of that workflow's event at that seq, or state_snapshots holds no checkpoint at or after
 *       the anchor's generation: {ok:false,reason:'ledger-behind-anchor'}.
 *     - otherwise: {ok:true}.
 * `store.saveState` (s1) is expected to call `writeAnchor` inside the same call that commits a checkpoint
 * (§12); this spec exercises the ledger-db.mjs primitive directly rather than depending on store.mjs.
 */

const checkpointFrom=(ledger,workflowId)=>{
  const head=ledger.eventsHead(workflowId),seqRow=ledger.db.prepare('SELECT seq FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(workflowId);
  const snap=ledger.db.prepare('SELECT checkpoint_id,generation FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id DESC LIMIT 1').get(workflowId);
  return {ledgerId:ledgerIdOf(ledger),workflowId,generation:snap.generation,checkpointId:snap.checkpoint_id,eventsHead:head,seq:seqRow.seq};
};

/** Copy the ledger file's current bytes aside (and back), standing in for a restored/foreign backup. */
const snapshotFile=file=>fs.readFileSync(file);
const restoreFile=(file,bytes)=>fs.writeFileSync(file,bytes);

test('§12 anchor: written at every checkpoint',async t=>{
  await withLedger(t,({repoRoot,ledger,ledgerFile})=>{
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
    const backup=snapshotFile(ledgerFile);   // "backup" taken right after the first checkpoint

    seedWorkflow(ledger,{id,events:[{event:'op-done',op:'op-1'}],generation:1});
    const latest=checkpointFrom(ledger,id);
    writeAnchor(repoRoot,latest);   // the anchor is committed for the LATEST checkpoint
    assert.equal(checkAnchor({repoRoot,workflowId:id}).ok,true,'the live ledger matches its own anchor');

    ledger.close();
    restoreFile(ledgerFile,backup);   // the checkout is restored from the earlier backup
    const result=checkAnchor({repoRoot,workflowId:id});
    assert.equal(result.ok,false);
    assert.equal(result.reason,'ledger-behind-anchor');
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
    const result=checkAnchor({repoRoot,workflowId:id});
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
    const foreignBytes=snapshotFile(foreignFile);
    foreign.close();

    restoreFile(ledgerFile,foreignBytes);   // a different ledger's bytes now sit at the tracked path
    const result=checkAnchor({repoRoot,workflowId:id});
    assert.equal(result.ok,false);
    assert.equal(result.reason,'ledger-identity-mismatch');
  });
});

test('§12 anchor: an anchor-less first boot is legitimate',async t=>{
  await withLedger(t,({repoRoot,ledger})=>{
    assert.equal(fs.existsSync(anchorFileFor(repoRoot)),false,'no anchor was ever written in this checkout');
    assert.equal(checkAnchor({repoRoot,workflowId:'wf-never-anchored'}).ok,true,'no tracked anchor at all is a legitimate first boot');

    const id='wf-partial-anchor';
    seedWorkflow(ledger,{id:'wf-other',state:{id:'wf-other',job:'unrelated',phase:'run'},events:[{event:'goal-approved'}],generation:1});
    writeAnchor(repoRoot,checkpointFrom(ledger,'wf-other'));
    assert.equal(fs.existsSync(anchorFileFor(repoRoot)),true);
    assert.equal(checkAnchor({repoRoot,workflowId:id}).ok,true,'an anchor file with no entry for THIS workflow is still its first boot');
  });
});
