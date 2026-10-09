// slot-collect.mjs - ends the UAT slots whose lessee is gone, and the slots a workflow tree's install must not collide with.
//
// A slot is a lease (slot-store.mjs): the process that holds it and the command it runs (a Playwright run, the app server it starts) are
// the lessee's. When the lessee ends - its attempt settled or died, the process that launched the run is gone - the holder and its held
// command are stopped by recorded identity (pid + creation time + command line, never the pid or the port alone), the lock and the
// uat_slots row are released, and one `uat-slot-collected` event records the stop. The Host pass (scripts/reconciler/host-slot-servers.mjs),
// `starci uat slots collect` and the install of a workflow tree (stopSlotsInTree) all end a slot through endSlot.
import { allocationMs } from '../../engine/config.mjs';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';
import { killTree } from '../api/process/kill-tree.mjs';
import { processList } from '../api/process/process-list.mjs';
import { pidAlive } from '../lib/pid-alive.mjs';
import { foldCase, slash } from '../lib/path-key.mjs';
import { SLOT_LOCK, SLOT_PREFIX, holderOf, locksLike } from './slot-store.mjs';
import { attemptEnded, identityLive, identityOf, lesseeVerdict } from './slot-lessee.mjs';

/** Stop the process `pid` and its descendants: taskkill /T on Windows, SIGTERM elsewhere. True when the stop was sent. */
export function stopTree(pid) {
  if (process.platform === 'win32') return killTree(pid).ok;
  try { process.kill(pid, 'SIGTERM'); return true; } catch { return false; }
}

const inside = (dir, tree) => {
  const key = foldCase(slash(tree)), text = foldCase(slash(dir ?? ''));
  return text === key || text.startsWith(`${key}/`);
};

// The identity of a slot holder that recorded none: its pid as the process table shows it, when it is a uat-slots run.
const holderIdentity = (row, rows) => {
  const identity = identityOf(row.holder_pid, rows);
  return identity && /uat-slots/.test(identity.cmd) ? identity : null;
};

// The live slot rows with their parsed holder: [{row, slot, name, holder, lessee}].
function slotRows(m) {
  return locksLike(m, SLOT_PREFIX).flatMap((row) => {
    const match = SLOT_LOCK.exec(row.name);
    const holder = holderOf(row);
    return match ? [{ row, slot: Number(match[1]), name: row.name, holder, lessee: holder.lessee ?? null }] : [];
  });
}

/**
 * End one slot: stop its held command, then its holder, each only while the recorded identity is still the live process; release the lock and
 * the uat_slots row; append the event. Returns {slot, runId, why, stopped: [pid], survivors: [pid], released}. Seams: rows, stop, alive, env, dryRun.
 */
function endSlot(entry, { why, state, rows, stop = stopTree, alive = pidAlive, env = process.env, dryRun = false }) {
  const { row, slot, name, holder, lessee } = entry;
  // A lease that recorded no identity is judged by its holder pid: it is stopped only while that process is a uat-slots run.
  const self = lessee?.self ?? holderIdentity(row, rows);
  const targets = [lessee?.child, self].filter((identity) => identity && identityLive(identity, rows));
  const base = { slot, name, runId: holder.runId ?? null, state, why, pids: targets.map((t) => t.pid) };
  if (dryRun) return { ...base, stopped: [], survivors: [], released: false, dryRun: true };
  const stopped = targets.filter((identity) => stop(identity.pid)).map((identity) => identity.pid);
  const survivors = targets.filter((identity) => alive(identity.pid)).map((identity) => identity.pid);
  if (survivors.length) return { ...base, stopped, survivors, released: false };
  withMachine((m) => m.transaction(() => {
    m.releaseHostLock({ name, pid: row.holder_pid });
    m.releaseUatSlot(`slot-${slot}`);
    m.supEvent({ entityType: 'uat-slot', entityId: `slot-${slot}`, kind: 'uat-slot-collected',
      payload: { slot, runId: holder.runId ?? null, state, why, stopped, holderPid: row.holder_pid, scratchDir: lessee?.scratchDir ?? null, cwd: lessee?.cwd ?? null } });
  }), { env });
  return { ...base, stopped, survivors: [], released: true };
}

/**
 * The Host collection: every live slot whose lessee is gone is ended. A slot whose holder died but whose held command lives on is ended too.
 * `unknownHoldMs` is allocation.uatSlot.unknownHoldMs. Returns the ends, one per slot touched.
 */
export function collectSlots({ env = process.env, rows = processList({ cmdMax: 200 }), now = Date.now(), dryRun = false, only = null, unknownHoldMs = allocationMs('uatSlot.unknownHoldMs'), attemptOf = (dir) => attemptEnded(dir, readMachine, { env }), ...seams } = {}) {
  if (!rows) return [];
  const entries = readMachine((m) => slotRows(m), [], { env }).filter((entry) => only === null || entry.slot === only);
  const ends = [];
  for (const entry of entries) {
    const lessee = entry.lessee;
    const holderLive = lessee?.self ? identityLive(lessee.self, rows) : holderIdentity(entry.row, rows) !== null;
    const verdict = holderLive
      ? lesseeVerdict({ lessee, rows, attempt: attemptOf(lessee?.scratchDir ?? null), heldMs: now - entry.row.started_at, unknownHoldMs })
      : { state: 'holder-gone', why: 'the process holding the slot is gone' };
    if (verdict.state === 'live') continue;
    if (verdict.state === 'holder-gone' && !(lessee?.child && identityLive(lessee.child, rows))) continue;
    ends.push(endSlot(entry, { ...verdict, rows, env, dryRun, ...seams }));
  }
  return ends;
}

/** The ends of the live slots whose command runs from inside `tree` (the install of a workflow tree must not collide with its own servers). */
export function stopSlotsInTree(tree, { env = process.env, rows = processList({ cmdMax: 200 }), dryRun = false, ...seams } = {}) {
  if (!rows) return null;
  return readMachine((m) => slotRows(m), [], { env }).filter((entry) => inside(entry.lessee?.cwd, tree))
    .map((entry) => endSlot(entry, { state: 'tree-install', why: `an install of ${tree} needs the tree's files unloaded`, rows, env, dryRun, ...seams }));
}

/**
 * A holder that died while its held command lives on: stop that command (identity checked) inside the caller's transaction on `m` and record
 * the event. Returns the stopped pids. Seams: rows, stop, alive.
 */
export function stopOrphanChild(m, row, { rows = null, stop = stopTree, alive = pidAlive } = {}) {
  const holder = holderOf(row), child = holder.lessee?.child;
  if (!child || !alive(child.pid)) return [];
  if (!identityLive(child, rows ?? processList({ cmdMax: 200 }))) return [];
  if (!stop(child.pid)) return [];
  const slot = Number(SLOT_LOCK.exec(row.name)?.[1] ?? 0);
  m.supEvent({ entityType: 'uat-slot', entityId: `slot-${slot}`, kind: 'uat-slot-collected',
    payload: { slot, runId: holder.runId ?? null, state: 'holder-gone', why: 'the process holding the slot is gone', stopped: [child.pid], by: 'reclaim' } });
  return [child.pid];
}
