import test, {before, after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
const root=path.resolve(import.meta.dirname,'..');
const FIXTURE_DIRS=['config.example.yaml','cli','ops','workflows','model','kernel','hosts','models','providers','approvals','execution','knowledge','contracts','specifications','examples','scripts','core','schemas'];
function mktemp(){return fs.mkdtempSync(path.join(os.tmpdir(),'starci-build-'));}
function assertOwnTemp(dir){assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-build-'));}
function fixture(t){const dir=mktemp();t.after(()=>{assertOwnTemp(dir);fs.rmSync(dir,{recursive:true,force:true});});for(const p of FIXTURE_DIRS)fs.cpSync(path.join(root,p),path.join(dir,p),{recursive:true});return dir;}
const run=dir=>spawnSync(process.execPath,['scripts/ensure-build.mjs'],{cwd:dir,encoding:'utf8'});

// Shared golden fixture: one real cold build (source -> fresh .dist), built once for the whole
// file. Staleness is content-hash based (see build-workflows.mjs), so copying this directory
// elsewhere still reads as fresh — tests that only need "a valid build already in place" as their
// starting state copy this instead of paying for another full rebuild, and the CLI output from
// this very build doubles as evidence for the "no deferred knowledge" assertion below.
let golden, goldenBuild;
before(()=>{
  golden=mktemp();
  for(const p of FIXTURE_DIRS)fs.cpSync(path.join(root,p),path.join(golden,p),{recursive:true});
  goldenBuild=run(golden);
  assert.equal(goldenBuild.status,0,goldenBuild.stderr);
  assert.equal(JSON.parse(goldenBuild.stdout).rebuilt,true);
});
after(()=>{fs.rmSync(golden,{recursive:true,force:true});});
function fixtureFromGolden(t){const dir=mktemp();t.after(()=>{assertOwnTemp(dir);fs.rmSync(dir,{recursive:true,force:true});});fs.cpSync(golden,dir,{recursive:true});return dir;}

test('entry rebuilds absent, corrupt and stale JSON, and reuses a current build',t=>{
  t.diagnostic('runs 4 real ensure-build invocations on purpose: absent, cached, stale-source, corrupt-json must each be proven against the real pipeline, not mocked');
  const dir=fixture(t);let r=run(dir);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).rebuilt,true);r=run(dir);assert.equal(JSON.parse(r.stdout).rebuilt,false);const op=path.join(dir,'ops/task.execute/operator.yaml');const source=parseYaml(fs.readFileSync(op,'utf8'));source.goal.en+=' Synthetic changed request.';fs.writeFileSync(op,stringifyYaml(source));r=run(dir);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).rebuilt,true);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'.dist/ops/task.execute/operator.json'))).goal.en,source.goal.en);fs.writeFileSync(path.join(dir,'.dist/workflows/catalog.json'),'corrupt');r=run(dir);assert.equal(JSON.parse(r.stdout).rebuilt,true);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'.dist/workflows/catalog.json'))).fallback,'none');
});
test('invalid source fails instead of claiming the old build is ready',t=>{const dir=fixtureFromGolden(t);fs.writeFileSync(path.join(dir,'ops/task.execute/operator.yaml'),'{broken');const r=run(dir);assert.notEqual(r.status,0);assert.equal(r.stdout.includes('"ok":true'),false);});
test('compiled dist is JSON contracts plus mirrored runtime modules; entry requires freshness before selection',()=>{
  const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  const modules=new Set(fs.readFileSync(path.join(root,'scripts/runtime-modules.txt'),'utf8').split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')));
  for(const file of walk(path.join(root,'.dist'))){
    const relative=path.relative(path.join(root,'.dist'),file).replaceAll('\\','/');
    if(relative.endsWith('.mjs')&&!relative.startsWith('examples/todo-app-backend/')){assert.ok(modules.has(relative),relative);continue;}
    if(/^(docs|examples)\//.test(relative)&&!relative.endsWith('.json'))continue;
    assert.ok(relative.endsWith('.json'),relative);
    JSON.parse(fs.readFileSync(file));
  }
  const skill=fs.readFileSync(path.join(root,'SKILL.md'),'utf8');
  assert.ok(skill.indexOf('ensure-build.mjs')<skill.indexOf('.dist/workflows/catalog.json'));
  assert.equal(fs.existsSync(path.join(root,'v3')),false);
  assert.equal(fs.existsSync(path.join(root,'legacy')),false);
});

test('fresh compiled architecture CLI contains its complete internal module closure',t=>{
  const target=mktemp();t.after(()=>{assertOwnTemp(target);fs.rmSync(target,{recursive:true,force:true});});
  fs.mkdirSync(path.join(target,'src/modules'),{recursive:true});fs.mkdirSync(path.join(target,'node_modules'),{recursive:true});
  fs.symlinkSync(path.join(root,'node_modules/typescript'),path.join(target,'node_modules/typescript'),'junction');
  fs.writeFileSync(path.join(target,'package.json'),'\u007b"private":true\u007d\n');
  fs.writeFileSync(path.join(target,'architecture.json'),'\u007b"schema":"starci/architecture-config@1","kinds":["backend"],"tsconfig":"tsconfig.json"\u007d\n');
  fs.writeFileSync(path.join(target,'tsconfig.json'),'\u007b"compilerOptions":\u007b"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","noEmit":true\u007d,"include":["src/**/*.ts"]\u007d\n');
  fs.writeFileSync(path.join(target,'src/modules/value.ts'),'export const value=1;\n');
  const result=spawnSync(process.execPath,[path.join(golden,'.dist/cli/main.mjs'),'architecture','check',target,'--config','architecture.json'],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr||result.stdout);const report=JSON.parse(result.stdout);assert.equal(report.ok,true);assert.deepEqual(report.coverage.sourceFiles,['src/modules/value.ts']);
});

test('invalid typed operator policy cannot pass build',t=>{const dir=fixtureFromGolden(t);const file=path.join(dir,'ops/uat.verify/operator.yaml');const op=parseYaml(fs.readFileSync(file,'utf8'));op.uatPolicy.appearanceScoring=true;fs.writeFileSync(file,stringifyYaml(op));assert.notEqual(run(dir).status,0);});
test('ensure-build CLI never reports deferred knowledge success',()=>{
  // Reuses the golden fixture's own cold-build invocation above instead of spawning a second
  // identical full build just to inspect its stdout/stderr for the same scenario.
  assert.equal(/Knowledge compile deferred/i.test(goldenBuild.stderr+goldenBuild.stdout),false);
  assert.equal(JSON.parse(goldenBuild.stdout).ok,true);
  assert.equal(Object.hasOwn(JSON.parse(goldenBuild.stdout).knowledge||{},'deferred'),false);
});
