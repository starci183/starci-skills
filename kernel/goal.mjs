import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {skillRoot} from '../core/runtime-root.mjs';
import * as llm from '../models/functions.mjs';
import * as work from './ledger.mjs';
import {resolveLedgerRoot} from './routing.mjs';
import {loadRuntimes} from './schedule.mjs';
import {loadsFileFor,readLoads} from './loads.mjs';
import {resolveExecutionChain} from './chains.mjs';
import {GOAL_RECORD,WORK_LEDGER,allowlistsOverlap,byId,describeNode,dynamicBudget,firstLine,hostMissing,kindRole,
  launchOperator,ledgerBinding,ledgerItem,locateSharedTreePaths,need,parseGate,parseQuota,plain,required,slash,tail,toOp,
  unique,workModule,workOpId,writeJson} from './common.mjs';
import {decisionKindFor} from './io.mjs';
import {OWNER_ASK,openOwnerAsk} from './owner.mjs';
import {laneView} from './lanes.mjs';
import {intakeOp,scopeNames} from './intake.mjs';
import {cutOpFor,cutPlanned,cutReason,deriveWorkOp,designGate,laneOf,laneText,laneWalked} from './sync.mjs';
import {noteBrand} from './verify.mjs';

/**
 * The goal phase: everything that happens before the one human gate, and nothing that happens after it.
 *
 * It is one concern even though it reads two ways. On the Work ledger the TODO list already exists and the
 * phase only derives operations from it; on a plan ledger a model assesses one. Both end the same way - the
 * goal is critiqued, the page is written, the workflow stops - and that ending is the reason this is a file of
 * its own: the critique, the prerequisites it turns into intakes, the quota proposal and the approval are the
 * argument the owner reads and answers, and none of them are part of the loop that runs afterwards.
 */

/**
 * Phase `goal`. The Work ledger mode derives the TODO list from the authored tree; the plan mode asks a
 * model to assess one. Either way the kernel writes goal.md and goal.json and stops for the one approval.
 */
export function goalPhase(store,state,options={}){
  const phased=state.ledgerMode===WORK_LEDGER?workGoalPhase(store,state,options):planGoalPhase(store,state,options);
  // goal.md is written by the phase (a model renders the plan one), so the critique section and the lane header
  // are spliced in afterwards: whatever else the page says, a reader sees the objections to the goal before the
  // definition of done, and the worktree this workflow owns before anything else.
  if(phased?.ok&&plain(state.critique))noteCritiqueInGoal(store,state);
  if(phased?.ok&&plain(state.lane))noteLaneInGoal(store,state);
  return {...phased,...(plain(state.lane)?{lane:laneView(state)}:{}),...(plain(state.critique)?{critique:critiqueView(state)}:{})};
}

/** The two lines of goal.md that name the lane and the base it goes home to, under the title. */
export function laneHeaderLines(state){
  const lane=state.lane;
  return [`Lane \`${lane.name}\` - worktree \`${slash(lane.worktree)}\` on branch \`${lane.branch}\`: this workflow`,
    `owns that tree alone. Its branch is merged into \`${lane.base?.branch}\` in \`${slash(lane.base?.worktree??'')}\` when the workflow finishes done.`];
}
export function noteLaneInGoal(store,state){
  let page='';
  try{page=fs.readFileSync(store.paths.goal,'utf8');}catch{page='';}
  if(page.includes(`Lane \`${state.lane.name}\``))return;
  const lines=page.split('\n');
  const title=lines.findIndex(line=>line.startsWith('# '));
  const header=['',...laneHeaderLines(state)];
  lines.splice(title<0?0:title+1,0,...header);
  fs.writeFileSync(store.paths.goal,lines.join('\n'));
}

/* ------------------------------------------------------------------ the critique of the goal */

/**
 * Every goal a person writes is critiqued by the runtime before anything is planned from it. The critique is a
 * phase of the kernel, not a helper session: `critiqueGoal` is called in both ledger modes after the assessment
 * and before the approval page is written, its verdict is recorded in `state.critique`, in goal.json and in
 * goal.md above the definition of done, and the verdict has consequences - `revise` binds every operation
 * through its contract, `refuse` refuses the approval until the question is answered or the owner overrides it.
 * A provider that cannot answer never blocks a workflow: that is one event and one line on the page.
 */
/** Decision kinds whose accepted record is the product's own law: what a goal is critiqued against. */
const DECIDED_KINDS=['business','business-overview','architecture'];
/** Keys of an srs/sds payload that carry what the record states and what it was accepted against. */
const STATEMENT_KEYS=['statements','acceptanceCriteria','acceptance','criteria','closureCriteria','invariants','requirement','goal','question'];
/**
 * The statements of one decided record: the strings under a statement key of its `extensions.work3.srs` or
 * `.sds` payload, flattened, trimmed and capped, so the critic reads what the record states and not its tree.
 */
export function recordStatements(payload,{max=12,maxChars=300}={}){
  const found=[];
  const collect=(value,depth)=>{
    if(found.length>=max||depth>6)return;
    if(typeof value==='string'){const line=String(value).replace(/\s+/g,' ').trim();if(line)found.push(line.slice(0,maxChars));return;}
    if(Array.isArray(value)){for(const item of value)collect(item,depth+1);return;}
    if(plain(value))for(const item of Object.values(value))collect(item,depth+1);
  };
  const walk=(value,depth)=>{
    if(found.length>=max||depth>6)return;
    if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}
    if(!plain(value))return;
    for(const [key,item] of Object.entries(value))STATEMENT_KEYS.includes(key)?collect(item,depth+1):walk(item,depth+1);
  };
  walk(payload,0);
  return unique(found).slice(0,max);
}
/**
 * The records the product has already accepted in scope: every decided business or architecture node with the
 * statements and acceptance criteria of its authored payload. This is the evidence the critic names, so an
 * objection that contradicts one of them is actionable and one that names none is dropped.
 */
export function decidedRecords(api,at,loaded,{scope=[],max=40}={}){
  const list=Array.isArray(loaded?.list)?loaded.list:[];
  const chosen=scope.length?list.filter(node=>scope.some(entry=>scopeNames(node,entry))):list;
  const records=[];
  for(const node of chosen){
    if(records.length>=max)break;
    if(!DECIDED_KINDS.includes(node.kind)||node.state!=='done')continue;
    let raw=null;
    try{raw=typeof api?.readNode==='function'?api.readNode(at,node):null;}catch{raw=null;}
    const work3=raw?.extensions?.work3??null;
    records.push({id:node.id,kind:node.kind,
      title:[raw?.description,raw?.title,raw?.name].map(value=>String(value??'').trim()).find(Boolean)||String(node.id),
      statements:recordStatements(work3?.srs??work3?.sds??work3??null)});
  }
  return records;
}

/** `<host>/config.json` may set `critique.runtimes`: the critics every goal is challenged on, first answer wins. Astra first by default: one call per goal, and Fable's week is the scarcer window. */
export function critiqueRuntimes(host){
  try{
    const config=JSON.parse(fs.readFileSync(path.join(host,'config.json'),'utf8'));
    const listed=Array.isArray(config?.critique?.runtimes)?config.critique.runtimes:typeof config?.critique==='string'?[config.critique]:null;
    const runtimes=(listed??[]).filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim());
    return runtimes.length?runtimes:llm.DEFAULT_CRITIC_RUNTIMES;
  }catch{return llm.DEFAULT_CRITIC_RUNTIMES;}
}

