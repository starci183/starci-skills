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
const ROOT=path.resolve(import.meta.dirname,'..', '..');
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
    'scripts/kernel/cli.mjs':"import {terminalSend} from '../api/orca/terminal-send.mjs';\nterminalSend({terminal:'t'});\n",
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
  const root=fixture(t,{'scripts/agent/quota/probe.mjs':`import { ${O}Run, jsonOf } from '../${O}/lib.mjs';
export const p=()=>${O}Run(['status']);
`});
  const r=run(root);
  assert.equal(r.status,1);
  assert.deepEqual(rules(r.report),['scripts/agent/quota/probe.mjs:1 imports-runner']);
});

test('a wrapper importing its own runner is the sanctioned path',t=>{
  const root=fixture(t,{'scripts/api/orca/worker-start.mjs':"import { orcaCall } from './lib.mjs';\nexport const s=p=>orcaCall('worker-start',p);\n"});
  assert.equal(run(root).status,0);
});

test('raw orca is red, starci orca and prose about orca are clean',t=>{
  const root=fixture(t,{
    'skills/starci/references/workflow-chat.md':'Read the terminal with `orca terminal send --terminal <h> --text "go" --enter --json`.\n',
    'modules/kernel/api.yaml':'read: `starci orca terminal-send --terminal <h> --text go`\n',
    'modules/ops/ops/interface.draw.yaml':"action: 'the kernel never runs the orca call itself — scripts/agent/lib.mjs does'\n",
  });
  const r=run(root);
  assert.equal(r.status,1);
  assert.deepEqual(rules(r.report),['skills/starci/references/workflow-chat.md:1 orca-command'],
    'an English sentence naming orca is not a command line');
});

