import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../core/yaml.mjs';
import {settleDispatch} from '../hosts/orca/launch.mjs';
import * as graph from './graph.mjs';
import {AUTHOR_KIND,PLAN_KIND,authorsRecord,BRAND_DECIDE,KERNEL_CHECK,RECORD_OWNED,WORK_LEDGER,WORK_OPERATION,allowRoot,covers,describeNode,firstLine,
  gateDynamicOp,grammarReferences,inside,kernelGuards,kindRole,ledgerItem,liveStatus,locateSharedTreePaths,normalize,pathsIn,plain,
  slash,tail,toOp,unique,UI_KIND,validateCommandAt,workModule,workOpId,workValidateCommand,byId,ledgerAccess,workRootOf} from './common.mjs';
import {kindsReadingBrand} from './io.mjs';
import {brandReferencesOf,kernelProof,noteBrand,provenChecks,rereadBrand,treeVerdictFor} from './verify.mjs';
import {retemplateIntakeOps} from './intake.mjs';
import {bindPlannedAmendmentEffects} from './amendment.mjs';
import {isAuditOperation} from './audit.mjs';

/**
 * The Work tree, read and written. One concern, two directions.
 *
 * Reading: every iteration re-reads the authored tree, and every node it reports schedulable becomes the next
 * step of that node's kind lane (`state.lanes[nodeId]`) - which is why the lane template lives here and not
 * beside the workflow's own worktree lane. Writing: an accepted operation is one lane step, and only the last
 * step of a lane writes `done` with the evidence every step proved. The two belong together because they are
 * the same invariant seen twice: the tree is the TODO list, and the kernel owns what it says about progress.
 */

/* ------------------------------------------------------------------ lanes */

/**
 * A lane is the template a Work node travels: the ordered kinds that must each be accepted before the node's
 * ledger entry may be called done. `state.lanes[nodeId] = {lane:[kind,...], done:[kind,...], checks, head}`
 * is the whole bookkeeping - the graph owns the template, the kernel owns the progress.
 *
 * Backend work is built and then reviewed; frontend work is drawn, built and then proved by a UAT run. The
 * node is one ledger item either way, so the user approves a template, not a pile of operations.
 */
export const LANE_LAYOUTS=['backend','frontend'];
/** The layout a node path declares: `features/x/implementation/frontend/**` is frontend work. */
export function nodeLayout(node){
  const where=slash(node?.path??'');
  for(const layout of LANE_LAYOUTS)if(new RegExp(`(^|/)implementation/${layout}(/|$)`).test(where))return layout;
  return null;
}
/** Kinds the kernel plans itself (`planVerifyOps`), so a node never derives one as its own next step. */
export const KERNEL_PLANNED_KINDS=['review.verify'];
/** The lane record of one node, created the first time the node is seen and never re-templated after that. */
export function laneOf(state,node){
  state.lanes=plain(state.lanes)?state.lanes:{};
  const id=String(node?.id??'');
  const existing=state.lanes[id];
  if(existing?.lane?.length)return existing;
  const lane=(()=>{try{return graph.laneFor({kind:node?.kind??null,layout:nodeLayout(node),repositoryRole:node?.repository??null});}catch{return [];}})();
  // A node that already has accepted ops (a state from before lanes existed) starts its lane where those ops left it.
  // An accepted author op is not one of them: it completed the record the lane is templated from, it walked no step.
  const accepted=state.ops.filter(op=>op.nodeId===id&&op.status==='done'&&!authorsRecord(op.kind)).map(op=>op.kind);
  return state.lanes[id]={lane:[...lane],done:unique([...(existing?.done??[]),...accepted]),checks:[...(existing?.checks??[])],
    // `authored` is the bound on record authoring, not lane progress: it survives a re-template of the lane.
    ...(existing?.authored?{authored:existing.authored}:{}),
    head:existing?.head??state.ops.find(op=>op.nodeId===id&&op.status==='done'&&op.head&&!authorsRecord(op.kind))?.head??null};
}
/** The goal block `goal.*` lane predicates read: the frozen done metrics of the workflow's state. */
export const laneGoal=state=>state?{metrics:state.doneMetrics??null,done:state.definitionOfDone??[]}:null;
export const laneNext=(entry,predicates=null,goal=null)=>{
  try{return graph.nextKind(entry?.lane??[],entry?.done??[],{predicates:predicates??{},goal});}catch{return null;}
};
export const laneText=lane=>(lane??[]).join(' -> ');
/**
 * The optional steps the node's own design record retires right now, kept on the lane entry so every line the
 * user reads - the contract, the status view, the goal table - prints the lane as it is walked, not the template.
 */
export const laneSkip=(entry,predicates=null,goal=null)=>{
  if(!entry?.lane?.length)return [];
  try{entry.skipped=graph.skippedKinds(entry.lane,entry.done??[],{predicates:predicates??{},goal});}catch{entry.skipped=Array.isArray(entry.skipped)?entry.skipped:[];}
  return entry.skipped;
};
/** The lane as the node walks it: every mandatory step and every optional step its record did not retire. */
export const laneWalked=entry=>(entry?.lane??[]).filter(kind=>!(entry?.skipped??[]).includes(kind));
/** `2/3`: how much of a node's walked lane is accepted. What `workflow-status` prints per node. */
export const laneProgress=entry=>{const walked=laneWalked(entry);return walked.length?`${(entry.done??[]).filter(kind=>walked.includes(kind)).length}/${walked.length}`:null;};
/** The id of one lane step: the node id for the first step, then the node id plus the step's action word. */
const laneOpId=(nodeId,kind,first,taken)=>workOpId(first?nodeId:`${nodeId}-${String(kind).split('.').at(-1)}`,taken);
/**
 * A lane is templated the first time its node is seen. When the kinds profile later moves a node to another lane -
 * a `ui` node that used to share the frontend lane, say - the recorded template is stale, so at load every lane
 * whose fresh template differs and still contains every accepted step is re-templated; a lane that already
 * walked a step the new template does not know keeps its old one, and the mismatch stays visible in the events.
 */
export function retemplateLanes(store,state,loaded){
  for(const [id,entry] of Object.entries(plain(state.lanes)?state.lanes:{})){
    const node=loaded?.nodes?.get?.(id);
    if(!node||!Array.isArray(entry?.lane)||!entry.lane.length)continue;
    let fresh=[];
    try{fresh=graph.laneFor({kind:node.kind,layout:nodeLayout(node),repositoryRole:node.repository??null});}catch{continue;}
    if(!fresh.length||fresh.join('|')===entry.lane.join('|'))continue;
    const done=entry.done??[];
    if(!done.every(kind=>fresh.includes(kind))){store.appendEvent({event:'lane-template-stale',node:id,lane:entry.lane,fresh,done});continue;}
    const before=[...entry.lane];
    entry.lane=[...fresh];entry.skipped=[];
    for(const item of state.ledger)if(item.id===id&&Array.isArray(item.lane))item.lane=[...fresh];
    store.appendEvent({event:'lane-retemplated',node:id,from:before,to:fresh});
  }
}

/* ------------------------------------------------------------------ the interface design record */

/**
 * The `ui` node that is a node's interface design record: itself when it is one, else the ui node it references,
 * else the one beside it under its feature (`features/<feature>/ui/index.yaml`). The projection is asked first;
 * a record written after the tree was read is still found on disk, because the record, not the projection, is
 * the authority for what the interface lane still has to do.
 */
export function designNodeOf(access,node){
  if(!plain(node))return null;
  if(node.kind===UI_KIND)return node;
  const nodes=access?.loaded?.nodes;
  const byRef=(Array.isArray(node.refs)?node.refs:[]).map(id=>typeof nodes?.get==='function'?nodes.get(id):null).find(item=>item?.kind===UI_KIND);
  if(byRef)return byRef;
  const module=workModule(node);
  const beside=(access?.loaded?.list??[]).find(item=>item?.kind===UI_KIND&&slash(item.path??'')===`${module}/ui/index.yaml`);
  if(beside)return beside;
  const root=workRootOf(access?.at);
  if(!root||!module.startsWith('features/'))return null;
  const file=path.join(root,module,'ui','index.yaml');
  return fs.existsSync(file)?{id:null,path:`${module}/ui/index.yaml`,kind:UI_KIND,state:null}:null;
}
/**
 * The interface design record a node reads: the `ui:` spec of its ui node - surfaces, states, the candidate
 * images under the node's own assets and the `artworkSlots` the drawing declared - with the record's own state
 * and file. It is read from disk, never inferred: a feature whose ui node was never drawn has surfaces without
 * candidates, and a feature with no ui node at all has no record.
 */
export function designRecord(ctx,node){
  const access=ledgerAccess(ctx);
  if(!access||!plain(node))return null;
  const design=designNodeOf(access,node);
  const root=workRootOf(access.at);
  if(!design||!root||!design.path)return null;
  const file=path.join(root,String(design.path));
  let raw;
  try{raw=parseYaml(fs.readFileSync(file,'utf8'));}catch{return null;}
  if(!plain(raw)||raw.kind!==UI_KIND)return null;
  const spec=plain(raw.ui)?raw.ui:{};
  return {...spec,node:raw.id??design.id??null,state:raw.state??design.state??null,file:slash(file)};
}
const declared=value=>Array.isArray(value)?value.length>0:plain(value)?Object.keys(value).length>0:false;
const slotGenerated=slot=>plain(slot)&&typeof slot.file==='string'&&slot.file.trim()!=='';
/**
 * Predicates an `optionalWhen` lane step reads. Both are facts of the node's design record, never a judgement:
 * `node.hasInterfaceDesign` is true when that record names its surfaces and the candidate images that drew them
 * (so there is nothing left to draw), and `node.hasNoArtworkSlots` is true when it declares no artwork slot or
 * every slot already names its generated file (so there is no artwork left to produce). A node with no record
 * satisfies neither: the step runs until the record says otherwise.
 */
export function lanePredicates(ctx=null,node=null){
  const record=designRecord(ctx,node);
  const drawn=Boolean(record)&&declared(record.surfaces)&&declared(record.assets);
  const slots=Array.isArray(record?.artworkSlots)?record.artworkSlots:[];
  return {
    'node.hasInterfaceDesign':drawn,
    // A record that was never drawn has declared nothing yet: the artwork step stays until the drawing says otherwise.
    'node.hasNoArtworkSlots':drawn&&(!slots.length||slots.every(slotGenerated))
  };
}
/**
 * A frontend implementation is built against the drawing of its feature. While the `ui` node that is that
 * drawing is not done the build waits (`lane-waits-design`, recorded once per drawing), and a feature with no ui
 * node at all is the user's: a build that invents its own screen leaves nothing for the walk to compare
 * against. True when the node must not start its lane now; the same answer in the goal phase and in the run.
 */
