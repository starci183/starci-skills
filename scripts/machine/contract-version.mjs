// contract-version.mjs — the contract an operation was ADMITTED under, and the contract changes
// registered since (modules/kernel/contract-changes/).
//
// Owner, 2026-09-24: most blocks came from contract changes rolled onto running workflows
// mid-flight (the app shell, then the layout tree, then nav, then part review in one night). A
// running or already-settled leg is judged against ITS admitted contract; new legs use the current
// one. So:
//   - dispatch records the version it admitted the leg under in contracts.context_json.contract
//     (CONTRACT_VERSION_SCHEMA): the runtime's git HEAD, a digest over the op brief, _common, the
//     verdict contract and every schema/check the brief cites, and the admission time;
//   - a change registered as an entry file under modules/kernel/contract-changes/ names the checks and finding codes it ADDED and
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
//
// Owner, 2026-09-28 ("Đóng băng luật vẽ"): the draw rules changed eight times in one day and every
// change made running draw legs owe another redo (attempts 9-11 per node). So an op FAMILY can be
// frozen (modules/kernel/contract-freeze.yaml): a change that governs a frozen family carries a
// `batch` (explicit, or the family's default for a change landing at/after its `since`), and for a
// workflow created before the change it takes effect only at a RELEASE - one `contract-release`
// event (api contract-release --family <op>) naming the changes it releases. Until then:
//   - a new leg of that workflow is admitted under the frozen set: dispatch records the unreleased
//     changes as contract.withheld, and the leg is judged as if admitted before them (their checks
//     and codes advisory, their settle gates off) - for life, like any admission;
//   - the change owes no follow-up there. After the release a leg that does not carry it owes ONE
//     follow-up covering every released change (never one per change); a queued or running redo of
//     the leg owes nothing more; a redo admitted after the release carries all of them.
// New workflows (created after the change) get the latest rules at once.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { CONTRACT_CHANGES_SCHEMA, readContractChangesDoc } from './contract-changes-store.mjs';
import {sha256} from '../../engine/digest.mjs';
import { normWork } from '../lib/path-key.mjs';
import { parseJson, withPayload } from '../lib/json.mjs';

export const CONTRACT_VERSION_SCHEMA = 'starci/contract-version@1';
export const CHANGE_REACH = ['new-legs', 'follow-up'];
export const CONTRACT_FREEZE_SCHEMA = 'starci/contract-freeze@1';
export const CONTRACT_FREEZE_FILE = 'modules/kernel/contract-freeze.yaml';
export const CONTRACT_RELEASE_EVENT = 'contract-release';
const ABSENT = 'absent';
const ALWAYS_CITED = ['modules/ops/_common.yaml', 'modules/kernel/verdict-contract.yaml'];
const CITE_RX = /(?:modules\/schemas|scripts\/checks)\/[A-Za-z0-9._/-]+\.(?:ya?ml|mjs|json)/g;
const ID_RX = /^[a-z0-9][a-z0-9.-]{1,79}$/;

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
const normalizeChange = (raw, index, problems, knownOps) => {
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
  // An op name the manifests do not declare is a typo the registry must not
  // carry: the change would scope to nothing, or a follow-up would never fire.
  const named = [...ops, ...(reach === 'follow-up' ? [followUp.op.trim(), ...followUpOps] : [])];
  const unknown = [...new Set(named.filter((op) => !knownOps.has(op)))];
  if (unknown.length) { problems.push(`${id}: ${unknown.join(', ')} is not an op (modules/ops/ops/<id>.yaml)`); return null; }
  const paths = strings(raw.paths).map(normWork);
  if (paths.some((rel) => rel.includes('..') || path.isAbsolute(rel))) { problems.push(`${id}: paths are runtime-relative Source paths`); return null; }
  const batch = raw.batch == null ? null : String(raw.batch).trim();
  if (batch !== null && !ID_RX.test(batch)) { problems.push(`${id}: batch must be a lowercase slug`); return null; }
  if (batch && raw.safetyCritical === true) { problems.push(`${id}: a safetyCritical change applies at once and is never batched`); return null; }
  return {
    batch, families: [...new Set([...ops, ...(reach === 'follow-up' ? [followUp.op.trim(), ...followUpOps] : [])])],
    id, effectiveAt, effectiveAtText: String(raw.effectiveAt), commit: typeof raw.commit === 'string' ? raw.commit.trim() : null,
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '', ops, paths,
    adds: { checks: strings(raw.adds?.checks), codes: strings(raw.adds?.codes) },
    reach, safetyCritical: raw.safetyCritical === true,
    followUp: reach === 'follow-up' ? { op: followUp.op.trim(), ops: followUpOps.length ? followUpOps : ops, detail: typeof followUp.detail === 'string' ? followUp.detail.trim() : '' } : null,
  };
};

