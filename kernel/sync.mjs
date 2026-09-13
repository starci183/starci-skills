import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../core/yaml.mjs';
import {settleDispatch} from '../hosts/orca/launch.mjs';
import * as graph from './graph.mjs';
import {AUTHOR_KIND,BRAND_DECIDE,KERNEL_CHECK,RECORD_OWNED,WORK_LEDGER,WORK_OPERATION,allowRoot,describeNode,firstLine,
  gateDynamicOp,grammarReferences,inside,kernelGuards,kindRole,ledgerItem,liveStatus,locateSharedTreePaths,normalize,plain,
  slash,tail,toOp,unique,UI_KIND,workModule,workOpId,workValidateCommand,byId,ledgerAccess,workRootOf} from './common.mjs';
import {kindsReadingBrand} from './io.mjs';
import {brandReferencesOf,kernelProof,noteBrand,provenChecks,rereadBrand} from './verify.mjs';
import {retemplateIntakeOps} from './intake.mjs';

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
  const accepted=state.ops.filter(op=>op.nodeId===id&&op.status==='done'&&op.kind!==AUTHOR_KIND).map(op=>op.kind);
  return state.lanes[id]={lane:[...lane],done:unique([...(existing?.done??[]),...accepted]),checks:[...(existing?.checks??[])],
    // `authored` is the bound on record authoring, not lane progress: it survives a re-template of the lane.
    ...(existing?.authored?{authored:existing.authored}:{}),
    head:existing?.head??state.ops.find(op=>op.nodeId===id&&op.status==='done'&&op.head&&op.kind!==AUTHOR_KIND)?.head??null};
}
export const laneNext=(entry,predicates=null)=>{
  try{return graph.nextKind(entry?.lane??[],entry?.done??[],{predicates:predicates??{}});}catch{return null;}
};
export const laneText=lane=>(lane??[]).join(' -> ');
/**
 * The optional steps the node's own design record retires right now, kept on the lane entry so every line the
 * user reads - the contract, the status view, the goal table - prints the lane as it is walked, not the template.
 */
