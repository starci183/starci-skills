// input-digests.mjs — the inputs an op was admitted with, digested at dispatch
// and compared again by `api survey` / `api status`.
//
// Two kinds of input, judged differently (owner, 2026-09-24: editing Source
// knowledge re-staled dozens of settled jobs on every ledger, and each further
// edit re-staled the redo - inc-fd7bd0b0ecff, inc-914266179f5c, inc-1ddf786954cb):
//
//   source  the runtime's own law: `knowledge/**`, `modules/schemas/**` and the
//           data-owned files in SOURCE_FILES, named by the op manifest's
//           reads[].path, context[].path, knowledge[] or the selected
//           executionModes.<mode>.reads[].path, plus any the packet's params cite.
//           A settled job is judged against the Source it was ADMITTED under
//           (scripts/kernel/contract-version.mjs). A later Source edit is
//           `sourceDrift` - advisory, never stale: work that must catch up is a
//           change registered `reach: follow-up` in
//           modules/kernel/contract-changes.yaml, which status lists as
//           contractFollowUps.
//   work    the product records the job read: the `.starciwork/**` entries of
//           its payload.records (the records its packet bound). Recorded at
//           dispatch and re-baselined at settle to the bytes the job left
//           (`settled`, with a per-file map); a later change to one of those
//           files is `staleInput` - unless the change lies in the owned paths of
//           the job itself or of another job of the same workflow that was still
//           open or settled after it (the workflow's own later legs writing what
//           they own is progress the Kernel planned, not drift).
//
// Each entry is {path, digest, kind} relative to its root (the runtime root for
// source, the product repository for work): a file is sha256 of its bytes, a
// directory or glob is sha256 over its sorted `relpath\0filesha\n` lines (a
// work directory counts only its record files, index.yaml/resource.yaml, and
// never evidence/ or assets/), and a path that resolves to nothing is `absent`.
// The record rides in contracts.context_json.inputs (INPUT_DIGEST_SCHEMA); a
// contract without it never reports stale input or drift. An entry recorded
// before `kind` existed is classified by its path.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { JOB_STATUSES } from '../../engine/ledger-db.mjs';
import { admittedContractOf } from './contract-version.mjs';

export const INPUT_DIGEST_SCHEMA = 'starci/input-digests@1';
export const ABSENT = 'absent';
export const INPUT_KINDS = ['source', 'work'];
const SOURCE_ROOTS = ['knowledge/', 'modules/schemas/'];
const SOURCE_FILES = ['modules/models/code-patterns.yaml'];
export const WORK_PREFIX = '.starciwork/';
const WORK_EXCLUDED = ['.starciwork/runtime.sqlite', '.starciwork/ledger-anchor.json'];
const WORK_EXCLUDED_ROOTS = ['.starciwork/kernel-evidence/', '.starciwork/kernel-strays/'];
const WORK_RECORD_FILES = new Set(['index.yaml', 'resource.yaml']);
const WORK_SKIP_DIRS = new Set(['evidence', 'assets']);
const WORK_FILE_MAP_MAX = 600;
const SKIP_DIRS = new Set(['node_modules', '.git']);

