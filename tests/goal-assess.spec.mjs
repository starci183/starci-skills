import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=path.resolve(import.meta.dirname,'..');
const ASSESS=path.join(ROOT,'scripts','goal','assess.mjs');
// Lane m13: assess.mjs is the bounded cold-scan that feeds define-goal --plan.
// It must map findings onto quality-bar signals and must degrade — never throw —
// on a missing repo.

const run=(...args)=>spawnSync(process.execPath,[ASSESS,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {dir(){const d=fs.mkdtempSync(path.join(os.tmpdir(),'starci-assess-'));dirs.push(d);return d;}};
};

test('a synthesized repo surfaces lint/test signals in the JSON scan',t=>{
  const repo=fixture(t).dir();
  fs.mkdirSync(path.join(repo,'src'),{recursive:true});
  fs.writeFileSync(path.join(repo,'package.json'),JSON.stringify({name:'assess-fixture',scripts:{build:'tsc'}}));
  fs.writeFileSync(path.join(repo,'src','a.spec.ts'),"import test from 'node:test';\ntest('x',()=>{});\n");
  // One file carrying both relaxations the assessor greps for.
  fs.writeFileSync(path.join(repo,'src','dirty.ts'),'// eslint-disable-next-line no-explicit-any\nexport const x: any = 1;\n');
  fs.writeFileSync(path.join(repo,'src','clean.ts'),'export const y: number = 2;\n');

  const r=run('--repo',repo,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON, got: ${r.stdout}`);
  assert.equal(body.exists,true);
  assert.ok(body.lint.eslintDisableFiles>=1,'the eslint-disable file was not counted');
  assert.ok(body.lint.anyLeakFiles>=1,"the ': any' leak was not counted");
  assert.ok(body.testInfra.specFiles>=1,'the spec file was not counted');
  const signals=(body.signals??[]).join('\n');
  assert.match(signals,/static-correctness/,'lint findings must surface as static-correctness signals');
  assert.match(signals,/eslint-disable/);
  assert.match(signals,/any/);
});

test('a missing repo degrades to exists:false + a signal, exit 0',t=>{
  const repo=path.join(fixture(t).dir(),'does-not-exist');
  const r=run('--repo',repo,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body,`expected JSON, got: ${r.stdout}`);
  assert.equal(body.exists,false);
  assert.ok((body.signals??[]).some(s=>/does not exist/i.test(s)),`expected a missing-path signal, got: ${r.stdout}`);
});
