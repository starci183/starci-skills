import * as graph from './graph.mjs';

/**
 * Input and output as data, so the kernel stops carrying its own sets of kinds.
 *
 * Until 5.1 the kernel knew by heart which kinds read the brand (`DESIGN_KINDS`), which operation answers a
 * decision node (`DECISION_OPERATION`) and which one authors a feature. Every one of those lists was a copy of
 * something the kinds profile already declares, and a copy drifts: a kind added to `model/kinds.yaml` was
 * invisible to the kernel until somebody remembered to edit the kernel too. This module is the one place that
 * derives those answers from the profile, and the kernel asks it instead of remembering.
 *
 * It is also where the record catalog of 5-plus lands: what a file in the Work tree IS (`recordKindOfPath`),
 * what an operation kind may cite and may write (`ioPayload`, `ioBlock`), and which of the files a report
 * produced are records the kind never declared (`undeclaredWrites`). The kinds profile of today declares only
 * `mutates`; every function below reads `reads`/`writes` when the profile has them and falls back to `mutates`
 * when it does not, so the same kernel runs on both profiles and the answers do not change until the data does.
 */
export const KERNEL_IO='starci/kernel-io@1';

/** The closed record catalog of 5-plus: what a file in the Work tree or the product is, whoever wrote it. */
export const RECORD_KINDS=Object.freeze(['record','srs','sds','decision','brand','design','asset','code','grammar','evidence','runtime','integration']);

/**
 * Work node kinds the brand-reading derivation keys on when a profile declares no `reads`: the node that IS the
 * interface design record, and the side a node is delivered on when that side is the interface.
 */
const UI_NODE='ui',FRONTEND_SIDE='frontend';
/**
 * The kinds the 5.1 kernel hard-coded as `DESIGN_KINDS`. It is the fallback of `kindsReadingBrand`, used only
 * when no kinds profile can be read at all - a tree whose `.dist` is not built yet still has to run.
 */
export const BRAND_READERS=Object.freeze(['interface.draw','interface.asset','frontend.implement','uat.verify','grammar.update']);
/** The 5.1 `DECISION_OPERATION` map: the fallback of `decisionKindFor` for a node kind no lane claims. */
export const DECISION_OPERATION=Object.freeze({architecture:'architecture.decide',business:'business.decide','business-overview':'business.decide',brand:'brand.decide'});
/** The kind that authors a Work record, and the kind that decides the brand: the two intakes a scope may need. */
export const AUTHOR_KIND='work.author',BRAND_DECIDE='brand.decide',BRAND_SCOPE='brand';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const listOf=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'&&item.trim()):[];
const unique=list=>[...new Set(list)];
const slash=value=>String(value??'').replaceAll('\\','/');
/** A profile the caller passed, else the compiled one; a tree with no readable profile answers `null`, never throws. */
const profileOf=given=>{if(plain(given))return given;try{return graph.loadKinds();}catch{return null;}};
const kindsOf=profile=>plain(profile?.kinds)?profile.kinds:{};
const recordOf=(profile,kind)=>{const record=kindsOf(profile)[kind];return plain(record)?record:null;};
const lanesOf=profile=>Array.isArray(profile?.lanes)?profile.lanes.filter(plain):[];
const matchesOf=lane=>plain(lane?.match)?[lane.match]:Array.isArray(lane?.match)?lane.match.filter(plain):[];
const stepsOf=lane=>(Array.isArray(lane?.steps)?lane.steps:[]).map(step=>typeof step==='string'?step:step?.kind).filter(kind=>typeof kind==='string');

/* ------------------------------------------------------------------ what a kind reads and writes */

/**
 * The declared input and output of one kind. A profile that carries `reads`/`writes` (5-plus) answers both and
 * says so; one that carries only `mutates` (5.1) answers what the kind changes as its output and declares no
 * input at all - which is the honest answer, not an invented one, and is why `undeclaredWrites` is empty there.
 */
export function ioOf(kind,{profile=null}={}){
  const record=recordOf(profileOf(profile),kind);
  if(!record)return {reads:[],writes:[],declaredReads:false,declaredWrites:false};
  const reads=Array.isArray(record.reads)?listOf(record.reads):null;
  const writes=Array.isArray(record.writes)?listOf(record.writes):null;
  return {reads:reads??[],writes:writes??listOf(record.mutates),
    declaredReads:reads!==null,declaredWrites:writes!==null};
}
/** What the validator is told about the operation it judges: the records it may cite and the records it may write. */
export function ioPayload(kind,{profile=null}={}){
  const {reads,writes}=ioOf(kind,{profile});
  return {reads,writes};
}
/**
 * The `## Reads` / `## Produces` block a contract prints under the goal, so an operation knows which records it
 * may cite and which it may write before it reads its allowlist. A section is printed only when the profile
 * declares it: a kind whose inputs nobody has declared yet gets no `## Reads` heading over an empty list.
 */
export function ioBlock(kind,{profile=null}={}){
  const {reads,writes,declaredReads}=ioOf(kind,{profile});
  const lines=[];
  if(declaredReads&&reads.length)lines.push(`## Reads`,...reads.map(record=>`- \`${record}\``),
    `These are the record kinds this operation is derived from; a record of any other kind is not yours to cite as a source.`,``);
  if(writes.length)lines.push(`## Produces`,...writes.map(record=>`- \`${record}\``),
    `Every file you write is one of these record kinds. A file that is any other kind of record is a defect: the kernel maps your changed files itself and sends the report back.`,``);
  return lines;
}

