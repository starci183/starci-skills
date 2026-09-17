import crypto from 'node:crypto';
import path from 'node:path';
import {covers,kernelGuards,kindRole,normalize,parseRef,plain,slash,unique} from './common.mjs';
import {FAN_OUT,cutGroup,cutParentOf,effectiveDifficulty,fanOutDeferral,opCutGroup,opCutReason} from './sync.mjs';
import {isAsk} from './owner.mjs';
import {DEFAULT_MAX_PARALLEL_OPS} from './schedule.mjs';

/**
 * The dispatch planner (goal §5): given the ready operations of one tick, decide how many may launch together
 * without touching each other. Pure and deterministic - the same state and the same candidates always produce
 * the same plan, and nothing here launches, reserves or mutates: the kernel wires the plan back into its
 * scheduler, and the allocator is only ever reviewed, never allocated. There is no clock and no randomness;
 * the only tie-break a plan may see is the allocator's own `ready` order.
 *
 * Three facts decide a launch, in this order.
 *
 * File level: two ops share the air only when neither writes a path the other writes or reads. The allowlist
 * is the write scope; the read scope is the op's resolved record references plus its declared read paths -
 * an operation must never read a file another in-flight operation is rewriting. Two asks sharing a feature's
 * decisions folder are the kernel's one deliberate exception: each writes a new slug of its own and authors
 * nothing that is already there.
 *
 * Lease level: two ops needing the same capacity-1 resource cannot both hold it - the canonical writer of one
 * fenced repository root (`canonical-writer:*`, declared through candidateRootBindings or named directly) or a
 * machine lock (`machine:*`, declared or inferred from the op's checks). The lease question is asked only of
 * what the op declares: same-repository disjointness is already carried by the file rule, and the durable
 * engine still fences the real lease at reservation time.
 *
 * Group level: the children of one cut parent are bounded by `allocation.fanOut.maxPerGroup`, and while
 * `seamFirst` holds the seam child runs alone - before its siblings, never beside them, whichever order the
 * candidates arrived in.
 *
 * An op whose declared write scope is past the cut bounds - more than CUT_FILES files, more than
 * CUT_ASSERTIONS assertions, or CUT_COMPONENTS design components, the same measures `sync.mjs` applies to a
 * node - is not launched at all: it is cut, and its disjoint children are what launch next (the minting lives
 * in `sync.mjs`'s `cutOversizedOps`; the plan only names the op as a cut).
 */

const IN_FLIGHT=['running','answering'];
const SETTLED=['done','blocked','cancelled'];
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
/** The writer fence of one repository root, computed from the declared path: a plan reads state, not disk. */
const canonicalRoot=root=>slash(path.resolve(String(root??''))).toLowerCase();
const fragmentless=value=>String(value??'').split('#')[0];

/** The capacity-1 resource keys an operation needs: declared writer fences plus declared or inferred machine locks. */
export function writerKeys(op){
  const declared=[...(op?.resources??[]),...(op?.writerResources??[]),...(op?.leases??[])]
    .filter(item=>typeof item==='string'&&/^(canonical-writer|runtime-projection):/.test(item));
  if(typeof op?.writerKey==='string'&&/^(canonical-writer|runtime-projection):/.test(op.writerKey))declared.push(op.writerKey);
  const bindings=op?.candidateRootBindings?.bindings;
  const derived=Array.isArray(bindings)?bindings.filter(binding=>binding&&(binding.workerWritable||binding.runtimeWritable))
    .map(binding=>binding?.role==='workflow-store'&&!binding.workerWritable&&(binding.runtimeManagedFiles??[]).length===1
      ?`runtime-projection:${sha256(`${canonicalRoot(binding.repoRoot)}\n${normalize(binding.runtimeManagedFiles[0].path).toLowerCase()}`)}`
      :`canonical-writer:${sha256(canonicalRoot(binding.repoRoot))}`)
    :[];
  return unique([...declared,...derived]);
}
const leaseKeys=op=>unique([...writerKeys(op),...kernelGuards.resourceLocks(op).map(lock=>`machine:${lock}`)]);

