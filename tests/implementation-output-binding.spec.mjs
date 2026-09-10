import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {validateWorkspace} from '../core/index.mjs';
import {validateWorkPolicy,requestWorkPolicy,sealWorkResult,verifyWorkResult} from '../workflows/work-binding.mjs';

function fixture(t,{legacy=false,side='backend'}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-implementation-output-'));
 t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-implementation-output-'));fs.rmSync(root,{recursive:true,force:true});});
 const put=(p,m)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,stringifyYaml(m));};
 put('workspace.yaml',{schema:'work/workspace@1',id:'synthetic'});
 const file=`module/implementation/${side}/index.yaml`,id='synthetic.implementation';
 put(file,{schema:'work/node@2',id,kind:'implementation',required:true,state:'todo',description:'Immutable expected outcome',assertions:['behavior-pass'],implementation:{status:'proposed',changes:[],gaps:['Not implemented']}});
 const cell={id:'implement-backend',op:side==='backend'?'backend.implement':'interface.implement',workTargets:[id],...(!legacy?{workPolicy:{schema:'starci/implementation-output@1',targets:[id]}}:{})};
 const run={workRoot:root,goal:{workflow:'implement-backend',workTargets:[id],scope:{resources:[path.join(root,file)],paths:[]},resourceEffects:[{target:path.join(root,file)}],impacts:[],cells:[cell]},requests:{},status:'running'};
 const work=validateWorkspace(root);assert.ok(work.ok,JSON.stringify(work.errors));
 const n=work.nodes.find(n=>n.id===id);
 run.requests[cell.id]={schema:'starci/cell-request@1',workBindings:[{id,contextDigest:n.contextDigest,inputDigest:n.inputDigest}],...requestWorkPolicy(run,cell)};
 const edit=fn=>{const m=parseYaml(fs.readFileSync(path.join(root,file),'utf8'));fn(m);put(file,m);};
 return {root,run,cell,file,id,put,edit};
}
test('new implementation policy seals actual mapping while preserving original request',t=>{
 const f=fixture(t),request=structuredClone(f.run.requests[f.cell.id]);
 f.edit(m=>m.implementation={status:'observed',changes:[{what:'Implemented synthetic behavior',why:'Fixture only',repository:'synthetic',directory:'src',revision:'synthetic-test-subject',verification:['Synthetic unit check']}],gaps:[]});
 const response=sealWorkResult(f.run,f.cell,{outputs:{}});
 assert.deepEqual(f.run.requests[f.cell.id],request);assert.equal(request.schema,'starci/cell-request@2');
 assert.ok(verifyWorkResult(f.run,f.cell,response));
 f.edit(m=>m.implementation.gaps=['New material gap']);
 assert.throws(()=>verifyWorkResult(f.run,f.cell,response),/changed/);
});
test('implementation result policy does not mask expectations or graph changes',t=>{
 for(const change of [m=>m.description='Different expected behavior',m=>m.assertions=['weaker'],m=>m.required=false,m=>m.sourceRefs=[{repository:'other',revision:'a'.repeat(40),path:'src/a.ts'}],m=>m.extensions={arbitrary:'new intent'}]){
  const f=fixture(t);f.edit(change);assert.throws(()=>sealWorkResult(f.run,f.cell,{outputs:{}}));
 }
});
test('implementation output policy freezes upstream and undeclared semantic assets',t=>{
 const f=fixture(t);f.put('workspace.yaml',{schema:'work/workspace@1',id:'changed-workspace'});
 assert.throws(()=>sealWorkResult(f.run,f.cell,{}),/immutable/);
 const g=fixture(t);g.edit(m=>m.assets=[{path:'assets/new.txt'}]);fs.mkdirSync(path.join(g.root,path.dirname(g.file),'assets'));fs.writeFileSync(path.join(g.root,path.dirname(g.file),'assets/new.txt'),'synthetic');
 assert.throws(()=>sealWorkResult(g.run,g.cell,{}),/immutable/);
});
test('legacy implementation requests stay strict and cannot gain policy retroactively',t=>{
 const f=fixture(t,{legacy:true});f.edit(m=>m.implementation.gaps=[]);
 assert.throws(()=>verifyWorkResult(f.run,f.cell,{}),/changed/);
 f.cell.workPolicy={schema:'starci/implementation-output@1',targets:[f.id]};
 assert.throws(()=>sealWorkResult(f.run,f.cell,{}),/Legacy/);
});
test('implementation policy rejects asset permissions, design operators and wrong side',t=>{
 const f=fixture(t);f.cell.workPolicy.assetWrites=[];assert.throws(()=>validateWorkPolicy(f.run.goal,f.cell));
 delete f.cell.workPolicy.assetWrites;f.cell.op='architecture.decide';assert.throws(()=>validateWorkPolicy(f.run.goal,f.cell));
 const g=fixture(t);g.cell.op='interface.implement';assert.throws(()=>requestWorkPolicy(g.run,g.cell),/backend\/frontend/);
});
test('frontend uses the same prospective narrow output policy',t=>{
 const f=fixture(t,{side:'frontend'});f.edit(m=>m.implementation.status='observed');
 const response=sealWorkResult(f.run,f.cell,{});assert.ok(verifyWorkResult(f.run,f.cell,response));
});
