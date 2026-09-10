import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
const root=path.resolve(import.meta.dirname,'..');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-build-'));t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-build-'));fs.rmSync(dir,{recursive:true,force:true});});for(const p of ['config.example.yaml','cli','ops','workflows','profiles','knowledge','contracts','specifications','examples','scripts','core','schemas'])fs.cpSync(path.join(root,p),path.join(dir,p),{recursive:true});return dir;}
const run=dir=>spawnSync(process.execPath,['scripts/ensure-build.mjs'],{cwd:dir,encoding:'utf8'});
test('entry rebuilds absent, corrupt and stale JSON, and reuses a current build',t=>{const dir=fixture(t);let r=run(dir);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).rebuilt,true);r=run(dir);assert.equal(JSON.parse(r.stdout).rebuilt,false);const op=path.join(dir,'ops/task.execute/operator.yaml');const source=parseYaml(fs.readFileSync(op,'utf8'));source.goal.en+=' Synthetic changed request.';fs.writeFileSync(op,stringifyYaml(source));r=run(dir);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).rebuilt,true);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'.dist/ops/task.execute/operator.json'))).goal.en,source.goal.en);fs.writeFileSync(path.join(dir,'.dist/workflows/catalog.json'),'corrupt');r=run(dir);assert.equal(JSON.parse(r.stdout).rebuilt,true);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'.dist/workflows/catalog.json'))).fallback,'none');});
test('invalid source fails instead of claiming the old build is ready',t=>{const dir=fixture(t);assert.equal(run(dir).status,0);fs.writeFileSync(path.join(dir,'ops/task.execute/operator.yaml'),'{broken');const r=run(dir);assert.notEqual(r.status,0);assert.equal(r.stdout.includes('"ok":true'),false);});
test('compiled dist is JSON contracts plus mirrored runtime modules; entry requires freshness before selection',()=>{
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  const modules=new Set(fs.readFileSync(path.join(root,'scripts/runtime-modules.txt'),'utf8').split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')));
  for(const file of walk(path.join(root,'.dist'))){
    const relative=path.relative(path.join(root,'.dist'),file).replaceAll('\\','/');
    if(relative.endsWith('.mjs')){assert.ok(modules.has(relative),relative);continue;}
    if(/^(docs|examples)\//.test(relative)&&!relative.endsWith('.json'))continue;
    assert.ok(relative.endsWith('.json'),relative);
    JSON.parse(fs.readFileSync(file));
  }
  const skill=fs.readFileSync(path.join(root,'SKILL.md'),'utf8');
  assert.ok(skill.indexOf('ensure-build.mjs')<skill.indexOf('.dist/workflows/catalog.json'));
  assert.equal(fs.existsSync(path.join(root,'v3')),false);
  assert.equal(fs.existsSync(path.join(root,'legacy')),false);
});

test('invalid typed operator policy cannot pass build',t=>{const dir=fixture(t);assert.equal(run(dir).status,0);const file=path.join(dir,'ops/uat.verify/operator.yaml');const op=parseYaml(fs.readFileSync(file,'utf8'));op.uatPolicy.appearanceScoring=true;fs.writeFileSync(file,stringifyYaml(op));assert.notEqual(run(dir).status,0);});
test('ensure-build CLI never reports deferred knowledge success',t=>{const dir=fixture(t);const r=run(dir);assert.equal(r.status,0,r.stderr);assert.equal(/Knowledge compile deferred/i.test(r.stderr+r.stdout),false);assert.equal(JSON.parse(r.stdout).ok,true);assert.equal(Object.hasOwn(JSON.parse(r.stdout).knowledge||{},'deferred'),false);});