export function designGate(store,state,access,node,entry){
  if(!plain(node)||node.kind===UI_KIND||!(entry?.lane??[]).includes('frontend.implement'))return false;
  const design=designRecord(access,node);
  if(!design){
    if(!state.needUser.some(item=>item.node===node.id&&item.kind==='design'))
      state.needUser.push({node:node.id,kind:'design',detail:`no interface design record: the feature of ${node.id} has no ui node for the build to be drawn against; author one (features/<feature>/ui/index.yaml) or reference one`});
    return true;
  }
  if(design.state!=='done'){
    const waiting=design.node??design.file;
    if(entry.waitsDesign!==waiting){entry.waitsDesign=waiting;store.appendEvent({event:'lane-waits-design',node:node.id,design:design.node??null,file:design.file});}
    return true;
  }
  state.needUser=state.needUser.filter(item=>!(item.kind==='design'&&item.node===node.id));
  delete entry.waitsDesign;
  return false;
}
/**
 * The candidate images a ui node's record names, as the hashed evidence assets of its completion: the `ui`
 * completion profile requires a hashed local capture, and the drawing's candidates under the node's own `assets/`
 * are exactly that. Read and hashed here, so the evidence binds the bytes the record was accepted with.
 */
function designEvidenceAssets(access,node){
  if(!plain(node)||![UI_KIND,'implementation'].includes(node.kind))return [];
  const root=workRootOf(access?.at);
  if(!root)return [];
  const directory=path.join(root,path.dirname(String(node.path??'')));
  if(node.kind==='implementation'&&nodeLayout(node)==='frontend'){
    const assetsRoot=path.join(directory,'assets'),files=[];
    const walk=folder=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      const target=path.join(folder,entry.name);
      if(entry.isDirectory())walk(target);else if(entry.isFile()&&!entry.isSymbolicLink())files.push(target);
    }};
    try{if(fs.lstatSync(assetsRoot).isDirectory())walk(assetsRoot);}catch{return [];}
    return files.sort().map(file=>({path:slash(path.relative(directory,file)),scope:'node',sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  }
  const record=designRecord(access,node);
  if(!record)return [];
  const assets=[];
  for(const entry of Array.isArray(record.assets)?record.assets:[]){
    const relative=slash(String(entry?.path??'')).replace(/^\.\//,'');
    if(!relative.startsWith('assets/')||relative.split('/').some(part=>part===''||part==='..'))continue;
    try{
      const bytes=fs.readFileSync(path.join(directory,relative));
      assets.push({path:relative,scope:'node',sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
    }catch{/* a declared candidate that is not on disk is the validator's finding, not a kernel guess */}
  }
  return assets;
}
/** The design record of a node other than itself, tree-relative, as one reference of every op built or walked against it. */
function designReferenceOf(access,node){
  if(!plain(node)||node.kind===UI_KIND)return [];
  const record=designRecord(access,node);
  const root=workRootOf(access?.at);
  if(!record?.file||!root)return [];
  const relative=slash(path.relative(root,record.file));
  return relative&&!relative.startsWith('..')?[relative]:[];
}

/* ------------------------------------------------------------------ one node, one operation */

export function deriveWorkOp(api,repoRoot,node,{id,opOfNode=new Map(),index=0,lane=null,done=[],loaded=null,goal=null}){
  // Lane-aware: the kind of this operation is the node's next lane step, not a fixed map of the node kind.
  const template=lane?.length?lane:(()=>{try{return graph.laneFor({kind:node.kind,layout:nodeLayout(node),repositoryRole:node.repository??null});}catch{return [];}})();
  const access={api,at:repoRoot,loaded};
  const step=(()=>{try{return graph.nextKind(template,done,{predicates:lanePredicates(access,node),goal});}catch{return null;}})();
  const design=kindsReadingBrand().includes(step??'');
  // A ui node's drawing and artwork steps author the design body of the node's own record - the `ui:` spec
  // and the candidates and artwork under its assets - so the exact record path is granted, the way a decision
  // is granted its own record; every other kind is kept off the record the kernel owns.
  const ownRecord=node.kind===UI_KIND&&design?[`.starciwork/${slash(node.path)}`]:[];
  // The implementation contract owns running-page captures under the implementation node, not inside the UI
  // design record. Grant only this assets subtree; index.yaml and evidence remain kernel-owned.
  const ownCapture=node.kind==='implementation'&&nodeLayout(node)==='frontend'&&['frontend.implement','interface.implement'].includes(step)
    ?[`.starciwork/${slash(path.posix.dirname(node.path))}/assets/**`]:[];
  return toOp({id,nodeId:node.id,
    kind:step??WORK_OPERATION[node.kind]??'task.execute',goal:describeNode(api,repoRoot,node),
    ledgerIds:[node.id],allowlist:unique([...node.allowlist,...ownRecord,...ownCapture]),
    // A design-family step reads two bodies of material it may never invent: the installed grammar and the
    // product's own brand record with its assets.
    references:unique([node.path,...(node.refs??[]),...(design?grammarReferences():[]),...(design?brandReferencesOf(api,loaded):[]),...designReferenceOf(access,node)]),
    // The whole-tree validator is the kernel's own gate at acceptance: parallel operations must not fail on a sibling's in-progress ledger write.
    checks:node.checks.filter(check=>!KERNEL_CHECK.test(check.assertion??'')).map(check=>({name:check.assertion??check.command,command:check.command})),
    acceptance:node.assertions.length?node.assertions:[`${node.id} satisfies the Work contract it authored`],
    resources:[...(node.resources??[])],
    // An eligible node has no unsettled dependency, so a dependency inside this set is already done; the
    // mapping is kept so a tree that validates differently still schedules in dependency order.
    dependsOn:(node.dependsOn??[]).map(dep=>opOfNode.get(dep)).filter(Boolean),origin:'ledger'},index);
}

/**
 * Dynamic operations: the Work tree is re-read every iteration and every newly schedulable node (a node the
 * user added, or one whose dependencies just became done) becomes an operation of this workflow.
 */
export function syncLedgerOps(store,state,ctx){
  // The cut gate for ops, not only nodes: a minted implement op past the bounds - a standalone refactor, a
  // repair, a shared change - is cut into disjoint children here, before its first launch and whatever ledger
  // mode the workflow runs. Cut parents are settled against their children in the same pass.
  settleOpCuts(store,state);
  if(!ctx.work){cutOversizedOps(store,state,ctx);return [];}
  let loaded;
  try{loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});}
  catch(error){store.appendEvent({event:'ledger-sync-failed',reason:error.message});return [];}
  ctx.work.loaded=loaded;
  // A brand that moved since the last read is named here too: the re-read is what makes the new rev current.
  noteBrand(store,state,loaded);
  retemplateIntakeOps(store,state,ctx,loaded);
  // An operation created before the repository rule for a node another repository delivers is settled and blocked.
  for(const op of state.ops){
    if(!op.nodeId||op.refusal==='out-of-repository'||!ctx.work.code.repository||typeof ctx.work.api.nodeRepository!=='function')continue;
    const node=loaded.nodes.get(op.nodeId);
    if(!node)continue;
    let foreign=null;try{foreign=ctx.work.api.nodeRepository(ctx.work.api.readNode(ctx.work.at,node));}catch{foreign=null;}
    if(!foreign||foreign===ctx.work.code.repository)continue;
    if(liveStatus.includes(op.status)&&op.dispatch&&ctx.orca){
      settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'out-of-repository',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
      if(op.runtime)ctx.allocator.release(op.runtime,{op:op.id});
    }
    op.status='blocked';op.refusal='out-of-repository';op.dispatch=null;op.terminal=null;
    for(const item of state.ledger)if(item.id===op.nodeId)item.status='out-of-repository';
    store.appendEvent({event:'op-out-of-repository',op:op.id,node:op.nodeId,repository:foreign,own:ctx.work.code.repository});
  }
  let quarantined=false;
  if(!loaded.ok&&quarantineStrays(store,state,ctx,loaded).length){
    // Strays an abandoned operation left in the tree were moved aside: the tree is read again before anything
    // is concluded from its errors.
    try{loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});ctx.work.loaded=loaded;quarantined=loaded.ok;}catch{/* the invalid branch below says what it sees */}
  }
  if(!loaded.ok){
    // No node of an invalid tree is a trustworthy TODO, so nothing is derived from it - and that is said once per
    // distinct set of errors, never silently and never on every tick.
    const signature=unique(loaded.errors.map(error=>`${error.code}:${error.path??''}`)).sort().join('|');
    if(state.ledgerInvalid!==signature){
      state.ledgerInvalid=signature;
      store.appendEvent({event:'ledger-invalid',errors:loaded.errors.slice(0,8).map(error=>({code:error.code,path:error.path??null,message:String(error.message??'').slice(0,160)}))});
    }
    // A tree still red only outside an op's reach is green for that op: the ops the validator exhausted on the
    // whole-tree check are judged again when every remaining error is foreign to them - here, where the tree is
    // actually red, not after a return that never ran on a live backend.
    if(ctx.work){
      for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal&&state.needUser.some(entry=>entry.op===item.id&&entry.kind==='validator'&&/work-valid/.test(String(entry.detail??''))))){
        const verdict=treeVerdictFor(ctx,op);
        if(!verdict.ok)continue;
        op.status='ready';op.validatorRejects=0;op.dispatch=null;op.terminal=null;
        state.needUser=state.needUser.filter(entry=>!(entry.op===op.id&&entry.kind==='validator'));
        store.appendEvent({event:'op-readmitted',op:op.id,reason:`the ${verdict.foreign.length} error(s) of the tree are outside this operation`});
      }
    }
    // A red corner does not stop the rest of the tree. The validator marks the nodes its errors touch, and their
    // dependents, ineligible; every node it still calls eligible is a trustworthy TODO and is derived as usual.
    // Returning here once meant that six missing drawings of a frontend node held every backend integration proof
    // - and the owner's provision tabs behind them - for a whole night.
  }
  if(loaded.ok&&(state.ledgerInvalid||quarantined)){
    state.ledgerInvalid=null;store.appendEvent({event:'ledger-valid-again',...(quarantined?{after:'quarantine'}:{})});
    // Ops the validator exhausted only because the whole-tree check was red are judged again now that it is green.
    for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal&&state.needUser.some(entry=>entry.op===item.id&&entry.kind==='validator'&&/work-valid/.test(String(entry.detail??''))))){
      op.status='ready';op.validatorRejects=0;op.dispatch=null;op.terminal=null;
      state.needUser=state.needUser.filter(entry=>!(entry.op===op.id&&entry.kind==='validator'));
      store.appendEvent({event:'op-readmitted',op:op.id,reason:'the tree is valid again; the validator rejected only its whole-tree check'});
    }
  }
  // A proof is bound to the rules it was proven under: a node whose stored contract digest is not the current
  // one was verified under a declaration that has since changed, so it is reopened here rather than left
  // verified by habit. The kernel only does this when a digest function was given to it (`ctx.contractDigest`).
  reopenStaleProofs(store,state,ctx,loaded);
  const scope=state.scope.length?state.scope:null;
  const taken=new Set(state.ops.map(op=>op.id));
  // A measurement names a node only as its inspection subject. It is neither that node's delivery lane nor a
  // prerequisite which a later delivery operation may inherit.
  const opOfNode=new Map(state.ops.filter(op=>op.nodeId&&!isAuditOperation(op)).map(op=>[op.nodeId,op.id]));
  const added=[];
  pruneAnsweredQuestions(store,state,loaded);
  // A migration (`--migrate`) executes no node: its intakes are the whole workflow, at goal time and on every re-read.
  const candidates=(state.migrate??[]).length?[]:ctx.work.api.executableCandidates(loaded,{scope,repository:ctx.work.code.repository,side:ctx.work.side});
  // A "ledger incomplete" item is only as current as the tree: once its node is schedulable, done, or no longer
  // a candidate at all (foreign, ineligible), the item is stale and goes.
  const incomplete=new Set(candidates.filter(node=>!node.schedulable).map(node=>node.id));
  const doneNow=new Set(loaded.list.filter(node=>node.state==='done').map(node=>node.id));
  state.needUser=state.needUser.filter(item=>{
    if(item.kind!=='ledger')return true;
    if(item.node)return incomplete.has(item.node);
    // An op-keyed item (a refused write) is stale once that op is done and its node is back in the tree, or the node is done.
    const op=state.ops.find(candidate=>candidate.id===item.op);
    if(!op)return true;
    if(doneNow.has(op.nodeId??''))return false;
    return !(op.status==='done'&&op.nodeId&&loaded.nodes.has(op.nodeId));
  });
  for(const node of candidates){
    if(!node.schedulable){
      const authored=authorRecordOp(store,state,ctx,node,taken);
      if(authored)added.push(authored.id);
      continue;
    }
    const entry=laneOf(state,node);
    const inspections=state.ops.filter(op=>op.nodeId===node.id&&isAuditOperation(op));
    const mine=state.ops.filter(op=>op.nodeId===node.id&&!isAuditOperation(op));
    // A report-only audit workflow must not silently turn its stale subject into a delivery operation after the
    // measurement settles. Existing delivery lanes remain independent and continue normally.
    if(inspections.length&&!mine.length)continue;
    // The op that completed this node's record is not a step of its lane: it precedes the lane, so the lane's
    // first step is still the first step and still carries the node's own id.
    const laneOps=mine.filter(op=>!authorsRecord(op.kind));
    // One step at a time: a node yields its next lane step only when nothing of it is still in flight.
    if(mine.some(op=>op.status!=='done'))continue;
    // The design gate comes first even for a cut: a frontend node is cut by screen and region, which is exactly
    // what the feature's drawing settles, so there is nothing to cut it by until that `ui` node is done.
    if(!laneOps.length&&designGate(store,state,{api:ctx.work.api,at:ctx.work.at,loaded},node,entry))continue;
    // Before the lane, and instead of its first step: a node too big to be one operation is cut into children
    // first. The cut runs once per node; when it authored children the node is a derived parent and is not a
    // candidate at all on the next read, and when it reported `cut: none` the node starts its lane as it is.
    if(!laneOps.length){
      const cut=cutOp(store,state,node,ctx,taken);
      if(cut){added.push(cut.id);continue;}
    }
    const predicates=lanePredicates({api:ctx.work.api,at:ctx.work.at,loaded},node);
    laneSkip(entry,predicates,laneGoal(state));
    const next=laneNext(entry,predicates,laneGoal(state));
    // No next step means the lane is walked; `review.verify` is the kernel's own (planVerifyOps), not the node's.
    const onDisk=(()=>{try{return ctx.work.api.readNode(ctx.work.at,node)?.state??node.state;}catch{return node.state;}})();
    if(!next&&laneOps.length&&onDisk==='todo'&&!entry.recordedAttempt){
      // The lane is walked but the tree still says todo: an earlier done write was refused (a rule since fixed).
      // Record it once more from the lane's merged checks; a second refusal stays in needUser.
      const last=[...laneOps].reverse().find(op=>op.status==='done')??laneOps.at(-1);
      entry.recordedAttempt=state.iterations;
      store.appendEvent({event:'lane-record-retry',node:node.id,op:last.id});
      recordDone(store,state,last,ctx,{checks:entry.checks??[]},{nodeId:node.id,head:entry.head??last.head});
      ctx.guards.gitQueue(()=>commitLedgerWrite(store,state,last,ctx,node.id));
      continue;
    }
    // A cut child never plans its own prove step: `e2e.verify` and `review.verify` are planned once per parent.
    if(!next||KERNEL_PLANNED_KINDS.includes(next)||cutChildDefers(state,node.id,next)||mine.some(op=>op.kind===next))continue;
    const id=laneOpId(node.id,next,!laneOps.length,taken);opOfNode.set(node.id,id);
    const op=deriveWorkOp(ctx.work.api,ctx.work.at,node,{id,opOfNode,index:state.ops.length,lane:entry.lane,done:entry.done,loaded,goal:laneGoal(state)});
    bindPlannedAmendmentEffects(state,op,node);
    locateSharedTreePaths(op,ctx);
    op.difficulty=effectiveDifficulty(op);
    op.createdIteration=state.iterations;
    state.ops.push(op);
    if(!ledgerItem(state,node.id))
      state.ledger.push({id:node.id,title:describeNode(ctx.work.api,ctx.work.at,node),inputRef:node.path,kind:node.kind,nodeId:node.id,module:workModule(node),assessed:node.state,status:'planned',evidence:[],lane:[...entry.lane]});
    added.push(op.id);
    store.appendEvent({event:'op-added',op:op.id,node:node.id,kind:op.kind,
      reason:laneOps.length?`lane step ${entry.done.length+1} of ${laneWalked(entry).length} (${laneText(laneWalked(entry))})`:'newly schedulable Work node'});
    gateDynamicOp(store,state,op);
  }
  // And the ops this pass minted pass the same gate before the scheduler can reach them: a lane step whose
  // scope is past the bounds is still cut before its first launch, never launched whole and split later.
  cutOversizedOps(store,state,ctx);
  return added;
}

