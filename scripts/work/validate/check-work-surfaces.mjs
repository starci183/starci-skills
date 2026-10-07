#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {walk} from './check-example-work.mjs';
import {APP_SIDES, readWorkspace, resolveOwnedDirs, repoRootFor, loadRecords, indexInlineCriteria, resolveRecordRef} from '../record-ownership.mjs'; import { isMain } from '../../lib/is-main.mjs';
import {declaredSubscriptions,wiredSubscriptions,reportWiredSubscriptionDiff,reportFeaturesWithoutSubscribers,appendRepoSurfaceMap,appendSurfaceTotals} from './work-surface-reporting.mjs';
import {fromRoot, repoRoot} from './work-consistency-shared.mjs';
import {gqlOps, httpRoutes} from './work-surface-served.mjs';
import {contractDeclarations, matchDeclaredRoutes, reportUndeclaredRoutes} from './work-surface-http-diff.mjs';
import {checkFeRoutes, claimGraphOps, reportDeclaredGraphOps, reportUnclaimedGraphOps} from './work-surface-ops-diff.mjs';
import {eventIndexes, reportContractEvents, reportUnemittedEvents, reportUnrecordedEvents} from './work-surface-events-diff.mjs';

/**
 * The audits' sharpest surface complaint was the `/buyers` vs `/internal/buyers` class: a done contract
 * describing a wire no controller serves, discovered only when a live run fell over. check-work-deep.mjs
 * carries heuristic SUSPECT-tier versions of this diff (UNCLAIMED_SURFACE, GHOST_SURFACE,
 * CAPABILITY_WITHOUT_*) - deliberately soft, because regex extraction can lie in both directions. This
 * script is the standalone, rigorous pass over the same question: it extracts every public surface the
 * bound repositories actually serve (HTTP routes, GraphQL operations, frontend page routes, domain
 * events) and diffs it against every surface the tree declares (contract surfaces, integration
 * endpoints, ui-screen routes, event records, `subscribes`).
 *
 * Severity follows check-work-deep's discipline:
 *   REFUSE  - a done record asserts a surface nothing serves (deterministically wrong: the record claims
 *             a wire that does not exist)
 *   SUSPECT - served code no record explains, or a todo record's declared surface is not yet served
 *             (extraction is heuristic; an undeclared door can be legitimate)
 *   INFO    - ops-class routes and counts - visible, never alarming
 *
 * Emission is judged on non-spec files only: the bus spec suite constructs every event class
 * (including NewDeviceSigninEvent, which no use case publishes), so counting spec construction as
 * emission would report the exact lie this check exists to catch.
 */

const root = repoRoot;

/** The ids some implementation record's `proves` names (canonical). */
function provedIdsOf(records,canon){
  const provedIds=new Set();
  for(const [,rec] of records){
    if(rec.schema==='work/implementation@1'){
      for(const target of rec.data?.proves??[])if(typeof target==='string')provedIds.add(canon(target));
    }
  }
  return provedIds;
}

/** The record-owned directories that exist on disk, as `{id, abs, feature}`. */
function ownedDirsOf(records,workspaceDoc,workRoot,featureOf){
  const ownedDirs=[];
  for(const [id,rec] of records){
    for(const dir of resolveOwnedDirs(id,rec,records,workspaceDoc,workRoot)){
      if(fs.existsSync(dir.abs))ownedDirs.push({id,abs:dir.abs,feature:featureOf(rec)});
    }
  }
  return ownedDirs;
}

function ownershipClaims(records,workspaceDoc,workRoot,canon,featureOf){
  const provedIds=provedIdsOf(records,canon);
  const ownedDirs=ownedDirsOf(records,workspaceDoc,workRoot,featureOf);
  const ownerOf=file=>ownedDirs.filter(dir=>file.startsWith(dir.abs))
    .sort((a,b)=>b.abs.length-a.abs.length)[0]??null;
  const implIds=new Set([...records].filter(([,rec])=>rec.schema==='work/implementation@1').map(([id])=>id));
  const implNamed=name=>[...implIds].find(id=>id.split('.').pop()===name)??null;
  return {provedIds,ownerOf,implNamed};
}

// ---------- the check ----------

