import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {validatePlan,planAreas} from '../workflows/plan.mjs';
import {assertNewStoragePath} from '../workflows/storage.mjs';
import {autoASAPWindow} from '../workflows/auto.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'workflows/catalog.json')));
const clean=x=>String(x).replaceAll('|','\\|').replace(/\r?\n/g,' ');
export function renderPlan(plan){
 validatePlan(plan,catalog);
 const lines=['## Goal',plan.finalOutcome,'',`Mode: ${plan.mode??'manual'}.`];
 if(plan.mode==='auto') {
  const asap=autoASAPWindow(plan);
  lines.push('', '## Auto ASAP',`Candidate initial chain: ${asap.candidateJobIds.join(' → ')||'none'}. Estimate: ${asap.estimate.minMinutes}–${asap.estimate.maxMinutes} minutes.`, `Later in this same Plan: ${asap.laterJobIds.join(' → ')||'none'}. Checkpoint: ${asap.checkpoint?.reason??'terminal review'}.`, 'Advisory only: each job still requires current delegation, predecessor proof, risk assessment and remaining budget. Later job questions do not block this initial chain.');
  lines.push(`Auto budget: ${plan.auto.maxMinutes} minutes. Delegated technical acceptance: ${plan.auto.acceptance}. No production, publishing, real-data correction or runtime self-update authority.`,'','| Auto job | Environment | Business ceiling | Resource effects |','| --- | --- | --- | --- |');
  for(const j of plan.workflows)lines.push(`| ${clean(j.id)} | ${j.auto.environment} | ${clean(j.auto.business.join('; '))} | ${clean(j.auto.resourceEffects.map(e=>`${e.target}: ${e.operation} → ${e.postcondition}`).join('; '))} |`);
 }
 lines.push('','| Area | Action | Outcome | Targets |','| --- | --- | --- | --- |');
 for(const area of planAreas(plan)){const v=plan[area];lines.push(`| ${area} | ${v.action} | ${clean(v.outcome)} | ${clean(v.targets.join(', '))} |`);}
 if(plan.schema==='starci/plan@2') {
  lines.push('','## Coverage','| Area | Producing workflows | Reuse evidence / scope reason |','| --- | --- | --- |');
  for(const area of planAreas(plan)){const v=plan[area];lines.push(`| ${area} | ${clean(v.workflowIds.join(', '))} | ${clean([...v.evidence,v.reason].filter(Boolean).join('; '))} |`);}
  lines.push('','## Plan completion','| Criterion | Terminal outcome | Producing workflows |','| --- | --- | --- |');
  for(const c of plan.completionCriteria)lines.push(`| ${clean(c.id)} | ${clean(c.outcome)} | ${clean(c.workflowIds.join(', '))} |`);
 } else lines.push('','Legacy Plan v1: end-to-end coverage is not verified. Revise explicitly to v2 before presenting a new workflow goal; existing receipts are not migrated.');
 lines.push('','## Workflows','| Order | Workflow | Purpose | Input | Output | Criteria | Estimate |','| --- | --- | --- | --- | --- | --- | --- |');
 plan.workflows.forEach((j,i)=>lines.push(`| ${i+1} | ${j.workflow} | ${clean(j.purpose)} | ${clean(j.input)} | ${clean(j.output)} | ${clean(j.criteria.join('; '))} | ${j.estimate.minMinutes}–${j.estimate.maxMinutes} min; ${clean(j.estimate.assumptions)} |`));
 if(plan.schema==='starci/plan@2') {
  lines.push('','## Workflow checkpoints','| Job | Questions to resolve before this goal |','| --- | --- |');
  for(const j of plan.workflows)lines.push(`| ${clean(j.id)} | ${clean(j.openQuestions.join('; ')||(plan.mode==='auto'?'None; announce concrete goal and assess risk under explicit Plan delegation.':'None; present and confirm this workflow goal before effects.'))} |`);
 }
 lines.push('','## Open questions',(plan.openQuestions??[]).join('; ')||'None.');
 lines.push('','## Exclusions',plan.exclusions.join('; ')||'None.','','## Approval','Pending. Present this Plan and wait for an actual user decision.');return lines.join('\n')+'\n';
}
export function createBundle(plan,destination){
 if(plan?.schema!=='starci/plan@2')throw Error('New Plan bundles require starci/plan@2; do not silently migrate legacy approvals');
 const {digest}=validatePlan(plan,catalog);if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(plan.id))throw Error('Unsafe Plan ID');
 const dir=path.resolve(destination);if(fs.existsSync(dir))throw Error('Destination exists; never overwrite a Plan or its approvals');
 assertNewStoragePath(dir);
 let parent=path.dirname(dir);while(!fs.existsSync(parent))parent=path.dirname(parent);if(fs.lstatSync(parent).isSymbolicLink()||fs.realpathSync(parent).toLowerCase()!==parent.toLowerCase())throw Error('Plan destination cannot follow links');
 const approvals={},runs={};for(const j of plan.workflows){approvals[j.id]={status:'pending',presentation:null,receipts:[]};runs[j.id]={workflow:j.workflow,status:'planned',dependsOn:j.dependsOn,requests:{},responses:{},evidence:[]};}
 const docs={'index.yaml':{schema:'starci/plan-index@1',id:plan.id,goal:'goal/index.yaml',approval:'approval/index.yaml',run:'run/index.yaml'},'goal/index.yaml':{schema:'starci/plan-goal@1',planDigest:digest,plan,jobs:{}},'approval/index.yaml':{schema:'starci/plan-approval@1',planDigest:digest,jobs:approvals},'run/index.yaml':{schema:'starci/plan-run@1',planDigest:digest,status:'awaiting-plan-approval',jobs:runs}};
 for(const [p,doc]of Object.entries(docs)){const file=path.join(dir,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(doc),{flag:'wx'});}return dir;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [command,input,destination]=process.argv.slice(2);if(command==='template'){process.stdout.write(stringifyYaml(JSON.parse(fs.readFileSync(path.join(root,'workflows/plan.template.json')))));}
 else {const data=parseYaml(fs.readFileSync(input,'utf8'));const plan=data.plan??data;if(command==='create'&&destination)process.stdout.write(createBundle(plan,destination)+'\n');else if(command==='render')process.stdout.write(renderPlan(plan));else throw Error('Use plan.mjs template | create <filled-plan.yaml> <new-plan-directory> | render <plan-or-goal.yaml>');}}
 catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
}