/**
 * A proof remembers the rules it was proven under. `markDone` stores the digest of the kind's declaration, and
 * a node whose stored digest is not the current one was accepted under a contract that has since changed: it is
 * reopened (`proof-under-old-rule`) so its lane runs again under the rule that holds now.
 *
 * A node that stores NO digest is left alone on purpose. Every proof written before the digest existed would
 * otherwise be reopened at once, which is a whole product's work the owner never asked for; those are reopened
 * only when the owner asks. The digest is taken per kind, and the kind of a node's proof is the last step of
 * its lane - the step whose acceptance wrote `done` - falling back to the node kind for a node with no lane.
 */
function reopenStaleProofs(store,state,ctx,loaded){
  if(typeof ctx.contractDigest!=='function'||typeof ctx.work?.api?.readNode!=='function')return [];
  const reopened=[];
  for(const node of loaded.list??[]){
    if(node.state!=='done')continue;
    let raw=null;try{raw=ctx.work.api.readNode(ctx.work.at,node);}catch{continue;}
    const stored=raw?.extensions?.work3?.kernel?.contractDigest;
    if(typeof stored!=='string'||!stored)continue;
    // The kind whose declaration the proof was bound to is the kind of the op that wrote `done`, which the kernel
    // block records beside the digest; an older block that names none is read as the last step of the node's lane.
    const named=raw?.extensions?.work3?.kernel?.contractKind;
    const lane=(()=>{try{return graph.laneFor({kind:node.kind,layout:nodeLayout(node),repositoryRole:node.repository??null});}catch{return [];}})();
    const kind=(typeof named==='string'&&named.trim())?named.trim():(lane.at(-1)??node.kind);
    let current=null;try{current=ctx.contractDigest(kind);}catch{current=null;}
    if(typeof current!=='string'||!current||current===stored)continue;
    try{ctx.work.api.markReopened(ctx.work.at,node,{reason:`proof-under-old-rule: ${node.id} was proven under an older declaration of ${kind}`,by:'starci-kernel'});}
    catch(error){store.appendEvent({event:'ledger-write-failed',node:node.id,step:'reopened',reason:error.message});continue;}
    reopened.push(node.id);
    store.appendEvent({event:'proof-under-old-rule',node:node.id,kind});
  }
  return reopened;
}

/** The one path an operation may be given inside the ledger: the node's own `index.yaml`, exactly as the guard names it. */
export function recordPath(state,ctx,node){
  const root=ctx.work.ledger?.repoRoot??ctx.work.repoRoot??state.worktree;
  const owned=(ctx.guards??kernelGuards).protectedPaths(node,root)??[];
  return owned.find(entry=>/index\.ya?ml$/.test(entry))??null;
}

/**
 * An incomplete record is an operation's job, not the user's. A candidate the ledger reports `schedulable:false`
 * (it declares no write scope, or no check) gets exactly one `work.author` op whose allowlist is that node's own
 * `index.yaml` and whose only check is the kernel's own whole-tree validator. The bound is the point: one author
 * op per node per workflow, and a record that is still incomplete after that op was accepted is the question the
 * user has to answer - `settleAuthoredRecord` raises it and no second author op is ever created.
 *
 * Two cases keep today's behaviour instead. A tree another repository owns is not in this worktree, so no
 * operation here can be given a path inside it; and a node whose `index.yaml` the guard cannot name has no
 * write scope to grant. Both stay a `needUser` item, because inventing one is exactly what the ledger prevents.
 */
export function authorRecordOp(store,state,ctx,node,taken){
  const lane=laneOf(state,node);
  const record=ctx.work.shared?null:recordPath(state,ctx,node);
  const stop=detail=>{
    if(!state.needUser.some(item=>item.node===node.id&&item.kind==='ledger'))state.needUser.push({node:node.id,kind:'ledger',detail});
    return null;
  };
  if(lane.authored){
    const op=byId(state,lane.authored);
    // Still in flight: the record is being completed and there is nothing to tell the user yet. Finished any
    // other way - accepted, refused, blocked - the node is the user's, because its one author op is spent.
    if(op&&liveStatus.includes(op.status))return null;
    return stop(`ledger incomplete: ${node.reason}`);
  }
  if(!record)return stop(`ledger incomplete: ${node.reason}`);
  const id=workOpId(`${node.id}-author`,taken);
  const op=toOp({id,nodeId:node.id,kind:AUTHOR_KIND,
    goal:`Complete the Work record of ${node.id} so the kernel can launch it: ${node.reason}`,
    // No ledger item: the node enters the workflow's ledger when its own lane starts, not when its record is written.
    ledgerIds:[],allowlist:[record],references:unique([node.path,...(node.refs??[])]),
    checks:[{name:'work-valid',command:workValidateCommand(ctx)}],
    acceptance:['the node declares an allowlist and checks that name its assertions','the tree validates'],
    origin:'ledger'},state.ops.length);
  op.difficulty='hard';
  op.createdIteration=state.iterations;
  lane.authored=op.id;
  state.ops.push(op);
  // The record is being completed now, so it is no longer a question for the user.
  state.needUser=state.needUser.filter(item=>!(item.kind==='ledger'&&item.node===node.id));
  store.appendEvent({event:'op-added',op:op.id,node:node.id,kind:op.kind,reason:`ledger incomplete: ${node.reason}`});
  gateDynamicOp(store,state,op);
  return op;
}

/* ------------------------------------------------------------------ a heavy node is cut, then fanned out */

/**
 * Heavy work runs in parallel. A node whose record asks for more than one operation can deliver is not launched
 * as one long build: a planning operation cuts it into child nodes with disjoint write scopes, the seam that
 * everyone would otherwise share (module wiring, DI registration, migrations, shared contracts and types) is
 * built first and alone, the rest fan out across the free slots, and the proof - `e2e.verify` and `review.verify` -
 * runs ONCE for the whole group on a runtime none of the children used.
 *
 * The three measures below are the whole test of "too big", and all three are facts of the record, never a
 * judgement: how many files the node's write scope names, how many assertions it states, and how many design
 * components the SDS records it references carry. One of them over its bound is one `work.author` op in `cut`
 * mode before the lane and instead of the node's first step; none of them is a node that starts its lane as it is.
 */
