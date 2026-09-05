// The bank of missions of one product, at @worktrees/banked/<product>/: queue.json is the order,
// <missionId>/mission.json is the content, approvals.json is the person's one answer over the whole
// queue. This module is the one place that layout is read, written and hashed, so the helper that
// drafts a bank, the orchestrator that takes the next mission from it and the session gate that
// refuses an unapproved bankRef cannot disagree about what the bank says.
//
// Two rules the hash carries, and nothing else states twice:
//   - The approval covers the composition of the queue and the content of the missions it lists, not
//     their progress. Running or finishing a mission leaves the hash alone; adding, reordering,
//     dropping a mission, or correcting a mission's goal, changes it and the person is asked again.
//   - One mission per product at a time. `next` hands back nothing while a sibling is running, so a
//     mission that stopped for the person pauses the bank by simply staying `running`.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { secretErrors } from './sweep-secrets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const QUEUE_FILE = 'queue.json';
export const APPROVALS_FILE = 'approvals.json';
export const MISSION_FILE = 'mission.json';
export const MISSION_DOC = 'mission.md';
export const UNGROUNDED = 'BANK_UNGROUNDED';

export const bankDir = (hostRoot, product) => path.join(hostRoot, '.worktrees', 'banked', product);
export const missionDir = (hostRoot, product, missionId) => path.join(bankDir(hostRoot, product), missionId);
export const approvalId = (product, version) => `bank:${product}:v${version}`;

const readJson = async (file) => { if (!existsSync(file)) return null; try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } };
const schema = async (kind, root = ROOT) => JSON.parse(await readFile(path.join(root, 'templates', 'kinds', `${kind}.schema.json`), 'utf8'));

// One canonical form for hashing: object keys sorted, no whitespace. Two files that say the same
// thing hash the same however they were written.
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value === undefined ? null : value);
}
export const sha256 = (text) => `sha256:${createHash('sha256').update(text).digest('hex')}`;
export const missionDigest = (mission) => sha256(canonical(mission));

export const isDropped = (entry) => entry.status === 'dropped';
export const sessionOf = (entry) => { const m = /^(?:running|done):(.+)$/.exec(entry.status ?? ''); return m ? m[1] : null; };
export const isDone = (entry) => entry.status?.startsWith('done:') === true;
export const isRunning = (entry) => entry.status?.startsWith('running:') === true;

// The hash the approval records: the product, then the live entries in order, each as its id, what it
// waits for, how urgent it is and the digest of its mission file. Status is deliberately absent.
export function queueHash(queue, digests = new Map()) {
  const live = (queue?.entries ?? []).filter((e) => !isDropped(e));
  return sha256(canonical({
    product: queue?.product ?? null,
    entries: live.map((e) => ({ missionId: e.missionId, dependsOn: [...(e.dependsOn ?? [])].sort(), priority: e.priority, mission: digests.get(e.missionId) ?? null })),
  }));
}

export async function readQueue(hostRoot, product) { return readJson(path.join(bankDir(hostRoot, product), QUEUE_FILE)); }
export async function readApprovals(hostRoot, product) { return readJson(path.join(bankDir(hostRoot, product), APPROVALS_FILE)); }
export async function readMission(hostRoot, product, missionId) { return readJson(path.join(missionDir(hostRoot, product, missionId), MISSION_FILE)); }

export async function readMissions(hostRoot, product) {
  const dir = bankDir(hostRoot, product);
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const e of (await readdir(dir, { withFileTypes: true })).filter((x) => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const mission = await readJson(path.join(dir, e.name, MISSION_FILE));
    if (mission) out.set(e.name, mission);
  }
  return out;
}

// The whole bank in one read: the queue, its missions, the approvals, and the hash of what the person
// would be approving now.
export async function readBank(hostRoot, product) {
  const queue = await readQueue(hostRoot, product);
  const missions = await readMissions(hostRoot, product);
  const approvals = await readApprovals(hostRoot, product);
  const digests = new Map([...missions].map(([id, m]) => [id, missionDigest(m)]));
  return { product, queue, missions, approvals, digests, hash: queue ? queueHash(queue, digests) : null };
}

