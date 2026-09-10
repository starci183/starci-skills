import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';import {sha256,validateWorkspace} from '../core/index.mjs';
test('a direct business correction invalidates prior semantic proof',t=>{
  const f=fixture(t);f.node('module/business',{schema:'work/node@2'});f.done('module/business');
  const before=validateWorkspace(f.root),id='module.business';
  const file=path.join(f.root,'module/business/index.yaml'),meta=parseYaml(fs.readFileSync(file,'utf8'));
  f.put('module/business/index.yaml',{...meta,description:'Changed substantive requirement'});
  const after=validateWorkspace(f.root);
  assert.ok(before.ok,JSON.stringify(before.errors));assert.equal(after.ok,false);
  assert.ok(after.errors.some(error=>error.code==='STALE_COMPLETION'&&error.path==='module/business/index.yaml'));
  assert.notEqual(after.nodes.find(n=>n.id===id).inputDigest,before.nodes.find(n=>n.id===id).inputDigest);
  assert.notEqual(after.nodes.find(n=>n.id===id).effectiveState,'done');
});
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-layout-'));t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-layout-'));fs.rmSync(root,{recursive:true,force:true});});const put=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof v==='string'?v:stringifyYaml(v));};put('workspace.yaml',{schema:'work/workspace@1',id:'synthetic-layout'});const node=(dir,extra={})=>put(dir+'/index.yaml',{schema:'work/node@1',id:dir.replaceAll('/','.'),kind:'business',required:true,state:'todo',description:'Synthetic structural fixture, not product proof.',assertions:['verified'],...extra});const done=dir=>{const result=validateWorkspace(root),n=result.nodes.find(n=>n.id===dir.replaceAll('/','.'));assert.ok(result.ok,JSON.stringify(result.errors));put(dir+'/evidence/unit/manifest.yaml',{schema:'work/evidence@1',id:'proof.'+n.id,nodeId:n.id,inputDigest:n.inputDigest,outcome:'pass',assertions:[{id:'verified',outcome:'pass',observation:'Synthetic assertion from unit fixture'}],assets:[]});const meta=parseYaml(fs.readFileSync(path.join(root,dir,'index.yaml'),'utf8'));put(dir+'/index.yaml',{...meta,state:'done',completion:{inputDigest:n.inputDigest,evidence:['proof.'+n.id]}});};return {root,put,node,done};}
test('node-owned input image bytes invalidate referenced code but not unrelated done',t=>{const f=fixture(t);f.put('frontend/assets/design.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');f.node('frontend',{assets:[{path:'assets/design.svg'}]});f.node('code',{refs:['frontend']});f.node('other');f.done('code');f.done('other');const before=validateWorkspace(f.root);assert.ok(before.ok);f.put('frontend/assets/design.svg','<svg xmlns="http://www.w3.org/2000/svg"><title>Changed fixture</title></svg>');const after=validateWorkspace(f.root);assert.equal(after.nodes.find(n=>n.id==='code').effectiveState,'suspended');assert.equal(after.nodes.find(n=>n.id==='other').effectiveState,'done');});
test('flow-owned video proof binds assets without changing semantic input digest',t=>{const f=fixture(t);f.node('uat/flow1');const inputDigest=validateWorkspace(f.root).nodes[0].inputDigest;f.put('uat/flow1/assets/video-flow1.webm','synthetic byte-binding test, not an actual video');assert.equal(validateWorkspace(f.root).nodes[0].inputDigest,inputDigest);const bytes=fs.readFileSync(path.join(f.root,'uat/flow1/assets/video-flow1.webm'));f.put('uat/flow1/evidence/check/manifest.yaml',{schema:'work/evidence@1',id:'video-proof',nodeId:'uat.flow1',inputDigest,outcome:'pass',assertions:[{id:'verified',outcome:'pass',observation:'Synthetic storage test only, not UX acceptance'}],assets:[{scope:'node',path:'assets/video-flow1.webm',sha256:sha256(bytes)}]});f.node('uat/flow1',{state:'done',completion:{inputDigest,evidence:['video-proof']}});assert.equal(validateWorkspace(f.root).ok,true);f.put('uat/flow1/assets/video-flow1.webm','tampered');assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='ASSET_HASH'));});
test('growing business retains existing completed children and prevents parent done',t=>{const f=fixture(t);f.put('business/index.yaml',{schema:'work/node@1',id:'business',kind:'business',required:true,description:'Synthetic expanding scope'});f.node('business/create');f.done('business/create');assert.equal(validateWorkspace(f.root).nodes.find(n=>n.id==='business').effectiveState,'done');f.node('business/renew');const after=validateWorkspace(f.root);assert.ok(after.ok);assert.equal(after.nodes.find(n=>n.id==='business.create').effectiveState,'done');assert.notEqual(after.nodes.find(n=>n.id==='business').effectiveState,'done');});
test('local workflow files never become nodes or alter canonical hashes',t=>{const f=fixture(t);f.node('business');f.done('business');const before=validateWorkspace(f.root);f.put('_workflows/one/index.yaml','broken: [');f.put('_workflows/two/run.yaml','status: done\n');assert.deepEqual(validateWorkspace(f.root),before);});
test('mixed node formats and unsafe input asset ownership are rejected',t=>{const f=fixture(t);f.node('frontend',{assets:[{path:'../other.png'}]});assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='NODE_ASSET_PATH'));f.node('frontend');f.put('frontend/node.yaml','schema: work/node@1');assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='NODE_FORMAT_CONFLICT'));});

