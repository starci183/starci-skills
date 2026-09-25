// contract-version.mjs — the contract an operation was ADMITTED under, and the contract changes
// registered since (modules/kernel/contract-changes.yaml).
//
// Owner, 2026-09-24: most blocks came from contract changes rolled onto running workflows
// mid-flight (the app shell, then the layout tree, then nav, then part review in one night). A
// running or already-settled leg is judged against ITS admitted contract; new legs use the current
// one. So:
//   - dispatch records the version it admitted the leg under in contracts.context_json.contract
//     (CONTRACT_VERSION_SCHEMA): the runtime's git HEAD, a digest over the op brief, _common, the
//     verdict contract and every schema/check the brief cites, and the admission time;
//   - a change registered in contract-changes.yaml names the checks and finding codes it ADDED and
//     when it took effect; for a leg admitted before it those checks and codes are advisory
//     suspects (api check annotates them, api settle does not count them red), never refusals;
//   - a change marked `reach: follow-up` is meant to reach in-flight work: api status lists the
//     legs admitted before it as contractFollowUps and the Kernel enqueues a follow-up leg for each
//     (api enqueue --contract-change <id> --follow-up-of <job>) instead of holding the running one;
//   - `safetyCritical: true` is the only change that applies to every leg regardless of admission;
//   - `paths` names the Source files the change edited (knowledge/**, modules/schemas/**): a settled
//     leg that read one of them before the change reports it as advisory sourceDrift naming the
//     change, never as stale input (scripts/kernel/input-digests.mjs); an edit no change names is
//     reported `unregistered` for the supervisor.
// A leg admitted before this module existed has no recorded version: its contracts row's
// created_at is its admission time, which is all the comparison needs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseYaml } from '../../engine/yaml.mjs';
import { normWork } from './work-ownership.mjs';

export const CONTRACT_VERSION_SCHEMA = 'starci/contract-version@1';
export const CONTRACT_CHANGES_SCHEMA = 'starci/contract-changes@1';
export const CONTRACT_CHANGES_FILE = 'modules/kernel/contract-changes.yaml';
export const CHANGE_REACH = ['new-legs', 'follow-up'];
const ABSENT = 'absent';
const ALWAYS_CITED = ['modules/ops/_common.yaml', 'modules/kernel/verdict-contract.yaml'];
const CITE_RX = /(?:modules\/schemas|scripts\/checks)\/[A-Za-z0-9._/-]+\.(?:ya?ml|mjs|json)/g;
const ID_RX = /^[a-z0-9][a-z0-9.-]{1,79}$/;

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const list = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const strings = (value) => list(value).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());

/** The commit the runtime root's HEAD names, read from .git without spawning git; null when unreadable. */
export function runtimeShaOf(root) {
  const isSha = (text) => /^[0-9a-f]{40}$/.test(text);
  try {
    let gitDir = path.join(root, '.git');
    if (fs.statSync(gitDir).isFile()) {
      const pointer = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(gitDir, 'utf8'))?.[1];
      if (!pointer) return null;
      gitDir = path.resolve(root, pointer.trim());
    }
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (isSha(head)) return head;
    const ref = /^ref:\s*(.+)$/.exec(head)?.[1]?.trim();
    if (!ref) return null;
    let common = gitDir;
    try { common = path.resolve(gitDir, fs.readFileSync(path.join(gitDir, 'commondir'), 'utf8').trim()); } catch { /* not a linked worktree */ }
    for (const dir of [gitDir, common]) {
      try { const value = fs.readFileSync(path.join(dir, ref), 'utf8').trim(); if (isSha(value)) return value; } catch { /* packed */ }
    }
    for (const line of fs.readFileSync(path.join(common, 'packed-refs'), 'utf8').split('\n')) {
      const [sha, name] = line.trim().split(' ');
      if (name === ref && isSha(sha)) return sha;
    }
  } catch { /* no git metadata */ }
  return null;
}

/** The runtime files an op's contract consists of: its brief, the shared documents, and what the brief cites. */
export function contractFilesOf(root, op) {
  const brief = `modules/ops/ops/${op}.yaml`;
  let text = '';
  try { text = fs.readFileSync(path.join(root, brief), 'utf8'); } catch { /* digested as absent */ }
  const cited = [...new Set(text.match(CITE_RX) ?? [])].filter((rel) => !rel.includes('..'));
  return [brief, ...ALWAYS_CITED, ...cited.sort()].filter((rel, index, all) => all.indexOf(rel) === index);
}