export const CUT_FILES=12;
export const CUT_ASSERTIONS=8;
export const CUT_COMPONENTS=3;
/** Default fan-out policy, for a runtimes profile that declares no `allocation.fanOut`. */
export const FAN_OUT={seamFirst:true,maxPerGroup:9};

const DIFFICULTY_RANK={easy:0,medium:1,hard:2};
/**
 * The difficulty an operation's declared scope itself implies, measured on the same axes the cut gate uses,
 * at half the cut bound: the write scope's file count (the op's allowlist and write paths plus every
 * candidate root binding's file list), its assertions, and its named design components. An op approaching
 * the cut bound touches too much of the tree for the cheap tiers to be the answer, even when nothing in
 * the record said `hard`.
 */
export function measuredDifficulty(op){
  const bindings=Array.isArray(op?.candidateRootBindings?.bindings)?op.candidateRootBindings.bindings:[];
  const files=(op?.allowlist??[]).length+(op?.writePaths??[]).length
    +bindings.reduce((total,binding)=>total+(Array.isArray(binding?.allowlist)?binding.allowlist.length:0),0);
  const assertions=(Array.isArray(op?.assertions)?op.assertions:Array.isArray(op?.acceptance)?op.acceptance:[]).length;
  const components=(Array.isArray(op?.components)?op.components:Array.isArray(op?.sdsComponents)?op.sdsComponents:[]).length;
  if(files>=Math.ceil(CUT_FILES/2)||assertions>=Math.ceil(CUT_ASSERTIONS/2)||components>=CUT_COMPONENTS-1)return 'hard';
  if(files<=2&&assertions<=2&&components===0)return 'easy';
  return 'medium';
}
/**
 * The difficulty the allocator sees: the heavier of what the record declared and what its scope measures.
 * A declared `easy` cannot hide a six-file write scope, and a declared `hard` is never downgraded because
 * its allowlist happens to be short.
 */
export function effectiveDifficulty(op){
  const declared=typeof op?.difficulty==='string'&&op.difficulty in DIFFICULTY_RANK?op.difficulty:null;
  const measured=measuredDifficulty(op);
  return declared===null?measured:DIFFICULTY_RANK[measured]>DIFFICULTY_RANK[declared]?measured:declared;
}

const SDS_PATH=/(^|\/)architecture\/(sds|overview)(\/|$)/;
/**
 * The design components the SDS records a node references name. A reference is read from the tree (its record,
 * not the projection), because the count is what the design actually declares: the `components` list of an
 * `extensions.work3.sds` payload, or the record itself when it IS one component leaf.
 */
export function sdsComponents(ctx,node,loaded=null){
  const nodes=(loaded??ctx?.work?.loaded)?.nodes;
  const api=ctx?.work?.api;
  if(typeof api?.readNode!=='function')return [];
  const found=[];
  for(const id of unique([...(node?.refs??[]),...(node?.dependsOn??[])])){
    const target=typeof nodes?.get==='function'?nodes.get(id):null;
    const where=slash(target?.path??String(id??''));
    if(!SDS_PATH.test(where))continue;
    let raw=null;try{raw=api.readNode(ctx.work.at,target??where);}catch{raw=null;}
    const sds=plain(raw?.extensions?.work3?.sds)?raw.extensions.work3.sds:null;
    const components=Array.isArray(sds?.components)?sds.components:[];
    for(const item of components)found.push(String(plain(item)?(item.id??item.name??item.component??JSON.stringify(item)):item));
    if(!components.length&&String(sds?.schema??'')==='starci/sds-component@1')found.push(String(raw?.id??where));
  }
  return unique(found.filter(Boolean));
}

/**
 * Why this node is too big to be one operation, or null. Only a schedulable `implementation` node is measured:
 * a record that does not yet say what it writes is `work.author`'s job first, and a design, a walk or a
 * decision is one answer by construction.
 */
export function cutReason(ctx,node,loaded=null){
  if(String(node?.kind??'')!=='implementation'||node?.schedulable!==true)return null;
  const files=(node.allowlist??[]).length,assertions=(node.assertions??[]).length;
  const components=sdsComponents(ctx,node,loaded);
  const reason=files>CUT_FILES
    ?`its write scope names ${files} files, past the ${CUT_FILES} one operation may hold`
    :assertions>CUT_ASSERTIONS
      ?`it states ${assertions} assertions, past the ${CUT_ASSERTIONS} one operation may prove`
      :components.length>=CUT_COMPONENTS
        ?`the design it references names ${components.length} components (${components.slice(0,6).join(', ')}), which is more than one operation builds`
        :null;
  return reason?{reason,files,assertions,components}:null;
}

/**
 * The cut operation of one node. Its write scope is the node's own folder in the tree - a record write, which
 * is why its kind is `work.author` - its check is the whole-tree validator, and its references are the node,
 * the requirement and design it rests on, and the code its own allowlist names. It is bounded exactly as the
 * record-authoring op is: one per node per workflow (`lane.cut`), whatever it leaves behind.
 */
export function cutOpFor(node,{workRoot,found,id=`${node.id}-cut`}){
  const dir=`.starciwork/${slash(path.dirname(String(node.path??'')))}`;
  return {id,nodeId:node.id,kind:PLAN_KIND,cut:{node:node.id,reason:found.reason},
    goal:`Cut the Work node ${node.id} into child nodes that can be built in parallel: ${found.reason}. Name the SEAM first - the one child that owns what every other child would otherwise touch (module wiring, DI registration, migrations, shared contracts and types) - then cut the rest by acceptance, one observable behaviour each, disjoint from every sibling and from the seam. A node that really is one behaviour is not split: report \`done\` with \`cut: none\`.`,
    // No ledger item and no ledger id: the cut closes no node - the children it writes are the nodes the tree has after it.
    ledgerIds:[],allowlist:[`${dir}/**`],
    references:unique([node.path,...(node.refs??[]),...(node.dependsOn??[]),...(node.allowlist??[])]),
    // Named as the intake's check is, not `work-valid`: a cut may be planned at goal time, and the kernel strips
    // its own `work-valid` from every op it loads. The kernel still validates the tree itself at acceptance.
    checks:[{name:'work-tree-validates',command:validateCommandAt(workRoot)}],
    acceptance:[`${node.id} is a derived parent: no state, no completion, no write scope, its assertions kept as the group's acceptance under extensions.work3.groupAssertions`,
      `every child is written at ${dir}/<part>/index.yaml as work/node@2, kind implementation, state todo, required true, one observable behaviour, an allowlist of at most ${CUT_FILES} files disjoint from every sibling and from the seam, and one runnable check per assertion`,
      'exactly one child is the seam, and every other child dependsOn it',
      `every child assertion traces to the same SRS/SDS ids ${node.id} traced to`,
      'the tree validates'],
    origin:'ledger'};
}
/** The `cut-planned` line every planner writes, so the goal page and the run name the same measurement. */
export const cutPlanned=(store,op,found)=>store.appendEvent({event:'cut-planned',op:op.id,node:op.nodeId,
  reason:found.reason,files:found.files,assertions:found.assertions,components:found.components.length});
export function cutOp(store,state,node,ctx,taken=new Set()){
  const lane=laneOf(state,node);
  if(lane.cut||ctx.work.shared&&!ctx.work.ledger?.repoRoot)return null;
  const found=cutReason(ctx,node,ctx.work.loaded);
  if(!found)return null;
  const op=toOp(cutOpFor(node,{found,workRoot:ctx.work.ledger?.workRoot??path.join(ctx.work.repoRoot,'.starciwork'),
    id:workOpId(`${node.id}-cut`,taken)}),state.ops.length);
  op.cut={node:node.id,reason:found.reason};
  op.difficulty='hard';
  op.createdIteration=state.iterations;
  lane.cut=op.id;
  locateSharedTreePaths(op,ctx);
  state.ops.push(op);
  cutPlanned(store,op,found);
  gateDynamicOp(store,state,op);
  return op;
}

/** The cut groups of this workflow: `state.cuts[parent] = {children, seam, assertions}`, created at acceptance. */
const cutsOf=state=>{state.cuts=plain(state?.cuts)?state.cuts:{};return state.cuts;};
export const cutGroup=(state,parent)=>cutsOf(state)[String(parent??'')]??null;
/** The cut parent of a node, or null. A child never proves itself: its prove steps are the parent's one proof. */
export function cutParentOf(state,nodeId){
  const id=String(nodeId??'');
  if(!id)return null;
  for(const [parent,group] of Object.entries(cutsOf(state)))if((group?.children??[]).includes(id))return parent;
  return null;
}
/** Every child of the cut groups these ledger ids belong to - the set one group proof must cover. */
export const cutSiblings=(state,ledgerIds=[])=>unique(ledgerIds.map(id=>cutParentOf(state,id)).filter(Boolean)
  .flatMap(parent=>cutGroup(state,parent)?.children??[]));
/** True when these ids are part of a cut group but are not all of it: the group proof waits for every child. */
export function groupIncomplete(state,ledgerIds=[]){
  const siblings=cutSiblings(state,ledgerIds);
  return siblings.length>0&&siblings.some(child=>!ledgerIds.includes(child));
}
/** Kinds a cut child never plans for itself: every prove step of its lane belongs to the parent's one proof. */
export const cutChildDefers=(state,nodeId,kind)=>Boolean(cutParentOf(state,nodeId))&&kindRole(kind)==='verify';
/**
 * The one proof this group still owes: the first verify step of the children's lane that some child has not
 * walked yet - `e2e.verify` before `review.verify` - so one API proof and one review cover the whole group.
 */
export function groupVerifyKind(state,ledgerIds=[]){
  const entries=ledgerIds.map(id=>state?.lanes?.[id]).filter(entry=>entry?.lane?.length);
  // Goal-gated proofs are skipped the same way the lane walk skips them: a goal silent on the metric retires
  // the step, a goal that names it keeps it. `skipped` may be stale between laneSkip passes, so evaluate fresh.
  const proves=unique(entries.flatMap(entry=>{
    let skipped=new Set(entry.skipped??[]);
    try{skipped=new Set([...skipped,...graph.skippedKinds(entry.lane,entry.done??[],{goal:laneGoal(state)})]);}catch{}
    return entry.lane.filter(kind=>kindRole(kind)==='verify'&&!skipped.has(kind));
  }));
  return proves.find(kind=>entries.some(entry=>!(entry.done??[]).includes(kind)))??'review.verify';
}

/**
 * An accepted cut is measured against the tree, never against its own report: the ledger is re-read and the
 * children are whatever now sits under the node's folder. Children make the node a derived parent and the group
 * the unit every later proof is planned for (`cut-authored`); no child at all is the honest answer that the node
 * is one behaviour, and the kernel proceeds with it as it is (`cut-none`).
 */