export const laneSkip=(entry,predicates=null)=>{
  if(!entry?.lane?.length)return [];
  try{entry.skipped=graph.skippedKinds(entry.lane,entry.done??[],{predicates:predicates??{}});}catch{entry.skipped=Array.isArray(entry.skipped)?entry.skipped:[];}
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
  if(!plain(node)||node.kind!==UI_KIND)return [];
  const record=designRecord(access,node);
  const root=workRootOf(access?.at);
  if(!record||!root)return [];
  const directory=path.join(root,path.dirname(String(node.path??'')));
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

export function deriveWorkOp(api,repoRoot,node,{id,opOfNode=new Map(),index=0,lane=null,done=[],loaded=null}){
  // Lane-aware: the kind of this operation is the node's next lane step, not a fixed map of the node kind.
  const template=lane?.length?lane:(()=>{try{return graph.laneFor({kind:node.kind,layout:nodeLayout(node),repositoryRole:node.repository??null});}catch{return [];}})();
  const access={api,at:repoRoot,loaded};
  const step=(()=>{try{return graph.nextKind(template,done,{predicates:lanePredicates(access,node)});}catch{return null;}})();
  const design=kindsReadingBrand().includes(step??'');
  // A ui node's drawing and artwork steps author the design body of the node's own record - the `ui:` spec
  // and the candidates and artwork under its assets - so the exact record path is granted, the way a decision
  // is granted its own record; every other kind is kept off the record the kernel owns.
  const ownRecord=node.kind===UI_KIND&&design?[`.starciwork/${slash(node.path)}`]:[];
  return toOp({id,nodeId:node.id,
    kind:step??WORK_OPERATION[node.kind]??'task.execute',goal:describeNode(api,repoRoot,node),
    ledgerIds:[node.id],allowlist:unique([...node.allowlist,...ownRecord]),
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
  if(!ctx.work)return [];
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
    return [];
  }
  if(state.ledgerInvalid||quarantined){
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
  const opOfNode=new Map(state.ops.filter(op=>op.nodeId).map(op=>[op.nodeId,op.id]));
  const added=[];
  pruneAnsweredQuestions(store,state,loaded);
  const candidates=ctx.work.api.executableCandidates(loaded,{scope,repository:ctx.work.code.repository,side:ctx.work.side});
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
    const mine=state.ops.filter(op=>op.nodeId===node.id);
    // The op that completed this node's record is not a step of its lane: it precedes the lane, so the lane's
    // first step is still the first step and still carries the node's own id.
    const laneOps=mine.filter(op=>op.kind!==AUTHOR_KIND);
    // One step at a time: a node yields its next lane step only when nothing of it is still in flight.
    if(mine.some(op=>op.status!=='done'))continue;
    if(!laneOps.length&&designGate(store,state,{api:ctx.work.api,at:ctx.work.at,loaded},node,entry))continue;
    const predicates=lanePredicates({api:ctx.work.api,at:ctx.work.at,loaded},node);
    laneSkip(entry,predicates);
    const next=laneNext(entry,predicates);
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
    if(!next||KERNEL_PLANNED_KINDS.includes(next)||mine.some(op=>op.kind===next))continue;
    const id=laneOpId(node.id,next,!laneOps.length,taken);opOfNode.set(node.id,id);
    const op=deriveWorkOp(ctx.work.api,ctx.work.at,node,{id,opOfNode,index:state.ops.length,lane:entry.lane,done:entry.done,loaded});
    locateSharedTreePaths(op,ctx);
    op.difficulty=op.difficulty??'medium';
    op.createdIteration=state.iterations;
    state.ops.push(op);
    if(!ledgerItem(state,node.id))
      state.ledger.push({id:node.id,title:describeNode(ctx.work.api,ctx.work.at,node),inputRef:node.path,kind:node.kind,nodeId:node.id,module:workModule(node),assessed:node.state,status:'planned',evidence:[],lane:[...entry.lane]});
    added.push(op.id);
    store.appendEvent({event:'op-added',op:op.id,node:node.id,kind:op.kind,
      reason:laneOps.length?`lane step ${entry.done.length+1} of ${laneWalked(entry).length} (${laneText(laneWalked(entry))})`:'newly schedulable Work node'});
    gateDynamicOp(store,state,op);
  }
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
  const owns=(stray,file)=>file===stray||file.startsWith(stray.endsWith('/')?stray:`${stray}/`);
  // Every error must sit under a stray nobody owns; one error on a tracked or owned path and nothing moves.
  const culprits=unique(treePaths.map(file=>untracked.find(stray=>owns(stray,file))).filter(Boolean));
  if(!culprits.length||culprits.length!==unique(treePaths.map(file=>untracked.find(stray=>owns(stray,file))??'∅')).length)return [];
  if(culprits.some(stray=>inside(stray,live)))return [];
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const moved=[];
  for(const stray of culprits){
    const from=path.join(root,stray),to=path.join(store.dir,'strays',stamp,stray);
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
  return unique(((ctx.guards??kernelGuards).protectedPaths(node,ctx.work.ledger?.repoRoot??ctx.work.repoRoot)??[]).map(normalize))
    .filter(file=>!granted.includes(file));
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
export function guardRecordBlocks(store,state,op,ctx){
  if(op.kind!==AUTHOR_KIND||typeof op.recordBlocks!=='string')return [];
  const now=recordBlocks(ctx,op.nodeId);
  if(now===null||now===op.recordBlocks)return [];
  const paths=op.allowlist??[];
  const cwd=ctx.work?.ledger?.repoRoot??ctx.work?.repoRoot??state.worktree;
  const result=ctx.guards.gitQueue(()=>ctx.guards.revertProtected(ctx.git,{cwd,paths}))??{};
  op.recordBlocks=recordBlocks(ctx,op.nodeId)??op.recordBlocks;
  const reverted=unique([...(result.reverted??[]),...(result.removed??[])]).map(normalize);
  const touched=reverted.length?reverted:paths;
  store.appendEvent({event:'record-blocks-modified',op:op.id,node:op.nodeId,blocks:RECORD_OWNED,paths:touched,reverted});
  return touched;
}

/* ------------------------------------------------------------------ writing the Work ledger back */

/**
 * Every ledger write goes through here. A refused write is never silent and never fatal: the node keeps its
 * original bytes (work-ledger restores them itself), the refusal is an event, and the workflow carries it to
 * the user instead of reporting a green slice over a ledger that does not say so.
 */
export function ledgerWrite(store,state,op,ctx,step,action,nodeId=op.nodeId){
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
  verified={...verified,checks:[...(verified?.checks??[]),...kernelProof(ctx,nodeId)]};
  const decision=['architecture.decide','architecture.revise','business.decide',BRAND_DECIDE].includes(op.kind)||kindRole(op.kind)==='decide';
  if(decision){
    ledgerWrite(store,state,op,ctx,'decided',node=>ctx.work.api.markDecided(ctx.work.at,node,{
      by:'starci-kernel',
      // A revision of an accepted design bumps its rev, so a reopened decision is not read as the first one.
      // A brand decision always does: every surface already built from the old brand is bound to that rev.
      rev:['architecture.revise',BRAND_DECIDE].includes(op.kind)?nextRev(ctx,node):null,
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
  ledgerWrite(store,state,op,ctx,'done',node=>ctx.work.api.markDone(ctx.work.at,node,{
    opId:op.id,head:head??null,checks:provenChecks(verified.checks),verifiedBy:'starci-kernel',digest:ctx.work.digest,repository,bindSource:bindsCode(node),...(identity&&bindsCode(node)?{sourceIdentity:identity}:{}),...(contractDigest?{contractDigest,contractKind:op.kind}:{}),
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
    const lane=op.nodeId?state.lanes?.[op.nodeId]?.lane:null;
    // A lane that ends on a design step - a ui node, drawn then its artwork generated - is complete when that
    // step is accepted: no review is planned for it, so its last step is the one that settles the item.
    const entry=op.nodeId?state.lanes?.[op.nodeId]:null;
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
    laneSkip(entry,predicates);
    const next=laneNext(entry,predicates);
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