/**
 * The ops a change may name: the per-op manifests under modules/ops/ops/ are the
 * ops registry (modules/ops/registry.yaml is generated from them). An unreadable
 * directory means no name resolves, so an ops-scoped change fails closed.
 */
const knownOpsOf = (root) => {
  try {
    return new Set(fs.readdirSync(path.join(root, 'modules', 'ops', 'ops'))
      .filter((file) => file.endsWith('.yaml')).map((file) => file.slice(0, -'.yaml'.length)));
  } catch { return new Set(); }
};

/**
 * Every registered contract change, oldest first: {schema, changes[], problems[]}. The registry is one file per
 * entry under modules/kernel/contract-changes/ (scripts/machine/contract-changes-store.mjs). A missing registry registers none. `file` (or
 * STARCI_CONTRACT_CHANGES, the spec seam) reads one fixture document `{schema, changes: [...]}` instead.
 */
export function loadContractChanges(root, { file = process.env.STARCI_CONTRACT_CHANGES ? path.resolve(process.env.STARCI_CONTRACT_CHANGES) : null, freezeFile = defaultFreezeFile(root) } = {}) {
  let doc = null;
  const problems = [];
  if (file) {
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch (error) {
      if (error?.code === 'ENOENT') return { schema: CONTRACT_CHANGES_SCHEMA, changes: [], problems: [] };
      return { schema: CONTRACT_CHANGES_SCHEMA, changes: [], problems: [`unreadable: ${String(error?.message ?? error).slice(0, 200)}`] };
    }
    if (doc?.schema !== CONTRACT_CHANGES_SCHEMA) problems.push(`schema must be ${CONTRACT_CHANGES_SCHEMA}`);
  } else {
    const read = readContractChangesDoc(root);
    doc = read.doc;
    problems.push(...read.problems);
  }
  const knownOps = knownOpsOf(root);
  const changes = [];
  list(doc?.changes).forEach((raw, index) => {
    const change = normalizeChange(raw, index, problems, knownOps);
    if (!change) return;
    if (changes.some((other) => other.id === change.id)) { problems.push(`${change.id}: duplicate id`); return; }
    changes.push(change);
  });
  // The frozen families: a change governing one, landing at/after its `since`, is batched by default.
  const freeze = loadContractFreeze(root, { file: freezeFile, knownOps });
  problems.push(...freeze.problems);
  for (const change of changes) {
    if (change.batch || change.safetyCritical) continue;
    const family = freeze.families.find((f) => change.families.includes(f.family) && change.effectiveAt >= f.since);
    if (family) change.batch = family.batch;
  }
  return { schema: CONTRACT_CHANGES_SCHEMA, changes: changes.sort((a, b) => a.effectiveAt - b.effectiveAt), problems, freeze: freeze.families };
}

/**
 * The frozen op families (modules/kernel/contract-freeze.yaml): {families:[{family, since, batch, gatePaths[],
 * gates[{module, export}]}], problems[]}. Missing file: nothing frozen. With STARCI_CONTRACT_CHANGES set (a spec's
 * own registry) only STARCI_CONTRACT_FREEZE names one, so an isolated registry is never frozen by the live file.
 */
