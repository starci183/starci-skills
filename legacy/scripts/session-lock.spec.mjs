import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { replaceFile, replaceFileSync } from './session-lock.mjs';

test('Windows atomic replacement retries transient sharing denial and preserves both files on persistent denial', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'starci-atomic-replace-'));
  const temp = path.join(dir, 'state.tmp'); const file = path.join(dir, 'state.json');
  const denied = () => Object.assign(new Error('sharing violation'), { code: 'EPERM' });
  try {
    await writeFile(file, 'original'); await writeFile(temp, 'next');
    let calls = 0; const pauses = [];
    await replaceFile(temp, file, { platform: 'win32', pause: async ms => pauses.push(ms), renameFile: async (...args) => {
      calls += 1;
      if (calls < 3) { assert.equal(await readFile(file, 'utf8'), 'original'); assert.equal(await readFile(temp, 'utf8'), 'next'); throw denied(); }
      return rename(...args);
    } });
    assert.equal(await readFile(file, 'utf8'), 'next'); assert.equal(calls, 3); assert.deepEqual(pauses, [25, 25]);
    await writeFile(temp, 'later'); calls = 0;
    await assert.rejects(() => replaceFile(temp, file, { platform: 'win32', pause: async () => {}, renameFile: async () => { calls += 1; throw denied(); } }), { code: 'EPERM' });
    assert.equal(calls, 20); assert.equal(await readFile(file, 'utf8'), 'next'); assert.equal(await readFile(temp, 'utf8'), 'later');
    calls = 0;
    await assert.rejects(() => replaceFile(temp, file, { platform: 'linux', renameFile: async () => { calls += 1; throw denied(); } }), { code: 'EPERM' });
    assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('separate stale-owner contenders wait for recovery serialization and never delete a fresh live lock', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'starci-dead-lock-'));
  const lock = path.join(dir, 'owner.lock'), recovery = `${lock}.recovery`;
  const released = path.join(dir, 'release'), sentinel = path.join(dir, 'inside');
  const module = pathToFileURL(path.resolve(import.meta.dirname, 'session-lock.mjs')).href;
  const source = `import {withOwnedFileLock} from ${JSON.stringify(module)};
    import {existsSync,writeFileSync,unlinkSync} from 'node:fs';
    const [lock,sentinel,released,id]=process.argv.slice(2);
    const pause=ms=>new Promise(r=>setTimeout(r,ms));
    process.stdout.write('ready\\n');
    await withOwnedFileLock(lock,async()=>{
      if(existsSync(sentinel)) throw Error('two simultaneous owners');
      writeFileSync(sentinel,id);process.stdout.write('entered\\n');
      while(!existsSync(released)) await pause(10);
      await pause(40);unlinkSync(sentinel);
    });`;
  const file = path.join(dir, 'contender.mjs');
  const processes = [];
  try {
    await writeFile(file, source);
    // A negative PID cannot be a live owner. The held recovery marker makes the old algorithm's
    // unsafe removal deterministic: it would enter while another recovery still owns the guard.
    await writeFile(lock, JSON.stringify({pid:-1,token:'dead'}));
    await writeFile(recovery, JSON.stringify({pid:process.pid}));
    for (let id=0;id<2;id++) {
      const child = spawn(process.execPath,[file,lock,sentinel,released,String(id)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
      const state={child,text:'',errors:'',exit:null};
      state.done=new Promise(resolve=>child.on('exit',code=>{state.exit=code;resolve();}));
      child.stdout.on('data',chunk=>{state.text+=chunk;});child.stderr.on('data',chunk=>{state.errors+=chunk;});processes.push(state);
    }
    const until=async condition=>{const end=Date.now()+3500;while(!condition()){assert.ok(Date.now()<end,'child lock operation timed out');await new Promise(r=>setTimeout(r,10));}};
    await until(()=>processes.every(item=>item.text.includes('ready')));
    await new Promise(r=>setTimeout(r,100));
    assert.ok(processes.every(item=>!item.text.includes('entered')),'a contender bypassed the existing recovery guard');
    await rm(recovery);
    await until(()=>processes.some(item=>item.text.includes('entered')));
    await new Promise(r=>setTimeout(r,100));
    assert.equal(processes.filter(item=>item.text.includes('entered')).length,1,'the second stale reaper deleted the first new owner');
    await writeFile(released,'release');
    await Promise.all(processes.map(item=>item.done));
    for(const item of processes){assert.equal(item.exit,0,item.errors);assert.ok(item.text.includes('entered'));}
    assert.ok(!existsSync(lock));assert.ok(!existsSync(recovery));
  } finally {
    for(const item of processes)if(item.exit===null)item.child.kill();
    await Promise.all(processes.map(item=>item.done));
    if(!path.resolve(dir).startsWith(path.resolve(tmpdir())+path.sep))throw Error('unsafe lock fixture cleanup');
    await rm(dir,{recursive:true,force:true});
  }
});

test('synchronous replacement shares bounded Windows policy and preserves old bytes without unlinking', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'starci-sync-replace-'));
  const file = path.join(dir, 'index.json'), temp = path.join(dir, 'index.tmp');
  try {
    for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
      writeFileSync(file, 'old'); writeFileSync(temp, 'new'); let calls = 0; const pauses = [];
      replaceFileSync(temp, file, { platform: 'win32', pause: ms => pauses.push(ms), renameFile: (...args) => {
        calls++; assert.equal(readFileSync(file, 'utf8'), 'old');
        if (calls < 3) throw Object.assign(new Error('sharing denial'), { code });
        return renameSync(...args);
      } });
      assert.equal(calls, 3); assert.deepEqual(pauses, [25, 25]); assert.equal(readFileSync(file, 'utf8'), 'new');
    }
    writeFileSync(temp, 'later'); let calls = 0;
    const denied = () => { calls++; throw Object.assign(new Error('persistent'), { code: 'EPERM' }); };
    assert.throws(() => replaceFileSync(temp, file, { platform: 'win32', pause: () => {}, renameFile: denied }), { code: 'EPERM' });
    assert.equal(calls, 20); assert.equal(readFileSync(file, 'utf8'), 'new'); assert.equal(readFileSync(temp, 'utf8'), 'later');
    calls = 0;
    assert.throws(() => replaceFileSync(temp, file, { platform: 'linux', renameFile: denied }), { code: 'EPERM' });
    assert.equal(calls, 1);
    calls = 0;
    assert.throws(() => replaceFileSync(temp, file, { platform: 'win32', renameFile: () => { calls++; throw Object.assign(new Error('bad path'), { code: 'ENOENT' }); } }), { code: 'ENOENT' });
    assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});