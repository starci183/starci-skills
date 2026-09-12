import fs from 'node:fs';
import path from 'node:path';
import {readDistJson} from '../core/runtime-root.mjs';
import {parseYaml} from '../core/yaml.mjs';

/**
 * The workflow brain as data. `profiles/kinds.yaml` declares three things and this module is the only code
 * that reads them: the complete catalog of operation kinds (family, allocator role, what each may change,
 * what each may report), the mandatory lane every ledger node walks, and the bounded routes an outcome may
 * take. Everything here is a pure function of that profile; the only I/O is `loadKinds`.
 *
 * The division of labour is the point. A model fills the content of one operation and answers the closed
 * options that operation offers. It never chooses the next step, never chooses which kind repairs what, and
 * never chooses how many rounds a repair gets: `nextKind` and `routeFor` answer that from the profile, so the
 * same node always walks the same process and a changed process is a reviewable diff, not a better prompt.
 *
 * Two symbolic route targets keep the routes product-agnostic: `same` is the reporting kind itself (a shared
 * change a frontend op needs is a frontend op), and `lane.build` is the build step of the reporter's lane (a
 * red UAT walk repairs the build that lane declares). Both need context - `routeFor` is given `kind` and
 * `lane` - and an unresolvable symbol is reported as `unresolved`, never guessed into a default.
 */
export const KIND_GRAPH='starci/kind-graph@1';
/** The closed catalog. `validateGraph` refuses a profile that adds to it or drops from it. */
export const KINDS=Object.freeze(['business.decide','architecture.decide','architecture.revise','interface.draw','e2e.verify',
  'frontend.implement','backend.implement','runtime.operate','uat.verify','review.verify']);
export const FAMILIES=Object.freeze(['design','build','prove','repair']);
export const ROLES=Object.freeze(['decide','plan','implement','verify','write']);
export const MUTATIONS=Object.freeze(['code','sds','srs','decision','design','runtime']);
export const ORIGINS=Object.freeze(['ledger','shared','repair','gate','verify','architecture']);
export const OUTCOMES=Object.freeze(['done','partial','failed','ask','blocked']);
export const BLOCKERS=Object.freeze(['shared-change','sds-gap','interface-gap','environment','authority']);
export const VERDICTS=Object.freeze(['pass','findings','rejected','gate-failed']);
export const THEN=Object.freeze(['retry','reopen','pause','settle','needUser']);
/** Route targets that are resolved from the reporter's context instead of naming a kind outright. */
export const SAME='same';
export const LANE_BUILD='lane.build';
export const ON_KEYS=Object.freeze(['outcome','blocker','verdict']);

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const listOf=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[];

let distProfile=null;

/**
 * Load the catalog. Without `profileDir` it is the compiled `.dist/profiles/kinds.json`, exactly as
 * `loadRuntimes` loads the allocator's profile, so the same call works from the authored tree and from the
 * `.dist` copy. With `profileDir` the authored YAML (or a fixture) is read directly, which is how the tests
 * and `validateGraph` read a profile that has not been built yet.
 */
export function loadKinds({profileDir=null}={}){
  if(!profileDir){
    if(!distProfile)distProfile=readDistJson('profiles','kinds.json');
    return distProfile;
  }
  const dir=path.resolve(profileDir);
  for(const name of ['kinds.yaml','kinds.yml']){
    const file=path.join(dir,name);
    if(fs.existsSync(file))return parseYaml(fs.readFileSync(file,'utf8'));
  }
  const json=path.join(dir,'kinds.json');
  if(fs.existsSync(json))return JSON.parse(fs.readFileSync(json,'utf8'));
  throw Error(`No kinds profile in ${dir}: expected kinds.yaml`);
}

