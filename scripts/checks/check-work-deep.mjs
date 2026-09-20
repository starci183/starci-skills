#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {walk, FAMILIES} from './check-example-work.mjs';
import {readWorkspace, resolveOwnedDirs, repoRootFor, moduleRootOf, loadRecords, indexInlineCriteria, splitRef, resolveRecordRef} from '../example/example-ownership.mjs';

/**
 * Deep/semantic staleness checks layered on top of check-example-work.mjs, which only sees local shape:
 * an id matching its directory, a digest matching its bytes, a ref that resolves. The v6-3/v6-4 audits
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ID_RE = /^(br|ac|fr|nfr|data|journey|decision|sds|ui|impl|uat|contract|integration|gap|event)\.[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sha256File = file => sha256(fs.readFileSync(file));

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
 * Compact format: `P#frag` is a dep on P (the parent owns the inlined criterion), and a bare `ac.*` id
 * that survives only as an inline entry is a dep on the parent carrying it - `canon` maps both forms to
 * the record that actually owns the content today, so DEP_STALE follows the dependency through the
 * collapse rather than losing it. */
function depsOf(data, canon = id => id) {
  const deps = new Set();
  const collect = node => {
    if (typeof node === 'string') {
      const s = node.trim();
      if (ID_RE.test(s)) { deps.add(canon(s)); return; }
      const {id, frag} = splitRef(s);
      if (frag !== null && frag && ID_RE.test(id)) deps.add(canon(id));
      return;
    }
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === 'object') Object.values(node).forEach(collect);
  };
  collect(data);
  deps.delete(data?.id);
  return deps;
}

// ---------- code surface extraction (SUSPECT-tier heuristics) ----------
const SKIP = new Set(['node_modules', 'dist', '.next', '.starciwork']);
const srcFiles = (dir, ext) => {
  if (!fs.existsSync(dir)) return [];
  return walk(dir).filter(f => f.endsWith(ext) && !f.split(path.sep).some(s => SKIP.has(s)));
};

/** HTTP routes from NestJS controllers: @Controller prefix + method decorators in the same file. */
function httpRoutes(repoRoot) {
  const routes = [];
  for (const file of srcFiles(path.join(repoRoot, 'src'), '.controller.ts')) {
    const text = fs.readFileSync(file, 'utf8');
    const prefix = /@Controller\(\s*['"]([^'"]*)/.exec(text)?.[1] ?? '';
    for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete|Head|Options)\(\s*['"]([^'"]*)['"]?\s*\)/g)) {
      routes.push({method: m[1].toUpperCase(), path: `/${[prefix, m[2]].filter(Boolean).join('/')}`.replace(/\/+/g, '/'), file});
    }
    // bare @Get() with no arg
    for (const m of text.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*\)/g)) {
      routes.push({method: m[1].toUpperCase(), path: `/${prefix}`.replace(/\/+/g, '/'), file});
    }
  }
  return routes;
}

/** GraphQL operations: `graphql/{queries,mutations}/<cap>/<op>/` dirs anywhere under src (this codebase
 * nests them per-feature: src/features/<feature>/graphql/...), plus @Query/@Mutation decorated methods. */
function gqlOps(repoRoot) {
  const ops = [];
  const srcRoot = path.join(repoRoot, 'src');
  const findOpDirs = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (!entry.isDirectory() || SKIP.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const parent = path.basename(dir);
      if ((entry.name === 'queries' || entry.name === 'mutations') && parent === 'graphql') {
        const kind = entry.name.slice(0, -1);
        for (const cap of fs.readdirSync(abs).filter(d => fs.statSync(path.join(abs, d)).isDirectory())) {
          const capDir = path.join(abs, cap);
          for (const op of fs.readdirSync(capDir).filter(d => fs.statSync(path.join(capDir, d)).isDirectory())) {
            ops.push({kind, cap, op, file: path.join(capDir, op)});
          }
        }
      } else {
        findOpDirs(abs);
      }
    }
  };
  findOpDirs(srcRoot);
  for (const file of srcFiles(repoRoot, '.resolver.ts')) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/@(Query|Mutation)\b[^)]*\)\s*\n?\s*(?:async\s+)?(\w+)\s*\(/g)) {
      ops.push({kind: m[1].toLowerCase(), op: m[2], file});
    }
  }
  return ops;
}