function uiSpec(paths) {
  return {status:'proposed',intent:'Synthetic layout storage test, not a reviewed UI.',
    surfaces:[{name:'Editor',route:'/documents/edit',purpose:'Edit a document',actors:['owner']}],
    states:['loading','empty','error','interaction'].map(name=>({name,trigger:`Enter ${name}`,behavior:`Show ${name}`})),
    accessibility:['Keyboard operation'],responsive:['Adapt to the available viewport'],
    assets:paths.map(p=>({path:p,role:'Editor state or motion reference',provenance:'Synthetic test bytes only'})),
    observations:[],gaps:['Not visually reviewed']};
}

test('UI supports recursive scopes and many original-format design assets without evidence folders',t=>{
  const f=fixture(t),dir='product/chatbot/ui/documents/edit',paths=[
    'assets/states/desktop.png','assets/states/error.webp','assets/motion/update.webm',
    'assets/diagrams/regions.svg','assets/references/mobile.jpeg','assets/sequences/step-3.png'];
  f.put('product/chatbot/ui/index.yaml',{schema:'work/node@2',id:'chatbot.ui',kind:'ui',required:true,description:'Aggregate UI scope.'});
  for(const p of paths)f.put(`${dir}/${p}`,'Synthetic asset payload, not an actual render.');
  f.node(dir,{schema:'work/node@2',kind:'ui',ui:uiSpec(paths),assets:paths.map(p=>({path:p,description:'Synthetic resource role'}))});
  const result=validateWorkspace(f.root);assert.ok(result.ok,JSON.stringify(result.errors));
  assert.equal(result.nodes.length,2);assert.notEqual(result.nodes.find(n=>n.id==='chatbot.ui').effectiveState,'done');
  assert.equal(fs.existsSync(path.join(f.root,dir,'evidence')),false);
  const before=result.nodes.find(n=>n.path===dir+'/index.yaml').specDigest;
  f.put(`${dir}/${paths[2]}`,'Changed motion design input');
  assert.notEqual(validateWorkspace(f.root).nodes.find(n=>n.path===dir+'/index.yaml').specDigest,before);
});

test('asset payload folders do not create Work nodes or parse sample metadata',t=>{
  const f=fixture(t),dir='product/architecture/documents';
  const files=['assets/samples/index.yaml','assets/samples/resource.yaml','assets/samples/accounts.yaml',
    'assets/samples/input.json','assets/samples/_original/manifest.yaml'];
  files.forEach(p=>f.put(`${dir}/${p}`,'Intentionally not valid Work metadata.'));
  f.node(dir,{schema:'work/node@2',assets:files.map(p=>({path:p}))});
  const result=validateWorkspace(f.root);assert.ok(result.ok,JSON.stringify(result.errors));assert.equal(result.nodes.length,1);
});

