import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateWorkspace,sha256} from '../core/index.mjs';
import {stringifyYaml} from '../core/yaml.mjs';

function fixture(t,dirty=false){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-source-identity-'));
 t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-source-identity-'));fs.rmSync(root,{recursive:true,force:true});});
 const put=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,stringifyYaml(v));};
 const node={schema:'work/node@2',id:'impl',kind:'implementation',required:true,state:'todo',assertions:['test'],description:'Synthetic source identity completion.'};
 const nodePath='module/implementation/backend/index.yaml',base='module/implementation/backend/evidence/proof/';
 put('workspace.yaml',{schema:'work/workspace@1',id:'synthetic'});put(nodePath,node);
 const inputDigest=validateWorkspace(root).nodes[0].inputDigest;
 const source={schema:'starci/source-identity@1',repositories:[{repository:'backend',origin:'https://example.test/org/backend.git',state:'committed',commit:'a'.repeat(40),coverage:{kind:'full-tree',paths:[],dependencyCoverage:'Synthetic full tree and lockfile included.',limitations:[]}}]};
 const evidence={schema:'work/evidence@1',id:'proof',nodeId:'impl',inputDigest,outcome:'pass',assertions:[{id:'test',outcome:'pass',observation:'Synthetic execution result.'}],assets:[],sourceIdentity:structuredClone(source)};
 if(dirty){const bytes='synthetic reproducible source snapshot';const snapshot={artifact:'snapshot.txt',sha256:sha256(bytes)};Object.assign(source.repositories[0],{state:'dirty',baseCommit:source.repositories[0].commit,snapshot});delete source.repositories[0].commit;evidence.sourceIdentity=structuredClone(source);evidence.assets=[{path:snapshot.artifact,sha256:snapshot.sha256}];put(base+'manifest.yaml',evidence);fs.writeFileSync(path.join(root,base,snapshot.artifact),bytes);}
 node.state='done';node.completion={inputDigest,evidence:['proof'],sourceIdentity:source};
 const check=()=>{put(nodePath,node);put(base+'manifest.yaml',evidence);return validateWorkspace(root);};
 return {root,node,evidence,source,check,put,base,nodePath};
}
test('direct committed proof completes Work v2 implementation without registry resources',t=>{const f=fixture(t),r=f.check();assert.deepEqual(r.errors,[]);assert.equal(r.nodes[0].effectiveState,'done');assert.deepEqual(r.resources,[]);});
test('dirty proof binds preserved snapshot bytes rather than claiming HEAD was tested',t=>{const f=fixture(t,true);assert.deepEqual(f.check().errors,[]);fs.appendFileSync(path.join(f.root,f.base,'snapshot.txt'),'changed');assert.ok(f.check().errors.some(e=>e.code==='ASSET_HASH'));});
for(const [name,mutate,code] of [
 ['missing identity',f=>delete f.node.completion.sourceIdentity,'CODE_REFS'],
 ['wrong evidence commit',f=>f.evidence.sourceIdentity.repositories[0].commit='b'.repeat(40),'SOURCE_EVIDENCE_BINDING'],
 ['credential origin',f=>f.source.repositories[0].origin='https://secret@example.test/repo.git','SOURCE_ORIGIN'],
 ['wrong commit',f=>f.source.repositories[0].commit='HEAD','SOURCE_STATE'],
 ['unknown version',f=>f.source.schema='starci/source-identity@99','SOURCE_IDENTITY'],
 ['mixed legacy',f=>f.node.completion.codeRefs=[{repository:'backend',commit:'a'.repeat(40)}],'SOURCE_IDENTITY_MIXED'],
 ['wrong profile',f=>f.node.kind='operations','SOURCE_IDENTITY_SCOPE'],
 ['scoped without limitations',f=>Object.assign(f.source.repositories[0].coverage,{kind:'scoped',paths:['src']}),'SOURCE_COVERAGE'],
 ['undeclared extra',f=>f.source.repositories[0].fake=true,'UNKNOWN_FIELD'],
])test(`rejects ${name}`,t=>{const f=fixture(t);mutate(f);assert.ok(f.check().errors.some(e=>e.code===code));});
for(const [name,mutate,code] of [
 ['dirty tested commit',f=>f.source.repositories[0].commit='a'.repeat(40),'SOURCE_STATE'],
 ['missing snapshot asset',f=>f.evidence.assets=[],'SOURCE_SNAPSHOT'],
 ['wrong snapshot digest',f=>f.evidence.sourceIdentity.repositories[0].snapshot.sha256='b'.repeat(64),'SOURCE_SNAPSHOT'],
 ['snapshot traversal',f=>f.source.repositories[0].snapshot.artifact='../snapshot.txt','SOURCE_STATE'],
])test(`rejects ${name}`,t=>{const f=fixture(t,true);mutate(f);assert.ok(f.check().errors.some(e=>e.code===code));});
test('source proof cannot bypass stale input or failed tests',t=>{const f=fixture(t);f.node.description='Changed requirement';assert.ok(f.check().errors.some(e=>e.code==='STALE_COMPLETION'));f.evidence.outcome='fail';assert.ok(f.check().errors.some(e=>e.code==='EVIDENCE_NOT_PASS'));});
test('legacy codeRefs still require repository resources, never reinterpreted as direct identity',t=>{const f=fixture(t);delete f.node.completion.sourceIdentity;delete f.evidence.sourceIdentity;f.node.completion.codeRefs=[{repository:'backend',commit:'a'.repeat(40)}];f.evidence.codeRefs=structuredClone(f.node.completion.codeRefs);assert.ok(f.check().errors.some(e=>e.code==='MISSING_REF'));});
test('scoped snapshot states dependency boundaries and cannot silently claim full-tree coverage',t=>{const f=fixture(t,true);Object.assign(f.source.repositories[0].coverage,{kind:'scoped',paths:['src/domain','package-lock.json'],dependencyCoverage:'Includes domain dependencies only.',limitations:['Not registered application E2E.']});f.evidence.sourceIdentity=structuredClone(f.source);assert.deepEqual(f.check().errors,[]);f.source.repositories[0].coverage.kind='full-tree';assert.ok(f.check().errors.some(e=>e.code==='SOURCE_COVERAGE'));});
test('malformed direct identity yields diagnostics rather than validator crash',t=>{const f=fixture(t);for(const value of [null,{},[],{schema:'starci/source-identity@1',repositories:[null]},{schema:'starci/source-identity@1',repositories:[{state:'dirty',snapshot:null}]}]){f.node.completion.sourceIdentity=value;const r=f.check();assert.equal(r.ok,false);assert.ok(!r.errors.some(e=>e.code==='MALFORMED_WORKSPACE'));}});
