// slot-store.mjs - how a UAT slot is stored in machine.sqlite: slot <n> is the host lock `uat-slot-<n>` whose `holder` text is JSON
// {runId, token, lessee}; a waiter holds a ticket lock `uat-ticket-...`. A leaf module: uat-slots.mjs, slot-collect.mjs and slot-lessee.mjs
// all read the same rows and none of them imports another (uat-slots imports the other two).

export const SLOT_PREFIX = 'uat-slot-';
export const TICKET_PREFIX = 'uat-ticket-';
export const SLOT_LOCK = /^uat-slot-(\d+)$/;

/** The JSON a lock row carries in `holder`, or {}. */
export const holderOf = (row) => { try { return JSON.parse(row.holder ?? 'null') ?? {}; } catch { return {}; } };

/** The live (not released) host locks whose name starts with `prefix`, ordered by name. */
export const locksLike = (m, prefix) => m.db.prepare("SELECT * FROM host_locks WHERE substr(name,1,length(?))=? AND state<>'released' ORDER BY name").all(prefix, prefix);

/** Record the lessee on the slot lock `name` while `token` still holds it; false when another claimant took the slot. */
export function bindLessee(m, name, token, lessee) {
  const row = m.hostLock(name);
  const holder = row ? holderOf(row) : null;
  if (!row || row.state === 'released' || holder?.token !== token) return false;
  return m.update('host_locks', { holder: JSON.stringify({ ...holder, lessee }) }, { name, holder_pid: row.holder_pid }).changes > 0;
}
