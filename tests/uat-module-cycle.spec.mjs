import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

// starci-next inc-f681bbed166f: scripts/uat/uat-slots.mjs ran `await import('./assisted-runner.mjs')` under its
// own top-level await (`run`), while assisted-runner.mjs statically imports uat-slots.mjs. That module graph
// never settles: Node printed "Detected unsettled top-level await" and exited 13 before the held command ran.
// launchFor now lives in the leaf scripts/uat/launch.mjs, which both import.
const UAT=fileURLToPath(new URL('../scripts/uat/',import.meta.url));
const SLOTS=path.join(UAT,'uat-slots.mjs'),RUNNER=path.join(UAT,'assisted-runner.mjs'),LAUNCH=path.join(UAT,'launch.mjs');
const LIMIT_MS=20000;
const tempSlots=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-uat-cycle-spec-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return {...process.env,STARCI_UAT_SLOTS_DIR:dir};
};
// Run node with args; resolve {code, stdout, stderr, timedOut} — a hang is killed at LIMIT_MS, never waited out.
const runNode=(args,env=process.env)=>new Promise(resolve=>{
  const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='',timedOut=false;
  child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
  const timer=setTimeout(()=>{timedOut=true;child.kill();},LIMIT_MS);
  child.once('exit',code=>{clearTimeout(timer);resolve({code,stdout,stderr,timedOut});});
});
const importBoth=(first,second)=>runNode(['--input-type=module','-e',
  `await import(${JSON.stringify(pathToFileURL(first).href)});
await import(${JSON.stringify(pathToFileURL(second).href)});
console.log('both-loaded');`]);

for(const [label,first,second] of [['uat-slots then assisted-runner',SLOTS,RUNNER],['assisted-runner then uat-slots',RUNNER,SLOTS]]){
  test(`importing ${label} settles within ${LIMIT_MS} ms`,async()=>{
    const result=await importBoth(first,second);
    assert.equal(result.timedOut,false,`the import hung: ${result.stderr}`);
    assert.doesNotMatch(result.stderr,/unsettled top-level await/i);
    assert.equal(result.code,0,result.stderr);
    assert.match(result.stdout,/both-loaded/);
  });
}

test('`uat-slots.mjs run -- <command>` (its own top-level await) runs the held command and passes its exit code',async t=>{
  const env=tempSlots(t);
  const ok=await runNode([SLOTS,'run','--','node','-e',"console.log('inner-ran')"],env);
  assert.equal(ok.timedOut,false,`run hung: ${ok.stderr}`);
  assert.doesNotMatch(ok.stderr,/unsettled top-level await/i);
  assert.match(ok.stdout,/inner-ran/);
  assert.equal(ok.code,0,ok.stderr);
  const failing=await runNode([SLOTS,'run','--','node','-e','process.exit(7)'],env);
  assert.equal(failing.timedOut,false);
  assert.equal(failing.code,7);
});

test('uat-slots.mjs never imports assisted-runner.mjs; launch.mjs is a leaf with no local imports',()=>{
  const slots=fs.readFileSync(SLOTS,'utf8').split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(slots,/import\s*\(?\s*['"][^'"]*assisted-runner/);
  assert.doesNotMatch(fs.readFileSync(LAUNCH,'utf8'),/from\s+['"]\.{1,2}\//);
});

test('assisted-runner.mjs still exports the same launchFor',async()=>{
  const runner=await import(new URL('../scripts/uat/assisted-runner.mjs',import.meta.url).href);
  const launch=await import(new URL('../scripts/uat/launch.mjs',import.meta.url).href);
  assert.equal(runner.launchFor,launch.launchFor);
});
