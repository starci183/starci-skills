import test from 'node:test';
import {readExample} from './helpers/read-public.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateWorkspace} from '../core/index.mjs';
import {stringifyYaml} from '../core/yaml.mjs';
import {validateSpecification} from '../specifications/validate.mjs';

function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-source-provenance-'));
 t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-source-provenance-'));fs.rmSync(root,{recursive:true,force:true});});
 const put=(relative,data)=>{const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(data));};
 put('workspace.yaml',{schema:'work/workspace@1',id:'synthetic'});
 // Source example reused only as a structured fixture, never product acceptance.
 const spec=readExample('nivo-setup-business.json');
 const node={schema:'work/node@2',id:'synthetic.business',kind:'business',required:true,state:'todo',assertions:['review'],description:'Synthetic metadata binding test only.',sourceRefs:spec.sources.filter(s=>s.kind==='observed').map(({repository,revision,path,symbol,observation})=>({repository,revision,path,symbol,observation})),extensions:{work3:{specification:spec}}};
 const write=()=>put('module/business/index.yaml',node);
 const check=()=>{write();return validateWorkspace(root);};
 return {root,node,spec,put,write,check};
}

test('Work v2 binds observed specifications directly, with zero resource manifests and no writes',t=>{
 const f=fixture(t);f.write();const file=path.join(f.root,'module/business/index.yaml'),before=fs.readFileSync(file);
 const result=validateWorkspace(f.root);assert.deepEqual(result.errors,[]);assert.deepEqual(result.resources,[]);
 assert.deepEqual(fs.readFileSync(file),before);assert.equal(fs.existsSync(path.join(f.root,'_resources')),false);
 assert.equal(result.nodes[0].effectiveState,'todo');
});
test('direct citations bind exact repository and path, not another file from the same repository',t=>{
 const f=fixture(t),original=structuredClone(f.node.sourceRefs);
 for(const mutate of [refs=>refs.splice(0,1),refs=>refs[0].repository='unrelated',refs=>refs[0].path='unrelated/file.ts']) {
  f.node.sourceRefs=structuredClone(original);mutate(f.node.sourceRefs);
  assert.ok(f.check().errors.some(e=>e.code==='SPECIFICATION_SOURCE_UNBOUND'));
 }
});
test('direct revision mismatch or conflicting duplicate cannot hide behind an exact matching citation',t=>{
 const f=fixture(t);f.node.sourceRefs[0].revision='b'.repeat(40);
 assert.ok(f.check().errors.some(e=>e.code==='SPECIFICATION_SOURCE_STALE'));
 const source=f.spec.sources.find(s=>s.kind==='observed');
 f.node.sourceRefs.unshift({repository:source.repository,revision:source.revision,path:source.path,observation:'Synthetic second conflicting revision.'});
 assert.ok(f.check().errors.some(e=>e.code==='SPECIFICATION_SOURCE_STALE'));
});
test('full 64-hex revisions bind without requiring SHA-1',t=>{
 const f=fixture(t);for(const s of f.spec.sources.filter(s=>s.kind==='observed'))s.revision='c'.repeat(64);
 for(const ref of f.node.sourceRefs)ref.revision='c'.repeat(64);
 assert.deepEqual(f.check().errors,[]);
});
test('sourceRefs and specification reject malformed revisions and unsafe normalized paths',t=>{
 const f=fixture(t),original=structuredClone(f.node.sourceRefs),source=f.spec.sources.find(s=>s.kind==='observed'),oldRevision=source.revision,oldPath=source.path;
 for(const revision of ['main','HEAD','a'.repeat(39),'G'.repeat(40),'a'.repeat(41),' ']) {
  f.node.sourceRefs=structuredClone(original);f.node.sourceRefs[0].revision=revision;
  assert.ok(f.check().errors.some(e=>e.code==='SCHEMA_VALUE'),revision);
  source.revision=revision;assert.equal(validateSpecification(f.spec).ok,false);source.revision=oldRevision;
 }
 for(const unsafe of ['../file.ts','src/../file.ts','src/./file.ts','/absolute.ts','C:/file.ts','C:file.ts','src\\file.ts','src//file.ts','src/','src/file.ts:stream','src/\u0000file.ts',' ']) {
  f.node.sourceRefs=structuredClone(original);f.node.sourceRefs[0].path=unsafe;
  assert.ok(f.check().errors.some(e=>e.code==='SCHEMA_VALUE'),JSON.stringify(unsafe));
  source.path=unsafe;assert.equal(validateSpecification(f.spec).ok,false,JSON.stringify(unsafe));source.path=oldPath;
 }
});
test('malformed sourceRefs still return diagnostics rather than crashing validation',t=>{
 const f=fixture(t);
 for(const refs of [null,{},'invalid',[null],[{}]]) {
  f.node.sourceRefs=refs;const checked=f.check();assert.equal(checked.ok,false);
  assert.ok(checked.errors.some(e=>e.code==='SCHEMA_VALUE'));
  assert.ok(!checked.errors.some(e=>e.code==='MALFORMED_WORKSPACE'));
 }
});
test('ancestor and sibling citations cannot silently supply an owning-node observed binding',t=>{
 const f=fixture(t),refs=f.node.sourceRefs;f.node.sourceRefs=[];
 f.put('module/index.yaml',{schema:'work/node@2',id:'synthetic.module',kind:'group',required:true,sourceRefs:refs});
 f.put('sibling/index.yaml',{schema:'work/node@2',id:'synthetic.sibling',kind:'operations',required:true,state:'todo',sourceRefs:refs,description:'Synthetic unrelated source observations.'});
 f.node.refs=['synthetic.sibling'];assert.ok(f.check().errors.some(e=>e.code==='SPECIFICATION_SOURCE_UNBOUND'));
});
test('direct provenance preserves dangling refs, dependency, owner and completion gates',t=>{
 const f=fixture(t);f.node.refs=['missing'];assert.ok(f.check().errors.some(e=>e.code==='MISSING_REF'));
 delete f.node.refs;
 f.put('prerequisite/index.yaml',{schema:'work/node@2',id:'prerequisite',kind:'operations',required:true,state:'uninvestigate',description:'Synthetic unapproved prerequisite.'});
 f.node.dependsOn=['prerequisite'];let result=f.check();const own=result.nodes.find(n=>n.id===f.node.id);assert.equal(own.eligible,false);assert.ok(own.blockedBy.includes('prerequisite'));
 f.node.state='done';result=f.check();assert.ok(result.errors.some(e=>e.code==='SPECIFICATION_NOT_ACCEPTED'));assert.notEqual(result.nodes.find(n=>n.id===f.node.id).effectiveState,'done');
 f.node.state='todo';f.node.kind='architecture';assert.ok(f.check().errors.some(e=>e.code==='SPECIFICATION_OWNER'));
});
test('provenance updates change semantic input digests instead of reusing stale proof',t=>{
 const f=fixture(t),before=f.check().nodes[0].inputDigest;
 for(const ref of f.node.sourceRefs)ref.revision='d'.repeat(40);
 for(const source of f.spec.sources.filter(s=>s.kind==='observed'))source.revision='d'.repeat(40);
 const after=f.check();assert.deepEqual(after.errors,[]);assert.notEqual(after.nodes[0].inputDigest,before);
});