// The approval that is current: the newest one whose queueHash is the hash of the bank as it stands.
export function currentApproval(approvals, hash) {
  const list = approvals?.approvals ?? [];
  for (let i = list.length - 1; i >= 0; i -= 1) if (list[i].queueHash === hash) return list[i];
  return null;
}

export async function validateMission(mission, at, root = ROOT) {
  const errors = validateAgainst(await schema('banked-mission', root), mission, at);
  if (errors.length) return errors;
  if (!(mission.evidenceRefs ?? []).length) errors.push(`${at}: no evidenceRefs (${UNGROUNDED}); a banked mission names at least one unchecked entry, finding, run, source path or note it was drafted from`);
  return errors;
}

export async function validateQueue(queue, at, { missions = new Map(), root = ROOT } = {}) {
  const errors = validateAgainst(await schema('bank-queue', root), queue, at);
  if (errors.length) return errors;
  const ids = new Set();
  for (const e of queue.entries) {
    if (ids.has(e.missionId)) errors.push(`${at}: ${e.missionId} is listed twice; one mission has one entry`);
    ids.add(e.missionId);
  }
  for (const e of queue.entries) {
    for (const d of e.dependsOn ?? []) if (!ids.has(d)) errors.push(`${at}: ${e.missionId} depends on ${d}, which this queue does not list`);
    if (missions.size && !missions.has(e.missionId)) errors.push(`${at}: ${e.missionId} has no ${e.missionId}/${MISSION_FILE}; an entry with no mission is an order for work nobody wrote`);
  }
  for (const id of missions.keys()) if (!ids.has(id)) errors.push(`${at}: mission ${id} has no queue entry; a mission nobody ordered is never taken`);
  const running = queue.entries.filter(isRunning);
  if (running.length > 1) errors.push(`${at}: ${running.map((e) => e.missionId).join(', ')} are all running; one mission of a product runs at a time`);
  return errors;
}

// --- the queue as a value: every mutation returns a new queue, so a caller writes once. -------------
const clone = (queue) => JSON.parse(JSON.stringify(queue));
const indexOf = (queue, missionId) => queue.entries.findIndex((e) => e.missionId === missionId);

export function enqueue(queue, entry, { at = null } = {}) {
  const next = clone(queue);
  if (indexOf(next, entry.missionId) !== -1) throw new Error(`${entry.missionId} is already banked`);
  const row = { missionId: entry.missionId, status: entry.status ?? 'banked', dependsOn: entry.dependsOn ?? [], priority: entry.priority ?? 'P2' };
  if (at === null || at >= next.entries.length) next.entries.push(row); else next.entries.splice(Math.max(0, at), 0, row);
  return next;
}

export function reorder(queue, order) {
  const next = clone(queue);
  const byId = new Map(next.entries.map((e) => [e.missionId, e]));
  if (order.length !== next.entries.length || order.some((id) => !byId.has(id))) throw new Error('a reorder names exactly the missions the queue lists, once each');
  next.entries = order.map((id) => byId.get(id));
  return next;
}

export function drop(queue, missionId) { return setStatus(queue, missionId, 'dropped'); }
export function markRunning(queue, missionId, sessionId) { return setStatus(queue, missionId, `running:${sessionId}`); }
export function markDone(queue, missionId, sessionId) { return setStatus(queue, missionId, `done:${sessionId}`); }

function setStatus(queue, missionId, status) {
  const next = clone(queue);
  const i = indexOf(next, missionId);
  if (i === -1) throw new Error(`${missionId} is not banked`);
  next.entries[i] = { ...next.entries[i], status };
  return next;
}

// The next mission to take: the first banked entry whose dependencies are all done, and nothing at all
// while a sibling of the same product is still running.
export function next(queue) {
  if (!queue?.entries?.length) return null;
  if (queue.entries.some(isRunning)) return null;
  const done = new Set(queue.entries.filter(isDone).map((e) => e.missionId));
  return queue.entries.find((e) => e.status === 'banked' && (e.dependsOn ?? []).every((d) => done.has(d))) ?? null;
}

