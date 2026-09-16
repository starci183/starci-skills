import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStore} from '../kernel/store.mjs';
import {bindContinuationPath,CONTINUATION_SECTION_START,CONTINUATION_SECTION_END} from '../kernel/continuation.mjs';

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-continuation-binding-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStore({repoRoot:root,id:'wf-one'}),folder=path.join(root,'workflows');
  fs.mkdirSync(folder,{recursive:true});
  const write=(name,body)=>{const file=path.join(folder,name);fs.writeFileSync(file,body);return file;};
  return {store,write,canonical:path.join(folder,'wf-one.md')};
}

test('incidental IDs and historical generated sections cannot bind an aggregate goal as the checkpoint',t=>{
  const {store,write,canonical}=fixture(t);
  const body=`# Current goal\n\n| wf-one | Backend |\n| wf-two | Frontend |\n\n${CONTINUATION_SECTION_START}\n<!-- starci/workflow-continuation@1 -->\n# Workflow continuation: wf-one\n${CONTINUATION_SECTION_END}\n`;
  const aggregate=write('current-goal.md',body);
  assert.equal(bindContinuationPath(store,{id:'wf-one'}),canonical);
  assert.equal(fs.readFileSync(aggregate,'utf8'),body);
});

test('the exact stable filename takes precedence over a friendly identity declaration',t=>{
  const {store,write,canonical}=fixture(t);
  write('handoff.md','Workflow ID: `wf-one`\n');write('wf-one.md','# Existing canonical checkpoint\n');
  assert.equal(bindContinuationPath(store,{id:'wf-one'}),canonical);
});

test('only an unambiguous exact authored declaration binds a friendly checkpoint',t=>{
  const {store,write,canonical}=fixture(t);
  const suffix=write('suffix.md','Workflow ID: `wf-one-more`\n');
  assert.equal(bindContinuationPath(store,{id:'wf-one'}),canonical);
  const friendly=write('friendly.md','Workflow ID: `wf-one`\n');
  assert.equal(bindContinuationPath(store,{id:'wf-one'}),friendly);
  write('other.md','Workflow ID: wf-one\n');
  assert.equal(bindContinuationPath(store,{id:'wf-one'}),canonical);
  assert.ok(fs.existsSync(suffix));
});

test('conflicting identity declarations and malformed generated sections do not claim a workflow',t=>{
  const {store,write,canonical}=fixture(t);
  write('conflicting.md','Workflow ID: wf-one\nWorkflow ID: wf-two\n');
  write('malformed.md',`${CONTINUATION_SECTION_START}\nWorkflow ID: wf-one\n`);
  assert.equal(bindContinuationPath(store,{id:'wf-one'}),canonical);
});
