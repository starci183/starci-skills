// proof-integrity.mjs — what each indexed artifact proves, whether that proof still holds, and whether its
// bytes are the ones the ledger chained.
//
//   claims     every job_artifacts row gets an artifact_proofs row (engine/schema.sql) at indexing: the FR ids,
//              knowledge/ui proof cases ("ANATOMY-2 case-1"), XBase#state shapes and test specs it proves. They
//              come from the op report (its `claims`, and the specs and ids its passing checks name), the image
//              label (XBase#state@viewport), a starci/ui-proof-score@1 file (its passing cases), a uat flow the
//              job read (`proves`) and the FR records whose requiresProof command names a proven spec.
//   staleness  the same row keeps the code sha the proof was made at and the digest of every path it depends on
//              (the job's owned code paths and read records, the work-graph nodes of what it claims, the specs it
//              ran), digested with scripts/kernel/input-digests.mjs. A dependency whose digest moved makes the
//              proof `stale`; api status names the owning check op as an impact-check.
//   coverage   every FR, shape and applicable proof case of the workflow's scope with its evidence and status
//              proven | stale | missing (api coverage); an FR whose requiresProof has a required kind is a
//              must-have, and handover.review may not ask the owner while one is missing or stale (api report).
//   tamper     the artifacts-indexed event carries every indexed {path, sha256}, so the events digest chain
//              covers them; verifyProofs re-hashes each file and walks the chain (api verify-proofs).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sha256 } from '../../engine/digest.mjs';
import { hasLedgerTable, JOB_STATUSES } from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { parseJson } from '../lib/json.mjs';
import { createDigester, createWorkDigester, isWorkInput, WORK_PREFIX } from './input-digests.mjs';
import { latestVersion } from '../work/work-graph-store.mjs';
import { ARTIFACTS_INDEXED } from './job-artifacts.mjs';

export const PROOF_COVERAGE_SCHEMA = 'starci/proof-coverage@1';
/** The contract change that made a handover ask owe its must-have proof (modules/kernel/contract-changes.yaml, reach new-legs). */
export const PROOF_INTEGRITY_CHANGE = 'proof-integrity';
export const PROOF_VERIFY_SCHEMA = 'starci/proof-verify@1';
export const CLAIM_KINDS = ['frs', 'cases', 'shapes', 'specs'];
export const COVERAGE_STATUSES = ['proven', 'stale', 'missing'];
export const FR_ID = /^fr\.[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
export const SHAPE_ID = /^[A-Z][A-Za-z0-9]*Base#[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CASE_ID = /^[A-Z][A-Z0-9]*-\d+ case-\d+$/;
const CASE_IN_TEXT = /\b[A-Z][A-Z0-9]*-\d+ case-\d+\b/g;
const FR_IN_TEXT = /\bfr\.[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/g;
const SPEC_IN_TEXT = /[\w@./-]+\.(?:e2e-spec|spec|test|e2e)\.[cm]?[jt]sx?\b/g;
// Build output and tooling state never count as the code a proof depends on.
const CODE_SKIP_DIRS = new Set(['node_modules', '.git', '.starciwork', 'dist', 'build', 'out', '.next', '.turbo', 'coverage', 'storybook-static']);
const UI_DIR = /^(\.starciwork\/features\/[^/]+\/ui\/[^/]+)\//;
const CHECK_OP = /\.(?:verify|audit)$/;
const PROVEN_OUTCOMES = ['done', 'partial'];

const list = (v) => (Array.isArray(v) ? v : []);
const slashed = (p) => String(p).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
const uniq = (values) => [...new Set(values.filter((v) => typeof v === 'string' && v))].sort();
const emptyClaims = () => Object.fromEntries(CLAIM_KINDS.map((k) => [k, []]));
const mergeClaims = (...all) => Object.fromEntries(CLAIM_KINDS.map((k) => [k, uniq(all.flatMap((c) => list(c?.[k])))]));
const hasClaims = (c) => CLAIM_KINDS.some((k) => list(c?.[k]).length);
const covers = (owned, file) => { const o = slashed(owned).replace(/\/\*\*$/, ''); const f = slashed(file); return f === o || f.startsWith(`${o}/`); };

/** Why a report's `claims` [{paths?, frs?, cases?, shapes?, specs?}] is malformed: [reason]. */
export function claimsProblems(claims) {
  if (!Array.isArray(claims) || claims.length > 100) return ['claims must be an array of at most 100 {paths?, frs?, cases?, shapes?, specs?}'];
  const out = [];
  const ids = { frs: FR_ID, cases: CASE_ID, shapes: SHAPE_ID, specs: /\S/ };
  claims.forEach((c, i) => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) { out.push(`claims[${i}] must be an object`); return; }
    for (const k of Object.keys(c)) if (k !== 'paths' && !CLAIM_KINDS.includes(k)) out.push(`claims[${i}] has unknown field '${k}'`);
    if (!hasClaims(c)) out.push(`claims[${i}] names none of ${CLAIM_KINDS.join(', ')}`);
    if (c.paths !== undefined && (!Array.isArray(c.paths) || c.paths.some((p) => typeof p !== 'string' || !p.trim()))) out.push(`claims[${i}].paths must be an array of paths`);
    for (const k of CLAIM_KINDS) if (c[k] !== undefined) {
      if (!Array.isArray(c[k]) || c[k].some((v) => typeof v !== 'string' || !ids[k].test(v))) out.push(`claims[${i}].${k} must be an array of ${k === 'frs' ? 'fr.<feature>.<name> ids' : k === 'cases' ? '"RULE-N case-N" ids' : k === 'shapes' ? 'XBase#state shapes' : 'spec paths'}`);
    }
  });
  return out;
}

