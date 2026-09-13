import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';

// `bin/starci.mjs` is the one command line of the runtime: a workflow command reaches the launcher in
// `hosts/orca/launch.mjs` with its argv untouched, and every command the CLI already owned still reaches
// the CLI. Nothing here launches an agent: `workflow-list` is a read-only view of the workflow store.
const root=path.resolve(import.meta.dirname,'..');
const entry=path.join(root,'bin','starci.mjs');
const launcher=path.join(root,'hosts','orca','launch.mjs');

const repository=t=>{
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'starci-entry-'));
  t.after(()=>{assert.equal(path.dirname(parent),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(parent).startsWith('starci-entry-'));fs.rmSync(parent,{recursive:true,force:true});});
  const name='repo',repoRoot=path.join(parent,name);
  const dir=path.join(repoRoot,'.starciwork','_local','workflows','20260101-000000-entry');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({schema:'starci/workflow-state@1',
    kernel:'starci/workflow-kernel@1',id:'20260101-000000-entry',phase:'goal',approved:false,
    finished:null,lane:null,ops:[],ledger:[]}));
  return {parent,name,repoRoot};
};

const run=(args,cwd)=>spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:60000,windowsHide:true});

test('a workflow command on bin/starci.mjs is answered by the launcher, not by the CLI',t=>{
  const {parent,name}=repository(t);
  const result=run([entry,'workflow-list','--worktree',name],parent);
  assert.equal(result.status,0,result.stderr||result.stdout);
  // The launcher's text view reaches the terminal as a page, exactly as its own direct entry prints it.
  assert.match(result.stdout,/\| workflow \| phase \| lane \| ops \| kernel \| last event \|/);
  assert.match(result.stdout,/\| 20260101-000000-entry \| goal \(not approved\) \|/);
  assert.equal(result.stdout.includes('\\n'),false);
  assert.equal(result.stdout.includes('Unknown command'),false);

  // Same argv, same answer: the entry adds nothing of its own to what the launcher decides.
  const direct=run([launcher,'workflow-list','--worktree',name],parent);
  assert.equal(direct.status,0,direct.stderr||direct.stdout);
  assert.equal(result.stdout,direct.stdout);

  const json=run([entry,'workflow-list','--json','true','--worktree',name],parent);
  assert.equal(json.status,0,json.stderr||json.stdout);
  assert.deepEqual(JSON.parse(json.stdout).workflows.map(entry=>entry.id),['20260101-000000-entry']);
});

test('a launcher usage error is reported by the launcher and the CLI keeps its own commands',t=>{
  const {parent,name}=repository(t);
  // A workflow command that names no workflow fails the launcher's own way: a typed record, exit 1.
  const missing=run([entry,'workflow-status','--worktree',name],parent);
  assert.equal(missing.status,1);
  assert.equal(JSON.parse(missing.stderr).ok,false);

  // Commands the CLI already owned are untouched by the forwarding.
  const help=run([entry,'--help'],parent);
  assert.equal(help.status,0,help.stderr);
  assert.match(help.stdout,/starci workspace init/);
  // The installer page is only half the entry. Every command this entry forwards to the kernel launcher is
  // named after it, one line each, and so are the two machine checks - otherwise the help teaches a command
  // line that is missing the commands a person types most.
  assert.match(help.stdout,/workflow kernel \(forwarded to the launcher/);
  for(const command of ['workflow-goal','workflow-approve','workflow-answer','workflow-run','workflow-status',
    'workflow-list','workflow-stop','workflow-lane-close','workflow-supervise'])
    assert.match(help.stdout,new RegExp(`^\\s{2}${command}\\s{2,}\\S`,'m'),command);
  assert.match(help.stdout,/^ {2}render check .*--brand <work root>/m);
  assert.match(help.stdout,/^ {2}brand check <work root>/m);
  // The installer page still comes first: the kernel block is an addition, never a replacement.
  assert.ok(help.stdout.indexOf('starci workspace init')<help.stdout.indexOf('workflow kernel'),help.stdout);
  // Product-agnostic: no repository, product or machine path is named in what a person is taught to type.
  assert.doesNotMatch(help.stdout.slice(help.stdout.indexOf('workflow kernel')),/starci-academy|[A-Za-z]:[\\/]/);

  // `help` and `-h` are the same page as `--help`.
  for(const flag of ['help','-h']){
    const same=run([entry,flag],parent);
    assert.equal(same.status,0,same.stderr);
    assert.equal(same.stdout,help.stdout,flag);
  }
  const workflows=run([entry,'workflows'],parent);
  assert.equal(workflows.status,0,workflows.stderr);
  assert.equal(JSON.parse(workflows.stdout).workflows.length,16);
});
