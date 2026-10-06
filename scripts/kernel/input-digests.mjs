// input-digests.mjs — the inputs an op was admitted with, digested at dispatch
// and compared again by `starci kernel survey` / `starci kernel status`.
//
// Two kinds of input, judged differently (owner, 2026-09-24: editing Source
// knowledge re-staled dozens of settled jobs on every ledger, and each further
// edit re-staled the redo - inc-fd7bd0b0ecff, inc-914266179f5c, inc-1ddf786954cb):
//
//   source  the runtime's own law: `knowledge/**`, `modules/schemas/**` and the
//           data-owned files in SOURCE_FILES, named by the op manifest's
//           reads[].path, context[].path, knowledge[] or the selected
//           executionModes.<mode>.reads[].path, plus any the packet's params cite.
//           `sourceDrift` preserves actual recorded/current Source bytes; it never creates current READ/CHECK or historical follow-up work.
//   work    the product records the job read: the `.starciwork/**` entries of
//           its payload.records (the records its packet bound). Recorded at
//           dispatch and re-baselined at settle to the bytes the job left
//           (`settled`, with a per-file map and the change-note rev of each file:
//           the REVISION it read). A change in the owned paths of the job itself or
//           of another job of the same workflow still open or settled after it is
//           progress the Kernel planned, never drift. Otherwise only a COMMITTED
//           revision counts (an in-flight rewrite never does), judged by the
//           record's ONE owner workflow (work-ownership.mjs, owner 2026-09-25 -
//           peers re-staling each other's shared
//           records in a redo ping-pong): a peer's change is advisory `peerDrift`
//           unless the OWNER marked it breaking (its change note or `api
//           record-change --reach follow-up`), which owes ONE follow-up leg
//           (`staleInput` followUp); an unattributed edit of a record the job's own
//           workflow owns stays `staleInput` as before.
//
// Each entry is {path, digest, kind} relative to its root (the runtime root for
// source, the product repository for work): a file is sha256 of its bytes, a
// directory or glob is sha256 over its sorted `relpath\0filesha\n` lines (a
// work directory counts only its record files, index.yaml/resource.yaml, and
// never evidence/ or assets/), and a path that resolves to nothing is `absent`.
// The record rides in contracts.context_json.inputs (INPUT_DIGEST_SCHEMA); a
// contract without it never reports stale input or drift. An entry recorded before `kind` existed is classified by its path.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { INPUT_DIGEST_SCHEMA, WORK_PREFIX, inputDrift as inputDriftOf, inputKindOf, isSourceLaw, isWorkInput, special } from './input-drift.mjs';
import { changeNoteOf } from './work-ownership.mjs';
export { INPUT_DIGEST_SCHEMA, WORK_PREFIX, inputKindOf, isWorkInput };
import { normWork } from '../lib/path-key.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { opReadTexts, bindOpPath } from '../lib/op-shared.mjs';
import { underWorktrees } from '../lib/worktree-exclude.mjs';

export const ABSENT = 'absent';
const WORK_RECORD_FILES = new Set(['index.yaml', 'resource.yaml']);
const WORK_SKIP_DIRS = new Set(['evidence', 'assets']);
const WORK_FILE_MAP_MAX = 600;
const SKIP_DIRS = new Set(['node_modules', '.git']);

/** The Source-law path tokens a free-form manifest `path:` string names, in order. */
export function lawTokens(text) {
  const out = [];
  for (const word of String(text ?? '').split(/[\s+]+/)) {
    const token = word.replace(/^[("'`]+/, '').replace(/[)"'`,;:.]+$/, '').replaceAll('\\', '/').replace(/\/+$/, '');
    if (token && isSourceLaw(token) && !out.includes(token)) out.push(token);
  }
  return out;
}

/**
 * The Source-law inputs one dispatch binds: the manifest's declared reads
 * (top-level reads/context/knowledge, and the executionModes.<mode>.reads of
 * the mode params.mode selects) and any Source path the params cite. A `<name>`
 * placeholder is bound from params[name] when present, else left for
 * resolution as one segment.
 */
export function opInputPaths(briefDoc, { params = {}, mode = typeof params?.mode === 'string' ? params.mode : null } = {}) {
  const texts = opReadTexts(briefDoc, { params, mode });
  const out = [];
  for (const text of texts) for (const token of lawTokens(text)) {
    const bound = bindOpPath(token, params);
    if (!out.includes(bound)) out.push(bound);
  }
  return out;
}

/** The product Work inputs one job binds: the `.starciwork/**` entries of its payload.records, normalized. */
export function workInputPaths(payload) {
  const out = [];
  for (const raw of Array.isArray(payload?.records) ? payload.records : []) {
    if (typeof raw !== 'string') continue;
    const rel = normWork(raw);
    if (isWorkInput(rel) && !out.includes(rel)) out.push(rel);
  }
  return out;
}

const listFiles = (abs, skip = SKIP_DIRS, strict = false) => {
  const out = [];
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (error) { if (strict) throw error; return; }
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!skip.has(entry.name) && !underWorktrees(abs, p)) visit(p); }
      else if (entry.isFile()) out.push(p);
    }
  };
  if (fs.existsSync(abs)) visit(abs);
  return out;
};