const special = (segment) => /[*{<]/.test(segment);
export const isSourceLaw = (rel) => typeof rel === 'string' && !rel.includes('..')
  && (SOURCE_ROOTS.some((root) => rel.startsWith(root)) || SOURCE_FILES.includes(rel));
export const isWorkInput = (rel) => typeof rel === 'string' && rel.startsWith(WORK_PREFIX) && !rel.includes('..')
  && !rel.split('/').some(special) && !WORK_EXCLUDED.includes(rel) && !WORK_EXCLUDED_ROOTS.some((root) => rel.startsWith(root));
/** The kind of one recorded entry: its own `kind`, else what its path says (entries recorded before kinds). */
export const inputKindOf = (entry) => (INPUT_KINDS.includes(entry?.kind) ? entry.kind
  : isSourceLaw(entry?.path) ? 'source' : isWorkInput(entry?.path) ? 'work' : null);
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

/** The Source-law path tokens a free-form manifest `path:` string names, in order. */
export function lawTokens(text) {
  const out = [];
  for (const word of String(text ?? '').split(/[\s+]+/)) {
    const token = word.replace(/^[("'`]+/, '').replace(/[)"'`,;:.]+$/, '').replaceAll('\\', '/').replace(/\/+$/, '');
    if (token && isSourceLaw(token) && !out.includes(token)) out.push(token);
  }
  return out;
}

const readsOf = (entries) => (Array.isArray(entries) ? entries : []).map((entry) => entry?.path ?? entry);
const stringsOf = (value) => (typeof value === 'string' ? [value]
  : Array.isArray(value) ? value.flatMap(stringsOf)
  : value && typeof value === 'object' ? Object.values(value).flatMap(stringsOf) : []);

/**
 * The Source-law inputs one dispatch binds: the manifest's declared reads
 * (top-level reads/context/knowledge, and the selected execution mode's reads
 * when a mode is given) and any Source path the params cite. A `<name>`
 * placeholder is bound from params[name] when present, else left for
 * resolution as one segment.
 */
export function opInputPaths(briefDoc, { params = {}, mode = null } = {}) {
  const texts = [
    ...readsOf(briefDoc?.reads), ...readsOf(briefDoc?.context), ...readsOf(briefDoc?.knowledge),
    ...(mode ? readsOf(briefDoc?.policy?.executionModes?.[mode]?.reads) : []),
    ...stringsOf(params ?? {}),
  ];
  const bind = (token) => token.replace(/<([A-Za-z0-9_-]+)>/g, (whole, name) => {
    const value = params?.[name];
    return typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value) ? value : whole;
  });
  const out = [];
  for (const text of texts) for (const token of lawTokens(text)) {
    const bound = bind(token);
    if (!out.includes(bound)) out.push(bound);
  }
  return out;
}

/** The product Work inputs one job binds: the `.starciwork/**` entries of its payload.records, normalized. */
export function workInputPaths(payload) {
  const out = [];
  for (const raw of Array.isArray(payload?.records) ? payload.records : []) {
    if (typeof raw !== 'string') continue;
    const rel = raw.trim().replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
    if (isWorkInput(rel) && !out.includes(rel)) out.push(rel);
  }
  return out;
}

const listFiles = (abs, skip = SKIP_DIRS) => {
  const out = [];
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!skip.has(entry.name)) visit(p); }
      else if (entry.isFile()) out.push(p);
    }
  };
  visit(abs);
  return out;
};

const globRegex = (pattern) => new RegExp(`^${pattern
  .replace(/[.+?^$()|[\]\\]/g, '\\$&')
  .replace(/<[A-Za-z0-9_-]+>/g, '[^/]+')
  .replace(/\{([^{}]*)\}/g, (whole, body) => `(?:${body.split(',').join('|')})`)
  .replace(/\*\*\//g, '\0')
  .replace(/\*+/g, '.*')
  .replaceAll('\0', '(?:.*/)?')}$`);

const fileSha = (cache, abs) => {
  if (!cache.has(abs)) {
    let digest = null;
    try { digest = sha256(fs.readFileSync(abs)); } catch { digest = null; }
    cache.set(abs, digest);
  }
  return cache.get(abs);
};
const setDigestOf = (lines) => (lines.length ? sha256(lines.map(([rel, digest]) => `${rel}\0${digest}\n`).join('')) : ABSENT);
const sortLines = (lines) => lines.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * A Source digester bound to one runtime root. Every file is hashed at most
 * once per digester and every path pattern resolved at most once, so one
 * `api status` call reads each distinct input once however many jobs cite it.
 */
export function createDigester(root) {
  const fileCache = new Map(), pathCache = new Map();
  const setDigest = (files) => setDigestOf(sortLines(files
    .map((abs) => [path.relative(root, abs).replaceAll('\\', '/'), fileSha(fileCache, abs)])
    .filter(([, digest]) => digest)));
  const resolve = (rel) => {
    const segments = rel.split('/');
    const first = segments.findIndex(special);
    if (first < 0) {
      const abs = path.join(root, rel);
      let stat = null;
      try { stat = fs.statSync(abs); } catch { return ABSENT; }
      if (stat.isFile()) return fileSha(fileCache, abs) ?? ABSENT;
      return stat.isDirectory() ? setDigest(listFiles(abs)) : ABSENT;
    }
    const base = path.join(root, ...segments.slice(0, first));
    const rx = globRegex(rel);
    return setDigest(listFiles(base).filter((abs) => rx.test(path.relative(root, abs).replaceAll('\\', '/'))));
  };
  return (rel) => {
    if (!pathCache.has(rel)) pathCache.set(rel, resolve(rel));
    return pathCache.get(rel);
  };
}

/**
 * A Work digester bound to one product repository: `.starciwork/<x>` resolves
 * under <repo>/<workDir>/<x>. A record file is its own digest; a record
 * directory is the digest of its record files (index.yaml / resource.yaml,
 * never under evidence/ or assets/). `files(rel)` is the per-file map
 * {repoRelPath: sha256} behind a digest.
 */
