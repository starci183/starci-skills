import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {validatePlan} from '../workflows/plan.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'workflows/catalog.json')));
const clean=x=>String(x).replaceAll('|','\\|').replace(/\r?\n/g,' ');
export function renderPlan(plan){
 validatePlan(plan,catalog);
 const lines=['## Goal',plan.finalOutcome,'','| Area | Action | Outcome | Targets |','| --- | --- | --- | --- |'];
 for(const area of ['business','architecture','implementation','uat']){const v=plan[area];lines.push(`| ${area} | ${v.action} | ${clean(v.outcome)} | ${clean(v.targets.join(', '))} |`);}
 lines.push('','## Workflows','| Order | Workflow | Purpose | Input | Output | Criteria | Estimate |','| --- | --- | --- | --- | --- | --- | --- |');
 plan.workflows.forEach((j,i)=>lines.push(`| ${i+1} | ${j.workflow} | ${clean(j.purpose)} | ${clean(j.input)} | ${clean(j.output)} | ${clean(j.criteria.join('; '))} | ${j.estimate.minMinutes}–${j.estimate.maxMinutes} min; ${clean(j.estimate.assumptions)} |`));
 lines.push('','## Open questions',(plan.openQuestions??[]).join('; ')||'None.');
 lines.push('','## Exclusions',plan.exclusions.join('; ')||'None.','','## Approval','Pending. Present this Plan and wait for an actual user decision.');return lines.join('\n')+'\n';
}
export function createBundle(plan,destination){
 const {digest}=validatePlan(plan,catalog);if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(plan.id))throw Error('Unsafe Plan ID');
 const dir=path.resolve(destination);if(fs.existsSync(dir))throw Error('Destination exists; never overwrite a Plan or its approvals');
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
