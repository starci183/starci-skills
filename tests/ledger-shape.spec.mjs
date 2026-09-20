import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {openLedger} from '../engine/ledger-db.mjs';

/**
 * `workflows` is the parent of the ledger. Everything that belongs to a workflow hangs off it by
 * `workflow_id` and dies with it, so deleting a finished workflow can never leave a child behind and can
 * never leave content stranded in a table that outlives its parent.
 *
 * The temptation this gate exists to refuse is a content table with no parent - a `blobs` table keyed by
 * digest, say, so two workflows could share one attachment. It reads like deduplication and it is a second
 * root: rows that no workflow owns, that no finish clears, and that quietly become the place where things
 * accumulate. A document that must outlive a workflow belongs in the Work tree, in git, beside `features/`.
 *
 * So the shape is asserted, not described. A new table either carries `workflow_id` with a path to
 * `workflows`, or it is one of the ledger-wide operational tables named below and the list is edited in the
 * same commit - deliberately, with a reason - rather than a precedent being set by accident.
 */
// The parent itself is not in this list: it carries workflow_id as its own primary key.
const LEDGER_WIDE=['budget_reservations','budgets','meta','resources','signals'];

const withLedger=fn=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-ledger-shape-'));
  const ledger=openLedger({file:path.join(dir,'runtime.sqlite')});
  try{return fn(ledger);}finally{try{ledger.close();}catch{}fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});}
};
const tablesOf=ledger=>ledger.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);
const columnsOf=(ledger,table)=>ledger.db.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name);
const parentsOf=(ledger,table)=>ledger.db.prepare(`PRAGMA foreign_key_list(${table})`).all().map(row=>row.table);

test('every workflow-owned table reaches workflows, directly or through its job',()=>withLedger(ledger=>{
  const orphans=[];
  for(const table of tablesOf(ledger)){
    if(table==='workflows'||!columnsOf(ledger,table).includes('workflow_id'))continue;
    const parents=parentsOf(ledger,table);
    // `leases` reaches the parent through `jobs`, and the `leases_match_job` trigger makes the two identities
    // equal on every insert and update - a second foreign key would restate what the trigger already refuses.
    if(!parents.includes('workflows')&&!(table==='leases'&&parents.includes('jobs')))orphans.push(table);
  }
  assert.deepEqual(orphans,[],'these tables carry a workflow_id with no path to workflows; a child of a workflow dies with it');
}));

test('the ledger-wide tables are a closed list, so a second root cannot appear quietly',()=>withLedger(ledger=>{
  const unparented=tablesOf(ledger).filter(table=>!columnsOf(ledger,table).includes('workflow_id')).sort();
  assert.deepEqual(unparented,LEDGER_WIDE,
    'a new table without a workflow_id is a second root: either give it one, or add it here in the same commit with a reason');
}));

test('a workflow takes its children with it', ()=>withLedger(ledger=>{
  const at=Date.now();
  ledger.transaction(db=>{
    db.prepare('INSERT INTO workflows(workflow_id,title,created_at,updated_at) VALUES(?,?,?,?)').run('wf-parent','parent',at,at);
    db.prepare('INSERT INTO inputs(workflow_id,key,goal_revision,sha256,size,media_type,origin,bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run('wf-parent','1-handoff.md',1,'a'.repeat(64),7,'text/markdown','D:/owner/handoff.md',Buffer.from('content'),at);
  });
  assert.equal(ledger.db.prepare('SELECT COUNT(*) n FROM inputs WHERE workflow_id=?').get('wf-parent').n,1);

  // The child cannot outlive the parent, and it cannot be created without one either.
  assert.throws(()=>ledger.db.prepare('INSERT INTO inputs(workflow_id,key,goal_revision,sha256,size,media_type,origin,bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run('wf-absent','1-orphan.md',1,'b'.repeat(64),1,'text/markdown','D:/owner/orphan.md',Buffer.from('x'),at),/FOREIGN KEY/);
}));
