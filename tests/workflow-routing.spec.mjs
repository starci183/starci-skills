import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {init,update} from '../bin/starci-skills.mjs';
import {validateWorkflowCatalog,selectWorkflow} from '../workflows/select.mjs';
import {validateJobMatrices} from '../workflows/matrix.mjs';
import {validateCatalog} from '../ops/validate.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(dir,file)=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
const catalog=read(root,'workflows/catalog.json'),jobs=read(root,'workflows/jobs.json'),frontend=read(root,'workflows/frontend.json'),operators=read(root,'ops/catalog.json');
const temp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'starci-routing-'));t.after(()=>{assert.equal(path.dirname(d),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(d).startsWith('starci-routing-'));fs.rmSync(d,{recursive:true,force:true});});return d;};
test('one StarCi skill discovers all eight valid workflows and no preset skill layer',()=>{
  assert.match(fs.readFileSync(path.join(root,'SKILL.md'),'utf8'),/^name: starci$/m);
  assert.equal(fs.existsSync(path.join(root,'skills/catalog.json')),false);
  assert.equal(catalog.workflows.length,8);
  assert.deepEqual(validateWorkflowCatalog(catalog,jobs,frontend),{ok:true,errors:[]});
  assert.deepEqual(validateJobMatrices(jobs,operators),{ok:true,errors:[]});
});
test('unmatched direct work selects exactly task.execute; read-only and explicit choices are preserved',()=>{
  for(const intent of ['small-fix','standalone-deploy','data-correction','unknown',undefined])assert.equal(selectWorkflow(catalog,{intent}).id,'direct-task');
  assert.equal(selectWorkflow(catalog,{intent:'frontend-end-to-end'}).id,'frontend');
  assert.equal(selectWorkflow(catalog,{workflowId:'publish-deploy'}).id,'publish-deploy');
  assert.deepEqual(selectWorkflow(catalog,{readOnly:true}),{kind:'answer-or-inspect'});
  assert.throws(()=>selectWorkflow(catalog,{workflowId:'typo'}));
  const direct=jobs.workflows.find(w=>w.id==='direct-task');
  assert.deepEqual(direct.matrix.map(row=>row.map(c=>c.op)),[['task.execute']]);
});
test('routing rejects hidden workflow sources, missing entries and a multi-op fallback',()=>{
  const reject=change=>{const c=structuredClone(catalog),j=structuredClone(jobs);change(c,j);assert.equal(validateWorkflowCatalog(c,j,frontend).ok,false);};
  reject(c=>c.workflows[0].definition='../foreign.json');
  reject(c=>c.workflows.pop());
  reject(c=>c.workflows.push(c.workflows[0]));
  reject(c=>c.fallback='publish-deploy');
  reject(c=>c.limits.columns=4);
  reject((c,j)=>j.workflows.find(w=>w.id==='direct-task').matrix[0].push({op:'release.deliver'}));
});
test('direct task has no assumed Work/domain prerequisites and cannot grant itself unrestricted effects',()=>{
  const op=operators.ops.find(o=>o.id==='task.execute');assert.ok(op);
  assert.equal(op.contract.adHocPolicy.workTree,'required-workflow-bootstrap');
  assert.equal(op.contract.reads.some(r=>['business','architecture','target'].includes(r.id)),false);
  for(const field of ['authority','workTree','successors']){
    const c=structuredClone(operators);c.ops.find(o=>o.id===op.id).contract.adHocPolicy[field]='unrestricted';
    assert.ok(validateCatalog(c).errors.some(e=>e.code==='DIRECT_TASK_POLICY'));
  }
});
test('relocated CLI selects/displays workflows without creating Work or executing effects',t=>{
  const host=temp(t);init({dir:host,bootstrap:true},()=>{});
  const installed=path.join(host,'.claude');
  assert.equal(fs.existsSync(path.join(installed,'skills/catalog.json')),false);
  const cli=path.join(installed,'bin/starci-skills.mjs');
  for(const args of [['workflows'],['workflow','direct-task'],['route','small-fix']]){
    const out=spawnSync(process.execPath,[cli,'work',...args],{cwd:host,encoding:'utf8',windowsHide:true});
    assert.equal(out.status,0,out.stderr);const result=JSON.parse(out.stdout);if(args[0]!=='workflows')assert.equal(result.executed,false);
  }
  assert.equal(fs.existsSync(path.join(host,'.work')),false);
  assert.equal(fs.existsSync(path.join(host,'result.json')),false);
});
test('upgrading an old preset bootstrap retires owned presets while preserving custom work and V2 docs/sites',t=>{
  const host=temp(t);init({dir:host,bootstrap:true},()=>{});
  const dir=path.join(host,'.claude'),relative='skills/starci-fix/SKILL.md',bytes='Old installer-owned preset';
  fs.mkdirSync(path.dirname(path.join(dir,relative)),{recursive:true});fs.writeFileSync(path.join(dir,relative),bytes);
  const manifest=read(dir,'.starci-skills.json');manifest.files[relative]=crypto.createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(path.join(dir,'.starci-skills.json'),JSON.stringify(manifest));
  const old='<!-- starci:prompt-entry -->\nFor product development, enter [StarCi](.claude/INDEX.md), match the prompt to a named preset skill,\nand use its fixed bounded op chain. Across the prompt: at most three sequential waves and three\nconcurrent ops per wave. Track selected scope and evidence in .work; do not invent workflows.\nQuestions need no work ledger. Hand off work outside the selected scope or remaining budget.\n<!-- /starci:prompt-entry -->';
  fs.writeFileSync(path.join(host,'AGENTS.md'),'# Custom retained\n'+old+'\n');
  fs.mkdirSync(path.join(dir,'docs'),{recursive:true});fs.writeFileSync(path.join(dir,'docs/v2.md'),'V2 docs retained');
  update({dir:host,force:true},()=>{});
  assert.equal(fs.existsSync(path.join(dir,relative)),false);
  assert.match(fs.readFileSync(path.join(host,'AGENTS.md'),'utf8'),/single \[StarCi skill\]/);
  assert.match(fs.readFileSync(path.join(host,'AGENTS.md'),'utf8'),/Custom retained/);
  assert.equal(fs.readFileSync(path.join(dir,'docs/v2.md'),'utf8'),'V2 docs retained');
});
