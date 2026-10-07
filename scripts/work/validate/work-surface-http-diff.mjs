// The http half of the surface diff of check-work-surfaces.mjs: the routes contracts and integrations declare against
// the routes controllers serve.
import path from 'node:path';
import {declaredEventIdsOf, declaredGqlOf, declaredHttpOf, declaredKey, normRoute, servedKey} from './work-surface-declared.mjs';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ALL']);

/** Probe doors a host serves for its own sake - real, but no contract could ever own /health. */
const OPS_ROUTE_RE = /^\/(health|healthz|ready|readyz|live|livez|metrics|favicon\.ico|\.well-known)(\/|$)/;

/** The http endpoints an integration record lists that carry a method and an absolute path. */
function integrationEndpointsOf(rec,id,file){
  const found=[];
  for(const endpoint of Array.isArray(rec.data?.endpoints)?rec.data.endpoints:[]){
    const method=String(endpoint?.method??'').toUpperCase();
    if(HTTP_METHODS.has(method)&&typeof endpoint?.path==='string'&&endpoint.path.startsWith('/')){
      found.push({method,path:endpoint.path,id,state:rec.data?.state,file});
    }
  }
  return found;
}

function collectContractDeclarations(rec,id,file,found){
  for(const item of declaredHttpOf(rec.data))found.declaredHttp.push({...item,id,state:rec.data?.state,file});
  for(const name of declaredGqlOf(rec.data,true))found.declaredGql.push({name,id,state:rec.data?.state,file});
  for(const name of declaredGqlOf(rec.data,false))found.contractClaimedOps.add(name);
  for(const eventId of declaredEventIdsOf(rec.data))found.declaredContractEvents.push({id:eventId,by:id,file});
}

export function contractDeclarations(records,indexFile){
  const found={declaredHttp:[],declaredGql:[],contractClaimedOps:new Set(),declaredContractEvents:[],integrationEndpoints:[]};
  for(const [id,rec] of records){
    const file=indexFile(rec);
    if(rec.schema==='work/contract@1')collectContractDeclarations(rec,id,file,found);
    if(rec.schema==='work/integration@1')found.integrationEndpoints.push(...integrationEndpointsOf(rec,id,file));
  }
  return found;
}

/** A declaration a controller serves: it claims the route, and a contract route no impl record proves is a suspect. */
function reportServedDeclaration(declaration,served,declaredHttp,provedIds,suspect){
  if(declaredHttp.includes(declaration)&&!provedIds.has(declaration.id)){
    suspect(declaration.file,'CONTRACT_ROUTE_UNPROVEN',
      `${declaration.id}'s declared route ${declaration.method} ${declaration.path} is served by ${path.basename(served.file)} but no `+
      `impl record's proves names ${declaration.id} - the wire exists in contract and code, yet no implementation claims it`);
  }
}

function reportUnservedContractRoute(declaration,suspect,refuse){
  // a contract's declared wire with no serving route is the /buyers-vs-/internal/buyers class -
  // deterministically wrong once the contract is done; a todo contract may describe a wire not
  // yet built, so it is suspected, not refused
  const msg=`${declaration.id} declares "${declaration.method} ${declaration.path}" but no controller in any bound repository `+
    'serves it - a done contract describing a wire that does not exist';
  if(declaration.state==='done')refuse(declaration.file,'CONTRACT_GHOST_ROUTE',msg);
  else suspect(declaration.file,'CONTRACT_GHOST_ROUTE',
    `${msg} (record is ${declaration.state??'(no state)'}, not done - the door may still be unbuilt)`);
}

/** Matches each declared route to a served one; returns the keys of the served routes some declaration claims. */
export function matchDeclaredRoutes(declarations,declaredHttp,servedRoutes,servedKeys,provedIds,suspect,refuse,info){
  const claimedRouteKeys=new Set();
  for(const declaration of declarations){
    const key=declaredKey(declaration);
    const served=servedKeys.get(key)
      ??servedRoutes.find(route=>route.method==='ALL'&&normRoute(route.path)===normRoute(declaration.path));
    if(served){
      claimedRouteKeys.add(servedKey(served));
      reportServedDeclaration(declaration,served,declaredHttp,provedIds,suspect);
    }else if(declaredHttp.includes(declaration)){
      reportUnservedContractRoute(declaration,suspect,refuse);
    }else{
      // an integration endpoint is the provider's wire, not ours: unserved usually means outbound
      // (SePay's /userapi/..., Keycloak's /realms/...), which no controller could ever serve - INFO,
      // with the one question a reader has to answer themselves
      info(declaration.file,'INTEGRATION_ENDPOINT_REMOTE',
        `${declaration.id} endpoint "${declaration.method} ${declaration.path}" is not served by any bound repository - expected for the `+
        "provider's own API; check this entry if the endpoint was meant as an inbound door (webhook/callback)");
    }
  }
  return claimedRouteKeys;
}

export function reportUndeclaredRoutes(servedRoutes,claimedRouteKeys,ownerOf,suspect,info){
  for(const route of servedRoutes){
    if(claimedRouteKeys.has(servedKey(route)))continue;
    if(OPS_ROUTE_RE.test(normRoute(route.path))){
      info(route.file,'OPS_ROUTE',`${route.method} ${route.path} is an ops/probe door - real, but no contract could ever own it`);
      continue;
    }
    const owner=ownerOf(route.file);
    const msg=`${route.method} ${route.path} served by ${path.basename(route.file)} `+
      (owner?`is owned by ${owner.id} but declared by no contract or integration endpoint `+
        '- a wire between features with no record of its shape'
        :"sits under no record's owners and is declared nowhere - a shipped surface the tree cannot explain");
    suspect(route.file,'UNDECLARED_ROUTE',msg);
  }
}
