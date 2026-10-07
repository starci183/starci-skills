// The graphql and frontend half of the surface diff of check-work-surfaces.mjs: operations and page routes the code
// serves against the contracts, sds flows and ui-screens that name them.
import {camelOf} from './work-surface-gql.mjs';
import {feRoutes} from './work-surface-served.mjs';
import {gqlNamesMentioned, portAppMap, uiRouteClaims} from './work-surface-declared.mjs';

/** Op names the sds components mention in passing. */
function sdsNamedOpsOf(records){
  const sdsNamedOps=new Set();
  for(const [,rec] of records){
    if(rec.schema==='work/sds-component@1'){
      for(const name of gqlNamesMentioned(rec.data))sdsNamedOps.add(name);
    }
  }
  return sdsNamedOps;
}

/** The group an unclaimed op is reported under: its capability directory or its decorator kind. */
const opGroupOf=op=>(op.cap?`${(op.kind==='query'&&'queries')||'mutations'}/${op.cap}`:`decorated ${op.kind}`);

/** Who explains an op: the record owning its file, an impl record named like its directory, a contract surface or an sds flow. */
function claimOf(op,ownerOf,implNamed,contractClaimedOps,sdsNamedOps){
  const owner=op.file?ownerOf(op.file):null;
  const namedImpl=op.dir?implNamed(op.dir):null;
  const names=[op.name,op.dir,op.dir&&camelOf(op.dir)].filter(Boolean);
  const named=set=>names.some(name=>set.has(name));
  return owner?.id??namedImpl
    ??((named(contractClaimedOps)&&'contract-surface')||(named(sdsNamedOps)&&'sds-flow')||null);
}

export function claimGraphOps(ops,records,ownerOf,implNamed,contractClaimedOps){
  const opNames=new Set(ops.map(op=>op.name));
  const sdsNamedOps=sdsNamedOpsOf(records);
  const unclaimed=new Map();
  for(const op of ops){
    op.claim=claimOf(op,ownerOf,implNamed,contractClaimedOps,sdsNamedOps);
    if(!op.claim){
      const group=opGroupOf(op);
      if(!unclaimed.has(group))unclaimed.set(group,[]);
      unclaimed.get(group).push(op);
    }
  }
  return {opNames,unclaimed};
}

export function reportUnclaimedGraphOps(unclaimed,workRoot,suspect){
  for(const [group,groupOps] of unclaimed){
    const names=groupOps.map(op=>op.name).join(', ');
    suspect(groupOps[0].file??workRoot,'UNDECLARED_OPERATION',
      `graphql ${group} serves ${groupOps.length} op(s) no record owns or names: ${names} `+
      '- protocol adaptation is thin, but a shipped door should still be explained');
  }
}

export function reportDeclaredGraphOps(declaredGql,opNames,provedIds,suspect,refuse){
  for(const declaration of declaredGql){
    if(opNames.has(declaration.name)||opNames.has(camelOf(declaration.name))){
      if(!provedIds.has(declaration.id)){
        suspect(declaration.file,'CONTRACT_OP_UNPROVEN',
          `${declaration.id}'s surface names GraphQL ${declaration.name}, which is served, but no impl record's proves names `+
          `${declaration.id} - the op exists in contract and code, yet no implementation claims it`);
      }
      continue;
    }
    const msg=`${declaration.id}'s surface names GraphQL ${declaration.name} but no resolver serves an op of that name `+
      '- the record describes a door that does not exist';
    if(declaration.state==='done')refuse(declaration.file,'CONTRACT_GHOST_OP',msg);
    else suspect(declaration.file,'CONTRACT_GHOST_OP',`${msg} (record is ${declaration.state??'(no state)'}, not done)`);
  }
}

const feRouteKey=route=>`${route.repo}#${route.app??''}#${route.norm}`;

/** One ui-screen route claim against the served pages: the pages it reaches are claimed, a claim no page reaches is a ghost. */
function matchFeClaim(claim,feRoutesAll,portToApp,claimedFe,suspect,refuse){
  // a URL claim's port pins the app through metadata.json's ports projection; an unmapped port
  // degrades to a path match across every app rather than an automatic ghost
  const expectedApp=claim.port?portToApp.get(claim.port)??null:null;
  const hit=feRoutesAll.filter(route=>route.norm===claim.norm&&(!expectedApp||route.app===expectedApp));
  if(hit.length){
    for(const route of hit)claimedFe.add(feRouteKey(route));
    return;
  }
  const where=expectedApp?` on apps/${expectedApp}`:'';
  const msg=`${claim.id} claims route ${claim.raw} (as ${claim.norm}${where}) but no page.tsx serves it in any `+
    'bound fe repository - a screen the record says exists that no route reaches';
  if(claim.state==='done')refuse(claim.file,'UI_ROUTE_GHOST',msg);
  else suspect(claim.file,'UI_ROUTE_GHOST',`${msg} (record is ${claim.state??'(no state)'}, not done)`);
}

export function checkFeRoutes(workRoot,feRoots,records,suspect,refuse){
  const feRoutesAll=feRoots.flatMap(repo=>feRoutes(repo).map(route=>({...route,repo})));
  const claims=uiRouteClaims(records);
  const portToApp=new Map();
  for(const repo of feRoots)for(const [port,app] of portAppMap(workRoot,repo))portToApp.set(port,app);
  const claimedFe=new Set();
  for(const claim of claims)matchFeClaim(claim,feRoutesAll,portToApp,claimedFe,suspect,refuse);
  for(const route of feRoutesAll){
    if(!claimedFe.has(feRouteKey(route))){
      suspect(route.file,'UI_ROUTE_UNDECLARED',
        `${route.app?'apps/'+route.app+' ':''}route ${route.route} is served but no ui-screen's surfaces[].route claims it`);
    }
  }
  return {feRoutesAll,claims,claimedFe};
}
