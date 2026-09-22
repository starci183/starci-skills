// input-digests.mjs — the runtime inputs an op treats as law, digested at
// dispatch and compared again by `api survey` / `api status`.
//
// An op's law inputs are the `knowledge/**` paths (and the few data-owned
// runtime files in LAW_FILES) its manifest names in reads[].path, context[].path,
// knowledge[] or the selected executionModes.<mode>.reads[].path, plus any the
// packet's params cite. Each is recorded relative to the runtime root as
// {path, digest}: a file is sha256 of its bytes, a directory or glob is sha256
// over its sorted `relpath\0filesha\n` lines, and a path that resolves to
// nothing is `absent`. The record rides in contracts.context_json.inputs
// (INPUT_DIGEST_SCHEMA); a contract without it never reports stale input.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { JOB_STATUSES } from '../../engine/ledger-db.mjs';

export const INPUT_DIGEST_SCHEMA = 'starci/input-digests@1';
export const ABSENT = 'absent';
const LAW_ROOTS = ['knowledge/'];
const LAW_FILES = ['modules/models/code-patterns.yaml'];
const SKIP_DIRS = new Set(['node_modules', '.git']);

const isLaw = (rel) => LAW_ROOTS.some((root) => rel.startsWith(root)) || LAW_FILES.includes(rel);
const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const special = (segment) => /[*{<]/.test(segment);

/** The law-path tokens a free-form manifest `path:` string names, in order. */
export function lawTokens(text) {
  const out = [];
  for (const word of String(text ?? '').split(/[\s+]+/)) {
    const token = word.replace(/^[("'`]+/, '').replace(/[)"'`,;:.]+$/, '').replaceAll('\\', '/').replace(/\/+$/, '');
    if (token && isLaw(token) && !token.includes('..') && !out.includes(token)) out.push(token);
  }
  return out;
}

const readsOf = (entries) => (Array.isArray(entries) ? entries : []).map((entry) => entry?.path ?? entry);
const stringsOf = (value) => (typeof value === 'string' ? [value]
  : Array.isArray(value) ? value.flatMap(stringsOf)
  : value && typeof value === 'object' ? Object.values(value).flatMap(stringsOf) : []);

/**
 * The law inputs one dispatch binds: the manifest's declared reads (top-level
 * reads/context/knowledge, and the selected execution mode's reads when a mode
 * is given) and any law path the params cite. A `<name>` placeholder is bound
 * from params[name] when present, else left for resolution as one segment.
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

const listFiles = (abs) => {
  const out = [];
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) visit(p); }
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

/**
 * A digester bound to one runtime root. Every file is hashed at most once per
 * digester and every path pattern resolved at most once, so one `api status`
 * call reads each distinct input once however many jobs cite it.
 */
export function createDigester(root) {
  const fileCache = new Map(), pathCache = new Map();
  const fileDigest = (abs) => {
    if (!fileCache.has(abs)) {
      let digest = null;
      try { digest = sha256(fs.readFileSync(abs)); } catch { digest = null; }
      fileCache.set(abs, digest);
    }
    return fileCache.get(abs);
  };
  const setDigest = (files) => {
    const lines = files
      .map((abs) => [path.relative(root, abs).replaceAll('\\', '/'), fileDigest(abs)])
      .filter(([, digest]) => digest)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return lines.length ? sha256(lines.map(([rel, digest]) => `${rel}\0${digest}\n`).join('')) : ABSENT;
  };
  const resolve = (rel) => {
    const segments = rel.split('/');
    const first = segments.findIndex(special);
    if (first < 0) {
      const abs = path.join(root, rel);
      let stat = null;
      try { stat = fs.statSync(abs); } catch { return ABSENT; }
      if (stat.isFile()) return fileDigest(abs) ?? ABSENT;
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

/** The contracts.context_json.inputs record for one dispatch. */
export function recordInputs(root, paths, digest = createDigester(root)) {
  return { schema: INPUT_DIGEST_SCHEMA, digests: paths.map((rel) => ({ path: rel, digest: digest(rel) })) };
}

const cutOf = (payloadJson) => {
  try {
    const cut = JSON.parse(payloadJson ?? 'null')?.cut;
    return cut && cut.id != null ? { id: cut.id, ordinal: cut.ordinal, total: cut.total } : null;
  } catch { return null; }
};

/**
 * Settled jobs (succeeded, or failed on a partial report) of one workflow
 * whose recorded input digests no longer match the runtime root. Only the
 * newest attempt of each (op, cut id, cut ordinal) counts — an older attempt
 * was already superseded. A contract with no inputs record, or unparsable
 * JSON, contributes nothing. Returns
 * [{jobId, op, attempt, cut?, path, recorded, current}] ordered by op, cut
 * ordinal, attempt and path.
 */
export function staleInputs(db, workflowId, { root, digest = createDigester(root) } = {}) {
  const jobs = db.prepare("SELECT job_id,op_id,attempt,status,payload_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND op_id IS NOT NULL").all(workflowId);
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
  const candidates = db.prepare(`SELECT j.job_id,j.op_id,j.attempt,j.payload_json,
      CASE WHEN json_valid(c.context_json) THEN json_extract(c.context_json,'$.inputs') END AS inputs
    FROM jobs j JOIN contracts c ON c.workflow_id=j.workflow_id AND c.op_id=j.op_id AND c.attempt=j.attempt
    WHERE j.workflow_id=? AND j.kind<>'kernel' AND (j.status='succeeded' OR (j.status='failed' AND EXISTS(
      SELECT 1 FROM reports r WHERE r.workflow_id=j.workflow_id AND r.op_id=j.op_id AND r.attempt=j.attempt AND r.outcome='partial')))
    ORDER BY j.op_id,j.attempt`).all(workflowId);
  const out = [];
  for (const row of candidates) {
    if (!row.inputs || newest.get(groupOf(row)) !== row.attempt) continue;
    let record;
    try { record = JSON.parse(row.inputs); } catch { continue; }
    if (record?.schema !== INPUT_DIGEST_SCHEMA || !Array.isArray(record.digests)) continue;
    const cut = cutOf(row.payload_json);
    for (const entry of record.digests) {
      if (typeof entry?.path !== 'string' || typeof entry.digest !== 'string' || !isLaw(entry.path) || entry.path.includes('..')) continue;
      const current = digest(entry.path);
      if (current !== entry.digest) {
        const held = heldBy(row.op_id, cut);
        out.push({ jobId: row.job_id, op: row.op_id, attempt: row.attempt, ...(cut ? { cut } : {}), path: entry.path, recorded: entry.digest, current, ...(held ? { heldBy: held } : {}) });
      }
    }
  }
  return out.sort((a, b) => (a.op < b.op ? -1 : a.op > b.op ? 1 : 0)
    || (a.cut?.ordinal ?? 0) - (b.cut?.ordinal ?? 0) || a.attempt - b.attempt || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** staleInputs grouped per job: [{jobId, op, attempt, cut?, paths[]}] in the same order. */
export function staleOperationsOf(staleInput) {
  const byJob = new Map();
  for (const item of staleInput) {
    if (!byJob.has(item.jobId)) byJob.set(item.jobId, { jobId: item.jobId, op: item.op, attempt: item.attempt, ...(item.cut ? { cut: item.cut } : {}), ...(item.heldBy ? { heldBy: item.heldBy } : {}), paths: [] });
    byJob.get(item.jobId).paths.push(item.path);
  }
  return [...byJob.values()];
}