/** The tree path a node id or record reference resolves to, when the state can name it. */
const nodePathOf=(state,key)=>{
  for(const nodes of [state?.work?.loaded?.nodes,state?.nodes]){
    if(!nodes)continue;
    const found=typeof nodes.get==='function'?nodes.get(key):Array.isArray(nodes)?nodes.find(node=>node?.id===key||node?.path===key):nodes[key];
    if(found?.path)return normalize(found.path);
  }
  const listed=(state?.work?.loaded?.list??[]).find(node=>node?.id===key||node?.path===key);
  if(listed?.path)return normalize(listed.path);
  const item=(state?.ledger??[]).find(entry=>entry?.id===key);
  if(item?.inputRef)return normalize(item.inputRef);
  return null;
};
/** One reference as a file path: resolved entries carry `path`; a node id resolves through the loaded tree. */
const refToPath=(ref,state)=>{
  if(plain(ref)){
    if(typeof ref.path==='string'&&ref.path.trim())return normalize(ref.path);
    ref=ref.ref??ref.sourceRef;
  }
  let literal;try{literal=fragmentless(parseRef(ref).ref);}catch{return null;}
  const key=normalize(literal);
  if(!key)return null;
  const node=nodePathOf(state,key);
  if(node)return node==='.starciwork'||node.startsWith('.starciwork/')?node:`.starciwork/${node}`;
  return key;
};

/**
 * The file sets the parallel rule reasons over. Writes are the declared allowlist (plus `writePaths` when the
 * record says more); reads are the resolved references, the binding input paths, and `reads` when declared.
 */
export function opScopes(op,state){
  const writes=unique([...(op?.allowlist??[]),...(op?.writePaths??[])].map(entry=>normalize(entry)).filter(Boolean));
  const reads=[];
  for(const ref of op?.resolvedReferences??[])reads.push(refToPath(ref,state));
  for(const binding of op?.candidateRootBindings?.bindings??[])for(const ref of binding?.inputPaths??[])reads.push(refToPath(ref,state));
  for(const ref of op?.references??[])reads.push(refToPath(ref,state));
  for(const entry of op?.reads??[])reads.push(normalize(entry));
  return {writes,reads:unique(reads.filter(Boolean))};
}

const roleOf=op=>kindRole(op?.kind)??(typeof op?.role==='string'?op.role:null);
// A group member is a node-cut child (its nodeId sits inside the parent's group) or an op-cut child
// (`cutChildOf` names the parent op; the slice itself is no ledger node and keeps nodeId null).
const groupOf=(state,op)=>op?.cutChildOf??cutParentOf(state,op?.nodeId??(op?.ledgerIds??[])[0]??'');
const groupKeyOf=op=>op?.cutChildOf?op.id:op?.nodeId;
const groupFor=(state,op,parent)=>op?.cutChildOf?opCutGroup(state,parent):cutGroup(state,parent);

/**
 * Why this op is cut before its first launch instead of launched as one build, or null. `opCutReason` in
 * sync.mjs is the measuring gate - the same three bounds `cutReason` reads off a Work node, on the op's own
 * declared scope.
 */
export const cutSizeReason=opCutReason;

/** The first file-level collision between a candidate and an op already in flight (or already planned). */
function firstConflict(op,other,state){
  const a=opScopes(op,state),b=opScopes(other,state);
  // Two asks share the feature's decision folder by design - each writes a new slug and authors nothing that
  // is already there. A non-ask on that folder still waits: it edits what is there.
  if(isAsk(op.kind)&&isAsk(other.kind))return null;
  for(const w of a.writes)for(const theirs of b.writes)
    if(covers(w,theirs))return {file:w===theirs?w:`${w} ~ ${theirs}`,holder:other.id,reason:`write scope ${w} meets ${other.id}'s write scope ${theirs}`};
  for(const w of a.writes)for(const r of b.reads)
    if(covers(w,r))return {file:r,holder:other.id,reason:`writes ${w} while ${other.id} reads ${r}`};
  for(const r of a.reads)for(const w of b.writes)
    if(covers(w,r))return {file:r,holder:other.id,reason:`reads ${r} which ${other.id} is rewriting under ${w}`};
  return null;
}

/** The first capacity-1 lease - a canonical writer or a machine resource - the candidate would contest. */
function firstLease(op,other){
  const mine=leaseKeys(op),theirs=leaseKeys(other);
  const shared=mine.find(key=>theirs.includes(key));
  if(!shared)return null;
  const label=shared.startsWith('machine:')?`the exclusive resource ${shared.slice('machine:'.length)}`
    :shared.startsWith('runtime-projection:')?'the runtime-projection writer fence':'the canonical writer of its repository';
  return {key:shared,holder:other.id,reason:`${label} is held by ${other.id} (contested lease ${shared})`};
}

/** The fan-out reason to defer, or null: the seam of a group runs alone and first; siblings are bounded. */
function fanOutReason(state,op,holders,candidateNodes,policy){
  const parent=groupOf(state,op);
  if(parent&&policy.seamFirst!==false){
    const seam=groupFor(state,op,parent)?.seam??null;
    // The seam launches alone and first, in whichever order the candidates arrived: a sibling that shares a
    // tick with its unlaunched seam waits exactly as it waits for a running one.
    if(seam&&groupKeyOf(op)!==seam&&candidateNodes.has(seam))return `the seam ${seam} of ${parent} launches first and runs alone`;
  }
  const hit=fanOutDeferral(state,op,holders,{allocator:{fanOut:policy}});
  return hit?.reason??null;
}