export function createWorkDigester(repo, { workDir = '.starciwork' } = {}) {
  const fileCache = new Map(), pathCache = new Map();
  const absOf = (rel) => path.join(repo, workDir, rel.slice(WORK_PREFIX.length));
  const relOf = (abs) => `${WORK_PREFIX}${path.relative(path.join(repo, workDir), abs).replaceAll('\\', '/')}`;
  const resolve = (rel) => {
    const abs = absOf(rel);
    let stat = null;
    try { stat = fs.statSync(abs); } catch { return { digest: ABSENT, files: {} }; }
    if (stat.isFile()) {
      const digest = fileSha(fileCache, abs);
      return digest ? { digest, files: { [rel]: digest } } : { digest: ABSENT, files: {} };
    }
    if (!stat.isDirectory()) return { digest: ABSENT, files: {} };
    const lines = sortLines(listFiles(abs, new Set([...SKIP_DIRS, ...WORK_SKIP_DIRS]))
      .filter((file) => WORK_RECORD_FILES.has(path.basename(file)))
      .map((file) => [relOf(file), fileSha(fileCache, file)])
      .filter(([, digest]) => digest));
    return { digest: setDigestOf(lines), files: Object.fromEntries(lines) };
  };
  const get = (rel) => {
    if (!pathCache.has(rel)) pathCache.set(rel, resolve(rel));
    return pathCache.get(rel);
  };
  const digest = (rel) => get(rel).digest;
  digest.files = (rel) => get(rel).files;
  return digest;
}

/**
 * The contracts.context_json.inputs record for one dispatch: the Source paths
 * digested against the runtime root, and (with `repo`) the Work records
 * digested against the product repository.
 */
export function recordInputs(root, paths, digest = createDigester(root), { repo = null, workPaths = [], workDir = '.starciwork', workDigest = null } = {}) {
  const source = paths.map((rel) => ({ path: rel, digest: digest(rel), kind: 'source' }));
  const wd = repo && workPaths.length ? (workDigest ?? createWorkDigester(repo, { workDir })) : null;
  const work = wd ? workPaths.map((rel) => ({ path: rel, digest: wd(rel), kind: 'work' })) : [];
  return { schema: INPUT_DIGEST_SCHEMA, digests: [...source, ...work] };
}

/**
 * The Work baseline a settle leaves: every work entry of `record` gains
 * settled {at, digest, files} - the bytes as the job left them. A record
 * without work entries is returned unchanged; a record directory with more than
 * WORK_FILE_MAP_MAX record files keeps its digest without a per-file map.
 */
export function baselineWorkInputs(record, repo, { workDir = '.starciwork', now = Date.now(), workDigest = createWorkDigester(repo, { workDir }) } = {}) {
  if (record?.schema !== INPUT_DIGEST_SCHEMA || !Array.isArray(record.digests)) return record;
  if (!record.digests.some((entry) => inputKindOf(entry) === 'work')) return record;
  return {
    ...record,
    digests: record.digests.map((entry) => {
      if (inputKindOf(entry) !== 'work' || !isWorkInput(entry.path)) return entry;
      const files = workDigest.files(entry.path);
      const keys = Object.keys(files);
      return { ...entry, kind: 'work', settled: { at: now, digest: workDigest(entry.path),
        ...(keys.length <= WORK_FILE_MAP_MAX ? { files: Object.fromEntries(keys.map((key) => [key, files[key].slice(0, 16)])) } : {}) } };
    }),
  };
}

const cutOf = (payloadJson) => {
  try {
    const cut = JSON.parse(payloadJson ?? 'null')?.cut;
    return cut && cut.id != null ? { id: cut.id, ordinal: cut.ordinal, total: cut.total } : null;
  } catch { return null; }
};
const parseJson = (text) => { try { return JSON.parse(text ?? 'null'); } catch { return null; } };
const ownedOf = (payload) => (Array.isArray(payload?.owned_paths) ? payload.owned_paths : Array.isArray(payload?.ownedPaths) ? payload.ownedPaths : [])
  .filter((owned) => typeof owned === 'string' && owned.trim()).map((owned) => owned.trim().replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/\/+$/, ''));
const inside = (file, owned) => file === owned || file.startsWith(`${owned}/`);
const literalPrefix = (rel) => { const segments = rel.split('/'); const first = segments.findIndex(special); return first < 0 ? rel : segments.slice(0, first).join('/'); };
/** A registered change covers a drifted Source path when one of its `paths` is that path, inside it, or contains it. */
const covers = (changePath, rel) => {
  const base = literalPrefix(rel), c = changePath.replace(/\/+$/, '');
  return c === rel || c === base || c.startsWith(`${base}/`) || rel.startsWith(`${c}/`);
};

