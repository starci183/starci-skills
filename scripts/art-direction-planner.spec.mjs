import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {planChain} from './plan-chain.mjs';
import {loadOperatorPackages} from './operator-md.mjs';
import {loadOperatorGraph,validateChain} from './validate-chain.mjs';
import {fakeMission,line} from './chain-fixture.mjs';
const root=path.resolve(import.meta.dirname,'..'),packages=await loadOperatorPackages(root),graph=await loadOperatorGraph(root,packages);
for(const changeLevel of ['new','refine'])test('actual operator graph plans '+changeLevel+' with correctly scoped drawing and technical-before-audit proof',()=>{
 const mission=fakeMission([line('interface.generate'),line('interface.audit'),line('quality.verify')]);
 const plan=planChain({packages,mission,options:{graph,roles:['fe'],requirements:{'interface.generate':{changeLevel,contractEmission:'off'}}}});
 const cells=plan.chain.flat(),at=op=>cells.filter(cell=>plan.steps[cell]===op),draw=at('interface.draw'),quality=at('quality.verify'),source=at('interface.generate')[0],audit=at('interface.audit')[0];
 assert.equal(draw.length,changeLevel==='new'?1:0);
 if(changeLevel==='new'){
  assert.ok(cells.indexOf(draw[0])<cells.indexOf(source));assert.equal(quality.length,2);
  const technical=quality.find(cell=>cells.indexOf(cell)<cells.indexOf(audit)),final=quality.find(cell=>cell!==technical);
  assert.ok(technical);assert.deepEqual(plan.goals[technical],{prerequisite:audit});assert.deepEqual(plan.goals[final],{doneWhen:2});
  assert.ok(cells.indexOf(source)<cells.indexOf(technical));assert.ok(cells.indexOf(audit)<cells.indexOf(final));
 }else assert.equal(quality.length,1);
 const requests=Object.fromEntries(Object.entries(plan.steps).map(([cell,operatorId])=>[cell,{operatorId,requirements:plan.presets[cell]??{},goal:plan.goals[cell]}]));
 assert.deepEqual(validateChain(root,packages,plan.chain,plan.steps,requests,{graph,mission}),[]);
});
test('source-only forecast does not invent a verification goal and drawing-only does not grow implementation',()=>{
 const planned=op=>planChain({packages,mission:fakeMission([line(op)]),options:{graph,roles:['fe'],requirements:{'interface.generate':{changeLevel:'reconstruct',contractEmission:'off'}}}});
 const source=planned('interface.generate');assert.ok(!Object.values(source.steps).includes('interface.audit'));assert.deepEqual(Object.values(source.goals).filter(goal=>goal.doneWhen!==undefined),[{doneWhen:0}]);
 const drawing=planned('interface.draw');assert.ok(!Object.values(drawing.steps).includes('interface.generate'));assert.ok(!Object.values(drawing.steps).includes('uat.verify'));assert.ok(!Object.values(drawing.steps).includes('runtime.serve'));
});
