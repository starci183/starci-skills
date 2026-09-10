import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectExecutionRoute} from '../workflows/select.mjs';
import {selectFlash} from '../workflows/flash.mjs';
import {readWorkflow, readExample, readPublicJson} from './helpers/read-public.mjs';
const catalog=readWorkflow('catalog.json');
const policy=readWorkflow('flash.json');
const backend={action:'implement-backend',effectful:true};
const frontend={action:'implement-frontend',effectful:true,requiresBackend:false};
test('clear backend and UI repairs run one workflow without a Plan wrapper',()=>{
  for(const action of [backend,frontend])assert.equal(selectExecutionRoute(catalog,{scope:'bounded',actions:[action]}).id,action.action);
});
test('large, unclear and multiple workflow requests select planning',()=>{
  for(const scope of ['large','unclear'])assert.equal(selectExecutionRoute(catalog,{scope,actions:[]}).kind,'plan');
  assert.equal(selectExecutionRoute(catalog,{scope:'bounded',actions:[backend,frontend]}).kind,'plan');
});
test('existing Plan resumes instead of being recreated for every prompt',()=>{
  assert.equal(selectExecutionRoute(catalog,{scope:'bounded',actions:[backend],existingPlan:true}).kind,'resume-plan');
});
test('small eligible fix goes direct, small risky change still needs its workflow',()=>{
  const facts={schema:'starci/flash-facts@1',mode:null,operation:'edit',repository:{id:'example',root:process.cwd(),binding:'checked'},scope:{outcome:'Fix spacing',paths:['src/a.css'],clear:true,cohesive:true},impact:{business:false,authorization:false,schema:false,architecture:false,external:false,destructive:false,highRisk:false},checks:['focused-test']};
  assert.equal(selectExecutionRoute(catalog,{scope:'small',actions:[frontend],flashSelection:selectFlash(policy,facts)}).kind,'flash');
  facts.impact.authorization=true;
  assert.equal(selectExecutionRoute(catalog,{scope:'small',actions:[backend],flashSelection:selectFlash(policy,facts)}).kind,'workflow');
});
test('questions remain read-only and unknown workflow classification cannot execute',()=>{
  assert.equal(selectExecutionRoute(catalog,{readOnly:true}).kind,'answer-or-inspect');
  assert.throws(()=>selectExecutionRoute(catalog,{scope:'bounded',actions:[]}));
  assert.throws(()=>selectExecutionRoute(catalog,{scope:'bounded',actions:[{action:'invented',effectful:true}]}));
});