/** The implement runtimes of the slice a review op proves - `verifyAvoidsImplementRuntime` made explicit. */
const verifyAvoids=(state,op)=>op?.kind!=='review.verify'?[]:
  unique((state?.ops??[]).filter(other=>other.id!==op.id&&other.kind!=='review.verify'&&other.refusal!=='superseded'
    &&(other.ledgerIds??[]).length&&(other.ledgerIds??[]).some(id=>(op.ledgerIds??[]).includes(id)))
    .map(other=>other.runtime).filter(Boolean));

/**
 * One tick's launch plan. `ops` are the ready candidates in rank order; `state` carries every op, the cut
 * groups and the ledger (for resolving record references to paths); `allocator` supplies `maxParallelOps`,
 * `fanOut` and optionally `review` - called to read the ready runtimes of a kind, never to allocate.
 * Returns `{launch:[opIds], cut:[opIds], wait:[{op,reason}], reasons:{opId:reason}}` - every decision carries
 * the human-readable reason the debug trace consumes.
 */
export function planDispatch(state,ops=[],allocator=null){
  const max=finite(allocator?.maxParallelOps,DEFAULT_MAX_PARALLEL_OPS);
  const policy=plain(allocator?.fanOut)?allocator.fanOut:FAN_OUT;
  const busy=(state?.ops??[]).filter(item=>IN_FLIGHT.includes(item?.status)&&!item?.fill);
  const candidates=(ops??[]).filter(op=>op&&!IN_FLIGHT.includes(op.status));
  const candidateNodes=new Set(candidates.map(groupKeyOf).filter(Boolean));
  const launch=[],cut=[],wait=[],reasons={},planned=[],reserved={};
  const holders=()=>[...busy,...planned];
  const defer=(op,reason,extra={})=>{wait.push({op:op.id,reason,...extra});reasons[op.id]=reason;};

  for(const op of candidates){
    if(SETTLED.includes(op.status)){defer(op,`status ${op.status} is not launchable`);continue;}
    if(op.lease){defer(op,'the operation already holds its durable reservation; the engine settles it, not a new launch');continue;}
    if(op.fill){defer(op,'the operation waits on credential custody and holds no runtime slot');continue;}
    const over=cutSizeReason(op);
    if(over){cut.push(op.id);reasons[op.id]=`cut to implementation.plan: ${over}`;continue;}
    if(busy.length+planned.length>=max){defer(op,`maxParallelOps ${max} is already in flight; release a slot before dispatching ${op.id}`);continue;}
    const conflict=holders().map(other=>firstConflict(op,other,state)).find(Boolean);
    if(conflict){defer(op,conflict.reason,{file:conflict.file,holder:conflict.holder});continue;}
    const contested=holders().map(other=>firstLease(op,other)).find(Boolean);
    if(contested){defer(op,contested.reason,{lease:contested.key,holder:contested.holder});continue;}
    const fanOut=fanOutReason(state,op,holders(),candidateNodes,policy);
    if(fanOut){defer(op,fanOut,{parent:groupOf(state,op)??null});continue;}
    let runtime=null;
    if(typeof allocator?.review==='function'){
      const role=roleOf(op)??'implement',avoid=unique([...(op.avoidRuntimes??[]),...verifyAvoids(state,op)]);
      const view=allocator.review(op.kind,{avoid,restrictTo:op.restrictTo??null,difficulty:effectiveDifficulty(op),job:{...op,opId:op.id,role}});
      const freeable=(view?.ready??[]).filter(item=>finite(item?.free,1)-(reserved[item.runtime]??0)>0);
      if(view&&!freeable.length){
        const blocked=(view?.blocked??[]).map(item=>`${item.runtime} (${item.reason})`).join(', ');
        defer(op,`no runtime with the ${role} role and a free slot for ${op.kind}${blocked?`: ${blocked}`:''}`);
        continue;
      }
      runtime=freeable[0]?.runtime??null;
      if(runtime)reserved[runtime]=(reserved[runtime]??0)+1;
    }
    launch.push(op.id);planned.push(op);
    const beside=holders().slice(0,-1).map(other=>other.id);
    reasons[op.id]=`parallel-safe beside ${beside.join(', ')||'nothing in flight'}: disjoint scopes, no contested lease, slot ${launch.length+busy.length} of ${max}${runtime?`, runtime ${runtime} has a free slot`:''}`;
  }
  return {launch,cut,wait,reasons};
}