/** The contract version one dispatch admits a leg under (contracts.context_json.contract). */
export function contractVersionOf(root, op, { now = Date.now() } = {}) {
  const files = contractFilesOf(root, op).map((rel) => {
    let digest = ABSENT;
    try { digest = sha256(fs.readFileSync(path.join(root, rel))); } catch { /* absent */ }
    return { path: rel, digest };
  });
  const digest = sha256(files.map((file) => `${file.path}\0${file.digest}\n`).join(''));
  return { schema: CONTRACT_VERSION_SCHEMA, op, runtimeSha: runtimeShaOf(root), digest, files, admittedAt: now };
}

/** One registered change, normalized; `problems` collects why an entry is unusable. */
const normalizeChange = (raw, index, problems) => {
  const where = `changes[${index}]`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { problems.push(`${where} is not a map`); return null; }
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!ID_RX.test(id)) { problems.push(`${where}.id must be a lowercase slug`); return null; }
  const effectiveAt = Date.parse(String(raw.effectiveAt ?? ''));
  if (!Number.isFinite(effectiveAt)) { problems.push(`${id}: effectiveAt must be an ISO date-time`); return null; }
  const reach = raw.reach == null ? 'new-legs' : String(raw.reach).trim();
  if (!CHANGE_REACH.includes(reach)) { problems.push(`${id}: reach must be ${CHANGE_REACH.join('|')}`); return null; }
  const followUp = raw.followUp && typeof raw.followUp === 'object' ? raw.followUp : null;
  const ops = strings(raw.ops);
  const followUpOps = strings(followUp?.ops);
  if (reach === 'follow-up' && (!followUp || typeof followUp.op !== 'string' || !followUp.op.trim() || !(followUpOps.length || ops.length))) {
    problems.push(`${id}: reach follow-up needs followUp.op and the ops whose older legs it follows up (followUp.ops or ops)`);
    return null;
  }
  const paths = strings(raw.paths).map(normWork);
  if (paths.some((rel) => rel.includes('..') || path.isAbsolute(rel))) { problems.push(`${id}: paths are runtime-relative Source paths`); return null; }
  return {
    id, effectiveAt, effectiveAtText: String(raw.effectiveAt), commit: typeof raw.commit === 'string' ? raw.commit.trim() : null,
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '', ops, paths,
    adds: { checks: strings(raw.adds?.checks), codes: strings(raw.adds?.codes) },
    reach, safetyCritical: raw.safetyCritical === true,
    followUp: reach === 'follow-up' ? { op: followUp.op.trim(), ops: followUpOps.length ? followUpOps : ops, detail: typeof followUp.detail === 'string' ? followUp.detail.trim() : '' } : null,
  };
};

/**
 * Every registered contract change, oldest first: {schema, changes[], problems[]}. A missing file registers
 * none. STARCI_CONTRACT_CHANGES points the reader at another registry file (the spec seam).
 */
export function loadContractChanges(root, { file = process.env.STARCI_CONTRACT_CHANGES ? path.resolve(process.env.STARCI_CONTRACT_CHANGES) : path.join(root, CONTRACT_CHANGES_FILE) } = {}) {
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch (error) {
    if (error?.code === 'ENOENT') return { schema: CONTRACT_CHANGES_SCHEMA, changes: [], problems: [] };
    return { schema: CONTRACT_CHANGES_SCHEMA, changes: [], problems: [`unreadable: ${String(error?.message ?? error).slice(0, 200)}`] };
  }
  const problems = [];
  if (doc?.schema !== CONTRACT_CHANGES_SCHEMA) problems.push(`schema must be ${CONTRACT_CHANGES_SCHEMA}`);
  const changes = [];
  list(doc?.changes).forEach((raw, index) => {
    const change = normalizeChange(raw, index, problems);
    if (!change) return;
    if (changes.some((other) => other.id === change.id)) { problems.push(`${change.id}: duplicate id`); return; }
    changes.push(change);
  });
  return { schema: CONTRACT_CHANGES_SCHEMA, changes: changes.sort((a, b) => a.effectiveAt - b.effectiveAt), problems };
}

export const changeById = (registry, id) => registry?.changes?.find((change) => change.id === id) ?? null;

const parseJson = (text) => { try { return JSON.parse(text); } catch { return null; } };

/**
 * When and under what version a job was admitted: the contracts row of its attempt (its recorded
 * version, else the row's created_at). A job never dispatched has no admission yet - it will be
 * admitted under the current contract - and reads {at:null}.
 */
