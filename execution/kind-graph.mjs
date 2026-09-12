import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readDistJson} from '../core/runtime-root.mjs';
import {parseYaml} from '../core/yaml.mjs';

/**
 * The kind graph: `profiles/kinds.yaml` read as code. It answers four questions and nothing else - what a
 * kind is (`roleOf`, `familyOf`, `isReadOnly`), which ordered lane of kinds a Work node travels (`laneFor`,
 * `nextKind`, `describeLane`), which kind an outcome routes to (`routeFor`), and whether the profile itself
 * is coherent (`validateGraph`).
 *
 * It holds no control flow: the workflow kernel walks the lane and applies the route. A profile that cannot
 * be read leaves an empty graph rather than throwing, because the kernel degrades to its pre-lane behaviour
 * when the graph knows nothing - a runtime must still run with a stale build.
 */
export const KIND_GRAPH='starci/kinds@1';
export const ROLES=['decide','plan','implement','verify','write'];
export const THENS=['pause','reopen','retry'];
/** Result kinds a route may name that only the caller can resolve. */
export const ROUTE_SENTINELS=['same','lane-build'];
export const EMPTY_GRAPH={schema:KIND_GRAPH,kinds:{},lanes:{},nodeKinds:{},routes:[],problem:null};

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const list=value=>Array.isArray(value)?value:[];
const moduleDir=path.dirname(fileURLToPath(import.meta.url));
/** A lane step is a kind, or a kind with `optionalWhen: <predicate>`: a step only some nodes need. */
const stepOf=step=>plain(step)?{kind:String(step.kind??''),optionalWhen:step.optionalWhen??null}:{kind:String(step??''),optionalWhen:null};

/**
 * Load the profile. A runtime reads the compiled `.dist/profiles/kinds.json` (the only data a relocated
 * runtime may read); an authored tree whose build is older than this file falls back to the YAML beside it.
 */
export function loadKinds({profileDir=null}={}){
  const raw=readProfile(profileDir);
  if(!plain(raw.value))return {...EMPTY_GRAPH,problem:raw.problem};
  const value=raw.value;
  return {schema:value.schema??KIND_GRAPH,kinds:plain(value.kinds)?value.kinds:{},
    lanes:plain(value.lanes)?value.lanes:{},nodeKinds:plain(value.nodeKinds)?value.nodeKinds:{},
    routes:list(value.routes),problem:null};
}
function readProfile(profileDir){
  const sources=profileDir
    ?[()=>JSON.parse(fs.readFileSync(path.join(profileDir,'kinds.json'),'utf8')),
      ()=>parseYaml(fs.readFileSync(path.join(profileDir,'kinds.yaml'),'utf8'))]
    :[()=>readDistJson('profiles','kinds.json'),
      ()=>parseYaml(fs.readFileSync(path.join(moduleDir,'..','profiles','kinds.yaml'),'utf8'))];
  let problem=null;
  for(const read of sources){
    try{return {value:read(),problem:null};}catch(error){problem=problem??error.message;}
  }
  return {value:null,problem:`no kind graph could be read: ${problem}`};
}

/** Every inconsistency the profile can carry, as messages; an empty array means the graph is usable. */
export function validateGraph(profile=GRAPH){
  const errors=[];
  const kinds=plain(profile?.kinds)?profile.kinds:{};
  const lanes=plain(profile?.lanes)?profile.lanes:{};
  const known=Object.keys(kinds);
  if(profile?.schema!==KIND_GRAPH)errors.push(`Unsupported kind-graph schema ${profile?.schema}`);
  if(!known.length)errors.push('The kind graph declares no kinds');
  for(const [kind,entry] of Object.entries(kinds)){
    if(!plain(entry)){errors.push(`Kind ${kind} is not a mapping`);continue;}
    if(!ROLES.includes(entry.role))errors.push(`Kind ${kind} has no role of ${ROLES.join('|')}`);
    if(typeof entry.family!=='string'||!entry.family.trim())errors.push(`Kind ${kind} declares no family`);
  }
  for(const [key,lane] of Object.entries(lanes)){
    if(!list(lane).length){errors.push(`Lane ${key} is empty`);continue;}
    for(const step of lane)if(!known.includes(stepOf(step).kind))errors.push(`Lane ${key} names the unknown kind ${stepOf(step).kind}`);
  }
  for(const [nodeKind,value] of Object.entries(plain(profile?.nodeKinds)?profile.nodeKinds:{})){
    const family=plain(value)?String(value.lane??''):String(value??'');
    if(!Object.keys(lanes).some(key=>key===family||key.startsWith(`${family}/`)))
      errors.push(`Node kind ${nodeKind} maps to the unknown lane family ${family}`);
  }
  for(const route of list(profile?.routes)){
    if(!plain(route)){errors.push('A route is not a mapping');continue;}
    if(!plain(route.when))errors.push(`Route ${route.on} declares no match`);
    if(route.kind&&!known.includes(route.kind)&&!ROUTE_SENTINELS.includes(route.kind))
      errors.push(`Route ${route.on} routes to the unknown kind ${route.kind}`);
    if(route.then&&!THENS.includes(route.then))errors.push(`Route ${route.on} declares the unknown then ${route.then}`);
  }
  return errors;
}

