import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve(import.meta.dirname,'..');
const PACK=path.join(ROOT,'scripts','context','pack.mjs');
// Context assembly is a function, not the op agent's discretion —
// `pack.mjs --op <id> --json` returns
// {mandatory:[{path,why}], ownedFiles, truncated, missing} so the dispatch
// prompt can enumerate the real read list instead of 'read CONTEXT.md'.
const run=(...args)=>spawnSync(process.execPath,[PACK,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const norm=p=>String(p).replaceAll('\\','/');
const mandatoryPaths=body=>(body?.context?.mandatory??body?.mandatory??[]).map(e=>norm(typeof e==='string'?e:e?.path));

test('--op code.refactor --json emits the mandatory reads in load order',t=>{
  const r=run('--op','code.refactor','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON stdout, got: ${r.stdout}`);
  const paths=mandatoryPaths(body);
  assert.ok(paths.length>0,'context.mandatory is empty — the op would choose its own context again');
  assert.ok(paths.some(p=>/CONTEXT\.md$/i.test(p)),`mandatory reads must start at CONTEXT.md, got: ${paths.join(', ')}`);
  assert.ok(paths.some(p=>/ops\/code\.refactor\.yaml$/.test(p)),`mandatory reads must carry the op brief, got: ${paths.join(', ')}`);
  assert.ok(paths.some(p=>/verdict-contract\.yaml$/.test(p)),`mandatory reads must carry the verdict contract, got: ${paths.join(', ')}`);
});

test('missing --state degrades: exit 0, mandatory reads still resolve',t=>{
  const fx=fs.mkdtempSync(path.join(os.tmpdir(),'starci-pack-'));
  t.after(()=>fs.rmSync(fx,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  // A --state dir that was never created is the cold-checkout case — no .starciwork yet.
  // (--repo is the runtime root, not the target repo — leave it defaulted.)
  for(const args of [
    ['--op','code.refactor','--json'],
    ['--op','code.refactor','--state',path.join(fx,'absent','.starciwork'),'--json'],
  ]){
    const r=run(...args);
    assert.equal(r.status,0,`pack ${args.join(' ')} must not fail on missing state: ${r.stderr}`);
    const body=out(r);
    assert.ok(body&&mandatoryPaths(body).length>0,'mandatory reads must resolve even with no workflow state');
  }
});