export function checkWorkSurfaces(workRoot, out) {
  const records = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  const refuse = (file, code, msg) => out.refuse.push(`${fromRoot(file)}: ${msg} [${code}]`);
  const suspect = (file, code, msg) => out.suspect.push(`${fromRoot(file)}: ${msg} [${code}]`);
  const info = (file, code, msg) => out.info.push(`${fromRoot(file)}: ${msg} [${code}]`);
  const indexFile = rec => path.join(rec.dir, 'index.yaml');
  const featureOf = rec => path.relative(workRoot, rec.dir).replaceAll('\\', '/').split('/')[1];
  // Compact format: `P#frag` and collapsed bare `ac.*` ids resolve to the record carrying the criterion,
  // so proves/subscribes/contract-event refs compare canonical ids on both sides.
  const inline = indexInlineCriteria(records);
  const canon = ref => resolveRecordRef(records, ref, inline) ?? ref;

  // The sides workspace.yaml declares (be, fe), each its folder under the app root: the be side serves the routes, ops and
  // events, the fe side the pages.
  const sideRoot = side => {
    const root = repoRootFor(workRoot, side, workspaceDoc);
    return root && fs.existsSync(root) ? root : null;
  };
  const repoRoots = APP_SIDES.map(sideRoot).filter(Boolean);
  const beRoots = [sideRoot('be')].filter(r => r && fs.existsSync(path.join(r, 'src')));
  const feRoots = [sideRoot('fe')].filter(Boolean);

  // owned dirs once, for "the tree explains this file" tests
  const {provedIds,ownerOf,implNamed}=ownershipClaims(records,workspaceDoc,workRoot,canon,featureOf);

  // ---------- HTTP ----------
  const servedRoutes = beRoots.flatMap(r => httpRoutes(r).map(x => ({...x, repo: r})));

  const {declaredHttp,declaredGql,contractClaimedOps,declaredContractEvents,integrationEndpoints}=
    contractDeclarations(records,indexFile);

  const claimedRouteKeys=matchDeclaredRoutes([...declaredHttp,...integrationEndpoints],declaredHttp,
    servedRoutes,provedIds,suspect,refuse,info);
  reportUndeclaredRoutes(servedRoutes,claimedRouteKeys,ownerOf,suspect,info);

  // ---------- GraphQL ----------
  const ops = beRoots.flatMap(r => gqlOps(r).map(o => ({...o, repo: r})));
  const {opNames,unclaimed}=claimGraphOps(ops,records,ownerOf,implNamed,contractClaimedOps);
  reportUnclaimedGraphOps(unclaimed,workRoot,suspect);
  reportDeclaredGraphOps(declaredGql,opNames,provedIds,suspect,refuse);

  // ---------- FE routes ----------
  const {feRoutesAll,claims,claimedFe}=checkFeRoutes(workRoot,feRoots,records,suspect,refuse);

  // ---------- events ----------
  const {eventRecs,codeByRepo,allClasses,allEmitted,recordOfClass,emittedRecordIds}=
    eventIndexes(records,beRoots);
  reportUnemittedEvents(eventRecs,emittedRecordIds,recordOfClass,indexFile,refuse,suspect,info);
  reportUnrecordedEvents(allEmitted,allClasses,recordOfClass,suspect);
  reportContractEvents(declaredContractEvents,records,canon,suspect);

  // subscriptions, paired feature-wise: each subscriber file answers to the union of `subscribes`
  // declared by the feature that owns the file's directory
  const subscribesByFeature=declaredSubscriptions(records,featureOf,canon);
  // subscription handling is aggregated per feature before diffing - two subscriber files in one
  // feature would otherwise each report the other's declared events as never wired
  const wiredByFeature=wiredSubscriptions(codeByRepo,ownerOf,recordOfClass,suspect);
  reportWiredSubscriptionDiff(wiredByFeature,subscribesByFeature,records,canon,suspect);
  // a feature declaring subscribes with no subscriber file at all is the same absence, feature-wide
  reportFeaturesWithoutSubscribers(records,wiredByFeature,featureOf,canon,indexFile,suspect);

  // ---------- SURFACE MAP ----------
  appendRepoSurfaceMap(out,repoRoots,{servedRoutes,ops,feRoutesAll,codeByRepo},{claimedRouteKeys,claimedFe},ownerOf);
  appendSurfaceTotals(out,{eventRecs,emittedRecordIds,subscribesByFeature,records},{declaredHttp,integrationEndpoints,declaredGql,claims});
  return {records: records.size, routes: servedRoutes.length, ops: ops.length,
    feRoutes: feRoutesAll.length, events: eventRecs.length};
}

// ---------- main ----------
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const trees = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(dir => path.dirname(dir));

  const out = {refuse: [], suspect: [], info: [], map: []};
  for (const workRoot of trees) checkWorkSurfaces(workRoot, out);
  console.log('SURFACE MAP');
  for (const l of out.map) console.log(`  ${l}`);
  console.log('');
  for (const l of out.refuse) console.log(`REFUSE  ${l}`);
  for (const l of out.suspect) console.log(`SUSPECT ${l}`);
  for (const l of out.info) console.log(`INFO    ${l}`);
  console.log(`\n${out.refuse.length} refused, ${out.suspect.length} suspect, ${out.info.length} info`);
  process.exitCode = out.refuse.length ? 1 : 0;
}
