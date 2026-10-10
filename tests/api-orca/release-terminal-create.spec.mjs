// Outer-host stand-ins exercise the actual typed adapter. No fixture response is live release evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');
const factory = pathToFileURL(path.join(ROOT, 'scripts/api/orca/terminal-create.mjs')).href;
const STUB = `import fs from 'node:fs';
const argv=process.argv.slice(2), verb=argv.slice(0,2).join(' ');
fs.appendFileSync(process.env.RELEASE_TEST_LOG,JSON.stringify(argv)+'\\n');
if(argv[0]==='agent-context') console.log(JSON.stringify({ok:true,schemaVersion:1,commandCount:1,
  commands:[{command:'terminal create',flags:['--worktree','--shell','--title','--json']}]}));
else if(verb==='worktree list') console.log(JSON.stringify({ok:true,result:{worktrees:
  process.env.RELEASE_TEST_INVENTORY==='unreadable'?undefined:
  process.env.RELEASE_TEST_INVENTORY==='absent'?[]:
  process.env.RELEASE_TEST_INVENTORY==='duplicate'?[{id:'fixture-a',path:process.env.RELEASE_TEST_RUNTIME},{id:'fixture-b',path:process.env.RELEASE_TEST_RUNTIME}]:
  [{id:'fixture-source',path:process.env.RELEASE_TEST_RUNTIME}]}}));
else if(verb==='terminal create') {
  if(process.env.RELEASE_TEST_CREATE==='receipt-loss') process.stdout.write('receipt was lost');
  else console.log(JSON.stringify({ok:true,result:{terminal:{handle:'fixture-only',connected:true}}}));
} else throw new Error('unexpected fixture command: '+verb);
`;

function fixture(t, { inventory='registered', mode='committed' }={}) {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'starci-release-create-'));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true,maxRetries:10,retryDelay:25}));
  fs.symlinkSync(ROOT,path.join(base,'.claude'),process.platform==='win32'?'junction':'dir');
  const stub=path.join(base,'host.mjs'), log=path.join(base,'calls.jsonl'); fs.writeFileSync(stub,STUB);
  return {base,log,env:{...process.env,STARCI_SOURCE_ROOT:base,STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),RELEASE_TEST_LOG:log,RELEASE_TEST_RUNTIME:ROOT,
    RELEASE_TEST_INVENTORY:inventory,RELEASE_TEST_CREATE:mode}};
}
function run(fx, payload='') {
  const program=`import {terminalCreate} from ${JSON.stringify(factory)};
  try { console.log(JSON.stringify({value:terminalCreate(${payload})})); }
  catch(error) { console.log(JSON.stringify({error:error.message})); }`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',program],{env:fx.env,encoding:'utf8',windowsHide:true,timeout:60000});
  assert.equal(result.error,undefined); assert.equal(result.status,0,result.stderr);
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
}
const calls=fx=>fs.existsSync(fx.log)?fs.readFileSync(fx.log,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse):[];

test('the actual adapter passes only the native registered Source worktree, fixed PowerShell shell/title and no command or environment',t=>{
  const fx=fixture(t), result=run(fx).value;
  assert.equal(result.outcome,'ok'); assert.equal(result.effectState,'committed');
  const created=calls(fx).filter(argv=>argv.slice(0,2).join(' ')==='terminal create');
  assert.deepEqual(created,[['terminal','create','--worktree','fixture-source','--shell','powershell.exe','--title','[Release] StarCi runtime','--json']]);
});

test('caller payload and absent/ambiguous registered Source worktrees cause zero terminal creation',t=>{
  const payload=fixture(t); assert.match(run(payload,"{shell:'cmd.exe',command:'claude -p x',environment:'other'}").error,/accepts no input/);
  assert.deepEqual(calls(payload),[]);
  for(const inventory of ['absent','duplicate']) {
    const fx=fixture(t,{inventory}), result=run(fx).value;
    assert.equal(result.effectState,'none'); assert.equal(result.issued,false);
    assert.equal(calls(fx).filter(argv=>argv.slice(0,2).join(' ')==='terminal create').length,0);
  }
});

test('receipt loss is actual typed unknown custody and issues the create exactly once with no replay/request lookup',t=>{
  const fx=fixture(t,{mode:'receipt-loss'}), result=run(fx).value;
  assert.equal(result.outcome,'unknown'); assert.equal(result.effectState,'unknown');
  const issued=calls(fx);
  assert.equal(issued.filter(argv=>argv.slice(0,2).join(' ')==='terminal create').length,1);
  assert.equal(issued.filter(argv=>argv.slice(0,2).join(' ')==='orchestration request-show').length,0);
});