// The order a drafted bank comes out in: what a mission waits for first, then how urgent it is, then
// its id so two readings of the same product produce the same queue. A person may reorder afterwards —
// that is what `reorder` is for and the queue gate does not second-guess it — but a helper that drafts
// a bank emits this order, and its own validator says so.
export const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 };
export function plannedOrder(entries) {
  const left = entries.filter((e) => !isDropped(e));
  const taken = [];
  const done = new Set();
  while (left.length) {
    const ready = left.filter((e) => (e.dependsOn ?? []).every((d) => done.has(d) || !left.some((x) => x.missionId === d)));
    if (!ready.length) return null; // a cycle; the caller reports it against the ids that are left
    ready.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || a.missionId.localeCompare(b.missionId));
    const pick = ready[0];
    taken.push(pick.missionId);
    done.add(pick.missionId);
    left.splice(left.indexOf(pick), 1);
  }
  return taken;
}

export async function writeQueue(hostRoot, product, queue) {
  const dir = bankDir(hostRoot, product);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, QUEUE_FILE), `${JSON.stringify(queue, null, 2)}\n`);
}
export async function writeMission(hostRoot, product, mission, doc) {
  const dir = missionDir(hostRoot, product, mission.missionId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, MISSION_FILE), `${JSON.stringify(mission, null, 2)}\n`);
  if (doc !== undefined) await writeFile(path.join(dir, MISSION_DOC), doc);
}

// A bank read from disk, whole: the queue and every mission against their schemas, the entries against
// the missions, and the approval against the hash of what is there now.
export async function validateBank(hostRoot, product, { root = ROOT } = {}) {
  const errors = [];
  const bank = await readBank(hostRoot, product);
  const at = `@worktrees/banked/${product}`;
  if (!bank.queue) return { errors: [`${at}/${QUEUE_FILE}: missing; a bank is its queue`], bank };
  for (const [id, mission] of bank.missions) {
    errors.push(...await validateMission(mission, `${at}/${id}/${MISSION_FILE}`, root));
    if (mission.missionId !== id) errors.push(`${at}/${id}/${MISSION_FILE}: missionId ${mission.missionId} is not the folder ${id}`);
    if (mission.product !== product) errors.push(`${at}/${id}/${MISSION_FILE}: product ${mission.product} is not ${product}`);
    if (!existsSync(path.join(missionDir(hostRoot, product, id), MISSION_DOC))) errors.push(`${at}/${id}/${MISSION_DOC}: missing; the mission a person reads is written beside the one the harness reads`);
  }
  errors.push(...await validateQueue(bank.queue, `${at}/${QUEUE_FILE}`, { missions: bank.missions, root }));
  // A bank is read by a person and copied into a session's goal block, so it is swept like a receipt:
  // the one home of secret-shaped patterns answers here too, and nothing is a second list.
  errors.push(...secretErrors(bankDir(hostRoot, product), { relativeTo: bankDir(hostRoot, product) }).map((e) => `${at}/${e}`));
  if (bank.approvals) {
    errors.push(...validateAgainst(await schema('bank-approvals', root), bank.approvals, `${at}/${APPROVALS_FILE}`));
    if (bank.approvals.product !== product) errors.push(`${at}/${APPROVALS_FILE}: product ${bank.approvals.product} is not ${product}`);
  }
  return { errors, bank };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [product, hostArg] = process.argv.slice(2);
  if (!product) { process.stderr.write('usage: node scripts/bank.mjs <product> [hostRoot]\n'); process.exit(2); }
  const hostRoot = hostArg ? path.resolve(hostArg) : path.resolve(ROOT, '..');
  const { errors, bank } = await validateBank(hostRoot, product);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; }
  else {
    const n = next(bank.queue);
    process.stdout.write(`bank ${product}: ${bank.queue.entries.length} entries, hash ${bank.hash}, approved ${currentApproval(bank.approvals, bank.hash) ? 'current' : 'no'}, next ${n ? n.missionId : '—'}\n`);
  }
}