const profileOf=profile=>{
  const value=profile??loadKinds();
  need(plain(value)&&plain(value.kinds),'A kinds profile with a kinds catalog is required');
  return value;
};
const vocabulary=(profile,name,fallback)=>{
  const declared=profile?.vocabularies?.[name];
  return Array.isArray(declared)&&declared.length?declared.filter(item=>typeof item==='string'):fallback;
};
const lanesOf=profile=>Array.isArray(profile?.lanes)?profile.lanes.filter(plain):[];
const routesOf=profile=>Array.isArray(profile?.routes)?profile.routes.filter(plain):[];
const matchesOf=lane=>plain(lane?.match)?[lane.match]:Array.isArray(lane?.match)?lane.match.filter(plain):[];
const stepsOf=lane=>Array.isArray(lane?.steps)?lane.steps.map(step=>typeof step==='string'?{kind:step}:step).filter(plain):[];

/* ------------------------------------------------------------------ the catalog */

/** Every kind the loaded profile catalogues, in catalog order. */
export function kindList({profile=null}={}){return Object.keys(profileOf(profile).kinds);}
/** One catalog entry; throws for a kind the profile does not declare, because an unknown kind is a bug. */
export function kindRecord(kind,{profile=null}={}){
  const record=profileOf(profile).kinds[kind];
  need(plain(record),`Unknown operation kind ${kind}; the catalog is ${kindList({profile}).join(', ')}`);
  return record;
}
export function familyOf(kind,{profile=null}={}){return kindRecord(kind,{profile}).family;}
export function roleOf(kind,{profile=null}={}){return kindRecord(kind,{profile}).role;}
export function isReadOnly(kind,{profile=null}={}){return kindRecord(kind,{profile}).readOnly===true;}
export function mutationsOf(kind,{profile=null}={}){return listOf(kindRecord(kind,{profile}).mutates);}
/** The launchable operator contract behind a kind: `frontend.implement` is carried by `interface.implement`. */
export function operatorOf(kind,{profile=null}={}){return kindRecord(kind,{profile}).operator??kind;}
/** What a kind may report: outcomes it may end with and blocker kinds it may raise. */
export function reportsOf(kind,{profile=null}={}){
  const reports=kindRecord(kind,{profile}).reports;
  return {outcomes:listOf(reports?.outcomes),blockers:listOf(reports?.blockers)};
}
/** Named predicates `optionalWhen` may reference, with the one-line meaning the kernel implements. */
export function predicatesOf({profile=null}={}){
  const declared=profileOf(profile).predicates;
  return plain(declared)?{...declared}:{};
}

/* ------------------------------------------------------------------ lanes */

/** The side a node is delivered on: its layout when it has one, else the role its repository binding names. */
const roleOfNode=node=>{
  const value=node?.layout??node?.repositoryRole??null;
  return typeof value==='string'&&value.trim()?value.trim():null;
};
const matchFits=(match,node)=>{
  if(typeof match.kind==='string'&&match.kind!==node?.kind)return false;
  if(typeof match.role==='string'&&match.role!==roleOfNode(node))return false;
  return true;
};

/**
 * The lane record for one ledger node - `{kind, layout:'backend'|'frontend'|null, repositoryRole?}`. The first
 * lane whose match fits wins, so the profile's order is the specificity order; `null` when no lane claims the
 * node, which the kernel must treat as a question for the user rather than as a default lane.
 */
export function laneRecordFor(node,{profile=null}={}){
  const resolved=profileOf(profile);
  for(const lane of lanesOf(resolved))for(const match of matchesOf(lane))if(matchFits(match,node))return lane;
  return null;
}
/** The mandatory sequence of kinds for one node; `[]` when no lane claims it. */
export function laneFor(node,{profile=null}={}){
  const lane=laneRecordFor(node,{profile});
  return lane?stepsOf(lane).map(step=>step.kind):[];
}
/** One lane by id, for a status view or a contract that already knows which lane it is in. */
export function laneById(id,{profile=null}={}){return lanesOf(profileOf(profile)).find(lane=>lane.id===id)??null;}

