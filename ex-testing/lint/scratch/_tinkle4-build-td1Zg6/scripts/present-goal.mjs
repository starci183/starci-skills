import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml, stringifyYaml} from '../core/yaml.mjs';
import { readDistJson } from '../core/runtime-root.mjs';
import {validatePlan} from '../workflows/plan.mjs';
import {assertNewStoragePath} from '../workflows/storage.mjs';
import {renderPlan} from './plan.mjs';

const catalog=readDistJson('workflows','catalog.json');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

function noLinkedPath(target) {
  let current=target;
  while(!fs.existsSync(current)) {
    // existsSync is false for dangling links too; do not treat them as absent.
    try { if(fs.lstatSync(current).isSymbolicLink())throw Error('Presentation path cannot follow links'); }
    catch(error) { if(error.code!=='ENOENT')throw error; }
    const parent=path.dirname(current);
    if(parent===current)throw Error('Presentation path has no existing parent');
    current=parent;
  }
  if(fs.lstatSync(current).isSymbolicLink()||!samePath(fs.realpathSync(current),current))throw Error('Presentation path cannot follow links');
}

/** Read-only snapshot of a complete Plan goal; never an approval or a new Plan. */
export function exportGoalPresentation(sourceFile,jobId,destination) {
  const source=path.resolve(sourceFile),dir=path.resolve(destination);
  noLinkedPath(source);
  if(!fs.statSync(source).isFile())throw Error('Source goal must be a regular file');
  const bytes=fs.readFileSync(source),data=parseYaml(bytes.toString('utf8'));
  if(data?.schema!=='starci/plan-goal@1'||data.plan?.schema!=='starci/plan@2')throw Error('A current Plan v2 goal/index.yaml is required');
  const checked=validatePlan(data.plan,catalog);
  if(checked.digest!==data.planDigest)throw Error('Source Plan digest mismatch; do not export stale goals');
  const job=data.plan.workflows.find(candidate=>candidate.id===jobId);
  if(!job)throw Error('Selected workflow job does not exist in this Plan');
  assertNewStoragePath(dir);
  noLinkedPath(dir);
  if(fs.existsSync(dir))throw Error('Presentation destination exists; never overwrite a presented snapshot');
  const frozen=data.jobs?.[jobId];
  const presentation={
    schema:'starci/goal-presentation@1',
    jobId,workflow:job.workflow,sourceGoal:source,sourceSha256:sha256(bytes),
    planDigest:data.planDigest,
    goalStage:frozen?'recorded-goal-unverified':'plan-proposal',
    goalDigest:frozen?.goalDigest??null,
    authority:'none; export does not approve, accept, dispatch or alter Plan/run state',
    files:{goal:'goal.yaml',readable:'goal.md'},
  };
  const lines=[
    '# Workflow goal presentation','',`Job: ${job.id} (${job.workflow}).`,'',
    frozen?'A workflow goal is recorded below; this exporter does not validate its approval or execution readiness.':'This is a Plan-stage proposal; no concrete frozen workflow goal has been recorded yet.',
    '',`Source goal SHA-256: ${presentation.sourceSha256}.`,
    '', 'This is a read-only presentation snapshot, not approval. The source Plan and its bound approval/run records remain authoritative.',
    '', '## Selected workflow detail','', '```yaml',stringifyYaml(job).trimEnd(),'```',
  ];
  if(frozen)lines.push('','## Recorded workflow goal','', '```yaml',stringifyYaml(frozen).trimEnd(),'```');
  lines.push('','## Complete Plan','',renderPlan(data.plan));
  // Check everything before creating output; fail rather than mixing revisions.
  if(!fs.readFileSync(source).equals(bytes))throw Error('Source goal changed during presentation');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'goal.yaml'),bytes,{flag:'wx'});
  fs.writeFileSync(path.join(dir,'goal.md'),lines.join('\n')+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(dir,'presentation.yaml'),stringifyYaml(presentation),{flag:'wx'});
  return presentation;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);
    if(args.length!==3)throw Error('Use present-goal.mjs <goal/index.yaml> <job-id> <new-local-presentation-directory>');
    process.stdout.write(JSON.stringify(exportGoalPresentation(...args))+'\n');
  } catch(error) {process.stderr.write(error.message+'\n');process.exitCode=1;}
}