export function settleCut(store,state,op,ctx){
  const nodeId=op.cut?.node??op.nodeId;
  const entry=state.lanes?.[nodeId]??null;
  let loaded=null;
  try{loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});if(loaded.ok)ctx.work.loaded=loaded;}
  catch(error){store.appendEvent({event:'ledger-sync-failed',op:op.id,reason:error.message});}
  const tree=loaded?.ok?loaded:ctx.work.loaded;
  const parent=(tree?.list??[]).find(item=>item.id===nodeId)??ctx.work.node(nodeId)??null;
  const dir=`${slash(path.dirname(String(parent?.path??'')))}/`;
  const children=(tree?.list??[]).filter(item=>item.id!==nodeId&&item.kind===String(parent?.kind??'implementation')
    &&slash(item.path??'').startsWith(dir));
  if(!children.length){
    if(entry)entry.cutNone=true;
    store.appendEvent({event:'cut-none',node:nodeId,op:op.id,reason:'the node is one observable behaviour; it starts its lane as it is'});
    return 'cut-none';
  }
  const ids=children.map(child=>child.id);
  // The seam is a fact of the records: the one child every other child declares it depends on.
  const seam=children.find(child=>children.filter(other=>other.id!==child.id)
    .every(other=>(other.dependsOn??[]).includes(child.id)))??null;
  const assertions=(()=>{try{
    const raw=ctx.work.api.readNode(ctx.work.at,parent);
    const declared=raw?.extensions?.work3?.groupAssertions;
    return Array.isArray(declared)?declared.filter(item=>typeof item==='string'):[];
  }catch{return [];}})();
  cutsOf(state)[nodeId]={children:ids,seam:seam?.id??null,assertions};
  if(entry)entry.cutInto={children:[...ids],seam:seam?.id??null};
  // The parent closes no ledger item of its own any more; its group acceptance is the proof's acceptance.
  state.ledger=state.ledger.filter(item=>item.id!==nodeId);
  state.needUser=state.needUser.filter(item=>!(item.kind==='ledger'&&item.node===nodeId));
  store.appendEvent({event:'cut-authored',node:nodeId,op:op.id,children:ids,seam:seam?.id??null,
    groupAssertions:assertions.length});
  return 'cut-authored';
}

/**
 * The scheduler's fan-out rule, as a fact of the cut group rather than of the allocator: at most
 * `allocation.fanOut.maxPerGroup` children of one parent run at once, and while `seamFirst` holds the seam runs
 * alone - nothing of its group beside it. Returns the reason to defer, or null when the op may launch.
 */
export function fanOutDeferral(state,op,busy=[],ctx=null){
  // Two kinds of group share this rule: a Work node's children (the member's node id is inside the parent's
  // cut group) and a cut op's children (the member's `cutChildOf` names the parent op directly - its own
  // nodeId stays null, because a slice of an operation is not a ledger node).
  const groupOf=item=>item?.cutChildOf??cutParentOf(state,item?.nodeId??(item?.ledgerIds??[])[0]??'');
  const keyOf=item=>item?.cutChildOf?item.id:item?.nodeId;
  const parent=groupOf(op);
  if(!parent)return null;
  const policy=plain(ctx?.allocator?.fanOut)?ctx.allocator.fanOut:FAN_OUT;
  const max=Number.isFinite(policy.maxPerGroup)?policy.maxPerGroup:FAN_OUT.maxPerGroup;
  const seam=(op.cutChildOf?opCutGroup(state,parent):cutGroup(state,parent))?.seam??null;
  const siblings=busy.filter(other=>other.id!==op.id&&groupOf(other)===parent);
  if(policy.seamFirst!==false&&seam){
    if(keyOf(op)===seam&&siblings.length)
      return {reason:`the seam of ${parent} runs alone`,parent,running:siblings.map(other=>other.id)};
    if(keyOf(op)!==seam&&siblings.some(other=>keyOf(other)===seam))
      return {reason:`the seam ${seam} of ${parent} runs alone`,parent,running:[seam]};
  }
  if(siblings.length>=max)
    return {reason:`${max} children of ${parent} already run (allocation.fanOut.maxPerGroup)`,parent,running:siblings.map(other=>other.id)};
  return null;
}

/* ------------------------------------------- an op too big is cut before its first launch */

/** The op-level cut groups of this workflow: `state.opCuts[parentOpId] = {children, seam, assertions}`. */
const opCutsOf=state=>{state.opCuts=plain(state?.opCuts)?state.opCuts:{};return state.opCuts;};
export const opCutGroup=(state,parent)=>opCutsOf(state)[String(parent??'')]??null;

/**
 * Why one operation is too big to launch as it is, or null - the same three measures `cutReason` reads off a
 * Work node, taken on the op's own declared scope: the files its allowlist names, the assertions it must prove
 * and the design components it carries. Only an implement-role op is measured: a plan, a decision, a walk or a
 * proof is one answer by construction, whatever its allowlist names.
 */
export function opCutReason(op){
  if((kindRole(op?.kind)??op?.role)!=='implement')return null;
  const files=(op?.allowlist??[]).length;
  const assertions=(Array.isArray(op?.assertions)?op.assertions:Array.isArray(op?.acceptance)?op.acceptance:[]).length;
  const components=(Array.isArray(op?.components)?op.components:Array.isArray(op?.sdsComponents)?op.sdsComponents:[]).length;
  if(files>CUT_FILES)return `its declared write scope names ${files} files, past the ${CUT_FILES} one operation may hold`;
  if(assertions>CUT_ASSERTIONS)return `it states ${assertions} assertions, past the ${CUT_ASSERTIONS} one operation may prove`;
  if(components>=CUT_COMPONENTS)return `the design it references names ${components} components, which is more than one operation builds`;
  return null;
}

/**
 * The disjoint pieces of one write scope. Allowlist entries that cover each other (`src/**` and `src/x.ts`)
 * name the same files and stay in one class, so no file can land in two children; the classes then pack into
 * child scopes of at most CUT_FILES entries, in allowlist order. A single class past the bound stays one
 * child's whole scope - one file in two children is a silent write conflict, an oversized child is only big.
 */
function scopeChunks(allowlist){
  const classes=[];
  for(const entry of allowlist??[]){
    const hits=classes.filter(cls=>cls.some(other=>covers(other,entry)));
    if(!hits.length){classes.push([entry]);continue;}
    hits[0].push(entry);
    for(const cls of hits.slice(1)){for(const item of cls)if(!hits[0].includes(item))hits[0].push(item);classes.splice(classes.indexOf(cls),1);}
  }
  const chunks=[];
  for(const cls of classes){
    const last=chunks.at(-1);
    if(last&&last.length+cls.length<=CUT_FILES)last.push(...cls);else chunks.push([...cls]);
  }
  return chunks;
}

/** The path shapes that carry what every sibling would otherwise share - wiring, contracts, types, migrations. */
const SEAM_PATH=/(^|\/)(index|mod|main|types?|contracts?|registry|registrations?|wiring|container|di|migrations?|schemas?|config|manifest|barrel|bootstrap|setup|package\.json|tsconfig[^/]*)/i;
const seamScore=chunk=>chunk.reduce((score,entry)=>score+(SEAM_PATH.test(String(entry))?1:0),0);
/** `items` over `count` children: shared whole while inside the bound, contiguous slices past it. */
const spread=(items,count,bound)=>items.length<=bound?Array.from({length:count},()=>[...items])
  :Array.from({length:count},(_,index)=>items.slice(Math.ceil(index*items.length/count),Math.ceil((index+1)*items.length/count)));

/**
 * An op whose own declared scope is past the cut bounds is not launched as one long build: it is cut here -
 * before its first launch and in either ledger mode - into disjoint child ops named `<op>.1`, `<op>.2`, ...,
 * the same treatment a too-big Work node gets before its lane, applied to ops that never pass through a node
 * (standalone and refactor work, repairs, shared changes) or whose scope grew past the bound after minting.
 * The seam child - the one holding what every sibling would otherwise touch - is named, runs first and alone
 * (its siblings depend on it), and the parent op waits as the group's derived parent: it owns no slot, proves
 * nothing itself, and is settled by `settleOpCuts` when every child is.
 */
export function cutOversizedOps(store,state,ctx){
  const taken=new Set(state.ops.map(op=>op.id));
  const minted=[];
  for(const op of [...state.ops]){
    if(!['pending','ready'].includes(op.status))continue;
    // Only a first launch is cut: an op that already ran is answered by retries and repairs, never recut,
    // and an op marked for replan is measured after its scope is rewritten, not before.
    if(op.dispatch||op.terminal||op.lease||op.fill||op.ownerRequest||op.waitingFor||op.needsReplan||(op.attempt??1)>1||(op.reports??[]).length)continue;
    if(plain(op.cut)||op.intake||op.cutChildOf||op.cutChildren||op.refusal==='superseded'||isAuditOperation(op))continue;
    if(opCutsOf(state)[op.id])continue;
    const reason=opCutReason(op);
    if(!reason)continue;
    const chunks=scopeChunks(op.allowlist);
    // One covering class over the whole scope is still one operation - the honest `cut: none` answer.
    if(chunks.length<2)continue;
    const seam=chunks.reduce((best,chunk,index)=>seamScore(chunk)>seamScore(chunks[best])?index:best,0);
    const assertions=Array.isArray(op.assertions)?op.assertions:(op.acceptance??[]);
    const components=Array.isArray(op.components)?op.components:(op.sdsComponents??[]);
    const assertShare=spread(assertions,chunks.length,CUT_ASSERTIONS),componentShare=spread(components,chunks.length,CUT_COMPONENTS-1);
    const ids=chunks.map((_,index)=>workOpId(`${op.id}.${index+1}`,taken));
    chunks.forEach((chunk,index)=>{
      // A child is a slice of the operation, not a node: no nodeId. The group link is `cutChildOf`, and the
      // parent's ledger ids keep the child inside the same proof group, the same avoids and the same lane.
      const child=toOp({id:ids[index],kind:op.kind,
        goal:`${firstLine(op.goal)} - part ${index+1} of ${chunks.length} of ${op.id}${index===seam?' (the seam: what every sibling would otherwise touch)':''}: ${chunk.join(', ')}`,
        ledgerIds:[...(op.ledgerIds??[])],allowlist:chunk,references:[...(op.references??[])],
        checks:(op.checks??[]).map(check=>({...check})),acceptance:[...(assertShare[index].length?assertShare[index]:(op.acceptance??[]))],
        dependsOn:unique([...(op.dependsOn??[]).filter(dep=>dep!==op.id),...(index===seam?[]:[ids[seam]])]),
        // The kernel derives the children by its own rule: a cut is not new dynamic work - the parent's scope
        // already covered every file a child names - so they do not spend the owner's dynamic-op budget. The
        // `cutChildOf` link carries the provenance the origin would have.
        resources:[...(op.resources??[])],avoidRuntimes:[...(op.avoidRuntimes??[])],timeoutMs:op.timeoutMs??null,origin:'gate'},state.ops.length+index);
      child.cutChildOf=op.id;
      // What the parent declared travels with the slice that will actually run it: the fenced roots it may
      // write, the effect grants the amendment ceiling measured, and any pinned runtime list.
      for(const key of ['restrictTo','candidateRootBindings','externalEffects','amendmentEffects','independentReview','provisional'])
        if(op[key]!==undefined&&op[key]!==null)child[key]=structuredClone(op[key]);
      // The scope that forced the cut is the child's declared floor: a slice of a hard op is hard work too.
      child.difficulty=effectiveDifficulty(op);
      child.createdIteration=state.iterations;
      const componentField=Array.isArray(op.components)?'components':'sdsComponents';
      if(componentShare[index].length)child[componentField]=[...componentShare[index]];
      locateSharedTreePaths(child,ctx);
      state.ops.push(child);
      store.appendEvent({event:'op-added',op:child.id,kind:child.kind,reason:`cut child of ${op.id}: ${reason}`});
      gateDynamicOp(store,state,child);
    });
    opCutsOf(state)[op.id]={children:ids,seam:ids[seam],assertions:[...assertions]};
    op.cutChildren=ids;
    op.cutReason=reason;
    op.status='paused';
    store.appendEvent({event:'op-cut',op:op.id,kind:op.kind,reason,children:ids,seam:ids[seam],
      files:(op.allowlist??[]).length,assertions:assertions.length,components:components.length});
    minted.push(op.id);
  }
  return minted;
}