/**
 * Resolve whatever the caller calls a "lane" into steps that still carry `optionalWhen`: a lane id, a lane
 * record, or the plain kind list `laneFor` returned (matched back to its lane so the optional step is not
 * lost). An unrecognised kind list is taken at face value, with every step mandatory.
 */
function laneSteps(lane,profile){
  if(Array.isArray(lane)){
    const kinds=lane.map(step=>plain(step)?step.kind:step).filter(item=>typeof item==='string');
    const found=lanesOf(profile).find(item=>{
      const steps=stepsOf(item).map(step=>step.kind);
      return steps.length===kinds.length&&steps.every((kind,index)=>kind===kinds[index]);
    });
    return found?stepsOf(found):kinds.map(kind=>({kind}));
  }
  if(typeof lane==='string'){
    const found=lanesOf(profile).find(item=>item.id===lane);
    need(found,`Unknown lane ${lane}`);
    return stepsOf(found);
  }
  need(plain(lane),'A lane is a lane id, a lane record or a list of kinds');
  return stepsOf(lane);
}

const satisfied=(name,predicates)=>{
  const value=predicates?.[name];
  return typeof value==='function'?Boolean(value(name)):Boolean(value);
};

/**
 * The next step of a lane, or `null` when the lane is walked. The order is mandatory: a step that is neither
 * done nor a satisfied optional is returned even when a later step is already done, so a lane cannot be
 * entered in the middle and a skipped step is never silently accepted. `optionalWhen` is satisfied only by a
 * named predicate the kernel evaluated - a missing predicate is false, so the default is to run the step.
 */
export function nextKind(lane,doneKinds=[],{predicates={},profile=null}={}){
  const resolved=profileOf(profile);
  const done=new Set(Array.isArray(doneKinds)?doneKinds:[doneKinds]);
  for(const step of laneSteps(lane,resolved)){
    if(done.has(step.kind))continue;
    if(typeof step.optionalWhen==='string'&&satisfied(step.optionalWhen,predicates))continue;
    return step.kind;
  }
  return null;
}