/** fr.<feature>.<a>[.<b>] -> .starciwork/features/<feature>/fr/<a>[/<b>] */
export const frRecordDir = (id) => { const [, feature, ...rest] = id.split('.'); return `${WORK_PREFIX}features/${feature}/fr/${rest.join('/')}`; };
const readYaml = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const recordAt = (repo, rel) => readYaml(path.join(repo, slashed(rel).replace(/\/index\.yaml$/, ''), 'index.yaml'));

/** Every FR record of the product: [{id, dir, required[], commands[]}], read once per call. */
export function frRecordsOf(repo) {
  const root = path.join(repo, '.starciwork', 'features');
  const out = [];
  let features = [];
  try { features = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return out; }
  const visit = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some((e) => e.isFile() && e.name === 'index.yaml')) {
      const doc = readYaml(path.join(dir, 'index.yaml'));
      if (typeof doc?.id === 'string' && FR_ID.test(doc.id)) {
        const demands = Object.entries(doc.requiresProof && typeof doc.requiresProof === 'object' ? doc.requiresProof : {});
        out.push({ id: doc.id, dir: slashed(path.relative(repo, dir)), required: demands.filter(([, d]) => d?.required === true).map(([k]) => k).sort(),
          commands: demands.map(([, d]) => d?.command).filter((c) => typeof c === 'string') });
      }
    }
    for (const e of entries) if (e.isDirectory() && !['evidence', 'assets'].includes(e.name)) visit(path.join(dir, e.name));
  };
  for (const f of features) visit(path.join(root, f.name, 'fr'));
  return out;
}

const specsIn = (text) => [...String(text ?? '').matchAll(SPEC_IN_TEXT)].map((m) => slashed(m[0]));
const specMatches = (command, spec) => specsIn(command).some((s) => s === spec || s.endsWith(`/${spec}`) || spec.endsWith(`/${s}`));

/**
 * The claims one job's artifacts carry: {job, byPath: Map(path -> claims)}. Report-derived claims count only on a
 * done|partial report and a check with exitCode 0; a label or a score file speaks for itself.
 */