export function loadContractFreeze(root, { file = defaultFreezeFile(root), knownOps = knownOpsOf(root) } = {}) {
  if (!file) return { families: [], problems: [] };
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch (error) {
    if (error?.code === 'ENOENT') return { families: [], problems: [] };
    return { families: [], problems: [`contract-freeze unreadable: ${String(error?.message ?? error).slice(0, 200)}`] };
  }
  const problems = [];
  if (doc?.schema !== CONTRACT_FREEZE_SCHEMA) problems.push(`contract-freeze schema must be ${CONTRACT_FREEZE_SCHEMA}`);
  const families = [];
  list(doc?.families).forEach((raw, index) => {
    const family = typeof raw?.family === 'string' ? raw.family.trim() : '';
    if (!knownOps.has(family)) { problems.push(`contract-freeze families[${index}].family ${family || '(missing)'} is not an op`); return; }
    const since = Date.parse(String(raw.since ?? ''));
    if (!Number.isFinite(since)) { problems.push(`contract-freeze ${family}: since must be an ISO date-time`); return; }
    const batch = raw.batch == null ? family : String(raw.batch).trim();
    if (!ID_RX.test(batch)) { problems.push(`contract-freeze ${family}: batch must be a lowercase slug`); return; }
    const gates = list(raw.gates).filter((g) => g && typeof g.module === 'string' && typeof g.export === 'string')
      .map((g) => ({ module: normWork(g.module.trim()), export: g.export.trim() }));
    families.push({ family, since, batch, gatePaths: strings(raw.gatePaths).map(normWork), gates });
  });
  return { families, problems };
}
const defaultFreezeFile = (root) => (process.env.STARCI_CONTRACT_FREEZE ? path.resolve(process.env.STARCI_CONTRACT_FREEZE)
  : process.env.STARCI_CONTRACT_CHANGES ? null : path.join(root, CONTRACT_FREEZE_FILE));

/** The contracts row of a job's newest attempt, or null. */
export const latestContractOf = (db, jobId) => db.prepare('SELECT c.*, a.dispatch_id FROM contracts c JOIN op_attempts a ON a.attempt_id=c.attempt_id WHERE a.job_id=? ORDER BY a.attempt_id DESC LIMIT 1').get(jobId) ?? null;

export const changeById = (registry, id) => registry?.changes?.find((change) => change.id === id) ?? null;

/**
 * When and under what version a job was admitted: the contracts row of its newest attempt (its recorded
 * version, else the row's created_at). A job never dispatched has no admission yet - it will be
 * admitted under the current contract - and reads {at:null}.
 */
export function admittedContractOf(db, job) {
  // `job` is a jobs row (its newest attempt's contract), or names one dispatch by attempt_id (contracts are keyed by it).
  const row = job?.attempt_id != null ? db.prepare('SELECT * FROM contracts WHERE attempt_id=?').get(job.attempt_id) ?? null
    : job?.job_id ? latestContractOf(db, job.job_id) : null;
  if (!row) return { at: null, source: 'not-admitted', version: null };
  const version = parseJson(row.context_json ?? '')?.contract;
  const recorded = version?.schema === CONTRACT_VERSION_SCHEMA ? version : null;
  return { at: Number.isFinite(recorded?.admittedAt) ? recorded.admittedAt : row.created_at, source: recorded ? 'recorded' : 'contract-row', version: recorded,
    withheld: strings(recorded?.withheld) };
}

/** True when a leg of `admission` ({at, withheld?}) was admitted under `change`: after it took effect and not withheld from it. */
export const carriesChange = (admission, change) => Number.isFinite(admission?.at) && admission.at >= change.effectiveAt
  && !strings(admission?.withheld).includes(change.id);

/**
 * True when a leg of `admission` settles on its old contract for `change`: a known admission before the change, or one
 * that withheld it (a frozen batch not yet released for its workflow). A safety-critical change applies to every leg.
 */