/**
 * Run the critique and record it. The providers are the host's supervisor runtimes (`supervisor.runtimes` in
 * config.json, astra then fable) unless the caller names its own chain. An unanswered critique is
 * `goal-critique-unavailable` and the workflow carries on: a dead provider is not a veto over the owner's job.
 */
export function critiqueGoalPhase(store,state,{critiqueGoal=llm.critiqueGoal,providers=null,cwd=state.worktree,runHeadless,
  ledger=[],decisions=[],records=[],material=[],constraints=[]}={}){
  const chain=providers??critiqueRuntimes(state.host??'');
  const critiqued=typeof critiqueGoal==='function'?critiqueGoal({job:state.job,scope:state.scope??[],ledger,decisions,
    records,material,brand:state.brand??null,constraints,providers:chain,cwd,runHeadless}):null;
  if(!critiqued?.ok){
    state.critique={verdict:'unavailable',objections:[],required:[],alternatives:[],question:null,prerequisites:[],overlaps:[],provider:null,
      at:Date.now(),reason:critiqued?.reason??'critiqueGoal was not available'};
    state.provisions=[];
    // The form errors of the attempts travel with the event: an unavailable critique is only diagnosable from them.
    store.appendEvent({event:'goal-critique-unavailable',reason:state.critique.reason,
      attempts:critiqued?.attempts?.length??0,providers:chain,errors:(critiqued?.attempts??[]).slice(-2).map(item=>({provider:item.provider,errors:(item.errors??[]).slice(0,3)}))});
    return state.critique;
  }
  state.critique={verdict:critiqued.verdict,objections:(critiqued.objections??[]).map(item=>({...item})),
    required:[...(critiqued.required??[])],alternatives:[...(critiqued.alternatives??[])],
    question:critiqued.question??null,prerequisites:(critiqued.prerequisites??[]).filter(plain).map(item=>({...item})),
    // The overlaps with the decided records are the three cases seen from the critic's side: a `reference` is a
    // record the intake must cite, a `conflict` is a decision the owner takes. They reach the goal page and the
    // intake's contract; anything else the critic called an overlap is not a case and is dropped here.
    overlaps:(critiqued.overlaps??[]).filter(plain).map(item=>({record:String(item.record??'').trim(),case:String(item.case??'').trim(),evidence:String(item.evidence??'').trim()}))
      .filter(item=>item.record&&['reference','conflict'].includes(item.case)),
    provider:critiqued.provider??null,at:Date.now(),
    ...((critiqued.dropped??[]).length?{dropped:critiqued.dropped.length}:{})};
  // What only the owner can provide, read once from the WHOLE product rather than discovered one stuck
  // operation at a time. It is state of its own, not part of the critique verdict: the goal page renders it,
  // `workflow-status` prints it, and the operation that needs one asks for it in its own tab when it gets there.
  state.provisions=(critiqued.provisions??[]).filter(plain).map(item=>({kind:String(item.kind??'').trim(),
    name:String(item.name??'').trim(),feature:item.feature?String(item.feature).trim():null,why:String(item.why??'').trim()}))
    .filter(item=>item.kind&&item.name);
  store.appendEvent({event:'goal-critiqued',verdict:state.critique.verdict,objections:state.critique.objections.length,
    provider:state.critique.provider,...(state.critique.prerequisites.length?{prerequisites:state.critique.prerequisites.length}:{}),
    ...(state.critique.overlaps.length?{overlaps:state.critique.overlaps.length}:{}),
    ...((state.provisions??[]).length?{provisions:state.provisions.length}:{}),
    ...(state.critique.dropped?{dropped:state.critique.dropped}:{})});
  return state.critique;
}
/**
 * A prerequisite the critique names is acted on, not only printed. "Add X to the backend" with no record of X
 * is the common case: the goal phase plans the intake that authors X's records first (`work.author` for a
 * feature, `brand.decide` for the brand) and holds every other operation of the goal behind it, so the build
 * starts from a record and never from the prompt. A prerequisite the tree already holds changes nothing; a
 * `decision` is the owner's and stays on the page (`prerequisite-owner`).
 */