export function claimsOfJob({ repo, job, payload = {}, envelope = null, rows = [], frRecords = null }) {
  const proven = PROVEN_OUTCOMES.includes(envelope?.outcome);
  const passing = proven ? list(envelope?.checks).filter((c) => c?.exitCode === 0) : [];
  const fromChecks = {
    specs: passing.flatMap((c) => specsIn(c.command)),
    cases: passing.flatMap((c) => [...`${c.name} ${c.evidence ?? ''}`.matchAll(CASE_IN_TEXT)].map((m) => m[0])),
    frs: passing.flatMap((c) => [...`${c.name} ${c.evidence ?? ''}`.matchAll(FR_IN_TEXT)].map((m) => m[0])),
  };
  const declared = proven ? list(envelope?.claims) : [];
  let fromRecords = emptyClaims();
  if (proven && CHECK_OP.test(job.op_id ?? '')) {
    const proves = list(payload.records).filter((r) => typeof r === 'string' && /\/uat\//.test(r))
      .flatMap((r) => list(recordAt(repo, r)?.proves)).filter((id) => typeof id === 'string' && FR_ID.test(id));
    fromRecords = { ...fromRecords, frs: proves };
  }
  const job0 = mergeClaims(fromChecks, fromRecords, ...declared.filter((c) => !list(c.paths).length));
  const withSpecFrs = (claims) => {
    if (!claims.specs.length) return claims;
    frRecords ??= frRecordsOf(repo);
    const frs = frRecords.filter((fr) => fr.commands.some((cmd) => claims.specs.some((spec) => specMatches(cmd, spec)))).map((fr) => fr.id);
    return mergeClaims(claims, { frs });
  };
  // A drawing labelled <state>[--<part>]@<viewport> under a ui record (or of the one ui record the job bound) shows
  // the shape of that record's ui.shapes whose state it names, when exactly one base has that state.
  const boundUi = uniq(list(payload.records).map((r) => UI_DIR.exec(`${slashed(r)}/`)?.[1]));
  const shapesOf = new Map();
  const uiShape = (row, label) => {
    const dir = UI_DIR.exec(row.path)?.[1] ?? (boundUi.length === 1 ? boundUi[0] : null);
    if (!dir || row.kind !== 'image') return [];
    if (!shapesOf.has(dir)) shapesOf.set(dir, list(recordAt(repo, dir)?.ui?.shapes).filter((s) => s?.base && s?.state));
    const bases = shapesOf.get(dir).filter((s) => s.state === label.split('--')[0]).map((s) => `${s.base}#${s.state}`).filter((id) => SHAPE_ID.test(id));
    return bases.length === 1 ? bases : [];
  };
  const byPath = new Map();
  for (const row of rows) {
    const label = typeof row.label === 'string' ? row.label.split('@')[0] : null;
    const own = { shapes: !label ? [] : SHAPE_ID.test(label) ? [label] : uiShape(row, label) };
    if (/\.json$/i.test(row.path) && row.kind !== 'report') {
      const doc = parseJson((() => { try { return fs.readFileSync(path.join(repo, row.path), 'utf8'); } catch { return 'null'; } })());
      if (doc?.schema === 'starci/ui-proof-score@1') own.cases = list(doc.cases).filter((c) => c?.status === 'pass').map((c) => `${c.rule} ${c.case}`);
    }
    const scoped = declared.filter((c) => list(c.paths).some((p) => covers(p, row.path) || (row.origin && covers(p, row.origin))));
    byPath.set(row.path, withSpecFrs(mergeClaims(job0, own, ...scoped)));
  }
  return { job: withSpecFrs(job0), byPath, frRecords };
}

const gitHead = (repo) => { try { return execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim() || null; } catch { return null; } };
const codeDigester = (repo) => createDigester(repo, { skip: CODE_SKIP_DIRS });

/** The paths a job's proofs depend on: {code[], work[]}, relative to the ledger repository. */
export function dependencyPathsOf({ db, job, payload = {}, claims = emptyClaims() }) {
  const owned = list(payload.owned_paths).map((p) => (typeof p === 'string' ? p : p?.path)).filter((p) => typeof p === 'string').map(slashed);
  const graph = db ? latestVersion(db, job.workflow_id)?.graph : null;
  const nodes = list(graph?.nodes).filter((n) => list(n.frs).some((id) => claims.frs.includes(id)) || list(n.shapes).some((id) => claims.shapes.includes(id)));
  const all = [...owned, ...nodes.flatMap((n) => list(n.ownedPaths)).map(slashed), ...claims.specs];
  const code = uniq(all.filter((p) => !p.startsWith(WORK_PREFIX) && !p.startsWith('.starciwork') && !p.includes('..') && !/[*{<]/.test(p)));
  const work = uniq([...list(payload.records).filter((r) => typeof r === 'string').map(slashed), ...all].filter((p) => isWorkInput(p)));
  return { code, work };
}

/**
 * The artifact_proofs rows of one indexing, written inside the caller's transaction: claims per artifact, the code
 * sha, and the digest of every dependency. A row is re-baselined only when its path is in `refresh` (the artifact's
 * bytes changed); any other row keeps the baseline it was made against, so a re-index never freshens a stale proof.
 * Returns the number of rows written.
 */
export function recordArtifactProofs(ledger, { repo, job, payload = {}, envelope = null, rows = [], refresh = null, headSha = null, now = Date.now() }) {
  const db = ledger.db;
  if (!hasLedgerTable(db, 'artifact_proofs') || !rows.length) return 0;
  const known = new Set(db.prepare('SELECT path FROM artifact_proofs WHERE workflow_id=? AND job_id=?').all(job.workflow_id, job.job_id).map((r) => r.path));
  rows = rows.filter((row) => !known.has(row.path) || refresh?.has(row.path));
  if (!rows.length) return 0;
  const { job: jobClaims, byPath } = claimsOfJob({ repo, job, payload, envelope, rows });
  const { code, work } = dependencyPathsOf({ db, job, payload, claims: mergeClaims(jobClaims, ...byPath.values()) });
  const cd = codeDigester(repo), wd = createWorkDigester(repo);
  const deps = [...code.map((p) => ({ path: p, kind: 'code', digest: cd(p) })), ...work.map((p) => ({ path: p, kind: 'work', digest: wd(p) }))];
  const codeSha = headSha ?? envelope?.head ?? gitHead(repo);
  const upsert = db.prepare(`INSERT INTO artifact_proofs(workflow_id,job_id,path,claims_json,code_sha,deps_json,created_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(workflow_id,job_id,path) DO UPDATE SET claims_json=excluded.claims_json,code_sha=excluded.code_sha,deps_json=excluded.deps_json,created_at=excluded.created_at`);
  for (const row of rows) upsert.run(job.workflow_id, job.job_id, row.path, JSON.stringify(byPath.get(row.path) ?? emptyClaims()), codeSha, JSON.stringify(deps), now);
  return rows.length;
}

/**
 * Every indexed artifact of a workflow with its claims and freshness: [{jobId, op, attempt, jobStatus, path, kind,
 * sha256, codeSha, claims, state: fresh|stale|unbaselined, changed[]}]. An artifact indexed without an artifact_proofs
 * row (before this module) is `unbaselined`: it counts as evidence but can never be judged stale.
 */
export function proofArtifactsOf(db, workflowId, { repo }) {
  if (!hasLedgerTable(db, 'job_artifacts')) return [];
  const proofs = hasLedgerTable(db, 'artifact_proofs');
  const rows = db.prepare(`SELECT a.job_id,a.op_id,a.attempt,a.path,a.kind,a.sha256,a.label,j.status AS job_status,j.updated_at AS job_at
      ${proofs ? ',p.claims_json,p.code_sha,p.deps_json' : ''}
    FROM job_artifacts a LEFT JOIN jobs j ON j.job_id=a.job_id
    ${proofs ? 'LEFT JOIN artifact_proofs p ON p.workflow_id=a.workflow_id AND p.job_id=a.job_id AND p.path=a.path' : ''}
    WHERE a.workflow_id=? ORDER BY a.created_at,a.job_id,a.path`).all(workflowId);
  const cd = codeDigester(repo), wd = createWorkDigester(repo);
  const now = new Map();
  const digestOf = (dep) => { const key = `${dep.kind}\0${dep.path}`; if (!now.has(key)) now.set(key, dep.kind === 'work' ? wd(dep.path) : cd(dep.path)); return now.get(key); };
  return rows.map((r) => {
    const claims = r.claims_json ? mergeClaims(parseJson(r.claims_json, {})) : emptyClaims();
    const deps = r.deps_json ? list(parseJson(r.deps_json, [])) : null;
    const changed = deps ? deps.filter((d) => typeof d?.path === 'string' && digestOf(d) !== d.digest).map((d) => d.path) : [];
    return { jobId: r.job_id, op: r.op_id, attempt: r.attempt, jobStatus: r.job_status ?? null, jobAt: r.job_at ?? null, path: r.path, kind: r.kind, sha256: r.sha256,
      codeSha: r.code_sha ?? null, claims, state: !deps ? 'unbaselined' : changed.length ? 'stale' : 'fresh', changed };
  });
}

const itemKey = (kind, id) => `${kind}\0${id}`;
const CLAIM_OF_ITEM = { fr: 'frs', case: 'cases', shape: 'shapes' };
/** Evidence per claimed item: Map(kind\0id -> [artifact]); only a settled-succeeded or partial job's artifacts count. */
const evidenceIndex = (artifacts) => {
  const index = new Map();
  for (const a of artifacts) {
    if (a.jobStatus && !['succeeded', 'failed'].includes(a.jobStatus)) continue;
    for (const [item, claim] of Object.entries(CLAIM_OF_ITEM)) for (const id of a.claims[claim]) {
      const key = itemKey(item, id);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(a);
    }
  }
  return index;
};
const statusOf = (evidence) => (!evidence.length ? 'missing' : evidence.some((e) => e.state !== 'stale') ? 'proven' : 'stale');

/**
 * The stale proofs api status acts on: claimed items whose every piece of evidence is stale, grouped by the newest
 * stale job that made one - [{jobId, op, attempt, items[], changed[]}]. `open` ops (a job still running or queued)
 * are left out: that job re-proves or changes them.
 */
export function staleProofsOf(db, workflowId, { repo, artifacts = proofArtifactsOf(db, workflowId, { repo }) } = {}) {
  const index = evidenceIndex(artifacts);
  const open = new Set(db.prepare(`SELECT op_id FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status IN (${[...JOB_STATUSES.dispatchable, ...JOB_STATUSES.fenced].map(() => '?').join(',')})`)
    .all(workflowId, ...JOB_STATUSES.dispatchable, ...JOB_STATUSES.fenced).map((r) => r.op_id));
  const byJob = new Map();
  for (const [key, evidence] of index) {
    if (statusOf(evidence) !== 'stale') continue;
    const newest = evidence.reduce((a, b) => ((b.jobAt ?? 0) > (a.jobAt ?? 0) ? b : a));
    if (!newest.op || open.has(newest.op)) continue;
    if (!byJob.has(newest.jobId)) byJob.set(newest.jobId, { jobId: newest.jobId, op: newest.op, attempt: newest.attempt, items: [], changed: new Set() });
    const entry = byJob.get(newest.jobId);
    const [kind, id] = key.split('\0');
    entry.items.push(`${kind} ${id}`);
    for (const p of newest.changed) entry.changed.add(p);
  }
  return [...byJob.values()].map((e) => ({ ...e, items: e.items.sort(), changed: [...e.changed].sort() }));
}

/** The workflow's scope: FR ids, XBase#state shapes and ui record dirs, from its work graph and the records its jobs bound. */
export function scopeOf(db, workflowId) {
  const graph = latestVersion(db, workflowId)?.graph ?? null;
  const records = db.prepare("SELECT payload_json FROM jobs WHERE workflow_id=? AND kind<>'kernel'").all(workflowId)
    .flatMap((r) => { const p = parseJson(r.payload_json, {}) ?? {}; return [...list(p.records), ...list(p.owned_paths).map((o) => (typeof o === 'string' ? o : o?.path))]; })
    .filter((r) => typeof r === 'string').map(slashed);
  const frDir = /^\.starciwork\/features\/([^/]+)\/fr\/([^/]+(?:\/[^/]+)*?)(?:\/index\.yaml)?$/;
  const frs = uniq([...list(graph?.nodes).flatMap((n) => list(n.frs)).filter((id) => FR_ID.test(id)),
    ...records.map((r) => frDir.exec(r)).filter((m) => m && !/\/(evidence|assets)(\/|$)/.test(m[2])).map((m) => `fr.${m[1]}.${m[2].split('/').join('.')}`)]);
  const uiDirs = uniq(records.map((r) => UI_DIR.exec(`${r}/`)?.[1]));
  return { graphVersion: graph ? latestVersion(db, workflowId).version : null, frs, shapes: uniq(list(graph?.nodes).flatMap((n) => list(n.shapes)).filter((s) => SHAPE_ID.test(s))), uiDirs };
}

/**
 * api coverage: every FR, shape and applicable proof case of the workflow's scope with its evidence and status.
 * `briefCases(record)` returns the applicable "RULE-N case-N" ids of one ui record (scripts/checks/ui-proof-brief.mjs
 * buildBrief); it is injected so a caller that cannot load the knowledge still reports FRs and shapes.
 */
export function coverageOf(db, workflowId, { repo, briefCases = null, artifacts = proofArtifactsOf(db, workflowId, { repo }) } = {}) {
  const scope = scopeOf(db, workflowId);
  const index = evidenceIndex(artifacts);
  const frRecords = new Map(frRecordsOf(repo).map((fr) => [fr.id, fr]));
  const items = [];
  const shapes = new Set(scope.shapes);
  const cases = new Map();
  const errors = [];
  for (const dir of scope.uiDirs) {
    const doc = recordAt(repo, dir);
    for (const s of list(doc?.ui?.shapes)) if (s?.base && s?.state && SHAPE_ID.test(`${s.base}#${s.state}`)) shapes.add(`${s.base}#${s.state}`);
    if (doc && briefCases) {
      try { for (const id of briefCases(doc, dir)) { if (!cases.has(id)) cases.set(id, []); cases.get(id).push(doc.id ?? dir); } }
      catch (error) { errors.push({ record: dir, error: String(error?.message ?? error).slice(0, 200) }); }
    }
  }
  const evidenceView = (a) => ({ jobId: a.jobId, op: a.op, attempt: a.attempt, path: a.path, kind: a.kind, sha256: a.sha256, codeSha: a.codeSha, state: a.state, ...(a.changed.length ? { changed: a.changed } : {}) });
  const push = (kind, id, extra) => { const evidence = index.get(itemKey(kind, id)) ?? []; items.push({ kind, id, ...extra, status: statusOf(evidence), evidence: evidence.map(evidenceView) }); };
  for (const id of scope.frs) { const fr = frRecords.get(id); push('fr', id, { must: Boolean(fr?.required.length), ...(fr ? { requires: fr.required, record: fr.dir } : { record: null }) }); }
  for (const id of [...shapes].sort()) push('shape', id, { must: false });
  for (const [id, records] of [...cases].sort(([a], [b]) => (a < b ? -1 : 1))) push('case', id, { must: false, records: uniq(records) });
  const count = (pred) => items.filter(pred).length;
  const summary = Object.fromEntries(COVERAGE_STATUSES.map((s) => [s, count((i) => i.status === s)]));
  const owed = items.filter((i) => i.must && i.status !== 'proven').map((i) => ({ kind: i.kind, id: i.id, status: i.status }));
  return { schema: PROOF_COVERAGE_SCHEMA, workflowId, graphVersion: scope.graphVersion, summary: { ...summary, total: items.length, mustOwed: owed.length }, mustOwed: owed, items, ...(errors.length ? { errors } : {}) };
}

/** One text line per coverage item, for the human form of api coverage. */
export const coverageLines = (cov) => [
  `coverage ${cov.workflowId}: ${cov.summary.proven} proven, ${cov.summary.stale} stale, ${cov.summary.missing} missing of ${cov.summary.total}${cov.summary.mustOwed ? `; ${cov.summary.mustOwed} must-have owed` : ''}`,
  ...cov.items.map((i) => `  ${i.status.padEnd(7)} ${i.kind.padEnd(5)} ${i.id}${i.must ? ' (must)' : ''}${i.evidence.length ? ` — ${i.evidence.map((e) => `${e.jobId}:${e.path}${e.state === 'stale' ? ` [stale: ${list(e.changed).slice(0, 3).join(', ')}]` : ''}`).slice(0, 3).join('; ')}${i.evidence.length > 3 ? ` (+${i.evidence.length - 3})` : ''}` : ''}`),
];

/** The chain digest of one events row, exactly as engine/triggers.sql computes it. */
export const eventDigestOf = (prev, row) => sha256(`${prev ?? ''}${row.event_id}${row.kind}${row.payload_json ?? ''}${row.created_at}`);

/**
 * api verify-proofs: re-hash every indexed file, compare it with its ledger row and with the {path, sha256} the chained
 * artifacts-indexed event recorded, and walk the workflow's events digest chain. Returns {ok, files{checked, intact,
 * tampered[{jobId, path, reason, expected, actual?}], unchained}, chain{events, ok, broken[{seq, kind, reason}]}}.
 */
export function verifyProofs(db, workflowId, { repo }) {
  const events = db.prepare('SELECT seq,event_id,kind,entity_id,payload_json,prev_digest,digest,created_at FROM events WHERE workflow_id=? ORDER BY seq').all(workflowId);
  const broken = [];
  let prev = null;
  for (const e of events) {
    if ((e.prev_digest ?? null) !== prev) broken.push({ seq: e.seq, kind: e.kind, reason: 'prev_digest does not link to the event before it' });
    if (eventDigestOf(prev, e) !== e.digest) broken.push({ seq: e.seq, kind: e.kind, reason: 'digest does not match the event row' });
    prev = e.digest;
  }
  const chained = new Map();
  for (const e of events) if (e.kind === ARTIFACTS_INDEXED) for (const a of list(parseJson(e.payload_json, {})?.artifacts)) if (a?.path && a?.sha256) chained.set(`${e.entity_id}\0${a.path}`, a.sha256);
  const rows = hasLedgerTable(db, 'job_artifacts') ? db.prepare('SELECT job_id,path,sha256 FROM job_artifacts WHERE workflow_id=? ORDER BY job_id,path').all(workflowId) : [];
  const tampered = [];
  let unchained = 0;
  for (const r of rows) {
    const recorded = chained.get(`${r.job_id}\0${r.path}`) ?? null;
    if (!recorded) unchained += 1;
    const expected = recorded ?? r.sha256;
    let actual = null;
    try { actual = sha256(fs.readFileSync(path.join(repo, r.path))); } catch { actual = null; }
    if (actual === null) tampered.push({ jobId: r.job_id, path: r.path, reason: 'missing', expected });
    else if (actual !== expected) tampered.push({ jobId: r.job_id, path: r.path, reason: 'modified', expected, actual });
    else if (recorded && r.sha256 !== recorded) tampered.push({ jobId: r.job_id, path: r.path, reason: 'ledger-row-differs-from-chain', expected: recorded, actual: r.sha256 });
  }
  return { schema: PROOF_VERIFY_SCHEMA, workflowId, ok: !tampered.length && !broken.length,
    files: { checked: rows.length, intact: rows.length - tampered.length, tampered, unchained },
    chain: { events: events.length, ok: !broken.length, broken } };
}
