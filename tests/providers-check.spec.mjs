import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';

// scripts/checks/providers.mjs is the read-only gate before the first effect.
// Static by default; --live also compares every modules/host/orca/calls.yaml
// entry against the live `orca agent-context --json` signature.
const ROOT=path.resolve(import.meta.dirname,'..');
const CHECK=path.join(ROOT,'scripts','checks','providers.mjs');

const run=(args=[],env={})=>{
  const r=spawnSync(process.execPath,[CHECK,...args],
    {cwd:ROOT,encoding:'utf8',timeout:60000,windowsHide:true,env:{...process.env,...env}});
  return {status:r.status,report:JSON.parse(r.stdout.trim()),stderr:r.stderr};
};

// A copy of the real tree whose calls.yaml a case may bend. Only the documents
// the check reads are copied — this is a contract fixture, not a checkout.
const fixtureRoot=(t,mutate)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-providers-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const rel of [['modules','models','agents'],['modules','models','profiles'],['modules','host']])
    fs.cpSync(path.join(ROOT,...rel),path.join(root,...rel),{recursive:true});
  fs.copyFileSync(path.join(ROOT,'modules','models','registry.yaml'),path.join(root,'modules','models','registry.yaml'));
  const calls=path.join(root,'modules','host','orca','calls.yaml');
  fs.writeFileSync(calls,mutate(fs.readFileSync(calls,'utf8')));
  return root;
};

const stub=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-providers-orca-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'fake-orca.mjs');fs.writeFileSync(file,FAKE_ORCA);
  return {STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([file])};
};

test('the static check passes on this tree and runs no process',()=>{
  const r=run();
  assert.equal(r.status,0,JSON.stringify(r.report.errors));
  assert.equal(r.report.ok,true);
  assert.equal(r.report.live,undefined,'without --live the check never reaches the binary');
});

test('a calls.yaml flag the entry does not declare fails the static check',t=>{
  // --dispatch is required by worker-stop; drop it from flags and the runner
  // could never build the argv the contract says it must.
  const root=fixtureRoot(t,text=>text.replace(`  worker-stop:
    command: orchestration worker-stop
    kind: mutation
    timeoutMs: 60000
    flags: [dispatch]`,`  worker-stop:
    command: orchestration worker-stop
    kind: mutation
    timeoutMs: 60000
    flags: []`));
  const r=run(['--root',root]);
  assert.equal(r.status,1,'an undeclared flag must fail the check');
  assert.ok(r.report.errors.some(e=>/calls\.worker-stop requires --dispatch/.test(e)),
    `expected the worker-stop flag error, got ${JSON.stringify(r.report.errors)}`);
});

test('a classify block that can fall off its end fails the static check',t=>{
  const root=fixtureRoot(t,text=>text.replace(`      - when: {}
        outcome: failed
        effectState: none
  check:`,`  check:`));
  const r=run(['--root',root]);
  assert.equal(r.status,1);
  assert.ok(r.report.errors.some(e=>/calls\.worker-release classify must end with an unconditional rule/.test(e)),
    JSON.stringify(r.report.errors));
});

test('--live compares every calls.yaml entry against the agent-context listing',t=>{
  const r=run(['--live'],stub(t));
  assert.equal(r.status,0,JSON.stringify(r.report));
  assert.equal(r.report.live.ok,true);
  assert.deepEqual(r.report.live.drift,[]);
});

test('--live exits 1 with the diff when the binary is missing a command or a flag',t=>{
  const env={...stub(t),
    STARCI_FAKE_ORCA_OMIT_COMMAND:'orchestration worker-stop',
    STARCI_FAKE_ORCA_OMIT_FLAG:'orchestration worker-start:retry-of,orchestration worker-start:effort'};
  const r=run(['--live'],env);
  assert.equal(r.status,1,'drift against the live binary must be red');
  assert.equal(r.report.ok,false);
  const byCall=Object.fromEntries(r.report.live.drift.map(d=>[d.call,d]));
  assert.equal(byCall['worker-stop']?.missingCommand,true);
  assert.deepEqual(byCall['worker-start']?.missingFlags,['effort','retry-of']);
  assert.equal(byCall['worker-start']?.missingCommand,false);
  assert.equal(Object.keys(byCall).length,2,`only the drifted calls are reported: ${JSON.stringify(r.report.live.drift)}`);
});

test('--live is red, not silent, when agent-context cannot be read at all',()=>{
  const r=run(['--live'],{STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify(['-e','process.exit(1)'])});
  assert.equal(r.status,1);
  assert.match(r.report.live.drift[0].reason,/no command listing/);
});
