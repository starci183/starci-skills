import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createBundle} from '../scripts/plan.mjs';
import {exportGoalPresentation} from '../scripts/present-goal.mjs';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-view-'));
  t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});
  const p=JSON.parse(fs.readFileSync(new URL('../workflows/plan.template.json',import.meta.url)));
  Object.assign(p,{id:'view',requestId:'synthetic',originalRequest:'Review backend retry behavior',finalOutcome:'Report observed backend retry behavior'});
  for(const area of ['business','architecture','implementation','backend','frontend','uat'])p[area]={action:'not-applicable',outcome:'No change',targets:[],workflowIds:[],evidence:[],reason:'Read-only backend review'};
  p.backend={action:'change',outcome:'Reviewed backend behavior',targets:['synthetic.backend'],workflowIds:['review'],evidence:[],reason:''};
  p.workflows=[{id:'review',workflow:'review-code',purpose:'Inspect retry implementation',input:'Existing backend',output:'Observed review findings',criteria:['review-pass'],workTargets:['synthetic.backend'],paths:['src/retry.ts'],resources:[],dependsOn:[],openQuestions:[],estimate:{minMinutes:5,maxMinutes:15,assumptions:'Synthetic fixture'},selection:{requestQuote:p.originalRequest,codeChange:false,verification:'unit-component',separateDeliverable:false}}];
  p.completionCriteria=[{id:'reviewed',outcome:'Current retry behavior explained',workflowIds:['review']}];
  const bundle=createBundle(p,path.join(root,'plan'));
  return {root,bundle,source:path.join(bundle,'goal/index.yaml')};
}

test('goal export preserves complete YAML bytes and all source approval/run state',t=>{
  const {root,bundle,source}=fixture(t);
  const before=Object.fromEntries(['goal/index.yaml','approval/index.yaml','run/index.yaml'].map(rel=>[rel,fs.readFileSync(path.join(bundle,rel))]));
  const output=path.join(root,'view'),meta=exportGoalPresentation(source,'review',output);
  assert.ok(fs.readFileSync(path.join(output,'goal.yaml')).equals(before['goal/index.yaml']));
  for(const [rel,bytes]of Object.entries(before))assert.ok(fs.readFileSync(path.join(bundle,rel)).equals(bytes));
  assert.equal(meta.sourceSha256,createHash('sha256').update(before['goal/index.yaml']).digest('hex'));
  assert.equal(meta.goalStage,'plan-proposal');assert.equal(meta.goalDigest,null);
  const parsed=parseYaml(fs.readFileSync(path.join(output,'goal.yaml'),'utf8'));
  assert.equal(parsed.plan.workflows[0].paths[0],'src/retry.ts');
  assert.equal(parsed.plan.completionCriteria.length,1);
  assert.equal(parseYaml(fs.readFileSync(path.join(bundle,'approval/index.yaml'),'utf8')).jobs.review.status,'pending');
  assert.throws(()=>exportGoalPresentation(source,'review',output),/exists/);
});

test('bad digest or missing workflow fails without creating presentation output',t=>{
  const {root,source}=fixture(t),dest=path.join(root,'rejected');
  assert.throws(()=>exportGoalPresentation(source,'missing',dest),/does not exist/);assert.equal(fs.existsSync(dest),false);
  const data=parseYaml(fs.readFileSync(source,'utf8'));data.plan.finalOutcome='Changed without rebinding';
  fs.writeFileSync(source,stringifyYaml(data));
  assert.throws(()=>exportGoalPresentation(source,'review',dest),/digest mismatch/);assert.equal(fs.existsSync(dest),false);
});

test('linked output parent cannot write outside the selected presentation location',t=>{
  const {root,source}=fixture(t),external=path.join(root,'external'),link=path.join(root,'link');
  fs.mkdirSync(external);
  fs.symlinkSync(external,link,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>exportGoalPresentation(source,'review',path.join(link,'output')),/links/);
  assert.deepEqual(fs.readdirSync(external),[]);
});