export const admittedBeforeChange = (admission, change) => Boolean(change && !change.safetyCritical && Number.isFinite(admission?.at)
  && (admission.at < change.effectiveAt || strings(admission?.withheld).includes(change.id)));

/** The ids of every change a `contract-release` event of this workflow released (api contract-release). */
export function releasedChangesOf(db, workflowId) {
  const out = new Map();
  let rows = [];
  try { rows = db.prepare('SELECT payload_json,created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, CONTRACT_RELEASE_EVENT); } catch { rows = []; }
  for (const row of rows) for (const id of strings(parseJson(row.payload_json ?? '')?.changes)) if (!out.has(id)) out.set(id, row.created_at);
  return out;
}

const workflowCreatedAt = (db, workflowId) => {
  try { return db.prepare('SELECT created_at FROM workflows WHERE workflow_id=?').get(workflowId)?.created_at ?? null; } catch { return null; }
};

/**
 * The batched changes still FROZEN for a workflow: landed (effectiveAt <= now), batched, the workflow created before
 * they landed, and no contract-release of the workflow names them. `op` limits it to the changes governing that op
 * (their ops or follow-up ops); `family` to the changes of that frozen family. Oldest first.
 */
export function frozenChangesFor(db, registry, { workflowId, op = null, family = null, now = Date.now(), released = releasedChangesOf(db, workflowId) }) {
  const created = workflowCreatedAt(db, workflowId);
  if (!Number.isFinite(created)) return [];
  return (registry?.changes ?? []).filter((change) => change.batch && !change.safetyCritical && change.effectiveAt <= now
    && created < change.effectiveAt && !released.has(change.id)
    && (!op || change.ops.includes(op) || Boolean(change.followUp?.ops.includes(op)))
    && (!family || change.families.includes(family)));
}

/** The change ids a leg of `op` dispatched now in `workflowId` is admitted WITHOUT (contract.withheld). */
export const withheldChangesFor = (db, registry, { workflowId, op, now = Date.now() }) => frozenChangesFor(db, registry, { workflowId, op, now }).map((change) => change.id);

/** The registered changes a leg admitted at `admittedAt` was NOT admitted under (safety-critical ones always apply). */
export function laterChangesFor(registry, { admittedAt, op, withheld = [] }) {
  if (!Number.isFinite(admittedAt)) return [];
  const held = new Set(strings(withheld));
  return (registry?.changes ?? []).filter((change) => (change.effectiveAt > admittedAt || held.has(change.id)) && !change.safetyCritical
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
export function advisoryCodesFor(registry, { admittedAt, op = null, withheld = [] }) {
  const held = new Set(strings(withheld));
  const later = (registry?.changes ?? []).filter((change) => (change.effectiveAt > admittedAt || held.has(change.id)) && !change.safetyCritical
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
  return contractFollowUpsOf(db, workflowId, registry).owed;
}

/**
 * {owed, unadmitted}: `owed` as pendingContractFollowUps; `unadmitted` the legs a follow-up change names that carry
 * no admitted contract (no contracts row, a leg from before the ledger recorded one), so no follow-up can be proved
 * for them - {change, jobId, op, attempt, status}.
 */
export function contractFollowUpsOf(db, workflowId, registry, { released = releasedChangesOf(db, workflowId) } = {}) {
  // A batched change reaches a workflow created before it only once released there (contract-freeze.yaml): until then
  // it owes nothing, and after it the leg owes one follow-up for the whole released set (the dedupe below).
  const created = workflowCreatedAt(db, workflowId);
  const inForce = (change) => !change.batch || !Number.isFinite(created) || created >= change.effectiveAt || released.has(change.id);
  const changes = (registry?.changes ?? []).filter((change) => change.reach === 'follow-up' && inForce(change));
  if (!changes.length) return { owed: [], unadmitted: [] };
  const jobs = db.prepare("SELECT job_id,workflow_id,op_id,try_no AS attempt,status,payload_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND op_id IS NOT NULL ORDER BY created_at,job_id").all(workflowId)
    .map((row) => withPayload(row));
  // The redo legs already filed for each source leg (payload.contractChange.followUpOf), cancelled ones aside: a
  // dropped redo did no work. One that is still queued, or that was admitted under the change, or that is itself a
  // leg of the change's follow-up ops (the obligation moves to it: it is judged on its own admission) means the
  // source owes nothing more - never a second redo beside an equivalent one.
  const redosOf = new Map();
  for (const job of jobs) {
    const of = job.payload.contractChange?.followUpOf;
    if (!of || job.status === 'cancelled') continue;
    if (!redosOf.has(of)) redosOf.set(of, []);
    redosOf.get(of).push(job);
  }
  const redoCovers = (redo, change) => {
    if (redo.op_id !== change.followUp.op) return false;
    if (change.followUp.ops.includes(redo.op_id)) return true;
    const admission = admittedContractOf(db, redo);
    return admission.source === 'not-admitted' || carriesChange(admission, change);
  };
  const recorded = new Set(jobs.filter((job) => job.status !== 'cancelled').map((job) => job.payload.contractChange)
    .filter((mark) => mark?.id && mark?.followUpOf).map((mark) => `${mark.id}\0${mark.followUpOf}`));
  const groupOf = (job) => `${job.op_id}\0${job.payload.cut ? `${job.payload.cut.id}\0${job.payload.cut.ordinal}` : ''}`;
  const newest = new Map();
  // A cancelled leg did no work: it never hides the leg before it.
  for (const job of jobs) {
    if (job.status === 'cancelled') continue;
    // Rows come oldest first (try numbers are per unit): the last one of a group is its newest leg.
    newest.set(groupOf(job), job);
  }
  const owed = [], unadmitted = [];
  for (const change of changes) {
    for (const job of newest.values()) {
      if (!change.followUp.ops.includes(job.op_id) || !FOLLOW_UP_SOURCE_STATUSES.includes(job.status)) continue;
      if (job.payload.contractChange?.id === change.id) continue;
      if (recorded.has(`${change.id}\0${job.job_id}`)) continue;
      // A follow-up recorded for a newer change of the same follow-up op carries this one too: it ran under both.
      if (changes.some((other) => other.id !== change.id && other.effectiveAt >= change.effectiveAt && other.followUp.op === change.followUp.op
        && recorded.has(`${other.id}\0${job.job_id}`))) continue;
      if ((redosOf.get(job.job_id) ?? []).some((redo) => redoCovers(redo, change))) continue;
      const admitted = admittedContractOf(db, job);
      if (!Number.isFinite(admitted.at)) { unadmitted.push({ change: change.id, jobId: job.job_id, op: job.op_id, attempt: job.attempt, status: job.status }); continue; }
      if (carriesChange(admitted, change)) continue;
      owed.push({ change: change.id, jobId: job.job_id, op: job.op_id, attempt: job.attempt, status: job.status, followUpOp: change.followUp.op,
        detail: change.followUp.detail || change.summary, after: job.status === 'succeeded' ? null : job.job_id,
        ...(change.batch ? { batch: change.batch, releasedAt: released.get(change.id) ?? null } : {}) });
    }
  }
  // One leg owed by several changes of the same follow-up op owes ONE follow-up, under the newest of them.
  const byEffect = new Map(changes.map((change) => [change.id, change.effectiveAt]));
  const kept = new Map();
  for (const item of owed) {
    const key = `${item.jobId}\0${item.followUpOp}`;
    const had = kept.get(key);
    if (!had) kept.set(key, item);
    else if (byEffect.get(item.change) > byEffect.get(had.change)) kept.set(key, { ...item, alsoCovers: [...(had.alsoCovers ?? []), had.change] });
    else kept.set(key, { ...had, alsoCovers: [...(had.alsoCovers ?? []), item.change] });
  }
  return { owed: [...kept.values()], unadmitted };
}