/** A one-line markdown rendering of a lane, for an operation contract, a status view or docs. */
export function describeLane(lane,{profile=null}={}){
  const resolved=profileOf(profile);
  const steps=laneSteps(lane,resolved);
  const id=typeof lane==='string'?lane:plain(lane)&&!Array.isArray(lane)?lane.id:(lanesOf(resolved).find(item=>{
    const kinds=stepsOf(item).map(step=>step.kind),given=steps.map(step=>step.kind);
    return kinds.length===given.length&&kinds.every((kind,index)=>kind===given[index]);
  })?.id??null);
  const rendered=steps.map(step=>`\`${step.kind}\`${step.optionalWhen?` (optional when \`${step.optionalWhen}\`)`:''}`).join(' -> ');
  return id?`${id}: ${rendered||'(no step)'}`:rendered||'(no step)';
}

/* ------------------------------------------------------------------ routes */

const onOf=route=>{
  const on=plain(route?.on)?route.on:{};
  return Object.fromEntries(ON_KEYS.filter(key=>typeof on[key]==='string').map(key=>[key,on[key]]));
};
const fromOf=route=>typeof route?.from==='string'&&route.from.trim()?route.from.trim():'any';
const routeMatches=(route,query)=>{
  const from=fromOf(route);
  if(from!=='any'&&from!==query.kind)return false;
  const on=onOf(route);
  if(!Object.keys(on).length)return false;
  return Object.entries(on).every(([key,value])=>query[key]===value);
};
/** The build step of a lane: the last build-family kind it declares, which is the kind a repair belongs to. */
function laneBuildKind(lane,profile){
  if(!lane)return null;
  const steps=laneSteps(lane,profile).map(step=>step.kind);
  const build=steps.filter(kind=>plain(profile.kinds[kind])&&profile.kinds[kind].family==='build');
  return build.length?build[build.length-1]:null;
}

/**
 * The route one report takes, or `null` when the graph routes nothing (a clean `done`, a passing review) and
 * the lane simply advances. The answer is complete and bounded: the kind to create (`null` with
 * `needUser:true` when the workflow must stop), the origin to create it with, what happens to the reporter
 * (`then`) and how many times this route may fire for the same node group (`limit`).
 *
 * `kind` and `lane` are the reporter's context. Without them a symbolic target cannot be resolved, and the
 * answer says so in `unresolved` instead of falling back to a kind nobody chose.
 */
export function routeFor({outcome=null,blocker=null,verdict=null,kind=null,lane=null}={},{profile=null}={}){
  const resolved=profileOf(profile);
  const query={outcome,blocker,verdict,kind};
  const route=routesOf(resolved).find(item=>routeMatches(item,query));
  if(!route)return null;
  const to=plain(route.to)?route.to:{};
  const needUser=to.needUser===true;
  const target=typeof to.kind==='string'?to.kind:null;
  let resolvedKind=null,unresolved=null;
  if(!needUser){
    if(target===SAME)resolvedKind=kind??null;
    else if(target===LANE_BUILD)resolvedKind=laneBuildKind(lane,resolved);
    else resolvedKind=target;
    if(!resolvedKind)unresolved=target??'kind';
  }
  return {schema:KIND_GRAPH,route:route.id??null,on:onOf(route),from:fromOf(route),
    kind:resolvedKind,origin:typeof to.origin==='string'?to.origin:null,
    then:typeof route.then==='string'?route.then:null,
    limit:Number.isInteger(route.limit)?route.limit:null,
    needUser,unresolved,purpose:typeof route.purpose==='string'?route.purpose:null};
}
/** Every route, in match order, for a status view or docs. */
export function routeList({profile=null}={}){
  return routesOf(profileOf(profile)).map(route=>({id:route.id??null,on:onOf(route),from:fromOf(route),
    to:plain(route.to)?{...route.to}:{},limit:Number.isInteger(route.limit)?route.limit:null,
    then:typeof route.then==='string'?route.then:null,purpose:typeof route.purpose==='string'?route.purpose:null}));
}

/* ------------------------------------------------------------------ validation */

const fail=(errors,code,message,detail={})=>{errors.push({code,message,...detail});};
/** `on` of A is a subset of `on` of B: every query B matches, A matches too. */
const subsetOn=(a,b)=>Object.entries(a).every(([key,value])=>b[key]===value);

/**
 * Every way the profile can be wrong, as named errors (`[]` means valid). The graph is the process, so an
 * authored mistake here is a process mistake: an unknown kind in a lane or a route, a lane that builds
 * without proving, a design step after a build step, a prove kind allowed to redesign, a route without a
 * limit, a route no query can reach because an earlier one shadows it, a cycle between two named kinds, a
 * blocker no route answers. `runtimes` cross-checks the allocator profile, `operators` the op catalog.
 */
export function validateGraph(given=null,{runtimes=null,operators=null}={}){
  const errors=[];
  const profile=given??loadKinds();
  if(!plain(profile)||!plain(profile.kinds)){fail(errors,'profile-shape','A kinds profile needs a kinds catalog');return errors;}
  if(profile.schema!=='starci/kinds@1')fail(errors,'profile-schema',`Unexpected kinds profile schema ${profile.schema}`,{schema:profile.schema??null});
  const families=vocabulary(profile,'families',FAMILIES),roles=vocabulary(profile,'roles',ROLES);
  const mutations=vocabulary(profile,'mutates',MUTATIONS),origins=vocabulary(profile,'origins',ORIGINS);
  const outcomes=vocabulary(profile,'outcomes',OUTCOMES),blockers=vocabulary(profile,'blockers',BLOCKERS);
  const verdicts=vocabulary(profile,'verdicts',VERDICTS),thens=vocabulary(profile,'then',THEN);
  const catalogue=Object.keys(profile.kinds);
  const predicates=plain(profile.predicates)?Object.keys(profile.predicates):[];

  // The catalog is closed in both directions: the compiled KINDS list and the profile must agree.
  for(const kind of KINDS)if(!catalogue.includes(kind))fail(errors,'catalog-drift',`The catalog is missing the required kind ${kind}`,{kind});
  for(const kind of catalogue)if(!KINDS.includes(kind))fail(errors,'catalog-drift',`${kind} is not in the closed KINDS list of execution/kind-graph.mjs`,{kind});

  for(const [kind,record] of Object.entries(profile.kinds)){
    if(!plain(record)){fail(errors,'kind-shape',`Kind ${kind} is not a mapping`,{kind});continue;}
    if(!families.includes(record.family))fail(errors,'unknown-family',`Kind ${kind} declares the unknown family ${record.family}`,{kind,family:record.family??null});
    if(!roles.includes(record.role))fail(errors,'unknown-role',`Kind ${kind} declares the unknown role ${record.role}`,{kind,role:record.role??null});
    if(typeof record.readOnly!=='boolean')fail(errors,'missing-read-only',`Kind ${kind} must declare readOnly`,{kind});
    if(typeof record.purpose!=='string'||!record.purpose.trim())fail(errors,'missing-purpose',`Kind ${kind} must declare a one-line purpose`,{kind});
    const mutates=listOf(record.mutates);
    for(const entry of mutates)if(!mutations.includes(entry))fail(errors,'unknown-mutation',`Kind ${kind} may not mutate the unknown thing ${entry}`,{kind,mutates:entry});
    if(record.readOnly===true&&mutates.length)fail(errors,'readonly-mutates',`Kind ${kind} is readOnly and may not declare mutates`,{kind,mutates});
    if(record.readOnly===false&&!mutates.length)fail(errors,'mutates-nothing',`Kind ${kind} is not readOnly but changes nothing; declare what it mutates`,{kind});
    const reports=plain(record.reports)?record.reports:null;
    if(!reports){fail(errors,'missing-reports',`Kind ${kind} must declare the outcomes it may report`,{kind});continue;}
    const reported=listOf(reports.outcomes);
    if(!reported.length)fail(errors,'missing-reports',`Kind ${kind} must declare at least one outcome`,{kind});
    for(const outcome of reported)if(!outcomes.includes(outcome))fail(errors,'unknown-outcome',`Kind ${kind} may not report the unknown outcome ${outcome}`,{kind,outcome});
    for(const entry of listOf(reports.blockers)){
      if(!blockers.includes(entry))fail(errors,'unknown-blocker',`Kind ${kind} may not raise the unknown blocker ${entry}`,{kind,blocker:entry});
    }
    if(listOf(reports.blockers).length&&!reported.includes('blocked'))fail(errors,'blockers-without-blocked',`Kind ${kind} declares blockers but may not report blocked`,{kind});
    if(Array.isArray(operators)&&operators.length){
      const operator=record.operator??kind;
      if(!operators.includes(operator))fail(errors,'unknown-operator',`Kind ${kind} names the operator ${operator}, which the op catalog does not contain`,{kind,operator});
    }
  }

  const laneIds=new Set(),seenMatches=new Set();
  for(const lane of lanesOf(profile)){
    const id=typeof lane.id==='string'&&lane.id.trim()?lane.id.trim():null;
    if(!id){fail(errors,'lane-shape','Every lane needs an id');continue;}
    if(laneIds.has(id))fail(errors,'duplicate-lane-id',`Two lanes share the id ${id}`,{lane:id});
    laneIds.add(id);
    const matches=matchesOf(lane);
    if(!matches.length)fail(errors,'lane-no-match',`Lane ${id} matches no node shape`,{lane:id});
    for(const match of matches){
      const key=`${match.kind??'*'}/${match.role??'*'}`;
      if(seenMatches.has(key))fail(errors,'duplicate-lane-match',`Lane ${id} repeats the node shape ${key} an earlier lane already claims`,{lane:id,match:key});
      seenMatches.add(key);
    }
    const steps=stepsOf(lane);
    if(!steps.length){fail(errors,'lane-no-steps',`Lane ${id} declares no step`,{lane:id});continue;}
    const seenSteps=new Set();
    let builtAt=-1,provenAfterBuild=false;
    steps.forEach((step,index)=>{
      if(typeof step.kind!=='string'||!plain(profile.kinds[step.kind])){
        fail(errors,'lane-unknown-kind',`Lane ${id} step ${index+1} names ${step.kind}, which the catalog does not contain`,{lane:id,kind:step.kind??null});
        return;
      }
      if(seenSteps.has(step.kind))fail(errors,'lane-duplicate-step',`Lane ${id} walks ${step.kind} twice; a lane is a sequence, not a loop`,{lane:id,kind:step.kind});
      seenSteps.add(step.kind);
      if(typeof step.optionalWhen==='string'&&!predicates.includes(step.optionalWhen))
        fail(errors,'lane-unknown-predicate',`Lane ${id} step ${step.kind} is optional when ${step.optionalWhen}, which the profile does not declare`,{lane:id,kind:step.kind,predicate:step.optionalWhen});
      const family=profile.kinds[step.kind].family;
      if(family==='build')builtAt=index;
      if(family==='design'&&builtAt>=0)fail(errors,'lane-design-after-build',`Lane ${id} draws ${step.kind} after it already built; design comes first`,{lane:id,kind:step.kind});
      if(family==='prove'&&builtAt>=0&&index>builtAt)provenAfterBuild=true;
    });
    if(builtAt>=0&&!provenAfterBuild)fail(errors,'lane-build-without-proof',`Lane ${id} builds without proving it afterwards`,{lane:id});
  }

  const routeIds=new Set(),seenRoutes=[],edges=new Map(),routed=new Set();
  routesOf(profile).forEach((route,index)=>{
    const id=typeof route.id==='string'&&route.id.trim()?route.id.trim():`route-${index+1}`;
    if(routeIds.has(id))fail(errors,'duplicate-route-id',`Two routes share the id ${id}`,{route:id});
    routeIds.add(id);
    const on=onOf(route),from=fromOf(route);
    if(!Object.keys(on).length)fail(errors,'route-empty-on',`Route ${id} matches nothing; declare an outcome, a blocker or a verdict`,{route:id});
    if(on.outcome&&!outcomes.includes(on.outcome))fail(errors,'route-unknown-outcome',`Route ${id} routes the unknown outcome ${on.outcome}`,{route:id,outcome:on.outcome});
    if(on.blocker&&!blockers.includes(on.blocker))fail(errors,'route-unknown-blocker',`Route ${id} routes the unknown blocker ${on.blocker}`,{route:id,blocker:on.blocker});
    if(on.verdict&&!verdicts.includes(on.verdict))fail(errors,'route-unknown-verdict',`Route ${id} routes the unknown verdict ${on.verdict}`,{route:id,verdict:on.verdict});
    if(on.blocker)routed.add(on.blocker);
    if(from!=='any'&&!plain(profile.kinds[from]))fail(errors,'route-unknown-from',`Route ${id} comes from ${from}, which the catalog does not contain`,{route:id,from});
    if(from!=='any'&&on.blocker&&plain(profile.kinds[from])&&!listOf(profile.kinds[from].reports?.blockers).includes(on.blocker))
      fail(errors,'route-unreachable-blocker',`Route ${id} routes ${on.blocker} from ${from}, which may not raise it`,{route:id,from,blocker:on.blocker});
    if(!Number.isInteger(route.limit)||route.limit<1)fail(errors,'route-missing-limit',`Route ${id} needs a positive integer limit`,{route:id,limit:route.limit??null});
    if(!thens.includes(route.then))fail(errors,'route-unknown-then',`Route ${id} does not say what happens to the requester`,{route:id,then:route.then??null});
    const to=plain(route.to)?route.to:{};
    const needUser=to.needUser===true;
    const target=typeof to.kind==='string'?to.kind:null;
    if(!needUser&&!target)fail(errors,'route-target-missing',`Route ${id} names neither a kind nor needUser`,{route:id});
    if(needUser&&target)fail(errors,'route-target-conflict',`Route ${id} asks for the user and for the kind ${target}`,{route:id,kind:target});
    if(needUser&&route.then!=='needUser')fail(errors,'route-needs-user-then',`Route ${id} stops for the user, so then must be needUser`,{route:id,then:route.then??null});
    if(to.origin!==undefined&&!origins.includes(to.origin))fail(errors,'route-unknown-origin',`Route ${id} creates an operation with the unknown origin ${to.origin}`,{route:id,origin:to.origin});
    if(target&&![SAME,LANE_BUILD].includes(target)&&!plain(profile.kinds[target]))
      fail(errors,'route-unknown-kind',`Route ${id} routes to ${target}, which the catalog does not contain`,{route:id,kind:target});
    if(target&&plain(profile.kinds[target])){
      const targetFamily=profile.kinds[target].family;
      if(from!=='any'&&profile.kinds[from]?.family==='prove'&&targetFamily==='design')
        fail(errors,'prove-to-design',`Route ${id} lets the prove kind ${from} run the design kind ${target}; a prover asks for a redesign, it never is one`,{route:id,from,kind:target});
      if(targetFamily==='design'&&!['reopen','pause'].includes(route.then))
        fail(errors,'design-target-must-wait',`Route ${id} routes to the design kind ${target} without pausing or reopening the requester`,{route:id,kind:target,then:route.then??null});
      if(from!=='any'){
        const next=edges.get(from)??new Set();
        next.add(target);edges.set(from,next);
      }
    }
    for(const earlier of seenRoutes){
      if(subsetOn(earlier.on,on)&&(earlier.from==='any'||earlier.from===from))
        fail(errors,'route-shadowed',`Route ${id} is unreachable: ${earlier.id} already matches it`,{route:id,shadowedBy:earlier.id});
    }
    seenRoutes.push({id,on,from});
  });
  for(const blocker of blockers)if(!routed.has(blocker))fail(errors,'unrouted-blocker',`No route answers the blocker ${blocker}`,{blocker});

  // A cycle between named kinds: two routes that hand the work back and forth with no shared bound.
  const state=new Map();
  const walk=(kind,trail)=>{
    if(state.get(kind)==='done')return;
    if(state.get(kind)==='open'){
      fail(errors,'route-cycle',`The routes cycle: ${[...trail,kind].join(' -> ')}`,{cycle:[...trail,kind]});
      return;
    }
    state.set(kind,'open');
    for(const next of edges.get(kind)??[])walk(next,[...trail,kind]);
    state.set(kind,'done');
  };
  for(const kind of edges.keys())walk(kind,[]);

  if(plain(runtimes)){
    const roleOfKind=plain(runtimes.roleOfKind)?runtimes.roleOfKind:{};
    for(const [kind,record] of Object.entries(profile.kinds)){
      if(!plain(record))continue;
      const declared=roleOfKind[kind];
      if(declared===undefined)fail(errors,'role-not-allocatable',`The runtime profile does not map ${kind} to a role, so the allocator would guess one`,{kind});
      else if(declared!==record.role)fail(errors,'role-mismatch',`${kind} is ${record.role} here and ${declared} in the runtime profile`,{kind,role:record.role,runtimeRole:declared});
    }
  }
  return errors;
}

/** Convenience for a caller that only wants a verdict: the loaded profile, validated. */
export function assertGraph(profile=null,{runtimes=null,operators=null}={}){
  const resolved=profile??loadKinds();
  const errors=validateGraph(resolved,{runtimes,operators});
  need(!errors.length,`The kind graph does not validate: ${errors.map(error=>`${error.code}: ${error.message}`).join('; ')}`);
  return resolved;
}