test('nested UI cannot bind absent, duplicate or escaping assets and still requires state coverage',t=>{
  const f=fixture(t),dir='module/ui/group/screen';
  f.node(dir,{schema:'work/node@2',kind:'ui',ui:uiSpec(['assets/missing.png']),assets:[{path:'assets/missing.png'}]});
  assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='NODE_ASSET_UNREADABLE'));
  f.put(dir+'/assets/design.png','Synthetic');
  f.node(dir,{schema:'work/node@2',kind:'ui',ui:uiSpec(['assets/design.png']),assets:[{path:'assets/design.png'},{path:'assets/design.png'}]});
  assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='NODE_ASSET_PATH'));
  f.node(dir,{schema:'work/node@2',kind:'ui',ui:uiSpec(['assets/../outside.png']),assets:[{path:'assets/../outside.png'}]});
  assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='NODE_ASSET_PATH'));
  f.node(dir,{schema:'work/node@2',kind:'ui',ui:{...uiSpec([]),states:[]}});
  assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='UI_STATE_COVERAGE'));
});

test('UI scope must remain under ui and shared assets bind consumers without duplicate files',t=>{
  const f=fixture(t);
  f.node('wrong/screen',{schema:'work/node@2',kind:'ui',ui:uiSpec([])});
  assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='UI_LAYOUT'));
  f.node('wrong/screen',{schema:'work/node@2'});
  f.put('shared/assets/logo.svg','Synthetic shared resource');f.node('shared',{assets:[{path:'assets/logo.svg'}]});
  f.node('module/ui/consumer',{schema:'work/node@2',kind:'ui',ui:uiSpec([]),refs:['shared']});
  const before=validateWorkspace(f.root);assert.ok(before.ok,JSON.stringify(before.errors));
  f.put('shared/assets/logo.svg','Changed shared resource');
  const after=validateWorkspace(f.root);assert.ok(after.ok,JSON.stringify(after.errors));
  assert.notEqual(before.nodes.find(n=>n.id==='module.ui.consumer').inputDigest,after.nodes.find(n=>n.id==='module.ui.consumer').inputDigest);
});

test('editing completed content invalidates it without locking edits or unrelated done',t=>{
  const f=fixture(t);f.node('scope');f.node('other');f.done('scope');f.done('other');
  const meta=parseYaml(fs.readFileSync(path.join(f.root,'scope/index.yaml'),'utf8'));
  f.put('scope/index.yaml',{...meta,description:'User-authorized changed requirements.'});
  const result=validateWorkspace(f.root);
  assert.ok(result.errors.some(e=>e.code==='STALE_COMPLETION'&&e.path==='scope/index.yaml'));
  assert.notEqual(result.nodes.find(n=>n.id==='scope').effectiveState,'done');
  assert.equal(result.nodes.find(n=>n.id==='other').effectiveState,'done');
  const {completion,...reopened}=meta;f.put('scope/index.yaml',{...reopened,state:'todo',description:'User-authorized changed requirements.'});
  assert.ok(validateWorkspace(f.root).ok);
});

test('backend and frontend implementation scopes can grow recursively while their shared parent stays thin',t=>{
  const f=fixture(t),implementation={status:'proposed',changes:[],currentCodeMap:[],gaps:['Not implemented']};
  f.put('module/implementation/index.yaml',{schema:'work/node@2',id:'implementation',kind:'implementation',required:true,description:'Shared implementation scope.'});
  for(const side of ['backend','frontend']){
    const dir=`module/implementation/${side}`;
    f.put(dir+'/index.yaml',{schema:'work/node@2',id:side,kind:'implementation',required:true,implementation});
    f.node(dir+'/documents/update',{schema:'work/node@2',kind:'implementation',implementation});
  }
  let result=validateWorkspace(f.root);assert.ok(result.ok,JSON.stringify(result.errors));assert.equal(result.nodes.length,5);
  f.node('module/wrong/update',{schema:'work/node@2',kind:'implementation',implementation});
  assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='IMPLEMENTATION_LAYOUT'));
});

test('nested asset payload folders never follow junctions',t=>{
  const f=fixture(t);f.node('scope',{schema:'work/node@2'});f.put('_local/target/sample.txt','Not canonical');
  fs.mkdirSync(path.join(f.root,'scope/assets/captures'),{recursive:true});
  const link=path.join(f.root,'scope/assets/captures/linked');
  fs.symlinkSync(path.join(f.root,'_local/target'),link,process.platform==='win32'?'junction':'dir');
  const result=validateWorkspace(f.root);assert.ok(result.errors.some(e=>e.code==='SYMLINK'));
  assert.equal(result.nodes.length,1);
});