/** FE routes: every dir under src/app that holds a page.tsx, normalised ([lang] stripped). */
function feRoutes(repoRoot) {
  const appDir = path.join(repoRoot, 'src', 'app');
  return srcFiles(appDir, 'page.tsx').map(f => {
    const rel = path.relative(appDir, path.dirname(f)).replaceAll('\\', '/');
    return '/' + rel.split('/').filter(s => s && !/^\[.*\]$/.test(s)).join('/');
  }).map(p => ({route: p.replace(/\/+/g, '/') || '/', file: null}));
}

/** Domain events: `class XxxEvent` declarations (this codebase uses class-based events, not string emits). */
function eventClasses(repoRoot) {
  const names = new Set();
  for (const file of srcFiles(path.join(repoRoot, 'src'), '.ts')) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/class\s+(\w+Event)\b/g)) names.add(m[1]);
  }
  return names;
}

const eventClassOf = id => id.replace(/^event\./, '').split('.').map(s => s.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())).join('') + 'Event';

// ---------- the checks ----------

function checkTree(workRoot, out, baseline) {
  const records = loadRecords(workRoot, walk);
  const workspaceDoc = readWorkspace(workRoot);
  const backendRoot = path.dirname(workRoot);
  const rel = f => path.relative(root, f).replaceAll('\\', '/');
  const refuse = (file, code, msg) => out.refuse.push(`${rel(file)}: ${msg} [${code}]`);
  const suspect = (file, code, msg) => out.suspect.push(`${rel(file)}: ${msg} [${code}]`);
  const info = (file, code, msg) => out.info.push(`${rel(file)}: ${msg} [${code}]`);

  // evidence files indexed by owning record id
  let emittedEvents; // lazy per-tree cache for the event-class scan
  const evidenceByRecord = new Map();
  for (const file of walk(workRoot).filter(f => f.endsWith('evidence.yaml'))) {
    let ev;
    try { ev = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; } // the gate refuses the malformed file itself
    if (ev?.record) evidenceByRecord.set(ev.record, {ev, file, dir: path.dirname(file)});
  }

  const normNow = new Map(); // id -> normDigest
  for (const [id, rec] of records) normNow.set(id, normDigestOf(rec.data));
  // Compact format: a reference written as `P#frag` or a collapsed bare `ac.*` id still names a real
  // dependency - the record carrying the criterion. Baseline dep ids from before the collapse resolve
  // through the same map.
  const inline = indexInlineCriteria(records);
  const recOf = ref => {
    const rid = resolveRecordRef(records, ref, inline);
    return rid ? records.get(rid) : undefined;
  };

  // ---- baseline-backed checks ----
  if (!baseline) {
    out.info.push(`${rel(workRoot)}: no _derived/deep-baseline.json - DEP_STALE and NORM_UNRECORDED skipped; run --write-baseline after a verified-clean pass [NO_BASELINE]`);
  } else {
    const prior = baseline.records ?? {};
    for (const [id, rec] of records) {
      const was = prior[id];
      if (!was) continue;
      // NORM_UNRECORDED: normative text moved, rev did not
      if (was.norm && was.norm !== normNow.get(id)) {
        const revNow = rec.data?.change?.rev, revThen = was.rev;
        if (revThen != null && revNow === revThen) {
          refuse(rec.data ? path.join(rec.dir, 'index.yaml') : workRoot, 'NORM_UNRECORDED',
            `${id}'s normative content changed since baseline but change.rev is still ${revNow} - a silent edit`);
        }
      }
      // DEP_STALE: a done/proven record whose referenced deps moved since baseline
      if (rec.data?.state === 'done' && was.deps) {
        const moved = Object.entries(was.deps)
          .map(([depId, depNorm]) => [resolveRecordRef(records, depId, inline), depNorm, depId])
          .filter(([canonical, depNorm]) => canonical && normNow.get(canonical) !== depNorm)
          .map(([, , depId]) => depId);
        if (moved.length) {
          refuse(path.join(rec.dir, 'index.yaml'), 'DEP_STALE',
            `${id} is done but dep(s) changed since last verification: ${moved.join(', ')} - its proof was captured against older premises`);
        }
      }
    }
  }

  // ---- per-record checks ----
  for (const [id, rec] of records) {
    const data = rec.data ?? {};
    const indexFile = path.join(rec.dir, 'index.yaml');

    // PROVENBY_AUTHORED: provenBy is a derived field; an authored one is a claim speaking for another record
    if (data.provenBy) {
      refuse(indexFile, 'PROVENBY_AUTHORED', `${id} carries a hand-authored provenBy - provenance is derived from done records' proves edges, never written down by hand`);
      const targets = Object.values(data.provenBy).flat().filter(t => typeof t === 'string');
      for (const t of targets) {
        const target = recOf(t);
        if (target && target.data?.state !== 'done') {
          refuse(indexFile, 'PROVENBY_TARGET_NOT_DONE', `${id} claims proof by ${t}, which is ${target.data?.state ?? '(no state)'} - a false proof claim`);
        }
      }
    }

    // COMPOSES_PATH_DANGLING: composes[].module is a path field the base gate never checks
    for (const c of Array.isArray(data.composes) ? data.composes : []) {
      if (!c || typeof c !== 'object' || !c.module) continue;
      const repoRoot = repoRootFor(workRoot, data.repository, workspaceDoc);
      const abs = path.join(repoRoot, moduleRootOf(c.module));
      if (!fs.existsSync(abs)) {
        const msg = `${id} composes[].module names ${c.module}, which does not exist on disk`;
        if (data.state === 'done') refuse(indexFile, 'COMPOSES_PATH_DANGLING', msg); else suspect(indexFile, 'COMPOSES_PATH_DANGLING', msg);
      }
    }

    // PROOF_COMMAND_DEAD: requiresProof + evidence assertion commands must name real specs/scripts.
    // Commands resolve against the record's OWN repository (a fe impl's `npm run uat:typecheck` lives in
    // the frontend package.json), and a bare spec basename is a jest pattern, not a path - searched
    // repo-wide, not resolved literally.
    // this tree owns records for every bound repo (the backend's .starciwork describes the frontend too),
    // so a spec path may live in ANY bound repository - resolve candidates across all of them
    const repoRoots = [backendRoot, ...(workspaceDoc?.repositories ?? [])
      .filter(r => r?.name && r.role !== 'be')
      .map(r => repoRootFor(workRoot, r.name, workspaceDoc))];
    const recordRepoRoot = repoRootFor(workRoot, data.repository, workspaceDoc);
    const specExists = p => p.includes('/')
      ? repoRoots.some(r => fs.existsSync(path.join(r, p)))
      : repoRoots.some(r => srcFiles(r, '.ts').some(f => path.basename(f) === p));
    const checkCommand = (command, file, label) => {
      if (typeof command !== 'string') return;
      const npmRun = /npm run ([\w:-]+)/.exec(command);
      if (npmRun) {
        const scriptIn = r => {
          const pkgFile = path.join(r, 'package.json');
          if (!fs.existsSync(pkgFile)) return null;
          const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
          return pkg?.scripts?.[npmRun[1]] != null ? path.basename(r) : null;
        };
        if (!scriptIn(recordRepoRoot)) {
          const elsewhere = repoRoots.map(scriptIn).filter(Boolean);
          if (elsewhere.length) suspect(file, 'PROOF_COMMAND_AMBIGUOUS', `${label}: npm script "${npmRun[1]}" exists only in ${elsewhere.join('/')}, not the record's own repository - evidence does not record which cwd it ran in`);
          else refuse(file, 'PROOF_COMMAND_DEAD', `${label}: npm script "${npmRun[1]}" does not exist in any bound repository's package.json`);
        }
      }
      for (const token of command.match(/[\w./-]+\.(?:spec|e2e-spec|test)\.ts/g) ?? []) {
        const p = token.replace(/^--\S+\s+/, '');
        if (!specExists(p)) {
          refuse(file, 'PROOF_COMMAND_DEAD', `${label}: spec "${p}" matches no file in any bound repository`);
        }
      }
      // jest-style filter args like `-- tasks/complete` should match a real spec dir/file prefix;
      // separators vary (`tasks/complete` vs `task/task-lifecycle.e2e-spec.ts`), so normalise both to
      // word sequences before comparing - still heuristic, which is why it is SUSPECT not REFUSE
      const filter = /--\s+([\w/-]+)$/.exec(command)?.[1];
      if (filter && !filter.includes('*')) {
        const testsRoot = path.join(recordRepoRoot, 'src', 'tests');
        const words = filter.toLowerCase().split(/[\s/.\\_-]+/).filter(Boolean);
        const hit = fs.existsSync(testsRoot) && walk(testsRoot).some(f => {
          const fwords = f.toLowerCase().replaceAll('\\', '/').split(/[\s/.\\_-]+/).filter(Boolean);
          return words.every(w => fwords.includes(w));
        });
        if (!hit) suspect(indexFile, 'PROOF_FILTER_EMPTY', `${label}: filter "-- ${filter}" matches no spec under src/tests`);
      }
    };
    checkCommand(data.requiresProof?.e2e?.command, indexFile, 'requiresProof.e2e');
    const evEntry = evidenceByRecord.get(id);
    for (const a of Array.isArray(evEntry?.ev?.assertions) ? evEntry.ev.assertions : []) {
      checkCommand(a?.command, evEntry.file, `assertion ${a?.id ?? '(unnamed)'}`);
    }

    // REPO_UNBOUND: a repository field that resolves to a dir that isn't there = evidence that will false-stale
    if (data.repository) {
      const repoRoot = repoRootFor(workRoot, data.repository, workspaceDoc);
      if (!fs.existsSync(repoRoot)) {
        refuse(indexFile, 'REPO_UNBOUND', `${id} names repository "${data.repository}" which resolves to ${rel(repoRoot)} - nothing there; evidence under it will report (no files found), not the truth`);
      }
    }

    // EVENT_PRODUCER_KIND + EVENT_UNPRODUCED
    if (data.schema === 'work/event') {
      const producer = recOf(data.producer);
      if (producer?.schema === 'work/business-rule') {
        suspect(indexFile, 'EVENT_PRODUCER_IS_RULE', `${id} producer is ${data.producer}, a business-rule - rules do not emit events; the real producer (handler/impl) has no record`);
      }
      const emitted = emittedEvents ??= eventClasses(backendRoot);
      // the codebase names classes inconsistently (TaskDeletedEvent keeps the feature segment,
      // SignedInEvent drops it) - try the id's full class name and the feature-stripped one
      const withFeature = eventClassOf(id);
      const withoutFeature = eventClassOf(id.split('.').filter((s, i) => i !== 1).join('.'));
      if (!emitted.has(withFeature) && !emitted.has(withoutFeature)) {
        suspect(indexFile, 'EVENT_UNPRODUCED', `${id} maps to event class ${withFeature}/${withoutFeature}, neither declared under src/ - record may describe an event nothing emits`);
      }
    }

    // UAT_RUN_AGING: settled run older than the code it proves (mtime heuristic)
    if (data.schema === 'work/uat-flow' && data.state === 'done' && evEntry?.ev?.run) {
      const runDir = path.join(evEntry.dir, evEntry.ev.run);
      if (fs.existsSync(runDir)) {
        const runMtime = Math.max(...walk(runDir).map(f => fs.statSync(f).mtimeMs));
        const dirs = resolveOwnedDirs(id, rec, records, workspaceDoc, workRoot);
        const newer = dirs.flatMap(d => fs.existsSync(d.abs) ? walk(d.abs).filter(f => fs.statSync(f).mtimeMs > runMtime).map(f => path.relative(backendRoot, f)) : []);
        if (newer.length) suspect(indexFile, 'UAT_RUN_AGING', `${id}'s settled run predates ${newer.length} code file(s) that changed since (e.g. ${newer[0]}) - the pass may no longer describe the code`);
      }
    }
  }

  // ---- EVIDENCE_CONTEXT_MISSING: evidence with no cwd/repository stamp can't say what it ran against ----
  let unstamped = 0;
  for (const [, {ev}] of evidenceByRecord) {
    if (!ev.cwd && !ev.repository && !ev.commit) unstamped++;
  }
  if (unstamped) info(workRoot, 'EVIDENCE_CONTEXT_MISSING', `${unstamped} evidence file(s) carry no cwd/repository/commit stamp - a stale verdict cannot say which input moved`);

  // ---- PAYLOAD_AS_RECORD: asset payloads the base gate walks as records ----
  const payloads = walk(workRoot).filter(f => f.replaceAll('\\', '/').includes('/assets/') && f.endsWith('.yaml'))
    .map(f => parseYaml(fs.readFileSync(f, 'utf8'))).filter(d => d && d.schema && !String(d.schema).startsWith('work/'));
  if (payloads.length) info(workRoot, 'PAYLOAD_AS_RECORD', `${payloads.length} asset payload(s) carry non-work schemas - they are artifacts of their parent record, not records; the base gate should not walk them as such`);

  // ---- CATALOG_DRIFT ----
  const catalogFile = path.join(workRoot, 'index.yaml');
  const catalog = fs.existsSync(catalogFile) ? parseYaml(fs.readFileSync(catalogFile, 'utf8')) : null;
  const featureDirs = fs.existsSync(path.join(workRoot, 'features'))
    ? fs.readdirSync(path.join(workRoot, 'features')).filter(d => fs.statSync(path.join(workRoot, 'features', d)).isDirectory()) : [];
  const catalogDirs = (catalog?.features ?? []).map(f => String(f.directory ?? '').replace(/^features\//, ''));
  for (const d of featureDirs.filter(d => !catalogDirs.includes(d))) refuse(catalogFile, 'CATALOG_DRIFT', `features/${d} exists on disk but the catalog does not list it`);
  for (const d of catalogDirs.filter(d => !featureDirs.includes(d))) refuse(catalogFile, 'CATALOG_DRIFT', `catalog lists features/${d} but no such directory exists`);

  // ---- surface coverage (SUSPECT tier) ----
  const ownedDirs = [];
  for (const [id, rec] of records) {
    for (const d of resolveOwnedDirs(id, rec, records, workspaceDoc, workRoot)) {
      if (fs.existsSync(d.abs)) ownedDirs.push({id, abs: d.abs});
    }
  }
  const ownerOf = file => ownedDirs.find(d => file.startsWith(d.abs))?.id ?? null;

  const routes = httpRoutes(backendRoot);
  const ops = gqlOps(backendRoot);
  for (const r of routes) {
    if (!ownerOf(r.file)) suspect(r.file, 'UNCLAIMED_SURFACE', `${r.method} ${r.path} served by ${path.basename(r.file)} sits under no record's owners - a shipped surface with no claimant`);
  }
  for (const o of ops) {
    if (o.file && !ownerOf(o.file)) suspect(o.file, 'UNCLAIMED_SURFACE', `graphql ${o.kind} ${o.cap}/${o.op} sits under no record's owners`);
  }

  // CAPABILITY coverage: owning the module is necessary but not sufficient - an impl owning
  // `src/modules/bussiness/cart` does not mean any record describes what cart DOES. A capability
  // (graphql cap dir, controller prefix) is "specified" when a spec record's id carries it as a full
  // `.`-segment or its owned path carries it as a path segment - hyphenated lookalikes
  // (empty-cart-is-refused) do not count. Two levels: no spec record at all -> WITHOUT_SPEC; only
  // impl/sds claim it (designed, never specified functionally) -> WITHOUT_FR.
  const segSet = data => {
    const segs = new Set(String(data?.id ?? '').split('.'));
    const paths = (data?.owners ?? []).map(o => String(o?.path ?? '')).concat(
      (Array.isArray(data?.module) ? data.module : [data?.module]).filter(Boolean),
      (data?.composes ?? []).map(c => String(c?.module ?? '')));
    for (const p of paths) for (const s of p.split('/')) segs.add(s);
    return segs;
  };
  const claimsAny = new Set();   // fr|br|contract|sds|uat
  const claimsFunc = new Set();  // fr|br|contract only
  for (const [, rec] of records) {
    if (!/^(fr|br|contract|sds|uat)\./.test(rec.id)) continue;
    for (const s of segSet(rec.data)) claimsAny.add(s);
    if (/^(fr|br|contract)\./.test(rec.id)) for (const s of segSet(rec.data)) claimsFunc.add(s);
  }
  const capLevel = cap => claimsFunc.has(cap) ? 'fr' : claimsAny.has(cap) ? 'design' : null;
  for (const o of ops) {
    const level = capLevel(o.cap) ?? capLevel(o.op);
    if (level === null) suspect(o.file ?? workRoot, 'CAPABILITY_WITHOUT_SPEC', `graphql ${o.kind} ${o.cap}/${o.op} ships but no spec record names "${o.cap}" - capability with no record at all`);
    else if (level === 'design') suspect(o.file ?? workRoot, 'CAPABILITY_WITHOUT_FR', `graphql ${o.kind} ${o.cap}/${o.op} ships; only impl/sds records touch "${o.cap}" - designed but no fr/br/contract describes the operation`);
  }
  const routeCaps = new Set(routes.map(r => r.path.split('/').filter(Boolean)[0]).filter(Boolean));
  for (const cap of routeCaps) {
    const level = capLevel(cap);
    if (level === null) suspect(workRoot, 'CAPABILITY_WITHOUT_SPEC', `http routes under /${cap} serve but no spec record names it`);
    else if (level === 'design') suspect(workRoot, 'CAPABILITY_WITHOUT_FR', `http routes under /${cap} serve; only impl/sds records touch it`);
  }

  // GHOST_SURFACE: contract-declared http path that no controller serves
  const servedPaths = new Set(routes.map(r => `${r.method} ${r.path.replace(/\/:[^/]+/g, '/:_')}`));
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/contract') continue;
    const shapes = [];
    const surf = rec.data?.surface;
    for (const item of Array.isArray(surf?.http) ? surf.http : surf?.http ? [surf.http] : []) {
      if (item?.method && item?.path) shapes.push(`${item.method.toUpperCase()} ${item.path}`);
    }
    for (const entry of Array.isArray(surf?.shape) ? surf.shape : surf?.requests ?? []) {
      const m = /(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/.exec(String(entry?.shape ?? entry));
      if (m) shapes.push(`${m[1]} ${m[2]}`);
    }
    for (const s of shapes) {
      const [method, p] = s.split(' ');
      const norm = `${method} ${p.replace(/\/:[^/]+/g, '/:_').replace(/\/$/, '') || '/'}`;
      if (servedPaths.size && ![...servedPaths].some(sp => sp === norm)) {
        suspect(path.join(rec.dir, 'index.yaml'), 'GHOST_SURFACE', `${id} declares "${s}" but no controller under ${path.basename(backendRoot)}/src serves it - contract describes a wire that does not exist`);
      }
    }
  }
  return {records: records.size, surfaces: routes.length + ops.length};
}

// ---------- baseline ----------
function writeBaseline(workRoot) {
  const records = loadRecords(workRoot, walk);
  const inline = indexInlineCriteria(records);
  const canon = id => records.has(id) ? id : (inline.byAcId.get(id) ?? id);
  const entry = {};
  for (const [id, rec] of records) {
    const deps = {};
    for (const depId of depsOf(rec.data, canon)) {
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
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const doBaseline = args.includes('--write-baseline');
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const trees = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(f => f.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname);

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
