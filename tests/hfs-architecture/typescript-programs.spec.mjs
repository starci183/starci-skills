import assert from 'node:assert/strict';
import { hfsReadme } from '../helpers/hfs-tree-fixture.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createTypeScriptProgram,typeScriptProgramRun} from '../../scripts/hfs/typescript-programs.mjs';
import {loadArchitectureConfig} from '../../scripts/hfs/architecture/config.mjs';
import {buildTypeScriptContext} from '../../scripts/hfs/architecture/typescript.mjs';
import { appDeclaration } from '../helpers/hfs-arch-fixture.mjs';

/** The side folder of a fresh temp app: the root a side's code-pattern checks run on; the app root holds package.json and hfs.json. */
function sideFolder(prefix, side) {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), prefix)), side);
  fs.mkdirSync(root, { recursive: true });
  return root;
}


const require=createRequire(import.meta.url);
const ts=require('typescript');
const digest='a'.repeat(64);

function project(t){
  const root = sideFolder('starci-ts-programs-', 'fe');
  t.after(()=>{
    assert.equal(path.dirname(path.dirname(path.resolve(root))),path.resolve(os.tmpdir()));
    assert.ok(path.basename(path.dirname(root)).startsWith('starci-ts-programs-'));
    fs.rmSync(path.dirname(root), { recursive: true, force: true });
  });
  const write=(relative,value)=>{const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value));};
  return {root,write};
}

test('a program run builds one program per compiler input and a released or absent run builds fresh ones',t=>{
  const {root,write}=project(t);write('src/a.ts','export const a=1;');
  const input=(options={strict:true,noEmit:true})=>({rootNames:[path.join(root,'src/a.ts')],options,projectReferences:undefined});
  const outside=[createTypeScriptProgram(ts,input()),createTypeScriptProgram(ts,input())];
  assert.notEqual(outside[0],outside[1]);
  const programs=typeScriptProgramRun();
  const first=programs.run(()=>createTypeScriptProgram(ts,input()));
  assert.equal(programs.run(()=>createTypeScriptProgram(ts,input({noEmit:true,strict:true}))),first);
  assert.notEqual(programs.run(()=>createTypeScriptProgram(ts,input({strict:false,noEmit:true}))),first);
  assert.notEqual(createTypeScriptProgram(ts,input()),first);
  programs.release();
  assert.notEqual(programs.run(()=>createTypeScriptProgram(ts,input())),first);
});

test('a run shares programs across async work and another run never sees them',async()=>{
  const programs=typeScriptProgramRun(),other=typeScriptProgramRun();
  const input={rootNames:[],options:{noEmit:true},projectReferences:undefined};
  const first=await programs.run(async()=>{await new Promise(resolve=>setImmediate(resolve));return createTypeScriptProgram(ts,input);});
  assert.equal(await programs.run(async()=>createTypeScriptProgram(ts,input)),first);
  assert.notEqual(other.run(()=>createTypeScriptProgram(ts,input)),first);
});

test('a run builds the architecture context once and hands every caller its own error list',t=>{
  const {root,write}=project(t);
  write('../package.json',{private:true});
  write('../hfs.json', appDeclaration('fe', { apps: [{name:'web',kind:'next'}] }));
  write('tsconfig.json',{compilerOptions:{module:'ESNext',moduleResolution:'Bundler',target:'ES2022',strict:true,noEmit:true},include:['src/**/*.ts']});
  write('src/a.ts',"import {b} from './missing'; export const a=b;");
  const config=loadArchitectureConfig(root);
  const outside=[buildTypeScriptContext(config,ts),buildTypeScriptContext(config,ts)];
  assert.notEqual(outside[0].program,outside[1].program);
  const programs=typeScriptProgramRun();
  const [first,second]=programs.run(()=>[buildTypeScriptContext(config,ts),buildTypeScriptContext(loadArchitectureConfig(root),ts)]);
  assert.equal(first.program,second.program);assert.equal(first.edges,second.edges);
  assert.ok(first.errors.length>0);assert.deepEqual(first.errors,second.errors);assert.notEqual(first.errors,second.errors);
  first.errors.push({ruleId:'X',message:'caller-owned'});
  assert.equal(programs.run(()=>buildTypeScriptContext(config,ts)).errors.length,second.errors.length);
  programs.release();
  assert.notEqual(programs.run(()=>buildTypeScriptContext(config,ts)).program,first.program);
});