/**
 * Settled jobs of one workflow (succeeded, or failed on a partial report),
 * newest attempt of each (op, cut id, cut ordinal) only, compared with their
 * recorded inputs. Returns {stale, sourceDrift}:
 *   stale        Work inputs changed from outside the job's workflow since it
 *                settled: [{jobId, op, attempt, cut?, heldBy?, path, kind:'work',
 *                recorded, current, changed[]}]
 *   sourceDrift  Source inputs edited since the job was admitted - advisory:
 *                [{jobId, op, attempt, cut?, path, kind:'source', recorded,
 *                current, admittedAt, changes[], followUp[], unregistered}] where
 *                changes are the registered contract changes after admission
 *                whose `paths` cover it and followUp those of them that reach
 *                this op's settled legs (`reach: follow-up`, contractFollowUps).
 * A contract with no inputs record, or unparsable JSON, contributes nothing.
 */
export function inputDrift(db, workflowId, { root, repo = null, workDir = '.starciwork', registry = null, digest = createDigester(root), workDigest = repo ? createWorkDigester(repo, { workDir }) : null } = {}) {
  const jobs = db.prepare("SELECT job_id,op_id,attempt,status,payload_json,updated_at FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND op_id IS NOT NULL").all(workflowId);
  const newest = new Map(), seams = new Map();
  const groupOf = (row) => { const cut = cutOf(row.payload_json); return `${row.op_id}\0${cut ? `${cut.id}\0${cut.ordinal}` : ''}`; };
  for (const row of jobs) {
    newest.set(groupOf(row), Math.max(newest.get(groupOf(row)) ?? 0, row.attempt));
    const cut = cutOf(row.payload_json);
    if (!cut) continue;
    const key = `${row.op_id}\0${cut.id}`, seam = seams.get(key);
    if (!seam || cut.ordinal < seam.ordinal) seams.set(key, { ordinal: cut.ordinal, open: null });
    const current = seams.get(key);
    if (cut.ordinal === current.ordinal && !JOB_STATUSES.settled.includes(row.status)) current.open = row.job_id;
  }
  // A cut is redone seam-first: while its seam ordinal (the lowest) has an
  // open job, every higher stale slice of that cut waits on it.
  const heldBy = (op, cut) => {
    const seam = cut ? seams.get(`${op}\0${cut.id}`) : null;
    return seam?.open && cut.ordinal > seam.ordinal ? seam.open : null;
  };
  // Who may write a product record without it being drift for a job settled at `at`: the job itself,
  // and every other job of this workflow still open or settled after `at` (its own later legs).
  const writers = jobs.map((row) => {
    const payload = parseJson(row.payload_json) ?? {};
    const settledAt = JOB_STATUSES.settled.includes(row.status) ? (Number.isFinite(payload.settledAt) ? payload.settledAt : row.updated_at) : null;
    return { jobId: row.job_id, owned: ownedOf(payload), settledAt };
  });
  const attributed = (file, jobId, at) => writers.some((writer) => (writer.jobId === jobId || writer.settledAt == null || writer.settledAt > at)
    && writer.owned.some((owned) => inside(file, owned)));
  const candidates = db.prepare(`SELECT j.job_id,j.workflow_id,j.op_id,j.attempt,j.payload_json,
      CASE WHEN json_valid(c.context_json) THEN json_extract(c.context_json,'$.inputs') END AS inputs
    FROM jobs j JOIN contracts c ON c.workflow_id=j.workflow_id AND c.op_id=j.op_id AND c.attempt=j.attempt
    WHERE j.workflow_id=? AND j.kind<>'kernel' AND (j.status='succeeded' OR (j.status='failed' AND EXISTS(
      SELECT 1 FROM reports r WHERE r.workflow_id=j.workflow_id AND r.op_id=j.op_id AND r.attempt=j.attempt AND r.outcome='partial')))
    ORDER BY j.op_id,j.attempt`).all(workflowId);
  const stale = [], sourceDrift = [];
  for (const row of candidates) {
    if (!row.inputs || newest.get(groupOf(row)) !== row.attempt) continue;
    const record = parseJson(row.inputs);
    if (record?.schema !== INPUT_DIGEST_SCHEMA || !Array.isArray(record.digests)) continue;
    const cut = cutOf(row.payload_json);
    let admitted;
    for (const entry of record.digests) {
      if (typeof entry?.path !== 'string' || typeof entry.digest !== 'string' || entry.path.includes('..')) continue;
      const kind = inputKindOf(entry);
      if (kind === 'source' && isSourceLaw(entry.path)) {
        const current = digest(entry.path);
        if (current === entry.digest) continue;
        admitted ??= admittedContractOf(db, row);
        const later = (registry?.changes ?? []).filter((change) => Number.isFinite(admitted.at) && change.effectiveAt > admitted.at
          && Array.isArray(change.paths) && change.paths.some((changePath) => covers(changePath, entry.path)));
        const followUp = later.filter((change) => change.reach === 'follow-up' && change.followUp?.ops?.includes(row.op_id)).map((change) => change.id);
        sourceDrift.push({ jobId: row.job_id, op: row.op_id, attempt: row.attempt, ...(cut ? { cut } : {}), path: entry.path, kind,
          recorded: entry.digest, current, admittedAt: Number.isFinite(admitted.at) ? admitted.at : null,
          changes: later.map((change) => change.id), followUp, unregistered: later.length === 0 });
      } else if (kind === 'work' && workDigest && isWorkInput(entry.path)) {
        // Judged only against the settle baseline: without it the job's own writes are indistinguishable from drift.
        const base = entry.settled;
        if (!base || typeof base.digest !== 'string') continue;
        const current = workDigest(entry.path);
        if (current === base.digest) continue;
        const now = workDigest.files(entry.path);
        const then = base.files && typeof base.files === 'object' ? base.files : null;
        const changedFiles = then
          ? [...new Set([...Object.keys(then), ...Object.keys(now)])].filter((file) => (now[file]?.slice(0, 16) ?? null) !== (then[file] ?? null)).sort()
          : [entry.path];
        const unexplained = changedFiles.filter((file) => !attributed(file, row.job_id, Number(base.at) || 0));
        if (!unexplained.length) continue;
        const held = heldBy(row.op_id, cut);
        stale.push({ jobId: row.job_id, op: row.op_id, attempt: row.attempt, ...(cut ? { cut } : {}), path: entry.path, kind,
          recorded: base.digest, current, changed: unexplained.slice(0, 10), ...(held ? { heldBy: held } : {}) });
      }
    }
  }
  const order = (a, b) => (a.op < b.op ? -1 : a.op > b.op ? 1 : 0)
    || (a.cut?.ordinal ?? 0) - (b.cut?.ordinal ?? 0) || a.attempt - b.attempt || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { stale: stale.sort(order), sourceDrift: sourceDrift.sort(order) };
}

