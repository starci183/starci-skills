import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {resumeRepos,runningWorkflows} from '../scripts/kernel/managed-repos.mjs';

// The managed ledgers are exactly config.yaml supervisor.repos (plus explicit paths); nothing is discovered.

test('only the ledgers config.yaml supervisor.repos lists (plus explicit paths) are managed; nothing is discovered',t=>withLedger(t,({root,repoRoot})=>{
  const source=path.dirname(repoRoot),other=path.join(root,'no-ledger');
  fs.mkdirSync(other,{recursive:true});
  const env={...process.env,STARCI_SOURCE_ROOT:source};
  assert.deepEqual(resumeRepos({config:{supervisor:{repos:[]}},env}),{repos:[],missing:[]},'an empty list manages nothing, not the source root');
  assert.deepEqual(resumeRepos({config:{supervisor:{repos:['repo','repo']}},env}),{repos:[repoRoot],missing:[]},'relative to the source root, once');
  assert.deepEqual(resumeRepos({config:{supervisor:{}},env,extra:[other,repoRoot]}),{repos:[repoRoot],missing:[other]});
}));

test('runningWorkflows lists running, unarchived workflows only',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:'wf-run',state:{phase:'running'}});
  seedWorkflow(ledger,{id:'wf-done',state:{phase:'finished'}});
  seedWorkflow(ledger,{id:'wf-archived',state:{phase:'running'}});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id IN ('wf-run','wf-archived')").run();
  ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id='wf-done'").run();
  ledger.db.prepare("UPDATE workflows SET archived_at=? WHERE workflow_id='wf-archived'").run(Date.now());
  assert.deepEqual(runningWorkflows(repoRoot).map(w=>w.workflowId),['wf-run']);
}));