/**
 * A cut op is the derived parent of its group: it owns no runtime slot and proves nothing itself - it waits
 * on its children. When every child is done the parent is done with the group's last head; a child that dies
 * for good blocks the parent with the reason, so the op's dependents read the same answer it would have given.
 */
export function settleOpCuts(store,state){
  const settled=[];
  for(const [parentId,group] of Object.entries(opCutsOf(state))){
    const parent=byId(state,parentId);
    if(!parent||!Array.isArray(parent.cutChildren)||parent.status!=='paused')continue;
    const children=group.children.map(id=>byId(state,id));
    if(children.some(child=>!child))continue;
    // Dead the way the kernel's `deadOp` reads it: failed outright, or blocked by a refusal time will not lift.
    const dead=children.find(child=>child.status==='failed'||(child.status==='blocked'&&child.refusal&&!['launch-cooling','rate-limited'].includes(child.refusal)));
    if(dead){
      parent.status='blocked';parent.refusal='cut-child-failed';
      // The group is dead with its child: the siblings that never launched are cancelled, not left to depend
      // on a seam that can never land.
      for(const child of children)if(['pending','ready'].includes(child.status))child.status='cancelled';
      if(!state.needUser.some(item=>item.op===parent.id&&item.kind==='authority'))state.needUser.push({op:parent.id,kind:'authority',
        detail:`${parent.id} was cut into ${group.children.join(', ')} before its first launch; ${dead.id} is ${dead.status}${dead.refusal?` (${dead.refusal})`:''}`});
      store.appendEvent({event:'cut-parent-blocked',op:parent.id,child:dead.id,status:dead.status,refusal:dead.refusal??null});
      continue;
    }
    if(!children.every(child=>child.status==='done'))continue;
    parent.status='done';parent.verdict='cut';
    parent.head=children.map(child=>child.head).filter(Boolean).at(-1)??parent.head;
    parent.files=unique(children.flatMap(child=>child.files??[]));
    // The lane step the parent stood for was walked by its children: the group's delivery counts once, as its.
    const entry=parent.nodeId?state.lanes?.[parent.nodeId]:null;
    if(entry?.lane?.length)entry.done=unique([...(entry.done??[]),parent.kind]);
    store.appendEvent({event:'cut-parent-settled',op:parent.id,children:group.children});
    settled.push(parent.id);
  }
  return settled;
}

/** The child of a cut group whose build step holds this file, or null when no child's write scope names it. */
export function childOwning(state,ledgerIds=[],file){
  const target=normalize(file);
  for(const id of ledgerIds)
    if(state.ops.some(op=>(op.nodeId===id||(op.ledgerIds??[]).includes(id))&&kindRole(op.kind)==='implement'&&inside(target,op.allowlist??[])))
      return id;
  return null;
}
/**
 * Where a group proof's findings are repaired: the one child whose write scope holds every file the findings
 * name. Findings spread over several children (or over none) stay the group's, exactly as before the cut.
 */
export function repairTarget(state,op,findings=[]){
  const ledgerIds=op?.ledgerIds??[];
  if(!cutSiblings(state,ledgerIds).length)return null;
  const owners=unique(unique(findings.flatMap(pathsIn)).map(file=>childOwning(state,ledgerIds,file)).filter(Boolean));
  if(owners.length!==1)return null;
  const nodeId=owners[0];
  const build=state.ops.find(item=>item.nodeId===nodeId&&kindRole(item.kind)==='implement');
  return {nodeId,ledgerIds:[nodeId],allowlist:build?.allowlist??op.allowlist,checks:build?.checks??op.checks};
}

/**
 * A `ledger` question on the user's list names a node the kernel could not record; when the tree now says that
 * node is done - a later retry wrote it, or the record was repaired - the question is answered and is dropped,
 * with an event, so the morning list carries only what is still true.
 */
export function pruneAnsweredQuestions(store,state,loaded){
  if(!Array.isArray(state.needUser)||!loaded?.nodes)return;
  const kept=[];
  for(const item of state.needUser){
    const keyed=item?.op?state.ops.find(candidate=>candidate.id===item.op):null;
    // A question about an op that was since superseded, or about a shared change that is no longer blocked, has no reason left.
    if(keyed&&keyed.refusal==='superseded'){store.appendEvent({event:'need-user-answered',op:item.op,kind:item.kind,reason:'superseded'});continue;}
    if(item?.kind==='shared-change'){
      const named=(String(item.detail??'').match(/waits for the shared change (\S+), which is blocked/)??[])[1];
      const shared=named?state.ops.find(candidate=>candidate.id===named):null;
      if(shared&&shared.status!=='blocked'){store.appendEvent({event:'need-user-answered',op:item.op??null,kind:item.kind,reason:`${named} is ${shared.status}`});continue;}
    }
    if(item?.kind!=='ledger'){kept.push(item);continue;}
    // An older build asked about "null" after an intake completed: an intake authors records, not a node.
    const intakeOf=(String(item.detail??'').match(/after (\S+) completed its record/)??[])[1];
    const intake=intakeOf?state.ops.find(candidate=>candidate.id===intakeOf):null;
    if(!item.node&&intake?.intake?.scope){store.appendEvent({event:'need-user-answered',op:intake.id,kind:item.kind,reason:'an intake authors records, not a node'});continue;}
    // Keyed by node, or by the op whose write was refused: the nodes that op closes (its own, or the set a review names).
    const op=item.op?state.ops.find(candidate=>candidate.id===item.op):null;
    const nodes=item.node?[item.node]:op?unique([...(op.nodeId?[op.nodeId]:[]),...(op.ledgerIds??[])]):[];
    const answered=nodes.length>0&&nodes.every(id=>loaded.nodes.get(id)?.state==='done');
    if(answered){store.appendEvent({event:'need-user-answered',node:item.node??null,op:item.op??null,nodes,detail:String(item.detail??'').slice(0,160)});continue;}
    kept.push(item);
  }
  state.needUser=kept;
}

/* ------------------------------------------------------------------ stray files in the tree */

/**
 * An invalid tree whose every error sits under an untracked path that no live operation owns is not the
 * owner's problem to untangle: an abandoned operation left those files (a settled intake once left half a
 * feature in the base worktree and every backend op failed `work-valid` for an hour). They are moved, whole,
 * to `<store>/strays/<timestamp>/` - kept for the owner, out of the tree - and the tree is read again.
 * Tracked files are never touched; a stray inside a live op's allowlist is that op's, and stays.
 */
export function quarantineStrays(store,state,ctx,loaded){
  if(!ctx.work||ctx.work.shared||typeof ctx.git!=='function'||!Array.isArray(loaded?.errors)||!loaded.errors.length)return [];
  const root=ctx.work.ledger?.repoRoot??ctx.work.repoRoot??state.worktree;
  const shown=ctx.git('git',['status','--porcelain','--','.starciwork'],{cwd:root,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return [];
  const untracked=(shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(line=>line.startsWith('??'))
    .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))).filter(file=>file.startsWith('.starciwork/')&&!/(^|\/)_local\//.test(file));
  if(!untracked.length)return [];
  const live=state.ops.filter(item=>liveStatus.includes(item.status)).flatMap(item=>item.allowlist??[]).map(normalize);
  const treePaths=loaded.errors.map(error=>normalize(`.starciwork/${String(error.path??'')}`));
  // The error and the stray name the same thing from two ends: git reports the untracked file, the validator
  // reports the directory that must not exist. A `_resources` error whose stray is the secret file three levels
  // under it matched neither way round and froze a whole tree, so containment is tested in both directions.
  const within=(inner,outer)=>inner===outer||inner.startsWith(outer.endsWith('/')?outer:`${outer}/`);
  const owns=(stray,file)=>within(file,stray)||within(stray,file);
  // Every untracked stray that carries an error and that no live op owns is moved, whether or not other errors
  // sit on tracked paths: what the kernel can clean it cleans, and the rest is reported as it is.
  const culprits=unique(treePaths.map(file=>untracked.find(stray=>owns(stray,file))).filter(Boolean)).filter(stray=>!inside(stray,live));
  if(!culprits.length)return [];
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const moved=[];
  for(const stray of culprits){
    // A quarantined stray is a real file taken out of the tree, so it keeps a real home - beside the ledger,
    // in the kernel's own corner of `.starciwork`, never under `_local` and never in the ledger itself.
    // `store.dir` was that home until §8 made it null, at which point every quarantine threw and the tree
    // stayed invalid with the stray still in it.
    const from=path.join(root,stray),to=path.join(store.repoRoot,'.starciwork','kernel-strays',store.id,stamp,stray);
    try{
      fs.mkdirSync(path.dirname(to),{recursive:true});
      // The store may live on another drive than the worktree (an Orca worktree on C:, the repository on D:):
      // a rename cannot cross drives, a copy followed by the removal can.
      try{fs.renameSync(from,to);}catch(error){if(error?.code!=='EXDEV')throw error;fs.cpSync(from,to,{recursive:true});fs.rmSync(from,{recursive:true,force:true});}
      moved.push({from:stray,to:slash(to)});
    }catch(error){store.appendEvent({event:'stray-quarantine-failed',path:stray,reason:String(error?.message??error)});}
  }
  if(moved.length)store.appendEvent({event:'stray-quarantined',strays:moved,errors:loaded.errors.slice(0,5).map(error=>`${error.code} ${error.path??''}`)});
  return moved;
}
export function sweepTreeStrays(store,state,ctx){
  if(!ctx.work||ctx.work.shared||typeof ctx.git!=='function')return [];
  const shown=ctx.git('git',['status','--porcelain','--','.starciwork'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return [];
  // Only what a known, no-longer-live operation could have left is swept: an untracked path inside the allowlist of
  // a blocked or settled op. A path no op ever owned may be a person's draft and is left where it is.
  const live=state.ops.filter(item=>['running','paused','answering','ready','pending'].includes(item.status)).flatMap(item=>item.allowlist??[]);
  const abandoned=state.ops.filter(item=>['blocked','ready','pending'].includes(item.status)&&!item.dispatch).flatMap(item=>item.allowlist??[]);
  const owned=/(?:^|\/)(?:evidence|_local)\/|(?:^|\/)index\.ya?ml$/;
  const strays=(shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(line=>line.startsWith('??'))
    .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,'')))
    .filter(file=>file.startsWith('.starciwork/')&&!owned.test(file)&&!inside(file,live)&&inside(file,abandoned));
  for(const file of strays){try{fs.rmSync(path.join(state.worktree,file),{recursive:true,force:true});}catch{}}
  if(strays.length)store.appendEvent({event:'tree-strays-removed',strays});
  return strays;
}

/* ------------------------------------------------------------------ kernel-owned paths */

/**
 * The ledger paths this kernel owns for an operation's node - its `index.yaml` (where `state`, `completion`
 * and `extensions.work3.kernel` live) and its `evidence/**`. An operation is granted one only when its own
 * allowlist names that exact file (an `architecture.decide` op authors the design body of its node), never
 * through a directory glob.
 */
export function kernelOwnedPaths(state,op,ctx){
  if(!ctx?.work||!op.nodeId)return [];
  // A ledger another repository owns is not in this worktree at all: an operation cannot write it here, so
  // there is no path here to protect and no fingerprint to take.
  if(ctx.work.shared)return [];
  const node=ctx.work.node(op.nodeId);
  if(!node)return [];
  const granted=(op.allowlist??[]).map(normalize);
  // A cut holds the node's whole folder, and the node's own record is exactly what it must turn into a derived
  // parent, so the folder glob grants that record the way an author op's literal path does. The evidence folder
  // under it stays the kernel's all the same: a cut proves nothing and writes no evidence.
  const held=file=>granted.includes(file)||(plain(op.cut)&&!/(^|\/)evidence(\/|$)/.test(file)&&inside(allowRoot(file),granted));
  return unique(((ctx.guards??kernelGuards).protectedPaths(node,ctx.work.ledger?.repoRoot??ctx.work.repoRoot)??[]).map(normalize))
    .filter(file=>!held(file));
}

/** Content fingerprint of those paths: at acceptance the only pending change there must be the kernel's own. */
export function protectedFingerprint(root,paths=[]){
  const files=[];
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true}))
    entry.isDirectory()?walk(path.join(dir,entry.name)):files.push(path.join(dir,entry.name));};
  for(const entry of paths){
    const target=path.join(root,allowRoot(entry));
    try{if(fs.statSync(target).isDirectory())walk(target);else files.push(target);}catch{files.push(target);}
  }
  return unique(files).sort().map(file=>{
    const name=normalize(path.relative(root,file));
    try{return `${name}:${crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')}`;}catch{return `${name}:absent`;}
  }).join('\n');
}