/**
 * The kinds whose contract reads the brand record - what the 5.1 kernel called `DESIGN_KINDS`.
 *
 * A profile that declares `reads` answers it outright: every kind that reads `brand`, plus `uat.verify`, which
 * reads the design and the assets rather than the brand itself and still has to be told the identity it is
 * walking through. A profile that declares only `mutates` is read through its lanes instead, which is the same
 * statement one level up: the steps of every lane that draws or builds an interface (the lane of a `ui` node and
 * the lane of a node delivered on the frontend side), plus the kind that grows the design language itself.
 */
export function kindsReadingBrand({profile=null}={}){
  const resolved=profileOf(profile);
  if(!resolved)return [...BRAND_READERS];
  const declared=Object.entries(kindsOf(resolved)).filter(([,record])=>Array.isArray(record.reads));
  if(declared.length){
    const readers=declared.filter(([,record])=>listOf(record.reads).includes('brand')).map(([kind])=>kind);
    return unique([...readers,...(kindsOf(resolved)['uat.verify']?['uat.verify']:[])]);
  }
  const surfaces=lanesOf(resolved)
    .filter(lane=>matchesOf(lane).some(match=>match.kind===UI_NODE||match.role===FRONTEND_SIDE))
    .flatMap(stepsOf);
  const language=Object.entries(kindsOf(resolved)).filter(([,record])=>listOf(record.mutates).includes('grammar')).map(([kind])=>kind);
  const found=unique([...surfaces,...language]);
  return found.length?found:[...BRAND_READERS];
}

/**
 * The intake of one scope: the brand is decided, everything else is authored. Both kinds are read from the
 * profile - the single step of the brand lane, and the kind whose only output is an authored `record` - so a
 * profile that renames either is followed without editing the kernel.
 */
export function intakeKindFor(scope,{profile=null}={}){
  const resolved=profileOf(profile);
  if(slash(scope).replace(/\/+$/,'')===BRAND_SCOPE)return decisionKindFor(BRAND_SCOPE,{profile:resolved})??BRAND_DECIDE;
  const authors=Object.entries(kindsOf(resolved)).find(([,record])=>{
    const writes=Array.isArray(record.writes)?listOf(record.writes):listOf(record.mutates);
    return record.role==='plan'&&writes.includes('record');
  });
  return authors?.[0]??AUTHOR_KIND;
}
/**
 * The operation that answers a decision node: the one step of the lane the profile matches for that node kind.
 * A lane with more than one step is not a decision (a decision is settled once, never built and re-decided), so
 * only a single-step lane answers here; anything else falls back to the 5.1 map and then to `business.decide`.
 */
export function decisionKindFor(nodeKind,{profile=null}={}){
  const resolved=profileOf(profile);
  const lane=(()=>{try{return graph.laneFor({kind:nodeKind},{profile:resolved});}catch{return [];}})();
  if(lane.length===1)return lane[0];
  return DECISION_OPERATION[nodeKind]??'business.decide';
}

/* ------------------------------------------------------------------ what a file is */

const WORK_ROOT=/^\.?\/?\.starciwork\//;
/**
 * The record kind of one path - the layout table of 5-plus §2, most specific first. The path is the one the
 * kernel computes from git, so it may name the tree (`.starciwork/features/...`) or be tree-relative already;
 * `repository:`/`grammar:` are the two prefixes a record may carry instead of a path.
 *
 * `nodeKind` is the one thing a path cannot say on its own: a node's own `index.yaml` is its `record`, except
 * for a `ui` node, whose record IS the interface design. `runtime` is never a path - it is declared, not
 * written - so nothing here ever answers it.
 */
export function recordKindOfPath(file,{nodeKind=null}={}){
  const given=slash(file).replace(/^\.\//,'').trim();
  if(!given)return null;
  if(/^grammar:/i.test(given))return 'grammar';
  if(/^repository:/i.test(given))return 'code';
  const outside=!WORK_ROOT.test(given);
  const relative=given.replace(WORK_ROOT,'');
  if(/(^|\/)knowledge\/grammars\//.test(relative))return 'grammar';
  // A path that neither names the tree nor has the shape of a tree record is product source.
  if(outside&&!/^(features|brand)\//.test(relative))return 'code';
  if(/(^|\/)evidence\//.test(relative))return 'evidence';
  if(/(^|\/)assets\//.test(relative))return 'asset';
  if(/^features\/[^/]+\/business\/srs\/decisions\//.test(relative))return 'decision';
  if(/^features\/[^/]+\/business\//.test(relative))return 'srs';
  if(/^features\/[^/]+\/architecture\//.test(relative))return 'sds';
  if(/^features\/[^/]+\/integration\//.test(relative))return 'integration';
  if(/^features\/[^/]+\/ui\//.test(relative))return 'design';
  if(/^brand\//.test(relative))return 'brand';
  if(/(^|\/)index\.ya?ml$/.test(relative))return nodeKind===UI_NODE?'design':'record';
  return 'code';
}

/**
 * The files a report produced whose record kind the operation's own kind does not declare it writes. A profile
 * that declares no `writes` declares no rule either, so the answer is empty and nothing is refused: the check
 * arrives with the data, not before it.
 */
export function undeclaredWrites(kind,files=[],{profile=null,nodeKind=null}={}){
  const {writes,declaredWrites}=ioOf(kind,{profile});
  if(!declaredWrites)return [];
  const allowed=new Set(writes);
  const found=[];
  for(const file of Array.isArray(files)?files:[]){
    const record=recordKindOfPath(file,{nodeKind});
    if(!record||allowed.has(record))continue;
    found.push({file:slash(file),record});
  }
  return found;
}
