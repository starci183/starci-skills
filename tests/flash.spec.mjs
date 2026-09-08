import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateFlashPolicy,selectFlash,recheckFlash,validateFlashResult} from '../workflows/flash.mjs';

const policy=JSON.parse(fs.readFileSync(new URL('../workflows/flash.json',import.meta.url)));
const flags={business:false,authorization:false,schema:false,architecture:false,external:false,destructive:false,highRisk:false};
const facts=(overrides={})=>({schema:'starci/flash-facts@1',mode:'FLASH',operation:'edit',repository:{id:'app',root:'C:/repo/app',binding:'main@abc'},scope:{outcome:'Correct compact header spacing',paths:['src/header.css'],clear:true,cohesive:true},impact:{...flags},checks:['npm test -- header'],...overrides});

test('policy is complete and an explicit small cohesive repair selects FLASH without Work or Plan records',()=>{
  assert.equal(validateFlashPolicy(policy).ok,true);
  const selected=selectFlash(policy,facts());
  assert.equal(selected.kind,'flash');
  assert.equal(selected.request.effectCeiling,'local-source-and-focused-local-checks');
  assert.equal(Object.hasOwn(selected.request,'workRoot'),false);
  assert.equal(Object.hasOwn(selected.request,'approval'),false);
});

test('normal, ambiguous, noncohesive and already-active repair scope returns Plan',()=>{
  assert.equal(selectFlash(policy,facts({mode:null})).kind,'plan');
  assert.equal(selectFlash(policy,facts({scope:{...facts().scope,clear:false}})).kind,'plan');
  assert.equal(selectFlash(policy,facts({scope:{...facts().scope,cohesive:false}})).kind,'plan');
  assert.equal(selectFlash(policy,facts({active:true})).kind,'plan');
});

test('inspection stays read-only and FLASH is never inferred from wording',()=>{
  assert.deepEqual(selectFlash(policy,facts({mode:null,operation:'inspect'})),{kind:'inspect',reasons:['read-only-inspection']});
  assert.equal(selectFlash(policy,facts({mode:null,scope:{...facts().scope,outcome:'please quickly fix this obvious typo'}})).kind,'plan');
  assert.throws(()=>selectFlash(policy,facts({mode:'fast'})),/Unknown mode/);
});

test('business, authorization, schema, architecture, external, destructive and high-risk work all return Plan',()=>{
  for(const flag of Object.keys(flags)){const impact={...flags,[flag]:true};const selected=selectFlash(policy,facts({impact}));assert.equal(selected.kind,'plan',flag);assert.ok(selected.reasons.includes(`${flag}-impact`),flag);}
});

test('multiple local files are allowed only as one declared cohesive repair',()=>{
  const scope={...facts().scope,paths:['src/header.css','src/header.mobile.css']};
  assert.equal(selectFlash(policy,facts({scope})).kind,'flash');
  assert.equal(selectFlash(policy,facts({scope:{...scope,cohesive:false}})).kind,'plan');
});

test('wrong repository, changed binding, expanded path or newly discovered impact returns Plan',()=>{
  const selected=selectFlash(policy,facts());
  const current={repository:selected.request.repository,changedPaths:['src/header.css'],impact:{...flags}};
  assert.equal(recheckFlash(selected,current).kind,'flash');
  assert.equal(recheckFlash(selected,{...current,repository:{...current.repository,id:'other'}}).kind,'plan');
  assert.equal(recheckFlash(selected,{...current,repository:{...current.repository,binding:'main@def'}}).kind,'plan');
  assert.equal(recheckFlash(selected,{...current,changedPaths:['src/header.css','src/app.ts']}).kind,'plan');
  assert.equal(recheckFlash(selected,{...current,impact:{...flags,schema:true}}).kind,'plan');
});

test('focused checks need actual observations; failure is honest and cannot verify completion',()=>{
  const selected=selectFlash(policy,facts());
  const base={repository:selected.request.repository,changedPaths:['src/header.css'],impact:{...flags}};
  assert.equal(validateFlashResult(selected,{...base,checks:[]}).ok,false);
  const unavailable=validateFlashResult(selected,{...base,checks:[{id:'npm test -- header',status:'unavailable',observation:'Test command is not installed.'}]});
  assert.equal(unavailable.ok,true);assert.equal(unavailable.verified,false);
  const failed=validateFlashResult(selected,{...base,checks:[{id:'npm test -- header',status:'fail',observation:'One assertion failed.'}]});
  assert.equal(failed.ok,true);assert.equal(failed.verified,false);
  const passed=validateFlashResult(selected,{...base,checks:[{id:'npm test -- header',status:'pass',observation:'Focused suite passed.'}]});
  assert.equal(passed.ok,true);assert.equal(passed.verified,true);
  const expanded=validateFlashResult(selected,{...base,impact:{...flags,authorization:true},checks:[{id:'npm test -- header',status:'pass',observation:'Focused suite passed.'}]});
  assert.equal(expanded.ok,false);assert.equal(expanded.verified,false);assert.ok(expanded.errors.includes('authorization-impact'));
});

test('malformed or duplicate targets/checks cannot enter FLASH',()=>{
  assert.throws(()=>selectFlash(policy,facts({repository:{id:'app',root:'',binding:'main@abc'}})));
  assert.throws(()=>selectFlash(policy,facts({scope:{...facts().scope,paths:['../secret']}})));
  assert.throws(()=>selectFlash(policy,facts({scope:{...facts().scope,paths:['src/a.css','src/a.css']}})));
  assert.throws(()=>selectFlash(policy,facts({checks:['test','test']})));
});
