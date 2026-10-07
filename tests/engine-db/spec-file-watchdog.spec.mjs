import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// A spec file that leaks a live process must not stall the suite: the file-watchdog preload ends a file's process
// once it outlives its wall-clock limit, and never touches a process that finishes on its own or the runner itself.
const PRELOAD=pathToFileURL(path.resolve(import.meta.dirname,'..','setup','file-watchdog.mjs')).href;
const run=(code,env)=>spawnSync(process.execPath,['--import',PRELOAD,'-e',code],{encoding:'utf8',timeout:30000,env:{...process.env,NODE_TEST_CONTEXT:undefined,...env}});

test('a spec file process that stays alive past the limit is ended and named',()=>{
  const r=run('setInterval(()=>{},1000)',{NODE_TEST_CONTEXT:'child-v8',STARCI_SPEC_FILE_TIMEOUT_MS:'500'});
  assert.equal(r.error,undefined,'it ended on its own, not by the outer timeout');
  assert.equal(r.status,1);
  assert.match(r.stderr,/spec file watchdog: .* still running after 1s/);
});

test('a spec file process that finishes inside the limit exits cleanly (the timer is unref\'d)',()=>{
  const r=run('0',{NODE_TEST_CONTEXT:'child-v8',STARCI_SPEC_FILE_TIMEOUT_MS:'60000'});
  assert.equal(r.status,0,r.stderr);
});

test('the runner process (no NODE_TEST_CONTEXT) is never bounded',()=>{
  const r=run('setTimeout(()=>{},1500)',{STARCI_SPEC_FILE_TIMEOUT_MS:'200'});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.stderr,'');
});
