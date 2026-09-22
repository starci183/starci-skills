import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// CONTRIBUTING.md rule 5 made executable: host calls go through
// scripts/api/orca/, and no agent-facing prose sends an agent to `orca` or to
// modules/host/**. Every case is a tmp tree the check is pointed at with
// --root, so the real repo is never the fixture.
const ROOT=path.resolve(import.meta.dirname,'..');
const CHECK=path.join(ROOT,'scripts','checks','check-host-boundary.mjs');

const run=(root,args=[])=>{
  const r=spawnSync(process.execPath,[CHECK,'--root',root,...args],
    {cwd:ROOT,encoding:'utf8',timeout:60000,windowsHide:true});
  return {status:r.status,report:JSON.parse(r.stdout.trim()),stderr:r.stderr};
};

// A minimal StarCi-shaped tree: the check reads api.yaml for the verb
// inventory and walks the code and prose roots.
const fixture=(t,files)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-boundary-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const all={'modules/host/orca/api.yaml':'schema: starci/orca-api@1\npublicCommands:\n  - \'orchestration worker-start\'\n  - \'terminal send\'\n  - \'agent-context\'\n  - \'status\'\n',...files};
  for(const [rel,body] of Object.entries(all)){
    const file=path.join(root,rel);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,body);
  }
  return root;
};
const rules=report=>report.violations.map(v=>`${v.where} ${v.rule}`).sort();
// Assembled, never written out: this spec sits inside a scanned root, so a
// violating line may exist only in the fixture it writes.
const O='or'+'ca';

test('a clean tree is green and says so',t=>{
  const root=fixture(t,{
    'scripts/api/orca/lib.mjs':`import {spawnSync} from 'node:child_process';
spawnSync('${O}',['status','--json']);
`,
    'scripts/kernel/api.mjs':"import {terminalSend} from '../api/orca/terminal-send.mjs';\nterminalSend({terminal:'t'});\n",
    'CONTEXT.md':'Host calls go through `scripts/api/orca/`; agents never run orca and never read `modules/host/**`.\n',
    'modules/kernel/api.yaml':"note: the kernel agent never calls orca directly; it runs the orca call through a wrapper\n",
  });
  const r=run(root);
  assert.equal(r.status,0,JSON.stringify(r.report.violations));
  assert.deepEqual(r.report.violations,[]);
});

test('spawning orca outside the wrapper directory is red',t=>{
  const root=fixture(t,{'modules/supervisor/poll.mjs':`import {spawnSync} from 'node:child_process';
const r=spawnSync('${O}',['terminal','read']);
`});
  const r=run(root);
  assert.equal(r.status,1);
  assert.deepEqual(rules(r.report),['modules/supervisor/poll.mjs:2 spawns-orca']);
});

test('importing the Orca runner outside the wrapper directory is red',t=>{
  const root=fixture(t,{'scripts/api/quota/probe.mjs':`import { ${O}Run, jsonOf } from '../${O}/lib.mjs';
export const p=()=>${O}Run(['status']);
`});
  const r=run(root);
  assert.equal(r.status,1);
  assert.deepEqual(rules(r.report),['scripts/api/quota/probe.mjs:1 imports-runner']);
});

test('a wrapper importing its own runner is the sanctioned path',t=>{
  const root=fixture(t,{'scripts/api/orca/worker-start.mjs':"import { orcaCall } from './lib.mjs';\nexport const s=p=>orcaCall('worker-start',p);\n"});
  assert.equal(run(root).status,0);
});

test('prose telling an agent to run an orca command is red, prose about orca is not',t=>{
  const root=fixture(t,{
    'skills/workflow-chat/SKILL.md':'Read the terminal with `orca terminal send --terminal <h> --text "go" --enter --json`.\n',
    'modules/ops/ops/interface.draw.yaml':"action: 'the kernel never runs the orca call itself — scripts/agent/lib.mjs does'\n",
  });
  const r=run(root);
  assert.equal(r.status,1);
  assert.deepEqual(rules(r.report),['skills/workflow-chat/SKILL.md:1 orca-command'],
    'an English sentence naming orca is not a command line');
});

test('a node path that is not a wrapper is red; the wrapper path is not',t=>{
  const root=fixture(t,{'init/AGENTS.md':
    'Run `node .claude/scripts/api/orca/terminal-read.mjs --terminal <h>` to read a screen.\n'+
    'Never `node .claude/scripts/orca-cli.mjs terminal read`.\n'});
  const r=run(root);
  assert.equal(r.status,1);
  assert.deepEqual(rules(r.report),['init/AGENTS.md:2 node-orca-path']);
});

test('telling an agent to load the host contract is red',t=>{
  const root=fixture(t,{'CONTEXT.md':'Before creating any execution agent, load the Orca host contract `modules/host/orca/calls.yaml`.\n'});
  const r=run(root);
  assert.equal(r.status,1);
  assert.deepEqual(rules(r.report),['CONTEXT.md:1 reads-host-contract']);
});

test('the host contract and the owner-chat skills may quote orca commands',t=>{
  const root=fixture(t,{
    'modules/host/orca/index.yaml':"cli: 'orca terminal send --terminal <h> --text \"x\" --enter --json'\n",
    'skills/orca-cli/SKILL.md':'Run `orca worktree create --repo <r> --name <n>`.\n',
    'skills/orchestration/SKILL.md':'Run `orca orchestration worker-start --task <t>`.\n',
    'skills/computer-use/SKILL.md':'Run `orca computer list-windows`.\n',
  });
  assert.equal(run(root).status,0,'the contract is data and those three skills are the owner\'s own tools');
});

test('the allow file exempts one path:line and records why',t=>{
  const files={'CONTEXT.md':'x\nload `modules/host/orca/calls.yaml` first.\n'};
  const red=run(fixture(t,files));
  assert.equal(red.status,1);
  assert.deepEqual(rules(red.report),['CONTEXT.md:2 reads-host-contract']);
  const root=fixture(t,{...files,'scripts/checks/host-boundary.allow':'# header\nCONTEXT.md:2 # lane-E-rewrite-pending\n'});
  const green=run(root);
  assert.equal(green.status,0);
  assert.deepEqual(green.report.allowed,[{where:'CONTEXT.md:2',reason:'lane-E-rewrite-pending'}]);
  // The exemption is one line, not a file-wide pass.
  fs.writeFileSync(path.join(root,'CONTEXT.md'),'load `modules/host/orca/calls.yaml` first.\nload `modules/host/orca/api.yaml` too.\n');
  assert.deepEqual(rules(run(root).report),['CONTEXT.md:1 reads-host-contract']);
});

test('this repo is clean once its allow file is applied',()=>{
  const r=spawnSync(process.execPath,[CHECK],{cwd:ROOT,encoding:'utf8',timeout:60000,windowsHide:true});
  const report=JSON.parse(r.stdout.trim());
  assert.equal(r.status,0,`host boundary violations: ${JSON.stringify(report.violations,null,2)}`);
  for(const {where,reason} of report.allowed)
    assert.ok(reason&&reason!=='no reason given',`${where} is exempted without a reason`);
});