/** The profile this process uses. Read once: a workflow must not change its template mid-run. */
export const GRAPH=loadKinds();
export const KINDS=Object.freeze(Object.keys(GRAPH.kinds));
const entryOf=kind=>GRAPH.kinds[String(kind??'')]??null;
export const roleOf=kind=>entryOf(kind)?.role??null;
export const familyOf=kind=>entryOf(kind)?.family??null;
export const isReadOnly=kind=>entryOf(kind)?.readOnly===true;

/**
 * The lane of one node: its kind picks the family, its layout (`backend` / `frontend`, from the node path or
 * the repository role it declares) picks which lane of that family. A kind the profile does not map falls
 * back to a lane named exactly after it, and then to no lane at all - the caller decides what that means.
 */
export function laneFor({kind,layout=null,repositoryRole=null}={}){
  const {lanes,nodeKinds}=GRAPH;
  const declared=nodeKinds[String(kind??'')];
  const family=plain(declared)?String(declared.lane??kind??''):String(declared??kind??'');
  const where=layout??repositoryRole??(plain(declared)?declared.layout??null:null);
  const fallbackLayout=plain(declared)?declared.defaultLayout??null:null;
  const lane=(where&&lanes[`${family}/${where}`])??lanes[family]??(fallbackLayout?lanes[`${family}/${fallbackLayout}`]:null);
  return list(lane).map(step=>stepOf(step).kind).filter(Boolean);
}

/**
 * The next kind of a lane: the first step nobody has delivered yet. A step declared `optionalWhen` is skipped
 * when its predicate holds for this node, so one lane serves a family whose members do not all need drawing.
 */
export function nextKind(lane,doneKinds=[],{predicates={}}={}){
  const done=new Set(list(doneKinds).map(String));
  for(const step of list(lane)){
    const {kind,optionalWhen}=stepOf(step);
    if(!kind||done.has(kind))continue;
    if(optionalWhen&&holds(predicates,optionalWhen))continue;
    return kind;
  }
  return null;
}
const holds=(predicates,name)=>{
  const value=plain(predicates)?predicates[name]:undefined;
  return typeof value==='function'?Boolean(value()):Boolean(value);
};

/**
 * The route for one reported situation, or null when the graph has no rule for it. `kind: same` is resolved
 * here to the reporting kind; `kind: lane-build` is returned untouched, because only the caller knows the
 * lane the op belongs to.
 */
export function routeFor({outcome=null,blocker=null,verdict=null,kind=null}={}){
  const query={outcome,blocker,verdict,kind};
  for(const route of list(GRAPH.routes)){
    if(!plain(route)||!plain(route.when))continue;
    if(!Object.entries(route.when).every(([field,value])=>String(query[field]??'')===String(value)))continue;
    return {on:route.on??null,kind:route.kind==='same'?kind:route.kind??null,origin:route.origin??null,
      then:THENS.includes(route.then)?route.then:'retry',
      limit:Number.isFinite(route.limit)?route.limit:null,needUser:route.needUser===true};
  }
  return null;
}

/** The lane as one line, for a goal the user approves and a contract an operation reads. */
export function describeLane(lane){
  return list(lane).map(step=>stepOf(step).kind).filter(Boolean).join(' -> ');
}