/**
 * Before any machine verification: revert what the operation wrote into the kernel's own ledger paths and
 * report it. A report that touched them is never accepted - it is downgraded to `failed` and comes back.
 */
export function guardKernelPaths(store,state,op,ctx){
  const paths=op.kernelOwned??[];
  if(!paths.length)return [];
  const root=ctx.work?.ledger?.repoRoot??ctx.work?.repoRoot??state.worktree;
  if(protectedFingerprint(root,paths)===(op.kernelOwnedAt??''))return [];
  const result=ctx.guards.gitQueue(()=>ctx.guards.revertProtected(ctx.git,{cwd:state.worktree,paths}))??{};
  const reverted=unique([...(result.reverted??[]),...(result.removed??[])]).map(normalize);
  op.kernelOwnedAt=protectedFingerprint(root,paths);
  const touched=reverted.length?reverted:paths;
  store.appendEvent({event:'kernel-paths-modified',op:op.id,node:op.nodeId,paths:touched,reverted,protected:paths});
  return touched;
}

/** The kernel-owned blocks of one node's record, as one comparable string; `null` when the record cannot be read. */
export function recordBlocks(ctx,nodeId){
  if(!ctx?.work||!nodeId||typeof ctx.work.api.readNode!=='function')return null;
  const node=ctx.work.node(nodeId);
  if(!node)return null;
  try{
    const raw=ctx.work.api.readNode(ctx.work.at,node);
    return JSON.stringify({state:raw?.state??null,completion:raw?.completion??null,
      kernel:raw?.extensions?.work3?.kernel??null});
  }catch{return null;}
}

/**
 * `work.author` is the one kind whose allowlist names its own node's `index.yaml`, so that file cannot be
 * protected as a whole - the op exists to write it. What stays the kernel's is protected inside it instead:
 * `state`, `completion` and `extensions.work3.kernel` are read back and compared with the snapshot taken at
 * launch. A changed block is reverted with the rest of the file and the report is not accepted, exactly as a
 * written kernel path is for any other op: a completion an agent writes itself is a claim, not a record.
 */
export const CUT_OWNED=['completion'];
const BLOCK_KEY={state:'state',completion:'completion','extensions.work3.kernel':'kernel'};
/** The kernel-owned blocks of a record an author op holds, compared field by field rather than as one string. */
const sameBlocks=(before,after,owned)=>{
  if(before===after)return true;
  try{
    const a=JSON.parse(before),b=JSON.parse(after);
    return owned.every(name=>JSON.stringify(a?.[BLOCK_KEY[name]??name]??null)===JSON.stringify(b?.[BLOCK_KEY[name]??name]??null));
  }catch{return false;}
};
export function guardRecordBlocks(store,state,op,ctx){
  if(!authorsRecord(op.kind)||typeof op.recordBlocks!=='string')return [];
  const now=recordBlocks(ctx,op.nodeId);
  // A cut turns the node into a derived parent, and a parent authors no state: removing `state` is the job, not
  // a forgery. Only `completion` stays the kernel's there - a cut proves nothing and may never claim it did.
  const owned=plain(op.cut)?CUT_OWNED:RECORD_OWNED;
  if(now===null||sameBlocks(op.recordBlocks,now,owned))return [];
  const paths=op.allowlist??[];
  const cwd=ctx.work?.ledger?.repoRoot??ctx.work?.repoRoot??state.worktree;
  const result=ctx.guards.gitQueue(()=>ctx.guards.revertProtected(ctx.git,{cwd,paths}))??{};
  op.recordBlocks=recordBlocks(ctx,op.nodeId)??op.recordBlocks;
  const reverted=unique([...(result.reverted??[]),...(result.removed??[])]).map(normalize);
  const touched=reverted.length?reverted:paths;
  store.appendEvent({event:'record-blocks-modified',op:op.id,node:op.nodeId,blocks:owned,paths:touched,reverted});
  return touched;
}

/* ------------------------------------------------------------------ writing the Work ledger back */

/**
 * Every ledger write goes through here. A refused write is never silent and never fatal: the node keeps its
 * original bytes (work-ledger restores them itself), the refusal is an event, and the workflow carries it to
 * the user instead of reporting a green slice over a ledger that does not say so.
 */
export function ledgerWrite(store,state,op,ctx,step,action,nodeId=op.nodeId){
  if(isAuditOperation(op)){
    store.appendEvent({event:'audit-ledger-write-skipped',op:op.id,operation:op.operation,node:nodeId??null,step});
    return null;
  }
  if(!ctx.work||!nodeId)return null;
  const node=ctx.work.node(nodeId);
  if(!node){
    store.appendEvent({event:'ledger-node-missing',op:op.id,node:nodeId,step});
    state.needUser.push({op:op.id,kind:'ledger',detail:`the Work node ${nodeId} is no longer in the validated tree, so ${step} could not be recorded`});
    return null;
  }
  try{
    const result=action(node);
    store.appendEvent({event:'ledger-write',op:op.id,node:nodeId,step});
    return result;
  }catch(error){
    store.appendEvent({event:'ledger-write-failed',op:op.id,node:nodeId,step,reason:error.message});
    state.needUser.push({op:op.id,kind:'ledger',detail:`the Work node ${nodeId} refused ${step}: ${error.message}`});
    return null;
  }
}

/**
 * An accepted slice becomes `done` plus one evidence manifest on the node that asked for the work. On a lane
 * this is the LAST step only: `nodeId`, `checks` and `head` are passed in, because the step that completes a
 * lane may be a kernel review that names several nodes and proves them with the checks every step ran.
 */
export function recordDone(store,state,op,ctx,verified,{nodeId=op.nodeId,head=op.head}={}){
  if(ctx.work&&!nodeId&&op.kind===BRAND_DECIDE){rereadBrand(store,state,op,ctx);return;}
  if(!ctx.work||!nodeId)return;
  verified={...verified,checks:[...(verified?.checks??[]),...kernelProof(ctx,nodeId,op)]};
  const decision=['architecture.decide','architecture.revise','business.decide','business.revise',BRAND_DECIDE].includes(op.kind)||kindRole(op.kind)==='decide';
  if(decision){
    ledgerWrite(store,state,op,ctx,'decided',node=>ctx.work.api.markDecided(ctx.work.at,node,{
      by:'starci-kernel',
      // A revision of an accepted record bumps its rev, so a reopened decision is not read as the first one -
      // the design for `architecture.revise`, the requirement for `business.revise`. A brand decision always
      // does: every surface already built from the old brand is bound to that rev.
      rev:['architecture.revise','business.revise',BRAND_DECIDE].includes(op.kind)?nextRev(ctx,node):null,
      digest:ctx.work.digest,
      review:{reviewer:op.runtime??'starci-kernel',
        authority:`the kernel accepted ${op.id} after re-running its checks itself`,
        observations:decisionObservations(ctx,node,op),
        limitations:['Only the operation allowlist was reviewed.']}}),nodeId);
    if(op.kind===BRAND_DECIDE)rereadBrand(store,state,op,ctx);
    return;
  }
  // A completion binds its source directly (starci/source-identity@1) so the tree needs no repository resource record;
  // the identity is scoped to the operation allowlist, which is exactly what the kernel verified.
  // Source identity names the repository the slice is IN, which is the worktree this kernel commits in - never
  // the repository that happens to own the ledger the record is written to.
  const repository=ctx.work.code.repository??path.basename(ctx.work.code.repoRoot);
  // Only a code-bearing node (implementation, release) binds its source; the validator refuses a source identity or
  // code refs on any other kind, and that is what a review found and an agent "fixed" by hand once.
  const bindsCode=node=>['implementation','release'].includes(String(node?.kind??''));
  const identity=ctx.work.code.origin&&/^[a-f0-9]{40,64}$/.test(String(head??''))&&typeof ctx.work.api.buildSourceIdentity==='function'
    ?ctx.work.api.buildSourceIdentity({repository,origin:ctx.work.code.origin,commit:head,paths:op.allowlist??[],
      dependencyCoverage:'Dependencies were not re-verified by this operation.',limitations:['Only the operation allowlist was verified by the kernel.']})
    :null;
  // The declaration this proof was accepted under travels with it, so a later change of that declaration is a
  // fact the next sync can see (`proof-under-old-rule`) instead of a proof nobody dares to trust or to reopen.
  const contractDigest=typeof ctx.contractDigest==='function'?(()=>{try{return ctx.contractDigest(op.kind);}catch{return null;}})():null;
  // The decisions this proof rests on that the OWNER has not taken yet: the receipt names them, so a different
  // answer later can find every node it was built on without guessing from the workflow's own memory.
  ledgerWrite(store,state,op,ctx,'done',node=>ctx.work.api.markDone(ctx.work.at,node,{
    opId:op.id,head:head??null,checks:provenChecks(verified.checks),verifiedBy:'starci-kernel',digest:ctx.work.digest,repository,bindSource:bindsCode(node),...(identity&&bindsCode(node)?{sourceIdentity:identity}:{}),...(contractDigest?{contractDigest,contractKind:op.kind}:{}),
    provisional:[...(op.provisional??[])],
    evidence:{outcome:'pass',environment:'local',actor:'starci-kernel',tool:'starci-kernel',
      // A ui node's completion carries its candidates as hashed captures: what the drawing produced is what is proven.
      assets:designEvidenceAssets({api:ctx.work.api,at:ctx.work.at,loaded:ctx.work.loaded},node),
      servedVersionEvidence:`Checks re-run by the StarCi kernel in workflow ${state.id} on branch ${state.branch}`}}),nodeId);
}