test('a node path that is not a wrapper is red; wrapper and starci forms are clean',t=>{
  const root=fixture(t,{'init/AGENTS.md':
    'Run `starci orca terminal-read --terminal <h>` to read a screen.\n'+
    'Never `node .claude/scripts/orca-cli.mjs terminal read`.\n'+
    'Use `starci orca terminal-read --terminal <h>` instead.\n'});
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

test('the host contract and the owner-tool references may quote orca commands',t=>{
  const root=fixture(t,{
    'modules/host/orca/index.yaml':"cli: 'orca terminal send --terminal <h> --text \"x\" --enter --json'\n",
    'skills/starci/references/orca-cli.md':'Run `orca worktree create --repo <r> --name <n>`.\n',
    'skills/starci/references/orchestration.md':'Run `orca orchestration worker-start --task <t>`.\n',
    'skills/starci/references/computer-use.md':'Run `orca computer list-windows`.\n',
  });
  assert.equal(run(root).status,0,'the contract is data and those references are the owner\'s own tools');
});

test('public entry, lifecycle references and internal host prompts retain the host boundary',t=>{
  const files = ['skills/starci/SKILL.md', 'skills/starci/references/start-workflow.md',
    'skills/starci/references/assisted-uat.md', 'skills/starci/references/release.md',
    'skills/starci/references/host-startup.md', 'skills/starci/references/host-maintenance.md'];
  const root = fixture(t,Object.fromEntries(files.map(file => [file, `Run \`${O} status --json\`.\n`])));
  const report = run(root);
  assert.equal(report.status,1);
  assert.deepEqual(rules(report.report),files.map(file=>`${file}:1 orca-command`).sort());
});

test('there is no exemption list: a host-contract read is red until it is rewritten',t=>{
  const files={'CONTEXT.md':'x\nload `modules/host/orca/calls.yaml` first.\n',['scripts/checks/' + 'host-boundary.allow']:'CONTEXT.md:2 # not honoured\n'};
  const red=run(fixture(t,files));
  assert.equal(red.status,1);
  assert.deepEqual(rules(red.report),['CONTEXT.md:2 reads-host-contract']);
  assert.equal(red.report.allowed,undefined);
});

test('an agent CLI spawned as a child process is red, through a literal, a constant, a shim, a shell string or a cmd argv',t=>{
  const root=fixture(t,{
    'scripts/work/critic.mjs':[
      "import { spawn, execSync } from 'node:child_process';",
      "const CODEX = 'codex';",
      "const CLAUDE = process.platform === 'win32' ? 'claude.cmd' : 'claude';",
      "spawn(CODEX, ['exec', '-s', 'read-only']);",
      "spawn(CLAUDE, ['-p', '--model', 'm']);",
      "execSync('devin -p \"judge\"');",
    ].join('\n'),
    'engine/runner.cjs':"const cp = require('child_process');\ncp.spawnSync('cmd', ['/c', 'cursor-agent', '-p']);\n",
    'bin/x.mjs':"import * as cp from 'node:child_process';\nconst GEMINI = '/opt/tools/gemini.exe';\ncp.execFile(GEMINI, []);\n",
  });
  const r=run(root);
  assert.equal(r.status,1);
  const hits=r.report.violations.filter(v=>v.rule==='agent-cli-spawn');
  assert.deepEqual(hits.map(v=>v.where).sort(),['bin/x.mjs:3','engine/runner.cjs:2','scripts/work/critic.mjs:4','scripts/work/critic.mjs:5','scripts/work/critic.mjs:6']);
  for(const v of hits)assert.equal(v.code,'AGENT_CLI_SPAWN');
  assert.match(hits.find(v=>v.where==='scripts/work/critic.mjs:4').detail,/agent CLI codex/);
  assert.match(hits.find(v=>v.where==='scripts/work/critic.mjs:5').detail,/agent CLI claude/);
});

test('the headless call api (scripts/api/codex) may spawn codex; the same spawn anywhere else is red',t=>{
  const spawnCodex=["import { spawn } from 'node:child_process';","spawn('codex', ['exec', '--json']);"].join('\n');
  const root=fixture(t,{'scripts/api/codex/exec.mjs':spawnCodex,'scripts/work/imagegen-copy.mjs':spawnCodex});
  const r=run(root);
  assert.equal(r.status,1);
  const hits=r.report.violations.filter(v=>v.rule==='agent-cli-spawn');
  assert.deepEqual(hits.map(v=>v.where),['scripts/work/imagegen-copy.mjs:2']);
});

test('a mention of an agent CLI is not a spawn; git, node and npm spawns pass',t=>{
  const root=fixture(t,{
    'scripts/work/ok.mjs':[
      "import { spawn, spawnSync } from 'node:child_process';",
      "// the critic used to run `claude -p` and `codex exec` here",
      "const why = 'never run claude -p or codex exec: launch through worker-start';",
      "const CLAUDE = 'claude';",
      "console.error(`refused: ${CLAUDE} -p is a headless launch`);",
      "spawnSync('git', ['status']);",
      "spawn(process.execPath, ['scripts/x.mjs', '--agent', 'claude']);",
      "spawnSync('npm', ['run', 'check'], { shell: true });",
      "spawnSync('node', ['-e', 'codex']);",
      "workerStart({ agent: 'codex', model: 'gpt-6.1-sol' });",
    ].join('\n'),
    'scripts/work/local.mjs':"const spawn = (cmd) => cmd;\nspawn('claude');\n",
    'tests/fixture.spec.mjs':"import { spawn } from 'node:child_process';\nspawn('codex', ['exec']);\n",
  });
  const r=run(root);
  assert.equal(r.status,0,JSON.stringify(r.report.violations));
});

test('this repo is clean',()=>{
  const r=spawnSync(process.execPath,[CHECK],{cwd:ROOT,encoding:'utf8',timeout:60000,windowsHide:true});
  const report=JSON.parse(r.stdout.trim());
  assert.equal(r.status,0,`host boundary violations: ${JSON.stringify(report.violations,null,2)}`);
});

test('--help prints the usage, names the one file the check does not scan, and exits clean',()=>{
  const r=spawnSync(process.execPath,[CHECK,'--help'],{cwd:ROOT,encoding:'utf8',timeout:60000,windowsHide:true});
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/^Usage: starci runtime check --only host-boundary/);
  assert.ok(r.stdout.includes('scripts/checks/check-host-boundary.mjs names the patterns it bans and is not scanned.'));
});
