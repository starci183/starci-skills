import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {openSession,confirmSession,cleanupFixtureOwners,discoveryFor} from './v23-test-fixture.mjs';
import {discoverSession} from './session-open.mjs';
const schema=JSON.parse(await readFile(new URL('../templates/step/state.schema.json',import.meta.url))).properties.mission;
const base={language:'en',goal:'Inspect readiness.',target:'Environment',includes:['Readiness'],outputs:['Report'],doneWhen:[{evidence:'Readiness reported.',producedBy:'environment.preflight'}],verification:'Read report.',sourceRef:'user:opening'};
const mutations=[m=>m.goal='x'.repeat(schema.properties.goal.maxLength+1),m=>m.includes=Array(schema.properties.includes.maxItems+1).fill('scope'),m=>m.doneWhen[0].evidence='x'.repeat(schema.properties.doneWhen.items.properties.evidence.maxLength+1),m=>m.verification='x'.repeat(schema.properties.verification.maxLength+1)];
async function fixture(t){const owner=await mkdtemp(path.join(os.tmpdir(),'mission-size-'));t.after(async()=>{cleanupFixtureOwners(owner);await rm(owner,{recursive:true,force:true});});const input={project:'size',hostBinding:{kind:'codex-task',hostId:path.basename(owner),worktree:owner,sourcePromptRef:'user:opening'},mission:structuredClone(base)};return {owner,input,open:()=>openSession(path.join(owner,'.worktrees/sessions'),input)};}
async function snapshot(dir){const files={};async function walk(p){for(const e of await readdir(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())await walk(f);else files[path.relative(dir,f)]=(await readFile(f)).toString('base64');}}await walk(dir);return files;}
test('oversized opening refuses before a session directory is created',async t=>{for(const mutate of mutations){const f=await fixture(t);mutate(f.input.mission);await assert.rejects(f.open(),/mission\./);assert.deepEqual(await readdir(path.join(f.owner,'.worktrees/sessions')).catch(e=>e.code==='ENOENT'?[]:Promise.reject(e)),[]);}});
test('discover and corrected confirmation reject oversized mission without changing ledger or history',async t=>{const f=await fixture(t),o=await f.open();let state=JSON.parse(await readFile(path.join(o.session,'state.json')));for(const mutate of mutations){const m=structuredClone(state.mission);mutate(m);const before=await snapshot(o.session);await assert.rejects(discoverSession(o.session,m),/mission\./);assert.deepEqual(await snapshot(o.session),before);}
 await confirmSession(o.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:approved'});state=JSON.parse(await readFile(path.join(o.session,'state.json')));
 for(const mutate of mutations){const m=structuredClone(state.mission);mutate(m);const before=await snapshot(o.session);await assert.rejects(confirmSession(o.session,{selected:'corrected',selectedBy:'user',sourceRef:'user:correction',mission:m}),/mission\./);assert.deepEqual(await snapshot(o.session),before);}
 const corrected={...state.mission,goal:'Inspect corrected readiness.'};const r=await confirmSession(o.session,{selected:'corrected',selectedBy:'user',sourceRef:'user:correction',mission:corrected});assert.equal(r.version,2);
});
test('as-stated refuses malformed existing draft before choices are written',async t=>{const f=await fixture(t),o=await f.open();const file=path.join(o.session,'state.json'),s=JSON.parse(await readFile(file));s.mission.goal='x'.repeat(schema.properties.goal.maxLength+1);await writeFile(file,JSON.stringify(s));const before=await snapshot(o.session);await assert.rejects(confirmSession(o.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:approved'}),/mission.goal/);assert.deepEqual(await snapshot(o.session),before);});
test('delivery-expanded mission is checked after inference while boundary sized text remains valid',async t=>{
 const f=await fixture(t);f.input.mission.goal='x'.repeat(schema.properties.goal.maxLength);f.input.mission.verification='v'.repeat(schema.properties.verification.maxLength);
 const o=await f.open(),state=JSON.parse(await readFile(path.join(o.session,'state.json')));assert.equal(state.mission.goal.length,schema.properties.goal.maxLength);
 const m={...state.mission,discovery:discoveryFor(state.project,{tags:['business'],head:state.mission.discovery.repositories[0].head}),doneWhen:Array.from({length:schema.properties.doneWhen.maxItems},()=>({producedBy:'environment.preflight',evidence:'Readiness reported.'}))};
 const before=await snapshot(o.session);await assert.rejects(discoverSession(o.session,m),/mission.doneWhen/);assert.deepEqual(await snapshot(o.session),before);
});