export function planCritiquePrerequisites(store,state,{loaded,workRoot,repositories={},ctx=null}){
  const listed=(state.critique?.prerequisites??[]).filter(plain);
  const planned=[];
  for(const item of listed){
    const entry=item.kind==='brand'?'brand':slash(String(item.feature??'')).replace(/\/+$/,'');
    if(!entry)continue;
    // A prerequisite that names a record or a contract rather than a feature ("module command contract") is not a
    // feature to author: it is reported for the owner, never turned into an intake of a folder that cannot exist.
    if(item.kind!=='decision'&&entry!=='brand'&&!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry)){store.appendEvent({event:'prerequisite-unresolved',kind:item.kind,feature:item.feature??null,why:item.why});continue;}
    if(item.kind==='decision'){store.appendEvent({event:'prerequisite-owner',kind:item.kind,feature:item.feature??null,why:item.why});continue;}
    const held=entry==='brand'?Boolean(state.brand):loaded.list.some(node=>scopeNames(node,entry));
    if(held){store.appendEvent({event:'prerequisite-held',kind:item.kind,feature:entry,why:item.why});continue;}
    const existing=state.ops.find(op=>op.intake?.scope===entry);
    if(existing){planned.push(existing);continue;}
    const raw=intakeOp(state,{workRoot,loaded,index:state.ops.filter(op=>op.intake?.scope==='brand').length,entry,repositories});
    const op=toOp(raw,state.ops.length);op.intake=raw.intake;op.difficulty='hard';op.prerequisite={kind:item.kind,why:item.why};
    if(ctx)locateSharedTreePaths(op,ctx);
    state.ops.push(op);planned.push(op);
    store.appendEvent({event:'intake-planned',op:op.id,scope:op.intake.scope,kind:op.kind,allowlist:op.allowlist,prerequisite:item.kind,why:item.why});
  }
  const ids=unique(planned.map(op=>op.id));
  if(ids.length)for(const op of state.ops){if(!ids.includes(op.id))op.dependsOn=unique([...(op.dependsOn??[]),...ids]);}
  return planned;
}
/** The feature a critique line is about: the `features/<name>` of a record id, a path or the sentence itself. */
const featureIn=(...values)=>{
  for(const value of values){
    const text=slash(String(value??''));
    const path=text.match(/features\/([A-Za-z0-9][A-Za-z0-9._-]*)/);
    if(path)return path[1];
    const id=text.match(/^[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\./);
    if(id)return id[1];
  }
  return null;
};
/** Whether one operation touches a feature: its node, its ledger items, its allowlist or its references say so. */
const opTouches=(op,feature)=>[op.nodeId,...(op.ledgerIds??[]),...(op.allowlist??[]),...(op.references??[])]
  .some(value=>featureIn(value)===feature);
/**
 * The hidden decisions the critic found, acted on rather than only printed - and acted on differently depending
 * on what kind of decision it is. This is the owner's ruling of 2026-09-14 as code: a hidden decision that
 * changes nothing observable about money, authority or customer data costs nobody a question here, because the
 * record repair (`business.revise`, `architecture.revise`) settles it the moment an operation actually hits it,
 * towards the most reasonable reading and with the reason in the decision log. A DECISIVE one is the opposite:
 * it is put to the owner as one `owner.ask` of kind `decision` before any operation of its feature runs, which
 * WP8a then takes provisionally on its recommendation so the work is prepared rather than stopped.
 */
export function planCritiqueDecisions(store,state,{ctx=null}={}){
  const hidden=(state.critique?.objections??[]).filter(item=>plain(item)&&item.kind==='hidden-decision');
  const planned=[];
  for(const objection of hidden){
    if(!objection.decisive){
      store.appendEvent({event:'hidden-decision-deferred',claim:firstLine(objection.claim),evidence:firstLine(objection.evidence)});
      continue;
    }
    const feature=featureIn(objection.evidence,objection.claim);
    // The ops this decision stands in front of: the ones that touch its feature, or - when no feature can be
    // read out of the objection at all - every op of the goal, because the kernel may not guess which are safe.
    const touching=state.ops.filter(op=>op.kind!==OWNER_ASK&&(feature?opTouches(op,feature):true));
    const requester=touching[0]??null;
    if(!requester){
      store.appendEvent({event:'decision-unplanned',claim:firstLine(objection.claim),feature,reason:'no operation of this goal touches it'});
      continue;
    }
    const text=`${objection.claim}${objection.consequence?` - ${objection.consequence}`:''} (critique evidence: ${objection.evidence})`;
    // `question.kind: decision` is what makes this the provisional kind: the ask op writes the decision record
    // with numbered options and one recommendation, and the work continues on that recommendation.
    openOwnerAsk(store,state,requester,{kind:'decision',text,options:[]},ctx);
    const ask=state.ops.find(op=>op.kind===OWNER_ASK&&op.question?.text===text)??null;
    if(!ask)continue;
    for(const op of touching)if(op.id!==ask.id&&op.id!==requester.id)op.dependsOn=unique([...(op.dependsOn??[]),ask.id]);
    planned.push(ask);
    store.appendEvent({event:'decision-planned',op:ask.id,feature,claim:firstLine(objection.claim),ops:touching.map(op=>op.id)});
  }
  return planned;
}
export const critiqueView=state=>({verdict:state.critique?.verdict??null,objections:(state.critique?.objections??[]).length,
  required:(state.critique?.required??[]).length,provider:state.critique?.provider??null,
  ...((state.critique?.prerequisites??[]).length?{prerequisites:state.critique.prerequisites.length}:{}),
  ...((state.critique?.overlaps??[]).length?{overlaps:state.critique.overlaps.length}:{}),
  ...(plain(state.critiqueOverride)?{overridden:state.critiqueOverride.reason}:{})});

export const CRITIQUE_HEADING='## Phản biện (critique)';
export const PROVISIONS_HEADING='### The owner provides';
/**
 * What only the owner can provide, read once from the whole product before anything is planned. It is on the
 * goal page for one reason: so the owner knows what is coming, not so they go and gather it now. Nothing waits
 * on this list - the operation that needs a credential, a sandbox account, a dataset or an authority asks for it
 * in its own tab at the moment it needs it, and every other operation carries on.
 */
export function provisionLines(state){
  const provisions=(state?.provisions??[]).filter(plain);
  if(!provisions.length)return [];
  return [``,PROVISIONS_HEADING,``,
    ...provisions.map(item=>`- **${item.kind}** \`${item.name}\`${item.feature?` (feature \`${item.feature}\`)`:''} - ${sentence(item.why)}`),
    ``,`These are yours to provide and nobody else can: the operation that needs one asks for it in its own tab`,
    `at the moment it needs it, with the exact name. Nothing else in this workflow waits for that answer.`];
}
const sentence=value=>{const line=firstLine(value);return !line?'(not stated)':/[.!?]$/.test(line)?line:`${line}.`;};
/** The critique as the user reads it on the approval page: the verdict, the objections with their evidence, then what it demands. */
export function critiqueLines(state){
  const critique=plain(state.critique)?state.critique:{verdict:'unavailable'};
  const by=critique.provider?` (critic \`${critique.provider}\`)`:'';
  const lines=[CRITIQUE_HEADING,``];
  if(critique.verdict==='unavailable'){
    lines.push(`Phản biện: chưa chạy được - no critic runtime answered (${critique.reason??'unavailable'}), so this goal`,
      `was never challenged. The approval is not blocked by that, and nothing here binds an operation.`);
    return [...lines,``];
  }
  lines.push({
    sound:`Verdict: \`sound\`${by} - the critique found nothing that blocks this goal; proceed as written.`,
    revise:`Verdict: \`revise\`${by} - proceed only under the required changes below. They are part of the goal you approve here, and every operation of this workflow carries them in its contract.`,
    refuse:`Verdict: \`refuse\`${by} - this goal contradicts an accepted record or cannot be verified at all, so the approval is refused. Answer the question below and run the goal again, or accept the critique with \`workflow-approve --id ${state.id} --accept-critique "<reason>"\`.`
  }[critique.verdict]??`Verdict: \`${critique.verdict}\`${by}.`);
  if((critique.objections??[]).length){
    lines.push(``);
    for(const objection of critique.objections){
      // A hidden decision says what happens to it, because the two cases cost the owner very different things.
      const decided=objection.kind!=='hidden-decision'?''
        :objection.decisive?' This one moves money, authority or customer data, so it is put to you before the work of its feature starts.'
        :' This one changes no observable outcome about money, authority or customer data, so the runtime settles it towards the most reasonable reading when an operation hits it, states why in the record decision log, and you overturn it there if you disagree.';
      lines.push(`- **${objection.kind}** - ${sentence(objection.claim)} Evidence: ${sentence(objection.evidence)} Consequence: ${sentence(objection.consequence)}${decided}`);
    }
  }
  if(critique.dropped)lines.push(``,`${critique.dropped} objection(s) named no evidence and were dropped by the kernel.`);
  if(['revise','refuse'].includes(critique.verdict)&&(critique.required??[]).length)
    lines.push(``,`### Required changes`,``,...critique.required.map((item,index)=>`${index+1}. ${firstLine(item)}`));
  if((critique.alternatives??[]).length)lines.push(``,`### Alternatives`,``,...critique.alternatives.map(item=>`- ${firstLine(item)}`));
  if(critique.verdict==='refuse'&&critique.question)lines.push(``,`### Question`,``,firstLine(critique.question));
  if((critique.prerequisites??[]).length){
    const opOf=item=>state.ops?.find(op=>op.intake?.scope===(item.kind==='brand'?'brand':slash(String(item.feature??'')).replace(/\/+$/,'')))?.id??null;
    lines.push(``,`### Prerequisites`,``,...critique.prerequisites.map(item=>{
      const op=opOf(item);
      return `- **${item.kind}**${item.feature?` of \`${item.feature}\``:''} - ${sentence(item.why)}${item.kind==='decision'?' The owner decides it.':op?` Planned first as \`${op}\`; every other operation waits for it.`:' The tree already holds it.'}`;
    }));
  }
  // The critic's overlaps are the owner's reading of the three cases before any intake runs: a conflict is a
  // decision only they take, a reference is a record the intake will cite and never restate.
  const conflicts=(critique.overlaps??[]).filter(item=>item.case==='conflict'),cites=(critique.overlaps??[]).filter(item=>item.case==='reference');
  if(conflicts.length)lines.push(``,`### Conflicts for the owner`,``,...conflicts.map(item=>
    `- \`${item.record}\` - ${sentence(item.evidence)} The intake writes this as a \`conflict\` row with a decision record under the feature; the owner decides it with \`workflow-answer\`.`));
  if(cites.length)lines.push(``,`### Records to cite`,``,...cites.map(item=>
    `- \`${item.record}\` - ${sentence(item.evidence)} The intake cites it by id as a \`reference\` row and never restates it.`));
  lines.push(...provisionLines(state));
  if(plain(state.critiqueOverride))lines.push(``,
    `Override: the owner accepted this critique - "${firstLine(state.critiqueOverride.reason)}". An override is the owner's decision, so the kernel does not ask again.`);
  return [...lines,``];
}
/** Write the section into goal.md above the definition of done, replacing the one that is already there. */
export function noteCritiqueInGoal(store,state){
  let page='';
  try{page=fs.readFileSync(store.paths.goal,'utf8');}catch{page='';}
  const lines=page.split('\n');
  const section=critiqueLines(state);
  const at=lines.findIndex(line=>line.trim()===CRITIQUE_HEADING);
  if(at>=0){
    let end=at+1;
    while(end<lines.length&&!lines[end].startsWith('## '))end+=1;
    lines.splice(at,end-at,...section);
  }else{
    const heading=lines.findIndex(line=>line.startsWith('## '));
    const title=lines.findIndex(line=>line.startsWith('# '));
    lines.splice(heading>=0?heading:title<0?lines.length:title+1,0,...section);
  }
  const text=lines.join('\n');
  fs.writeFileSync(store.paths.goal,text.endsWith('\n')?text:`${text}\n`);
}

/* ------------------------------------------------------------------ phase: goal on a plan ledger */

/**
 * Plan ledger: one model call fills the whole plan form (definition of done, ledger, operations), the
 * kernel writes goal.md and goal.json and stops. Nothing is launched before the user approves.
 */
export function planGoalPhase(store,state,{assessGoal=llm.assessGoal,critiqueGoal=llm.critiqueGoal,renderGoalMarkdown=llm.renderGoalMarkdown,extractMaterial=llm.extractMaterial,cwd=state.worktree,providers,runHeadless}={}){
  need(!state.approved,`Workflow ${state.id} is already approved; run workflow-run`);
  need(typeof assessGoal==='function','assessGoal is not available yet in models/functions.mjs');
  const material=typeof extractMaterial==='function'?extractMaterial(state.inputs.map(item=>item.ref),{cwd}):[];
  const assessed=assessGoal({job:state.job,inputs:state.inputs,material,constraints:[
    `every op runs in the one worktree ${slash(state.worktree)} on branch ${state.branch}: allowlists of ops that may run in parallel must be disjoint`,
    `at most ${state.maxParallelOps??10} ops run at a time, and the kernel re-runs every declared check itself before it accepts a done`,
    ...state.inputs.map(item=>`input ${item.kind}: ${item.ref}`)],providers,cwd,runHeadless});
  if(!assessed?.ok){
    store.appendEvent({event:'goal-failed',attempts:assessed?.attempts??null});
    store.saveState(state);
    return {ok:false,id:state.id,reason:assessed?.reason??'assessGoal produced no valid plan',attempts:assessed?.attempts??[]};
  }
  const plan=assessed.value;
  need(Array.isArray(plan.ledger)&&plan.ledger.length,'The plan has no ledger');
  need(Array.isArray(plan.ops)&&plan.ops.length,'The plan has no operations');
  state.definitionOfDone=[...(plan.definitionOfDone??[])];
  state.risks=[...(plan.risks??[])];state.questions=[...(plan.questions??[])];
  // `assessed` is what the plan claims the item already is; `status` is the kernel's own lifecycle. An item
  // the plan calls done has no op building it, so it is carried as `preexisting`: approved by the user, not
  // verified by the kernel, and named as such in the final report.
  state.ledger=plan.ledger.map((item,index)=>({id:item.id??`goal-${index+1}`,title:required(item.title,'ledger title'),
    inputRef:item.inputRef??null,assessed:item.status??'unknown',status:item.status==='done'?'preexisting':'planned',evidence:[]}));
  need(new Set(state.ledger.map(item=>item.id)).size===state.ledger.length,'Ledger ids are not unique');
  state.ops=plan.ops.map(toOp);
  need(new Set(state.ops.map(op=>op.id)).size===state.ops.length,'Operation ids are not unique');
  for(const op of state.ops){
    need(op.allowlist.length,`Operation ${op.id} has an empty allowlist`);
    for(const dependency of op.dependsOn)need(byId(state,dependency),`Operation ${op.id} depends on the unknown ${dependency}`);
    for(const id of op.ledgerIds)need(ledgerItem(state,id),`Operation ${op.id} claims the unknown ledger item ${id}`);
  }
  if(plan.gates&&!state.gates.length)state.gates=plan.gates.map(parseGate);
  // Overlapping allowlists are not fatal: the scheduler never runs two overlapping operations at once.
  const overlaps=[];
  for(const [index,op] of state.ops.entries())for(const other of state.ops.slice(index+1)){
    if(allowlistsOverlap(op.allowlist,other.allowlist)&&!other.dependsOn.includes(op.id)&&!op.dependsOn.includes(other.id))overlaps.push([op.id,other.id]);
  }
  // The goal is critiqued before the page that asks for the approval is written: the plan the model assessed is
  // exactly what the critic reads, so an objection to it is an objection to what the user is about to approve.
  critiqueGoalPhase(store,state,{critiqueGoal,providers,cwd,runHeadless,material,
    ledger:state.ledger.map(item=>({id:item.id,kind:null,title:item.title})),
    constraints:[`the ledger of this goal was assessed by a model, not authored: a ledger item the plan calls done is approved by the user and never verified by the kernel`,
      ...state.inputs.map(item=>`input ${item.kind}: ${item.ref}`)]});
  // The decisive hidden decisions are planned on a plan ledger too: the owner is asked before the work, not after.
  planCritiqueDecisions(store,state,{});
  writeJson(store.paths.goalJson,{schema:GOAL_RECORD,id:state.id,job:state.job,inputs:state.inputs,ledgerMode:state.ledgerMode,
    definitionOfDone:state.definitionOfDone,risks:state.risks,questions:state.questions,critique:state.critique??null,
    ledger:state.ledger,ops:state.ops.map(op=>({id:op.id,kind:op.kind,goal:op.goal,
      ledgerIds:op.ledgerIds,allowlist:op.allowlist,references:op.references,checks:op.checks,acceptance:op.acceptance,dependsOn:op.dependsOn})),
    gates:state.gates,serializedOverlaps:overlaps,assessedBy:assessed.provider??null,provisions:state.provisions??[]});
  const markdown=typeof renderGoalMarkdown==='function'?renderGoalMarkdown(plan,{job:state.job}):null;
  fs.writeFileSync(store.paths.goal,markdown??fallbackGoalMarkdown(state));
  state.phase='awaiting-approval';
  store.appendEvent({event:'goal',ops:state.ops.length,ledger:state.ledger.length,gates:state.gates.length,overlaps});
  store.saveState(state);
  return {ok:true,id:state.id,goal:store.paths.goal,goalJson:store.paths.goalJson,
    ops:state.ops.length,ledger:state.ledger.length,gates:state.gates.length,overlaps,
    next:`review ${slash(store.paths.goal)} and approve with workflow-approve --id ${state.id}`};
}

export function fallbackGoalMarkdown(state){
  return [`# ${state.job}`,``,`Workflow \`${state.id}\` - branch \`${state.branch}\``,``,`## Definition of done`,
    ...state.definitionOfDone.map(item=>`- ${item}`),``,`## Goal ledger`,
    ...state.ledger.map(item=>`- \`${item.id}\` ${item.title}${item.inputRef?` (${item.inputRef})`:''}`),``,`## Operations`,
    ...state.ops.map(op=>`- \`${op.id}\` ${op.kind}: ${firstLine(op.goal)} - allowlist ${op.allowlist.join(', ')}${op.dependsOn.length?` - after ${op.dependsOn.join(', ')}`:''}`),
    ...(state.gates.length?[``,`## Job gates`,...state.gates.map(gate=>`- ${gate.name}: \`${gate.command}\``)]:[])].join('\n')+'\n';
}

/* ------------------------------------------------------------------ phase: goal on the Work ledger */

/**
 * Run the shipped Work validator and return its projection. The binary is resolved from the skill root, so
 * the same call works whether the kernel runs from the authored tree or from its `.dist` copy; `work-ledger`
 * takes this as its injected `validate` instead of guessing the host layout.
 */
export function validateWorkTree({repoRoot,workRoot=null}={}){
  const root=path.resolve(required(repoRoot,'repository root'));
  const tree=workRoot?path.resolve(workRoot):path.join(root,'.starciwork');
  const bin=path.join(skillRoot,'bin','starci.mjs');
  const shown=spawnSync(process.execPath,[bin,'validate',tree],{encoding:'utf8',windowsHide:true,maxBuffer:96*1024*1024});
  const output=(shown.stdout??'').trim();
  need(output,`The Work validator produced no output for ${slash(tree)}: ${tail(shown.stderr,300)||`exit ${shown.status}`}`);
  try{return JSON.parse(output);}catch{throw Error(`The Work validator did not print JSON for ${slash(tree)}`);}
}

const ledgerErrorText=errors=>errors.slice(0,3).map(error=>typeof error==='string'?error:JSON.stringify(error)).join('; ');

/**
 * Work ledger: the TODO list already exists, so the kernel never asks a model to invent one. It loads the
 * tree through the shipped validator, lists the decision candidates and the schedulable executable
 * candidates in scope, and derives every operation from its node - goal from `description`, allowlist from
 * `implementation.changes[].files`, checks from `extensions.work3.checks`, acceptance from `assertions`.
 * A node that declares no allowlist or no checks cannot be launched: it becomes a `needUser` item named
 * "ledger incomplete" in goal.md, because guessing a scope for authored work is not the kernel's to do.
 * The model is asked for one thing only: the definition of done and the risks and questions around it.
 */
export function workGoalPhase(store,state,{assessGoal=llm.assessGoal,critiqueGoal=llm.critiqueGoal,ledgerApi=work,validate=validateWorkTree,cwd=state.worktree,providers,runHeadless,
  ledgerRoot=null,git=spawnSync,resolveLedger=resolveLedgerRoot}={}){
  need(!state.approved,`Workflow ${state.id} is already approved; run workflow-run`);
  // The Work ledger is the branch content of the worktree; only the workflow history lives in the main repository.
  const repoRoot=state.repoRoot??path.resolve(state.worktree);
  state.repoRoot=repoRoot;
  // ... unless another repository of the same product owns the tree: then the code is here and the Work is there.
  const binding=ledgerBinding(state,{repoRoot,host:state.host,ledgerRoot,git,resolve:resolveLedger});
  const at={repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot};
  const repository=ledgerApi.repositoryName?.(repoRoot)??null;
  const loaded=ledgerApi.loadLedger({...at,validate});
  const scope=state.scope.length?state.scope:null;
  const executables=ledgerApi.executableCandidates(loaded,{scope,repository,side:binding.side});
  const ready=executables.filter(node=>node.schedulable),incomplete=executables.filter(node=>!node.schedulable);
  // A scope entry that names nothing in the tree is a feature - or the brand - still to be authored. The workflow
  // then begins with one intake operation that writes those records from the job, and the tree, once it has them,
  // says what follows: decisions the owner takes, lanes the kernel walks. Nothing is invented by the kernel itself.
  // `--reintake <feature>` re-authors drafts the tree already holds under the reconciliation rule: the same intake
  // op, in reconcile mode, over the same allowlist - the way a feature authored before that rule is brought under it.
  const reintake=(state.reintake??[]).map(entry=>slash(String(entry??'')).replace(/\/+$/,'')).filter(Boolean);
  const absent=unique([...(scope??[]).filter(entry=>!loaded.list.some(node=>scopeNames(node,entry))),...reintake]);
  const repositories=(()=>{try{return Object.fromEntries(bindingRoutes(binding.binding,{source:path.dirname(path.resolve(state.host??''))}).map(route=>[route.role,route.directory]));}catch{return {};}})();
  // The folders of the other bound repositories, and the folder they all live in, so a path naming one of them
  // is never mistaken for a path of this worktree.
  state.otherRepositories=unique(Object.values(repositories).map(root=>path.basename(String(root))).filter(name=>name&&name!==path.basename(repoRoot)));
  state.repositoriesRoot=state.host?path.basename(path.dirname(path.dirname(path.resolve(state.host)))):null;
  const intake=absent.map((entry,index)=>intakeOp(state,{workRoot:binding.ledgerRoot,loaded,index,entry,repositories,mode:reintake.includes(slash(String(entry)).replace(/\/+$/,''))?'reconcile':'author'}));
  state.decisions=ledgerApi.decisionCandidates(loaded,{scope}).map(node=>({id:node.id,kind:node.kind,path:node.path,
    operation:decisionKindFor(node.kind)??'business.decide',title:describeNode(ledgerApi,at,node)}));
  state.ledgerSummary=ledgerApi.ledgerSummary(loaded,{scope});
  // The brand is part of what the user approves: goal.md and goal.json name the record every design step reads.
  noteBrand(store,state,loaded,{silent:true});
  if(!loaded.ok)state.needUser.push({kind:'ledger',detail:`the Work tree does not validate, so no node in it is a trustworthy TODO: ${ledgerErrorText(loaded.errors)}`});
  for(const node of incomplete)state.needUser.push({node:node.id,kind:'ledger',detail:`ledger incomplete: ${node.reason}`});
  need(ready.length||incomplete.length||state.decisions.length||intake.length,
    `No eligible Work node in scope ${scope?scope.join(', '):'(the whole tree)'}: there is nothing for this workflow to do`);
  // The lane is the template the user approves: every node gets its record here, before any op exists. A
  // frontend build whose drawing is not done yet keeps its lane and waits; it enters the ops once the ui node is.
  state.lanes={};
  for(const node of ready)laneOf(state,node);
  // A held node is still a goal item: it stays `planned` in the ledger with no op, so the workflow cannot finish
  // around it, and its first op is created by `syncLedgerOps` once the drawing it waits for is done.
  const launchable=ready.filter(node=>!designGate(store,state,{api:ledgerApi,at,loaded},node,state.lanes[node.id]));
  state.ledger=ready.map(node=>({id:node.id,title:describeNode(ledgerApi,repoRoot,node),inputRef:node.path,
    kind:node.kind,nodeId:node.id,module:workModule(node),assessed:node.state,status:'planned',evidence:[],
    lane:[...(state.lanes[node.id]?.lane??[])]}));
  // A node too big for one operation is never approved as one long build: what the user reads is the cut that
  // precedes it (`implementation.plan`), and the children it writes are the nodes the lanes are walked for. The
  // measurement is the same one `syncLedgerOps` applies, so the goal page and the run never disagree about it.
  const measured=new Map(launchable.map(node=>[node.id,cutReason({work:{api:ledgerApi,at,loaded}},node,loaded)])
    .filter(([,found])=>Boolean(found)));
  const built=launchable.filter(node=>!measured.has(node.id));
  const taken=new Set(),opOfNode=new Map();
  for(const node of built)opOfNode.set(node.id,workOpId(node.id,taken));
  const cuts=launchable.filter(node=>measured.has(node.id))
    .map(node=>cutOpFor(node,{workRoot:binding.ledgerRoot,found:measured.get(node.id),id:workOpId(`${node.id}-cut`,taken)}));
  state.ops=[...built.map((node,index)=>deriveWorkOp(ledgerApi,at,node,
    {id:opOfNode.get(node.id),opOfNode,index,lane:state.lanes[node.id]?.lane??null,done:[],loaded})),
    ...cuts.map((raw,index)=>{const op=toOp(raw,built.length+index);op.cut=raw.cut;op.difficulty='hard';
      state.lanes[op.nodeId].cut=op.id;return op;}),
    ...intake.map((raw,index)=>{const op=toOp(raw,built.length+cuts.length+index);op.intake=raw.intake;op.difficulty='hard';return op;})];
  for(const op of state.ops.filter(item=>item.cut))cutPlanned(store,op,measured.get(op.nodeId));
  for(const op of state.ops.filter(item=>item.intake))store.appendEvent({event:'intake-planned',op:op.id,scope:op.intake.scope,kind:op.kind,allowlist:op.allowlist,mode:op.intake.mode??'author'});
  for(const op of state.ops)locateSharedTreePaths(op,{work:{shared:binding.sharedLedger,ledger:{repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot}}});
  need(new Set(state.ops.map(op=>op.id)).size===state.ops.length,'Work operation ids are not unique');
  const assessed=typeof assessGoal==='function'?assessGoal({job:state.job,inputs:state.inputs,
    ledger:state.ledger.map(item=>({id:item.id,kind:item.kind,title:item.title,module:item.module})),
    constraints:[
      `the ledger is the authored Work tree under ${slash(binding.ledgerRoot)} and is not yours to change`,
      ...(binding.sharedLedger?[`that tree is owned by ${binding.ownerRepository??slash(binding.ownerRepoRoot)}, not by this repository: the code is written here and the Work is recorded there`]:[]),
      `every op runs in the one worktree ${slash(state.worktree)} on branch ${state.branch} under the node's own allowlist`,
      ...state.inputs.map(item=>`input ${item.kind}: ${item.ref}`)],providers,cwd,runHeadless}):null;
  if(assessed?.ok){
    state.definitionOfDone=[...(assessed.value.definitionOfDone??[])];
    // Difficulty x model capability: the assessment rates every node; the allocator routes by tier inside the quota.
    const rated=new Map((assessed.value.difficulty??[]).map(item=>[item.op,item.level]));
    for(const op of state.ops){op.difficulty=rated.get(op.id)??rated.get(op.nodeId)??op.difficulty??'medium';}
    state.risks=[...(assessed.value.risks??[])];
    state.questions=[...(assessed.value.questions??[])];
  }else{
    // The TODO list is a fact of the tree, so a model that cannot answer does not block the goal: the
    // definition of done falls back to the ledger itself and the failure is recorded as such.
    state.definitionOfDone=state.ledger.map(item=>`\`${item.id}\` is done with checks the kernel re-ran itself`);
    state.questions=incomplete.map(node=>`${node.id}: ${node.reason}`);
    store.appendEvent({event:'goal-assessment-failed',reason:assessed?.reason??'assessGoal was not available',attempts:assessed?.attempts?.length??0});
  }
  // The critique runs whether or not the assessment answered: the job text is the goal, and the records the
  // product already accepted are what it is challenged against. An unanswered critique is an event, never a stop.
  critiqueGoalPhase(store,state,{critiqueGoal,providers,cwd,runHeadless,
    ledger:state.ledger.map(item=>({id:item.id,kind:item.kind,title:item.title})),
    decisions:state.decisions.map(item=>({id:item.id,kind:item.kind,title:item.title})),
    // A feature being authored is reconciled against what the whole product decided, not against its own scope.
    records:decidedRecords(ledgerApi,at,loaded,{scope:intake.length?[]:state.scope}),
    constraints:[
      `the ledger is the authored Work tree under ${slash(binding.ledgerRoot)}: the goal may not add, drop or rewrite a node, so an objection to the ledger is an objection to the scope of this goal`,
      `the Work tree ${loaded.ok?'validates':'does NOT validate'}, and ${state.ledgerSummary?.eligible??0} of ${state.ledgerSummary?.total??0} nodes in scope are eligible`,
      ...state.inputs.map(item=>`input ${item.kind}: ${item.ref}`)]});
  const critiqueCtx={work:{shared:binding.sharedLedger,ledger:{repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot},
    at:{workRoot:binding.ledgerRoot}}};
  planCritiquePrerequisites(store,state,{loaded,workRoot:binding.ledgerRoot,repositories,ctx:critiqueCtx});
  // A hidden decision the critic marked decisive becomes one owner question before the work of its feature; a
  // hidden decision that moves no money, authority or customer data becomes nothing here, because the record
  // repair settles it when an operation actually hits it.
  planCritiqueDecisions(store,state,{ctx:critiqueCtx});
  need(new Set(state.ops.map(op=>op.id)).size===state.ops.length,'Work operation ids are not unique');
  writeJson(store.paths.goalJson,{schema:GOAL_RECORD,id:state.id,job:state.job,inputs:state.inputs,
    ledgerMode:state.ledgerMode,scope:state.scope,workRoot:slash(loaded.workRoot),ledgerValid:loaded.ok,
    ledgerSource:binding.source,ledgerShared:binding.sharedLedger,ledgerOwner:state.ledgerOwner,codeRepository:repository,codeSide:binding.side??null,
    definitionOfDone:state.definitionOfDone,risks:state.risks,questions:state.questions,critique:state.critique??null,
    ledger:state.ledger,decisions:state.decisions,ledgerSummary:state.ledgerSummary,brand:state.brand??null,
    lanes:Object.fromEntries(Object.entries(state.lanes??{}).map(([node,entry])=>[node,[...entry.lane]])),
    ops:state.ops.map(op=>({id:op.id,nodeId:op.nodeId,kind:op.kind,goal:op.goal,ledgerIds:op.ledgerIds,
      allowlist:op.allowlist,references:op.references,checks:op.checks,acceptance:op.acceptance,dependsOn:op.dependsOn})),
    gates:state.gates,needUser:state.needUser,assessedBy:assessed?.provider??null,provisions:state.provisions??[]});
  fs.writeFileSync(store.paths.goal,workGoalMarkdown(state,loaded));
  state.phase='awaiting-approval';
  store.appendEvent({event:'goal',ledgerMode:state.ledgerMode,scope:state.scope,ops:state.ops.length,
    ledger:state.ledger.length,decisions:state.decisions.length,incomplete:incomplete.length,gates:state.gates.length});
  store.saveState(state);
  return {ok:true,id:state.id,ledgerMode:state.ledgerMode,goal:store.paths.goal,goalJson:store.paths.goalJson,
    ops:state.ops.length,ledger:state.ledger.length,decisions:state.decisions.length,
    incomplete:incomplete.map(node=>node.id),needUser:state.needUser,gates:state.gates.length,
    ledgerRoot:slash(binding.ledgerRoot),ledgerSource:binding.source,ledgerShared:binding.sharedLedger,
    ledgerOwner:binding.sharedLedger?(binding.ownerRepository??slash(binding.ownerRepoRoot)):null,
    next:`review ${slash(store.paths.goal)} and approve with workflow-approve --id ${state.id}`};
}

/** goal.md in ledger mode: the nodes the kernel will execute, as the TODO the user approves. */
export function workGoalMarkdown(state,loaded){
  const overlaps=[];
  for(const [index,op] of state.ops.entries())for(const other of state.ops.slice(index+1))
    if(!work.disjoint(op.allowlist,other.allowlist))overlaps.push(`\`${op.id}\` and \`${other.id}\` share paths, so they never run at the same time`);
  const lines=[`# ${state.job}`,``,
    `Workflow \`${state.id}\` - branch \`${state.branch}\` - ledger \`work\` (${slash(loaded.workRoot)})`,
    ...(state.ledgerShared?[``,`The Work tree is owned by \`${state.ledgerOwner?.repository??slash(state.ledgerOwner?.repoRoot??'')}\`, not by this repository: code is written and committed in \`${slash(state.worktree)}\`, and every Work record is written and committed in the owner.`]:[]),
    `Scope: ${state.scope.length?state.scope.map(item=>`\`${item}\``).join(', '):'the whole Work tree'}. `+
    `The Work tree ${loaded.ok?'validates':'does NOT validate'}; ${state.ledgerSummary?.eligible??0} of ${state.ledgerSummary?.total??0} nodes in scope are eligible.`,``,
    `## Definition of done`,``,...state.definitionOfDone.map((item,index)=>`${index+1}. ${item}`),``,
    `## Work nodes this workflow executes`,``,
    `Each node travels its lane: every step is one operation, and the node is recorded done only when the last`,
    `step is accepted. The lane is the template you approve here.`,``,
    `| op | node | kind | lane | module | checks | allowlist |`,`| --- | --- | --- | --- | --- | --- | --- |`];
  for(const op of state.ops){
    const item=ledgerItem(state,op.ledgerIds[0]);
    const entry=state.lanes?.[op.nodeId??''];
    const walked=laneWalked(entry);
    const lane=walked.length?`${laneText(walked)} (this op: step ${walked.indexOf(op.kind)+1} of ${walked.length})`:op.kind;
    lines.push(`| \`${op.id}\` | ${op.nodeId?`\`${op.nodeId}\``:op.intake?`intake of \`${op.intake.scope}\``:'-'} | ${item?.kind??'-'} | ${lane} | ${item?.module??'-'} | ${op.checks.length} | ${op.allowlist.map(entry=>`\`${entry}\``).join(', ')||'-'} |`);
  }
  if(state.decisions.length){
    lines.push(``,`## Decisions still open in scope`,``,`These are answered by a decision, not by an operation in a worktree.`,``);
    for(const decision of state.decisions)lines.push(`- \`${decision.id}\` (${decision.kind}) ${firstLine(decision.title)}`);
  }
  const incomplete=state.needUser.filter(item=>item.kind==='ledger');
  if(incomplete.length){
    lines.push(``,`## Needs you first`,``,
      `A node whose record declares no write scope or no check cannot be launched. The kernel creates one`,
      `\`work.author\` operation per such node - whose only write scope is that node's own \`index.yaml\` - and`,
      `comes back to you only if the record is still incomplete after that operation was accepted. Anything`,
      `listed here without a node id is yours from the start.`,``);
    for(const item of incomplete)lines.push(`- ${item.node?`\`${item.node}\` `:''}${item.detail}`);
  }
  if(overlaps.length)lines.push(``,`## Serialized by a shared allowlist`,``,...overlaps.map(item=>`- ${item}`));
  const proposal=state.quotaProposal??proposeQuota(state);
  lines.push(``,`## Runtime allocation (the user sets this at approval)`,``,`Proposed from the difficulty of the operations (${proposal.summary}). Approve with \`workflow-approve --id ${state.id} --allocation ${proposal.text}\` or pass your own order and slots.`,``,`| runtime | slots (ratio) | difficulty | why |`,`| --- | --- | --- | --- |`,...proposal.rows.map(row=>`| \`${row.runtime}\` | ${row.slots} | ${row.tags} | ${row.why} |`),``,`Slots are both the parallel cap and the fill ratio inside a difficulty tier (4:1 means four operations on the first runtime for one on the second); a runtime without a tag takes every difficulty.`);
  if(state.gates.length)lines.push(``,`## Job gates`,``,...state.gates.map(gate=>`- ${gate.name}: \`${gate.command}\``));
  for(const [heading,items] of [['Risks',state.risks],['Questions',state.questions]]){
    if(!items.length)continue;
    lines.push(``,`## ${heading}`,``,...items.map(item=>`- ${item}`));
  }
  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------------ the quota proposal and the approval */

/** The launch chain of one operation kind, in order, or nothing when the registry cannot resolve it. */
function chainTargets(kind){
  try{return resolveExecutionChain({skill:'starci',op:launchOperator(kind)}).candidates.map(candidate=>candidate.target);}catch{return [];}
}
/** The repository's shared runtime ledger as this workflow sees it; an unreadable one is simply nothing shared. */
function sharedLoadsOf(state){
  try{return readLoads({path:loadsFileFor(state.dir),workflow:state.id});}catch{return null;}
}
/** A quota proposal from the difficulty mix: hard/medium operations lean on the strongest runtimes, easy ones on the cheapest. The user always sets the final numbers. */
export function proposeQuota(state,{runtimes=null,shared=undefined}={}){
  const profile=runtimes??(()=>{try{return loadRuntimes();}catch{return null;}})();
  const ops=state.ops.filter(op=>op.status!=='done');
  const hard=ops.filter(op=>op.difficulty==='hard').length,easy=ops.filter(op=>op.difficulty==='easy').length,medium=ops.length-hard-easy;
  const total=Math.min(ops.length||1,profile?.maxParallelOps??10);
  const order=(profile?.allocation?.preference?.implement??['gpt-5.6-sol','claude-opus','qwen3.8-flash']).filter(id=>profile?.runtimes?.[id]);
  const weights=order.map((id,index)=>index===0?hard+medium*0.6+easy*0.2:index===1?hard*0.4+medium*0.4+easy*0.3:medium*0.2+easy*0.8);
  const sum=weights.reduce((a,b)=>a+b,0)||1;
  let rows=order.map((id,index)=>({runtime:id,slots:Math.max(index===0?1:0,Math.round(total*weights[index]/sum)),tags:index===0?'hard+medium':index===1?'hard+medium':'easy+medium',why:index===0?'strongest tier: hard and most medium operations':index===1?'second tier: medium operations and overflow':'cheapest tier: easy operations and overflow'}));
  const cap=id=>profile?.runtimes?.[id]?.maxParallel;
  rows=rows.map(row=>({...row,slots:Number.isFinite(cap(row.runtime))&&cap(row.runtime)>0?Math.min(row.slots,cap(row.runtime)):row.slots}));
  // Every role the plan needs has a runtime with a slot: a `work.author` op needs the plan role, and a proposal
  // that gave its only slot to a runtime without it left a workflow stalled at its first tick.
  const rolesOf=id=>Array.isArray(profile?.runtimes?.[id]?.roles)?profile.runtimes[id].roles:[];
  for(const role of unique(ops.map(op=>kindRole(op.kind)).filter(Boolean))){
    if(rows.some(row=>row.slots>0&&rolesOf(row.runtime).includes(role)))continue;
    const able=rows.find(row=>rolesOf(row.runtime).includes(role));
    if(able){able.slots=Math.max(1,able.slots);able.why=`${able.why}; the only proposed runtime with the ${role} role`;continue;}
    const id=Object.keys(profile?.runtimes??{}).find(candidate=>rolesOf(candidate).includes(role));
    if(id)rows.push({runtime:id,slots:1,tags:'hard+medium',why:`the ${role} role: no runtime in the preference order has it`});
  }
  // ... and every kind's launch chain: a kind whose chain is [fable, astra] cannot run on a quota that names
  // only Sol, Opus and Qwen, whatever their roles. The first runtime of the chain gets a slot.
  for(const kind of unique(ops.map(op=>op.kind).filter(Boolean))){
    const targets=chainTargets(kind);
    if(!targets.length||rows.some(row=>row.slots>0&&targets.includes(row.runtime)))continue;
    const row=rows.find(item=>targets.includes(item.runtime));
    if(row){row.slots=Math.max(1,row.slots);row.why=`${row.why}; in the launch chain of ${kind}`;continue;}
    rows.push({runtime:targets[0],slots:1,tags:'hard+medium',why:`first of the launch chain of ${kind}`});
  }
  // ... and what the other workflows of this repository are already on: when the first runtime of a kind's chain
  // carries another kernel's operations, the next chain runtime that has the role is proposed a slot as well, so a
  // lane opened while another lane is on Fable proposes Astra without the owner having to say it.
  const outside=shared===undefined?sharedLoadsOf(state):plain(shared)?shared:null;
  for(const kind of unique(ops.map(op=>op.kind).filter(Boolean))){
    const targets=chainTargets(kind);
    const first=targets[0];
    const holder=first?(outside?.ops?.[first]??[])[0]?.workflow??null:null;
    if(!holder)continue;
    const role=kindRole(kind);
    const next=targets.slice(1).find(id=>profile?.runtimes?.[id]&&(!role||rolesOf(id).includes(role)));
    if(!next)continue;
    const row=rows.find(item=>item.runtime===next);
    if(row){row.slots=Math.max(1,row.slots);row.why=`${row.why}; ${first} is busy with ${holder}`;continue;}
    rows.push({runtime:next,slots:1,tags:'hard+medium',why:`next in the launch chain of ${kind}: ${first} is busy with ${holder}`});
  }
  const text=rows.map(row=>`${row.runtime}=${row.slots}:${row.tags}`).join(',');
  const proposal={rows,text,summary:`${hard} hard, ${medium} medium, ${easy} easy of ${ops.length} operations; up to ${total} in parallel`};
  state.quotaProposal=proposal;
  return proposal;
}

export function approve(store,state,{allocation=null,allowDynamic=null,acceptCritique=null,host=null}={}){
  // A goal the critique refused is not approvable as it stands: either the question is answered and the goal is
  // written again, or the owner overrides the critique on the record. An override is the owner's own decision, so
  // it is taken once and never asked for again.
  const refused=state.critique?.verdict==='refuse'&&!plain(state.critiqueOverride);
  const accepted=String(acceptCritique??'').trim();
  if(refused){
    need(accepted,`The critique of goal ${state.id} returned \`refuse\`: ${state.critique.question??'it named no question'} `+
      `Answer that and run workflow-goal again, or accept the critique with workflow-approve --id ${state.id} --accept-critique "<reason>".`);
    state.critiqueOverride={reason:accepted,at:Date.now()};
    store.appendEvent({event:'critique-overridden',reason:accepted,question:state.critique.question??null,
      objections:(state.critique.objections??[]).length});
    noteCritiqueInGoal(store,state);
  }
  if(allocation)state.quota=parseQuota(allocation);
  // `--allow-dynamic N` is the user raising the run-time op budget; ops the gate refused are reinstated with it.
  if(allowDynamic!==null&&allowDynamic!==undefined&&String(allowDynamic).trim()){
    const budget=Number(allowDynamic);
    need(Number.isInteger(budget)&&budget>=0,`--allow-dynamic takes a non-negative integer (0 forbids run-time ops): ${allowDynamic}`);
    const raised=budget>dynamicBudget(state);
    state.dynamicOpsBudget=budget;
    if(raised){
      for(const op of state.ops.filter(item=>item.status==='blocked'&&item.refusal==='dynamic-op')){op.status='pending';op.refusal=null;}
      state.needUser=state.needUser.filter(item=>item.kind!=='dynamic-op');
    }
  }
  // An op a host refused for a capability it lacked is re-admitted the moment the approval comes from a host that
  // has it: the refusal was the host's, not the op's, and this approval is on the record of which host gave it.
  // Without a host descriptor (an approval that names none) nothing is assumed and the refusal stands.
  if(plain(host)){
    for(const op of state.ops.filter(item=>item.status==='blocked'&&item.refusal==='host-unsupported')){
      if(hostMissing(host,op.kind).length)continue;
      op.status='ready';op.refusal=null;op.dispatch=null;op.terminal=null;op.nudged=false;
      state.needUser=state.needUser.filter(entry=>!(entry.op===op.id&&entry.kind==='host'));
      store.appendEvent({event:'op-readmitted',op:op.id,reason:`the ${host.name} host has what ${op.kind} needs`,host:host.name});
    }
  }
  // A workflow that finished `blocked` stopped for the user's decision; the user approving it again IS that
  // decision, so the finish is cleared and the supervisor starts a kernel that carries on from where it stopped.
  if(state.finished&&state.finished.outcome==='blocked'&&state.approved){
    const before=state.finished;
    state.finished=null;state.phase='run';state.stalls=0;state.stalledSince=null;state.kernelErrors=0;
    // The ops a limit exhausted - the validator's rejections, the launch attempts, the restarts, a stall - are the
    // items the policy could not settle, and the owner approving again says: try them again. Their counters start
    // over and their questions go; an op the kernel refused on principle (superseded, out of the repository, a
    // dynamic op over budget) stays refused, because approving again does not change what it was refused for.
    const readmitted=[];
    for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal)){
      // A clean slate: the runtimes a rate limit or a restart taught the op to avoid are open to it again, else an op
      // only one of them can run (a mascot needs Sol) would wait for a slot it may never get.
      op.status='ready';op.validatorRejects=0;op.launchFailures=0;op.restarts=0;op.dispatch=null;op.terminal=null;op.nudged=false;op.avoidRuntimes=[];op.avoidedAt={};
      state.needUser=state.needUser.filter(entry=>!(entry.op===op.id&&['validator','environment','restart','stall'].includes(entry.kind)));
      readmitted.push(op.id);
    }
    store.appendEvent({event:'resumed-after-block',reason:before.reason??null,budget:dynamicBudget(state),readmitted});
    for(const id of readmitted)store.appendEvent({event:'op-readmitted',op:id,reason:'the owner approved the workflow again after it finished blocked'});
  }
  // The user sets the runtime allocation at approval; without --allocation the proposal from goal.md is used and recorded.
  if(!state.quota){const proposal=state.quotaProposal??proposeQuota(state);state.quota=parseQuota(proposal.text);state.quotaSource='proposal';}else state.quotaSource=allocation?'user':state.quotaSource??'user';
  // On the Work ledger a plan may legitimately start with no operation: every candidate in scope declares an
  // incomplete record, and the first ledger sync turns each of those into one `work.author` op. Anything else
  // with no operation is an empty plan and stays unapprovable.
  const toAuthor=state.ledgerMode===WORK_LEDGER?state.needUser.filter(item=>item.kind==='ledger'&&item.node).length:0;
  need(state.ops.length||toAuthor,`Workflow ${state.id} has no plan to approve; run workflow-goal first`);
  state.approved=true;
  if(state.phase!=='finished')state.phase='run';
  store.appendEvent({event:'approved',ops:state.ops.length,toAuthor,quota:state.quota,dynamicOpsBudget:dynamicBudget(state),
    critique:state.critique?.verdict??null});
  store.saveState(state);
  return {ok:true,id:state.id,phase:state.phase,approved:true,ops:state.ops.length,ledger:state.ledger.length,
    quota:state.quota,dynamicOpsBudget:dynamicBudget(state),
    ...(plain(state.critique)?{critique:critiqueView(state)}:{})};
}
