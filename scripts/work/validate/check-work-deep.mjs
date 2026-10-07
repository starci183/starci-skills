#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {parseYaml} from '../../../engine/yaml.mjs';
import {sha256} from '../../../engine/digest.mjs';
import {ID_RE, walk} from './check-example-work.mjs';
import {APP_SIDES, appRootOf, readWorkspace, loadRecords, indexInlineCriteria, splitRef, resolveRecordRef} from '../record-ownership.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { fromRoot } from './work-consistency-shared.mjs';
import { recordRules } from './work-deep-records.mjs';
import { checkSurfaces } from './work-deep-surfaces.mjs';
export { runTimeOf } from './work-deep-records.mjs';

/**
 * Deep/semantic staleness checks layered on top of check-example-work.mjs, which only sees local shape:
 * an id matching its directory, a digest matching its bytes, a ref that resolves. Audits
 * showed everything that gate cannot see: a done record whose dependencies moved underneath it, a proof
 * command that names a spec file which does not exist, a contract surface no controller serves, a
 * shipped mutation no record claims. Those are the checks here.
 *
 * Severity model, deliberately three tiers rather than the gate's refuse/warn:
 *   REFUSE  - deterministically wrong (a file that is not there, a dep digest that moved)
 *   SUSPECT - extracted heuristically (a route found by regex may be a false positive); reported, never
 *             counted as a refusal, because a check that cries wolf trains people to ignore it
 *   INFO    - counts of things no machine can judge but someone should see (unstamped evidence context)
 *
 * Dependency staleness needs a baseline: edges carry no digest in this layout, so the script keeps
 * `_derived/deep-baseline.json` (per-record normDigest + the digest of every record it references).
 * `DEP_STALE`/`NORM_UNRECORDED` only run against that baseline - write it with `--write-baseline` after a
 * verified-clean pass, and the checks stay honest instead of guessing what "changed" means.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Canonical JSON with sorted keys - stable hashing regardless of yaml field order. */
