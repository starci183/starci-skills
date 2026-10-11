// revision-seats.mjs — the two stores a seat's revision records live in, as the adapter revision-ack.mjs works over:
// {role, root, current, records(), append(payload)}. A Kernel's records are events of its workflow ledger (the legacy
// `runtime-rev-acked` ack counts as the Kernel's own ack of the files it attested); the Supervisor's are events of machine.sqlite.
import { eventPayloadOf } from '../../engine/db/event-payload.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { supervisorEvent } from './home.mjs';
import { runtimeShaOf } from './contract-version.mjs';
import { NOTICE_EVENT, SETTLED_VERDICTS } from './revision-notice.mjs';

const LEGACY_ACK = 'runtime-rev-acked';

/** The newest commit of `root` made at or before `ms`: the revision a seat that booted then read; null when git cannot say. */
function revisionAt(root, ms) {
  try {
    const r = revList(['-1', `--before=${new Date(ms + 1000).toISOString()}`, 'HEAD'], { dir: root, timeout: 30_000 });
    const sha = String(r.stdout ?? '').trim();
    return r.status === 0 && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
  } catch { return null; }
}

const recordOf = (payload) => {
  if (payload?.verdict === 'woken') return { type: 'woken', rev: payload.to, digest: payload.digest };
  return SETTLED_VERDICTS.includes(payload?.verdict) ? { type: 'settled', rev: payload.to } : null;
};

/** The adapter of the Kernel of `workflowId` over its ledger handle `ledger` (openLedger), at the runtime tree `root` (the caller names it: kernel/runtime-rev.mjs revRootOf). */
export function kernelSeat({ ledger, workflowId, root, current = runtimeShaOf(root) }) {
  const db = ledger.db;
  return {
    role: 'kernel', root, current, workflowId,
    records() {
      const notices = db.prepare('SELECT payload_json, payload_sha FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, NOTICE_EVENT)
        .map((row) => recordOf(eventPayloadOf(row))).filter(Boolean);
      const row = db.prepare('SELECT payload_json, payload_sha FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(workflowId, LEGACY_ACK);
      const ack = row ? eventPayloadOf(row) : null;
      return [...(ack?.rev ? [{ type: 'legacy-ack', rev: ack.rev, files: Array.isArray(ack.files) ? ack.files : [] }] : []), ...notices];
    },
    append: (payload) => ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: NOTICE_EVENT, payload, createdAt: Date.now() })),
    bootRev() {
      const boot = db.prepare("SELECT MAX(created_at) AS at FROM events WHERE workflow_id=? AND kind IN ('kernel-booted','kernel-restarted','kernel-adopted')").get(workflowId)?.at;
      return boot ? revisionAt(root, Number(boot)) : null;
    },
  };
}

/** The adapter of the Supervisor over its machine handle `m` (openMachine). */
export function supervisorSeat({ m, root, current = runtimeShaOf(root), now = Date.now }) {
  return {
    role: 'supervisor', root, current,
    records: () => m.supEvents({ kind: NOTICE_EVENT, limit: 500 }).reverse().map((event) => recordOf(event.payload ?? parseJsonOr(event.payload_json))).filter(Boolean),
    append: (payload) => m.transaction(() => supervisorEvent(m, { kind: NOTICE_EVENT, payload, now: now() })),
    bootRev() {
      const boot = m.db.prepare("SELECT MAX(created_at) AS at FROM sup_events WHERE kind IN ('supervisor-booted','supervisor-restarted','supervisor-adopted')").get()?.at;
      return boot ? revisionAt(root, Number(boot)) : null;
    },
  };
}
