import assert from 'node:assert/strict';
import { metadataErrors, proofEnvironment } from './validate.mjs';
import { installInvocation } from './install.mjs';
const plan={packageName:'@example/library',fromVersion:'1.0.0',toVersion:'1.0.1',manifests:['apps/app/package.json'],release:{tarball:'https://registry.npmjs.org/@example/library/-/library-1.0.1.tgz',integrity:'sha512-example'}};
const oldManifest={name:'consumer',private:true,scripts:{test:'test'},dependencies:{'@example/library':'1.0.0',other:'2.0.0'}};
const newManifest={...structuredClone(oldManifest),dependencies:{...oldManifest.dependencies,'@example/library':'1.0.1'}};
const oldLock={lockfileVersion:3,packages:{'':{name:'root'},'apps/app':{dependencies:{'@example/library':'1.0.0'}},'apps/other':{dependencies:{'@example/library':'1.0.0'}},'node_modules/@example/library':{version:'1.0.0',resolved:'https://registry.npmjs.org/old.tgz',integrity:'sha512-old',peerDependencies:{react:'19'}},'node_modules/other':{version:'2.0.0'}}};
const newLock=structuredClone(oldLock);newLock.packages['apps/app'].dependencies['@example/library']='1.0.1';newLock.packages['apps/app/node_modules/@example/library']={...oldLock.packages['node_modules/@example/library'],version:'1.0.1',resolved:plan.release.tarball,integrity:plan.release.integrity};
const check=(manifest=newManifest,lock=newLock)=>metadataErrors(plan,{'apps/app/package.json':oldManifest},{'apps/app/package.json':manifest},oldLock,lock);
assert.deepEqual(check(),[]);
for(const mutate of [
  (m,l)=>{m.scripts.test='skip';},(m,l)=>{m.dependencies.other='3.0.0';},(m,l)=>{m.version='9';},
  (m,l)=>{l.packages['node_modules/other'].version='3.0.0';},(m,l)=>{l.lockfileVersion=2;},
  (m,l)=>{l.packages['apps/app/node_modules/@example/library'].integrity='sha512-wrong';},
  (m,l)=>{l.packages['apps/app/node_modules/@example/library'].peerDependencies.react='20';},
  (m,l)=>{delete l.packages['node_modules/@example/library'];},
  (m,l)=>{l.packages['apps/other'].dependencies['@example/library']='1.0.1';},
  (m,l)=>{delete l.packages['apps/app/node_modules/@example/library'];}
]){const m=structuredClone(newManifest),l=structuredClone(newLock);mutate(m,l);assert.ok(check(m,l).length);}
process.stdout.write('dependency.update self-test: exact manifest, lock identity and dependency closure mutations passed\n');
const ctx={checkout:'D:/bound/session-consumer',base:'a'.repeat(40),manifest:{scripts:{test:'vitest run'}},plan:{...plan,gates:[{id:'test',command:{kind:'npm-script',name:'test',args:[]}}]}};
assert.deepEqual(proofEnvironment(ctx,{kind:'npm-script',name:'test:ci'}),{COVERAGE_BASE_SHA:ctx.base});
assert.deepEqual(proofEnvironment(ctx,{kind:'npm-script',name:'test'}),{});
const baseline=installInvocation(ctx,'baseline'),release=installInvocation(ctx,'release');
assert.equal(baseline.cwd,ctx.checkout);assert.equal(release.cwd,ctx.checkout);
assert.notEqual(baseline.cwd,process.cwd());
assert.deepEqual(baseline.args.slice(1),['ci','--ignore-scripts','--no-audit','--no-fund']);
assert.deepEqual(release.args.slice(1),['install','@example/library@1.0.1','--save-exact','--workspace','apps/app','--ignore-scripts','--no-audit','--no-fund']);
assert.throws(()=>installInvocation(ctx,'D:/unbound/source'),/phase/);
process.stdout.write('dependency.update self-test: install cwd/argv and coverage base binding passed\n');
