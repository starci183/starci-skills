// The surface coverage checks of check-work-deep.mjs (SUSPECT tier): shipped routes and operations that no record
// owns or specifies, and contract-declared wires no controller serves.
import fs from 'node:fs';
import path from 'node:path';
import { resolveOwnedDirs } from '../record-ownership.mjs';
import { gqlOps, httpRoutes } from './work-deep-surface-scan.mjs';

/** The record dirs that exist on disk, as `{id, abs}`; a shipped file lies under the first one holding it. */
function ownedDirsOf({ records, workspaceDoc, workRoot }) {
  const ownedDirs = [];
  for (const [id, rec] of records) {
    for (const d of resolveOwnedDirs(id, rec, records, workspaceDoc, workRoot)) {
      if (fs.existsSync(d.abs)) ownedDirs.push({id, abs: d.abs});
    }
  }
  return ownedDirs;
}

function checkUnclaimedSurfaces({ suspect }, { routes, ops }, ownerOf) {
  for (const r of routes) {
    if (!ownerOf(r.file)) suspect(r.file, 'UNCLAIMED_SURFACE', `${r.method} ${r.path} served by ${path.basename(r.file)} sits under no record's owners - a shipped surface with no claimant`);
  }
  for (const o of ops) {
    if (o.file && !ownerOf(o.file)) suspect(o.file, 'UNCLAIMED_SURFACE', `graphql ${o.kind} ${o.cap}/${o.op} sits under no record's owners`);
  }
}

const segSet = data => {
  const segs = new Set(String(data?.id ?? '').split('.'));
  const paths = (data?.owners ?? []).map(o => String(o?.path ?? '')).concat(
    (Array.isArray(data?.module) ? data.module : [data?.module]).filter(Boolean),
    (data?.composes ?? []).map(c => String(c?.module ?? '')));
  for (const p of paths) for (const s of p.split('/')) segs.add(s);
  return segs;
};

/** The capability levels the records give: any of fr|br|contract|sds|uat claims, and fr|br|contract alone (functional). */
function capabilityClaims(records) {
  const claimsAny = new Set();   // fr|br|contract|sds|uat
  const claimsFunc = new Set();  // fr|br|contract only
  for (const [, rec] of records) {
    if (!/^(fr|br|contract|sds|uat)\./.test(rec.id)) continue;
    for (const s of segSet(rec.data)) claimsAny.add(s);
    if (/^(fr|br|contract)\./.test(rec.id)) for (const s of segSet(rec.data)) claimsFunc.add(s);
  }
  return { claimsAny, claimsFunc };
}

// CAPABILITY coverage: owning the module is necessary but not sufficient - an impl owning
// `src/modules/domain/cart` does not mean any record describes what cart DOES. A capability
// (graphql cap dir, controller prefix) is "specified" when a spec record's id carries it as a full
// `.`-segment or its owned path carries it as a path segment - hyphenated lookalikes
// (empty-cart-is-refused) do not count. Two levels: no spec record at all -> WITHOUT_SPEC; only
// impl/sds claim it (designed, never specified functionally) -> WITHOUT_FR.
function checkCapabilityCoverage({ records, workRoot, suspect }, { routes, ops }) {
  const { claimsAny, claimsFunc } = capabilityClaims(records);
  const capLevel = cap => (claimsFunc.has(cap) && 'fr') || (claimsAny.has(cap) && 'design') || null;
  for (const o of ops) {
    const level = capLevel(o.cap) ?? capLevel(o.op);
    if (level === null) suspect(o.file ?? workRoot, 'CAPABILITY_WITHOUT_SPEC', `graphql ${o.kind} ${o.cap}/${o.op} ships but no spec record names "${o.cap}" - capability with no record at all`);
    else if (level === 'design') suspect(o.file ?? workRoot, 'CAPABILITY_WITHOUT_FR', `graphql ${o.kind} ${o.cap}/${o.op} ships; only impl/sds records touch "${o.cap}" - designed but no fr/br/contract describes the operation`);
  }
  const routeCaps = new Set(routes.map(r => r.path.split('/').find(Boolean)).filter(Boolean));
  for (const cap of routeCaps) {
    const level = capLevel(cap);
    if (level === null) suspect(workRoot, 'CAPABILITY_WITHOUT_SPEC', `http routes under /${cap} serve but no spec record names it`);
    else if (level === 'design') suspect(workRoot, 'CAPABILITY_WITHOUT_FR', `http routes under /${cap} serve; only impl/sds records touch it`);
  }
}

/** The `METHOD /path` wires a contract record declares, in declaration order. */
function declaredWires(rec) {
  const shapes = [];
  const surf = rec.data?.surface;
  for (const item of (Array.isArray(surf?.http) && surf.http) || (surf?.http && [surf.http]) || []) {
    if (item?.method && item?.path) shapes.push(`${item.method.toUpperCase()} ${item.path}`);
  }
  for (const entry of Array.isArray(surf?.shape) ? surf.shape : surf?.requests ?? []) {
    const m = /(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/.exec(String(entry?.shape ?? entry));
    if (m) shapes.push(`${m[1]} ${m[2]}`);
  }
  return shapes;
}

// GHOST_SURFACE: contract-declared http path that no controller serves
function checkGhostSurfaces({ records, suspect }, routes) {
  const servedPaths = new Set(routes.map(r => `${r.method} ${r.path.replace(/\/:[^/]+/g, '/:_')}`));
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/contract@1') continue;
    for (const s of declaredWires(rec)) {
      const [method, p] = s.split(' ');
      const norm = `${method} ${p.replace(/\/:[^/]+/g, '/:_').replace(/\/$/, '') || '/'}`;
      if (servedPaths.size && !servedPaths.has(norm)) {
        suspect(path.join(rec.dir, 'index.yaml'), 'GHOST_SURFACE', `${id} declares "${s}" but no controller under be/src serves it - contract describes a wire that does not exist`);
      }
    }
  }
}

// ---- surface coverage (SUSPECT tier): returns how many routes and operations the backend ships.
export function checkSurfaces(ctx) {
  const ownedDirs = ownedDirsOf(ctx);
  const ownerOf = file => ownedDirs.find(d => file.startsWith(d.abs))?.id ?? null;
  const surfaces = { routes: httpRoutes(ctx.beRoot), ops: gqlOps(ctx.beRoot) };
  checkUnclaimedSurfaces(ctx, surfaces, ownerOf);
  checkCapabilityCoverage(ctx, surfaces);
  checkGhostSurfaces(ctx, surfaces.routes);
  return surfaces.routes.length + surfaces.ops.length;
}