const canon = value => JSON.stringify(value, (_, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

/** The normative projection of a record: everything except fields that describe its lifecycle, not its
 * meaning. `state`/`provenBy`/`verificationSource` are verdicts (derived in the correct model); `change`
 * is metadata ABOUT a change, not the change itself - excluding it is what lets NORM_UNRECORDED compare
 * "did the normative text move" against "did rev bump". */
const VOLATILE = new Set(['state', 'change', 'provenBy', 'verificationSource', 'blockedBy']);
const normDigestOf = data => {
  const projection = Object.fromEntries(Object.entries(data ?? {}).filter(([k]) => !VOLATILE.has(k)));
  return sha256(canon(projection));
};

/** Every record id this record references, anywhere in its yaml - deps for blast-radius purposes.
 * Compact format: `P#frag` is a dep on P (the parent owns the inlined criterion). */
function depsOf(data) {
  const deps = new Set();
  const collect = node => {
    if (typeof node === 'string') {
      const s = node.trim();
      if (ID_RE.test(s)) { deps.add(s); return; }
      const {id, frag} = splitRef(s);
      if (frag !== null && frag && ID_RE.test(id)) deps.add(id);
      return;
    }
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === 'object') Object.values(node).forEach(collect);
  };
  collect(data);
  deps.delete(data?.id);
  return deps;
}

// ---------- the checks ----------

/** The evidence.yaml files of the tree indexed by the record they belong to. */
function evidenceIndex(workRoot) {
  const evidenceByRecord = new Map();
  for (const file of walk(workRoot).filter(f => f.endsWith('evidence.yaml'))) {
    let ev;
    try { ev = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; } // the gate refuses the malformed file itself
    if (ev?.record) evidenceByRecord.set(ev.record, {ev, file, dir: path.dirname(file)});
  }
  return evidenceByRecord;
}

// NORM_UNRECORDED: normative text moved, rev did not
function checkNormUnrecorded({ workRoot, refuse }, id, rec, was, normNow) {
  if (!was.norm || was.norm === normNow.get(id)) return;
  const revNow = rec.data?.change?.rev, revThen = was.rev;
  if (revThen != null && revNow === revThen) {
    refuse(rec.data ? path.join(rec.dir, 'index.yaml') : workRoot, 'NORM_UNRECORDED',
      `${id}'s normative content changed since baseline but change.rev is still ${revNow} - a silent edit`);
  }
}

// DEP_STALE: a done/proven record whose referenced deps moved since baseline
function checkDepStale({ records, refuse }, id, rec, was, { normNow, inline }) {
  if (rec.data?.state !== 'done' || !was.deps) return;
  const moved = Object.entries(was.deps)
    .map(([depId, depNorm]) => [resolveRecordRef(records, depId, inline), depNorm, depId])
    .filter(([canonical, depNorm]) => canonical && normNow.get(canonical) !== depNorm)
    .map(([, , depId]) => depId);
  if (moved.length) {
    refuse(path.join(rec.dir, 'index.yaml'), 'DEP_STALE',
      `${id} is done but dep(s) changed since last verification: ${moved.join(', ')} - its proof was captured against older premises`);
  }
}

// ---- baseline-backed checks ----
function checkAgainstBaseline(ctx, out, baseline, { normNow, inline }) {
  if (!baseline) {
    out.info.push(`${fromRoot(ctx.workRoot)}: no _derived/deep-baseline.json - DEP_STALE and NORM_UNRECORDED skipped; run --write-baseline after a verified-clean pass [NO_BASELINE]`);
    return;
  }
  const prior = baseline.records ?? {};
  for (const [id, rec] of ctx.records) {
    const was = prior[id];
    if (!was) continue;
    checkNormUnrecorded(ctx, id, rec, was, normNow);
    checkDepStale(ctx, id, rec, was, { normNow, inline });
  }
}

// ---- EVIDENCE_CONTEXT_MISSING: evidence with no cwd/repository stamp can't say what it ran against ----
function reportUnstampedEvidence({ workRoot, evidenceByRecord, info }) {
  let unstamped = 0;
  for (const [, {ev}] of evidenceByRecord) {
    if (!ev.cwd && !ev.repository && !ev.commit) unstamped++;
  }
  if (unstamped) info(workRoot, 'EVIDENCE_CONTEXT_MISSING', `${unstamped} evidence file(s) carry no cwd/repository/commit stamp - a stale verdict cannot say which input moved`);
}

// ---- PAYLOAD_AS_RECORD: asset payloads the base gate walks as records ----
function reportPayloadsAsRecords({ workRoot, info }) {
  const payloads = walk(workRoot).filter(f => f.replaceAll('\\', '/').includes('/assets/') && f.endsWith('.yaml'))
    .map(f => parseYaml(fs.readFileSync(f, 'utf8'))).filter(d => d?.schema && !String(d.schema).startsWith('work/'));
  if (payloads.length) info(workRoot, 'PAYLOAD_AS_RECORD', `${payloads.length} asset payload(s) carry non-work schemas - they are artifacts of their parent record, not records; the base gate should not walk them as such`);
}

// ---- CATALOG_DRIFT ----
function checkCatalogDrift({ workRoot, refuse }) {
  const catalogFile = path.join(workRoot, 'index.yaml');
  const catalog = fs.existsSync(catalogFile) ? parseYaml(fs.readFileSync(catalogFile, 'utf8')) : null;
  const featureDirs = fs.existsSync(path.join(workRoot, 'features'))
    ? fs.readdirSync(path.join(workRoot, 'features')).filter(d => fs.statSync(path.join(workRoot, 'features', d)).isDirectory()) : [];
  const catalogDirs = (catalog?.features ?? []).map(f => String(f.directory ?? '').replace(/^features\//, ''));
  for (const d of featureDirs.filter(d => !catalogDirs.includes(d))) refuse(catalogFile, 'CATALOG_DRIFT', `features/${d} exists on disk but the catalog does not list it`);
  for (const d of catalogDirs.filter(d => !featureDirs.includes(d))) refuse(catalogFile, 'CATALOG_DRIFT', `catalog lists features/${d} but no such directory exists`);
}

function checkTree(workRoot, out, baseline) {
  const records = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  // The app root holds the one package.json, the Work tree and the sides; the be side's src/ is where the shipped surfaces are.
  const appRoot = appRootOf(workRoot);
  const beRoot = path.join(appRoot, 'be');
  const sideRoots = APP_SIDES.map(side => path.join(appRoot, side));
  let appScripts = null;
  try { appScripts = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'))?.scripts ?? {}; } catch { appScripts = {}; }
  const refuse = (file, code, msg) => out.refuse.push(`${fromRoot(file)}: ${msg} [${code}]`);
  const suspect = (file, code, msg) => out.suspect.push(`${fromRoot(file)}: ${msg} [${code}]`);
  const info = (file, code, msg) => out.info.push(`${fromRoot(file)}: ${msg} [${code}]`);
  // evidence files indexed by owning record id
  const evidenceByRecord = evidenceIndex(workRoot);
  const normNow = new Map(); // id -> normDigest
  for (const [id, rec] of records) normNow.set(id, normDigestOf(rec.data));
  // Compact format: a reference written as `P#frag` names a real dependency - the record carrying the
  // criterion.
  const inline = indexInlineCriteria(records);
  const recOf = ref => {
    const rid = resolveRecordRef(records, ref, inline);
    return rid ? records.get(rid) : undefined;
  };
  const ctx = { workRoot, records, workspaceDoc, appRoot, beRoot, sideRoots, appScripts, evidenceByRecord, recOf, refuse, suspect, info, emittedEvents: undefined };
  checkAgainstBaseline(ctx, out, baseline, { normNow, inline });
  for (const [id, rec] of records) {
    for (const rule of recordRules) rule(ctx, id, rec);
  }
  reportUnstampedEvidence(ctx);
  reportPayloadsAsRecords(ctx);
  checkCatalogDrift(ctx);
  return {records: records.size, surfaces: checkSurfaces(ctx)};
}

// ---------- baseline ----------
function writeBaseline(workRoot) {
  const records = loadRecords(workRoot, walk);
  const entry = {};
  for (const [id, rec] of records) {
    const deps = {};
    for (const depId of depsOf(rec.data)) {
      const dep = records.get(depId);
      if (dep) deps[depId] = normDigestOf(dep.data);
    }
    entry[id] = {norm: normDigestOf(rec.data), rev: rec.data?.change?.rev ?? null, deps};
  }
  const dir = path.join(workRoot, '_derived');
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, 'deep-baseline.json');
  fs.writeFileSync(file, JSON.stringify({generatedAt: new Date().toISOString(), records: entry}, null, 2));
  return file;
}

// ---------- main ----------
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const doBaseline = args.includes('--write-baseline');
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const trees = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(dir => path.dirname(dir));

  if (doBaseline) {
    for (const workRoot of trees) console.log(`baseline written: ${writeBaseline(workRoot)}`);
    process.exitCode = 0;
  } else {
    const out = {refuse: [], suspect: [], info: []};
    for (const workRoot of trees) {
      const baselineFile = path.join(workRoot, '_derived', 'deep-baseline.json');
      const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : null;
      checkTree(workRoot, out, baseline);
    }
    for (const l of out.refuse) console.log(`REFUSE  ${l}`);
    for (const l of out.suspect) console.log(`SUSPECT ${l}`);
    for (const l of out.info) console.log(`INFO    ${l}`);
    console.log(`\n${out.refuse.length} refused, ${out.suspect.length} suspect, ${out.info.length} info`);
    process.exitCode = out.refuse.length ? 1 : 0;
  }
}