const globRegex = (pattern) => new RegExp(`^${pattern
  .replace(/[.+?^$()|[\]\\]/g, String.raw`\$&`)
  .replace(/<[A-Za-z0-9_-]+>/g, '[^/]+')
  .replace(/\{([^{}]*)\}/g, (whole, body) => `(?:${body.replaceAll(',', '|')})`)
  .replaceAll(/\*\*\//g, '\0')
  .replace(/\*+/g, '.*')
  .replaceAll('\0', '(?:.*/)?')}$`);

const fileSha = (cache, abs, strict = false) => {
  if (!cache.has(abs)) {
    let digest = null;
    try { digest = sha256(fs.readFileSync(abs)); } catch (error) { if (strict) throw error; digest = null; }
    cache.set(abs, digest);
  }
  return cache.get(abs);
};
const setDigestOf = (lines) => (lines.length ? sha256(lines.map(([rel, digest]) => `${rel}\0${digest}\n`).join('')) : ABSENT);
const sortLines = (lines) => lines.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * A Source digester bound to one runtime root. Every file is hashed at most
 * once per digester and every path pattern resolved at most once, so one
 * `starci kernel status` call reads each distinct input once however many jobs cite it.
 * `skip` names the directories a walk never enters.
 */
export function createDigester(root, { skip = SKIP_DIRS, strict = false } = {}) {
  const fileCache = new Map(), pathCache = new Map();
  const setDigest = (files) => setDigestOf(sortLines(files
    .map((abs) => [path.relative(root, abs).replaceAll('\\', '/'), fileSha(fileCache, abs, strict)])
    .filter(([, digest]) => digest)));
  const resolve = (rel) => {
    const segments = rel.split('/');
    const first = segments.findIndex(special);
    if (first < 0) {
      const abs = path.join(root, rel);
      let stat = null;
      try { stat = fs.statSync(abs); } catch (error) { if (strict && !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; return ABSENT; }
      if (stat.isFile()) return fileSha(fileCache, abs, strict) ?? ABSENT;
      return stat.isDirectory() ? setDigest(listFiles(abs, skip, strict)) : ABSENT;
    }
    const base = path.join(root, ...segments.slice(0, first));
    const rx = globRegex(rel);
    return setDigest(listFiles(base, skip, strict).filter((abs) => rx.test(path.relative(root, abs).replaceAll('\\', '/'))));
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
export function createWorkDigester(repo, { workDir = '.starciwork', strict = false } = {}) {
  const fileCache = new Map(), pathCache = new Map();
  const absOf = (rel) => path.join(repo, workDir, rel.slice(WORK_PREFIX.length));
  const relOf = (abs) => `${WORK_PREFIX}${path.relative(path.join(repo, workDir), abs).replaceAll('\\', '/')}`;
  const resolve = (rel) => {
    const abs = absOf(rel);
    let stat = null;
    try { stat = fs.statSync(abs); } catch (error) { if (strict && !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; return { digest: ABSENT, files: {} }; }
    if (stat.isFile()) {
      const digest = fileSha(fileCache, abs, strict);
      return digest ? { digest, files: { [rel]: digest } } : { digest: ABSENT, files: {} };
    }
    if (!stat.isDirectory()) return { digest: ABSENT, files: {} };
    const lines = sortLines(listFiles(abs, new Set([...SKIP_DIRS, ...WORK_SKIP_DIRS]), strict)
      .filter((file) => WORK_RECORD_FILES.has(path.basename(file)))
      .map((file) => [relOf(file), fileSha(fileCache, file, strict)])
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
export function recordInputs(root, paths, digest = null, { repo = null, workPaths = [], workDir = '.starciwork', workDigest = null, strict = false } = {}) {
  digest ??= createDigester(root, { strict });
  const source = paths.map((rel) => ({ path: rel, digest: digest(rel), kind: 'source' }));
  const wd = repo && workPaths.length ? (workDigest ?? createWorkDigester(repo, { workDir, strict })) : null;
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
      // The revision each record file carried as the job read it (its change note's rev): an owner's
      // breaking change counts for this job only when its rev is above it (work-ownership.mjs).
      const revs = keys.length <= WORK_FILE_MAP_MAX ? Object.fromEntries(keys.map((key) => {
        try { return [key, changeNoteOf(fs.readFileSync(path.join(repo, workDir, key.slice(WORK_PREFIX.length)), 'utf8'))?.rev ?? null]; } catch { return [key, null]; }
      }).filter(([, rev]) => rev != null)) : {};
      return { ...entry, kind: 'work', settled: { at: now, digest: workDigest(entry.path),
        ...(keys.length <= WORK_FILE_MAP_MAX ? { files: Object.fromEntries(keys.map((key) => [key, files[key].slice(0, 16)])) } : {}),
        ...(Object.keys(revs).length ? { revs } : {}) } };
    }),
  };
}

export function inputDrift(db, workflowId, options = {}) {
  const { root, repo = null, workDir = '.starciwork' } = options;
  const digest = options.digest === undefined ? createDigester(root) : options.digest;
  const workDigest = options.workDigest === undefined ? (repo ? createWorkDigester(repo, { workDir }) : null) : options.workDigest;
  return inputDriftOf(db, workflowId, { root, repo, workDir, digest, workDigest,
    ownership: options.ownership ?? null, committed: options.committed, recordChanges: options.recordChanges ?? null });
}

/** The settled jobs whose Work inputs changed (inputDrift().stale); Source edits never make a job stale. */
export function staleInputs(db, workflowId, options = {}) {
  return inputDrift(db, workflowId, options).stale;
}

/**
 * staleInputs grouped per job: [{jobId, op, attempt, cut?, heldBy?, followUp?, breakingBy?[], paths[]}]
 * in the same order. followUp: every stale input of the job is an owner-declared breaking change, so
 * the job owes ONE targeted follow-up leg (never a seam-first redo); breakingBy names those owners.
 */
export function staleOperationsOf(staleInput) {
  const byJob = new Map();
  for (const item of staleInput) {
    if (!byJob.has(item.jobId)) byJob.set(item.jobId, { jobId: item.jobId, op: item.op, attempt: item.attempt, ...(item.cut ? { cut: item.cut } : {}), ...(item.heldBy ? { heldBy: item.heldBy } : {}), followUp: true, breakingBy: new Set(), paths: [] });
    const op = byJob.get(item.jobId);
    op.paths.push(item.path);
    if (!item.followUp) op.followUp = false;
    for (const b of item.breaking ?? []) op.breakingBy.add(b.owner);
  }
  return [...byJob.values()].map(({ followUp, breakingBy, ...op }) => ({ ...op, ...(followUp ? { followUp: true } : {}), ...(breakingBy.size ? { breakingBy: [...breakingBy].toSorted(byCodeUnit) } : {}) }));
}

/**
 * Peer drift summarized per record file for the status frontier - advisory only, never actionable:
 * {advisory:true, jobs, records:[{file, owner, ownerBy, writers[], jobs, foreignWrite, breakingIgnored?}]}, or null when none.
 */
export function peerDriftSummaryOf(peerDrift) {
  if (!peerDrift?.length) return null;
  const byFile = new Map();
  for (const item of peerDrift) for (const f of item.files ?? []) {
    if (!byFile.has(f.file)) byFile.set(f.file, { file: f.file, owner: f.owner, ownerBy: f.ownerBy, writers: new Set(), jobs: new Set(), foreignWrite: false, breakingIgnored: null });
    const entry = byFile.get(f.file);
    entry.jobs.add(item.jobId);
    for (const w of f.writers ?? []) entry.writers.add(w);
    if (f.foreignWrite) entry.foreignWrite = true;
    if (f.breakingIgnored) entry.breakingIgnored = f.breakingIgnored;
  }
  return {
    advisory: true,
    jobs: new Set(peerDrift.map((item) => item.jobId)).size,
    records: [...byFile.values()].toSorted((a, b) => (a.file < b.file ? -1 : 1)).map((entry) => ({ file: entry.file, owner: entry.owner, ownerBy: entry.ownerBy, writers: [...entry.writers].toSorted(byCodeUnit), jobs: entry.jobs.size,
      foreignWrite: entry.foreignWrite, ...(entry.breakingIgnored ? { breakingIgnored: entry.breakingIgnored } : {}) })),
  };
}

/**
 * Source drift summarized per path for the status frontier - advisory only, never actionable:
 * {advisory:true, jobs, paths:[{path, jobs}]}, or null when none.
 */
export function sourceDriftSummaryOf(sourceDrift) {
  if (!sourceDrift?.length) return null;
  const byPath = new Map();
  for (const item of sourceDrift) {
    if (!byPath.has(item.path)) byPath.set(item.path, { path: item.path, jobs: new Set() });
    const entry = byPath.get(item.path);
    entry.jobs.add(item.jobId);
  }
  return {
    advisory: true,
    jobs: new Set(sourceDrift.map((item) => item.jobId)).size,
    paths: [...byPath.values()].map((entry) => ({ path: entry.path, jobs: entry.jobs.size })),
  };
}