export function admittedContractOf(db, job) {
  const op = job.op_id ?? parseJson(job.payload_json ?? '')?.opId ?? null;
  const row = op ? db.prepare('SELECT created_at,context_json FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(job.workflow_id, op, job.attempt) : null;
  if (!row) return { at: null, source: 'not-admitted', version: null };
  const version = parseJson(row.context_json ?? '')?.contract;
  const recorded = version?.schema === CONTRACT_VERSION_SCHEMA ? version : null;
  return { at: Number.isFinite(recorded?.admittedAt) ? recorded.admittedAt : row.created_at, source: recorded ? 'recorded' : 'contract-row', version: recorded };
}

/** The registered changes a leg admitted at `admittedAt` was NOT admitted under (safety-critical ones always apply). */
export function laterChangesFor(registry, { admittedAt, op }) {
  if (!Number.isFinite(admittedAt)) return [];
  return (registry?.changes ?? []).filter((change) => change.effectiveAt > admittedAt && !change.safetyCritical
    && (!change.ops.length || change.ops.includes(op)));
}

/**
 * The recorded checks with each red check a later change ADDED marked advisory: its name is one the
 * change registered, or it names the finding `codes` that made it red and every one of them is a
 * code a later change added. Any caller-supplied `advisory` is dropped first - only the api decides.
 */
export function classifyChecks(checks, later) {
  return list(checks).map((check) => {
    if (!check || typeof check !== 'object') return check;
    const { advisory: _ignored, ...clean } = check;
    if (clean.exitCode === 0 || !later.length) return clean;
    const codes = strings(clean.codes);
    const byName = later.filter((change) => change.adds.checks.includes(clean.name));
    const allCodes = codes.length > 0 && codes.every((code) => later.some((change) => change.adds.codes.includes(code)));
    if (!byName.length && !allCodes) return clean;
    const byCode = allCodes ? later.filter((change) => codes.some((code) => change.adds.codes.includes(code))) : [];
    const ids = [...new Set([...byName, ...byCode].map((change) => change.id))];
    return { ...clean, advisory: { changes: ids, reason: byName.length
      ? `check ${clean.name} was added by ${ids.join(', ')} after this leg was admitted; a suspect for it, not a refusal`
      : `finding code(s) ${codes.join(', ')} were added by ${ids.join(', ')} after this leg was admitted; suspects for it, not refusals` } };
  });
}

/** The finding codes a leg admitted at `admittedAt` treats as suspects (check scripts' --admitted-at). */
export function advisoryCodesFor(registry, { admittedAt, op = null }) {
  const later = (registry?.changes ?? []).filter((change) => change.effectiveAt > admittedAt && !change.safetyCritical
    && (!op || !change.ops.length || change.ops.includes(op)));
  return { codes: [...new Set(later.flatMap((change) => change.adds.codes))], checks: [...new Set(later.flatMap((change) => change.adds.checks))], changes: later.map((change) => change.id) };
}

const FOLLOW_UP_SOURCE_STATUSES = ['succeeded', 'running', 'answering', 'effect_unknown'];

/**
 * The follow-up legs a workflow owes for `reach: follow-up` changes: the newest attempt of each
 * named op (per cut ordinal) that was admitted before the change and is running or succeeded,
 * with no job of this workflow yet recorded as its follow-up (payload.contractChange
 * {id, followUpOf}). [{change, jobId, op, attempt, status, followUpOp, detail, after}]
 */
export function pendingContractFollowUps(db, workflowId, registry) {
  const changes = (registry?.changes ?? []).filter((change) => change.reach === 'follow-up');
  if (!changes.length) return [];
  const jobs = db.prepare("SELECT job_id,workflow_id,op_id,attempt,status,payload_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND op_id IS NOT NULL ORDER BY created_at,job_id").all(workflowId)
    .map((row) => ({ ...row, payload: parseJson(row.payload_json ?? '') ?? {} }));
  const recorded = new Set(jobs.map((job) => job.payload.contractChange).filter((mark) => mark?.id && mark?.followUpOf).map((mark) => `${mark.id}\0${mark.followUpOf}`));
  const groupOf = (job) => `${job.op_id}\0${job.payload.cut ? `${job.payload.cut.id}\0${job.payload.cut.ordinal}` : ''}`;
  const newest = new Map();
  for (const job of jobs) if (!newest.has(groupOf(job)) || newest.get(groupOf(job)).attempt < job.attempt) newest.set(groupOf(job), job);
  const out = [];
  for (const change of changes) {
    for (const job of newest.values()) {
      if (!change.followUp.ops.includes(job.op_id) || !FOLLOW_UP_SOURCE_STATUSES.includes(job.status)) continue;
      if (job.payload.contractChange?.id === change.id) continue;
      const admitted = admittedContractOf(db, job);
      if (!Number.isFinite(admitted.at) || admitted.at >= change.effectiveAt) continue;
      if (recorded.has(`${change.id}\0${job.job_id}`)) continue;
      out.push({ change: change.id, jobId: job.job_id, op: job.op_id, attempt: job.attempt, status: job.status, followUpOp: change.followUp.op,
        detail: change.followUp.detail || change.summary, after: job.status === 'succeeded' ? null : job.job_id });
    }
  }
  return out;
}