/** The rev a revision writes: one past whatever the node's kernel block carries, and 1 when it carries none. */
function nextRev(ctx,node){
  try{
    const raw=ctx.work.api.readNode(ctx.work.repoRoot,node);
    const rev=Number(raw?.extensions?.work3?.kernel?.rev);
    return Number.isFinite(rev)?rev+1:1;
  }catch{return 1;}
}

/** A decision is settled by observations, one per authored assertion; with none authored, one for the node. */
function decisionObservations(ctx,node,op){
  const authored=(()=>{try{const raw=ctx.work.api.readNode(ctx.work.at,node);return Array.isArray(raw.assertions)?raw.assertions.map(String):[];}catch{return [];}})();
  const observation=firstLine(op.reports.at(-1)?.summary)||`${op.id} settled this decision`;
  return (authored.length?authored:[String(node.id)]).map(id=>({id,outcome:'pass',observation}));
}

/**
 * The ledger write is the kernel's own change to the repository, so it is committed too - under the node
 * directory it belongs to and with the same `Work:` trailer - instead of being left dirty in the worktree.
 * It follows the operation's commit because a completion binds the head of the slice it proves.
 */
export function commitLedgerWrite(store,state,op,ctx,nodeId=op.nodeId){
  if(!ctx.work||!nodeId)return null;
  const node=ctx.work.node(nodeId);
  if(!node)return null;
  // The write happens where the tree is, so the commit happens there too: in the owner repository, on whatever
  // branch it is on, with the same `Work:` trailer. A shared ledger is the only case where that is not here.
  const cwd=ctx.work.ledger?.repoRoot??state.worktree;
  const scope=normalize(path.join(path.relative(cwd,ctx.work.ledger?.workRoot??path.join(cwd,'.starciwork')),path.dirname(node.path)));
  // Ledger writes carry 64-hex digests that a repository secrets guard mistakes for keys; the kernel is the
  // author of those digests, so it declares the scan skipped for exactly this commit.
  const run=args=>ctx.git('git',args,{cwd,encoding:'utf8',windowsHide:true,env:{...process.env,ALLOW_SECRET_SCAN:'1'}});
  const files=ledgerChanges(run,scope);
  if(!files.length)return null;
  run(['config','core.longpaths','true']);
  if(run(['add','--',...files]).status!==0){store.appendEvent({event:'ledger-commit-failed',op:op.id,node:nodeId,reason:'git add'});return null;}
  const committed=run(['commit','-q','-m',`work(${nodeId}): record ${op.id} in the Work ledger\n\nWork: ${nodeId}`]);
  if(committed.status!==0){store.appendEvent({event:'ledger-commit-failed',op:op.id,node:nodeId,reason:tail(committed.stderr,200)});return null;}
  const shown=run(['rev-parse','HEAD']);
  const head=shown.status===0?(shown.stdout??'').trim():null;
  // `state.head` is the head of the code this workflow produced; a commit in another repository is never that.
  if(head&&!ctx.work.shared)state.head=head;
  if(head)op.ledgerCommit=head;
  store.appendEvent({event:'ledger-commit',op:op.id,node:nodeId,files,head,ledgerCommit:head,
    ...(ctx.work.shared?{repository:ctx.work.ledger.repository,shared:true}:{})});
  return head;
}

/** Pending ledger paths under one node directory, read where the tree lives rather than in this worktree. */
function ledgerChanges(run,scope){
  const shown=run(['status','--porcelain','--',scope]);
  if(shown.status!==0)return [];
  return unique((shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean)
    .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))))
    .filter(file=>inside(file,[scope]));
}

/**
 * A completion the kernel wrote can be refused by a later rule (a source coverage path that is not a source path).
 * The record is the kernel's, so the kernel rewrites it from what it knows - the kernel block's checks and head,
 * the completion's own paths, sanitized - instead of leaving the whole tree invalid for a human to fix by hand.
 */
export function repairKernelRecords(store,state,ctx,loaded){
  if(!ctx.work||loaded.ok||!Array.isArray(loaded.errors))return [];
  const api=ctx.work.api;
  if(typeof api.markDone!=='function'||typeof api.buildSourceIdentity!=='function'||typeof api.readNode!=='function')return [];
  const refused=unique(loaded.errors.filter(error=>['SOURCE_COVERAGE','SOURCE_IDENTITY','CODE_REFS'].includes(error.code)).map(error=>String(error.path??'')).filter(Boolean));
  const repaired=[];
  for(const node of loaded.list){
    const own=refused.some(file=>file===node.path||file.startsWith(`${path.posix.dirname(node.path)}/evidence/`));
    if(!own||node.state!=='done')continue;
    let raw;try{raw=api.readNode(ctx.work.at??ctx.work.repoRoot,node);}catch{continue;}
    const kernel=raw?.extensions?.work3?.kernel;
    if(!kernel?.opId||!kernel.head||!Array.isArray(kernel.checks))continue;
    const identity=raw?.completion?.sourceIdentity?.repositories?.[0];
    const bindsCode=['implementation','release'].includes(String(node.kind??''));
    try{
      const rebuilt=bindsCode&&identity?api.buildSourceIdentity({repository:identity.repository,origin:identity.origin,commit:kernel.head,paths:identity.coverage?.paths??[],
        dependencyCoverage:identity.coverage?.dependencyCoverage??'Dependencies were not re-verified by this operation.',limitations:identity.coverage?.limitations??['Only the operation allowlist was verified by the kernel.']}):null;
      ctx.guards.gitQueue(()=>{
        api.markDone(ctx.work.at??ctx.work.repoRoot,node,{opId:kernel.opId,head:kernel.head,checks:kernel.checks,verifiedBy:kernel.verifiedBy??'starci-kernel',at:kernel.at??null,
          digest:ctx.work.digest,bindSource:bindsCode,...(rebuilt?{sourceIdentity:rebuilt}:{}),
          evidence:{outcome:'pass',environment:'local',actor:'starci-kernel',tool:'starci-kernel',servedVersionEvidence:`Checks re-run by the StarCi kernel in workflow ${state.id} on branch ${state.branch}`}});
        commitLedgerWrite(store,state,{id:kernel.opId,nodeId:node.id},ctx,node.id);
      });
      repaired.push(node.id);
      store.appendEvent({event:'kernel-record-repaired',node:node.id,op:kernel.opId,codes:refused.length});
    }catch(error){store.appendEvent({event:'kernel-record-repair-failed',node:node.id,reason:String(error.message).slice(0,200)});}
  }
  if(repaired.length){try{ctx.work.loaded=api.loadLedger({repoRoot:ctx.work.at??ctx.work.repoRoot,validate:ctx.work.validate});}catch{}}
  return repaired;
}

/* ------------------------------------------------------------------ one accepted op is one lane step */

export function markLedger(state,op,head){
  for(const id of op.ledgerIds){
    const item=ledgerItem(state,id);
    if(!item)continue;
    item.evidence=[...(item.evidence??[]),{opId:op.id,kind:op.kind,head:head??null}];
    // Only the LAST step of a node's lane proves it (`review.verify` on a backend lane, `uat.verify` on a frontend
    // one); an earlier prove step such as `e2e.verify` leaves the item implemented so the review is still planned.
    // The lane that decides is the ITEM's, not the operation's: a group proof closes every child of a cut parent
    // at once and carries no node id of its own, and a backend group's `e2e.verify` must still leave the review to run.
    const entry=state.lanes?.[op.nodeId??id]??state.lanes?.[id]??null;
    const lane=entry?.lane??null;
    // A lane that ends on a design step - a ui node, drawn then its artwork generated - is complete when that
    // step is accepted: no review is planned for it, so its last step is the one that settles the item.
    const walked=laneWalked(entry);
    const proves=Array.isArray(lane)&&lane.length
      ?lane.at(-1)===op.kind||(!lane.includes('review.verify')&&walked.length>0&&walked.every(kind=>kind===op.kind||(entry.done??[]).includes(kind)))
      :(op.kind==='review.verify'||kindRole(op.kind)==='verify');
    item.status=proves?'verified':'implemented';
  }
}

/**
 * One accepted operation is one lane step. The node keeps `todo` with the kernel's `in-progress` block until
 * the LAST step of its lane is accepted; only then is `done` written, and with the checks every step of the
 * lane proved - the implement step's checks are what cover the node's authored assertions, and the prove step
 * (a kernel `review.verify`, or the lane's own `uat.verify`) is what allows the write at all.
 */
function laneNodesOf(state,op){
  if(op.nodeId)return state?.lanes?.[op.nodeId]?.lane?.length?[op.nodeId]:[];
  if(state.ledgerMode!==WORK_LEDGER)return [];
  return (op.ledgerIds??[]).filter(id=>state?.lanes?.[id]?.lane?.length);
}
const mergeProven=checks=>{
  const seen=new Map();
  for(const check of checks)seen.set(`${check.name}|${check.command}`,check);
  return [...seen.values()];
};
export function advanceLanes(store,state,op,ctx,verified){
  const nodes=laneNodesOf(state,op);
  if(!nodes.length||!ctx.work)return {handled:false,completed:[]};
  const completed=[];
  for(const nodeId of nodes){
    const entry=state.lanes[nodeId];
    entry.done=unique([...(entry.done??[]),op.kind]);
    entry.checks=mergeProven([...(entry.checks??[]),...provenChecks(verified.checks)]);
    entry.head=op.head??entry.head??null;
    const predicates=lanePredicates(ctx,ctx.work.node(nodeId));
    laneSkip(entry,predicates,laneGoal(state));
    const next=laneNext(entry,predicates,laneGoal(state));
    store.appendEvent({event:'lane-step',op:op.id,node:nodeId,kind:op.kind,
      step:laneProgress(entry),lane:entry.lane,skipped:[...(entry.skipped??[])],next:next??null});
    if(next){
      // Not done yet: the node keeps the kernel block of the step that just landed, and waits for the next one.
      ledgerWrite(store,state,op,ctx,'in-progress',node=>ctx.work.api.markInProgress(ctx.work.repoRoot,node,{opId:op.id,dispatch:op.dispatch}),nodeId);
      continue;
    }
    recordDone(store,state,op,ctx,{checks:entry.checks},{nodeId,head:entry.head??op.head});
    ctx.guards.gitQueue(()=>commitLedgerWrite(store,state,op,ctx,nodeId));
    completed.push(nodeId);
  }
  return {handled:true,completed};
}