/** The settled jobs whose Work inputs changed (inputDrift().stale); Source edits never make a job stale. */
export function staleInputs(db, workflowId, options = {}) {
  return inputDrift(db, workflowId, options).stale;
}

/** staleInputs grouped per job: [{jobId, op, attempt, cut?, heldBy?, paths[]}] in the same order. */
export function staleOperationsOf(staleInput) {
  const byJob = new Map();
  for (const item of staleInput) {
    if (!byJob.has(item.jobId)) byJob.set(item.jobId, { jobId: item.jobId, op: item.op, attempt: item.attempt, ...(item.cut ? { cut: item.cut } : {}), ...(item.heldBy ? { heldBy: item.heldBy } : {}), paths: [] });
    byJob.get(item.jobId).paths.push(item.path);
  }
  return [...byJob.values()];
}

/**
 * Source drift summarized per path for the status frontier - advisory only, never actionable:
 * {advisory:true, jobs, paths:[{path, jobs, changes[], followUp[], unregistered}]}, or null when none.
 */
export function sourceDriftSummaryOf(sourceDrift) {
  if (!sourceDrift?.length) return null;
  const byPath = new Map();
  for (const item of sourceDrift) {
    if (!byPath.has(item.path)) byPath.set(item.path, { path: item.path, jobs: new Set(), changes: new Set(), followUp: new Set(), unregistered: false });
    const entry = byPath.get(item.path);
    entry.jobs.add(item.jobId);
    for (const id of item.changes) entry.changes.add(id);
    for (const id of item.followUp) entry.followUp.add(id);
    if (item.unregistered) entry.unregistered = true;
  }
  return {
    advisory: true,
    jobs: new Set(sourceDrift.map((item) => item.jobId)).size,
    paths: [...byPath.values()].map((entry) => ({ path: entry.path, jobs: entry.jobs.size, changes: [...entry.changes], followUp: [...entry.followUp], unregistered: entry.unregistered })),
  };
}
