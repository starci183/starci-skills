// revision-seats.mjs — the two stores a seat's revision records live in, as the adapter revision-ack.mjs works over:
// {role, root, current, records(), append(payload), storeList(rows) -> sha}. A Kernel's records are events of its workflow ledger (the legacy
// `runtime-rev-acked` ack counts as the Kernel's own ack of the files it attested); the Supervisor's are events of machine.sqlite.
import { putBlob } from '../../engine/db/blob.mjs';
import { eventPayloadOf } from '../lib/event-payload.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { supervisorEvent } from './home.mjs';
import { runtimeShaOf } from './contract-version.mjs';
import { NOTICE_EVENT, SETTLED_VERDICTS } from './revision-notice.mjs';

const LEGACY_ACK = 'runtime-rev-acked';
const LIST_TYPE = 'application/json';

const recordOf = (payload) => {
  if (payload?.verdict === 'woken') return { type: 'woken', rev: payload.to, digest: payload.digest };
  return SETTLED_VERDICTS.includes(payload?.verdict) ? { type: 'settled', rev: payload.to } : null;
};
const listBytes = (rows) => Buffer.from(JSON.stringify(rows));

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
    storeList: (rows) => ledger.write.storeBlob({ content: listBytes(rows), mediaType: LIST_TYPE, redaction: 'v1' }).sha256,
  };
}

/** The adapter of the Supervisor over its machine handle `m` (openMachine). */
export function supervisorSeat({ m, root, current = runtimeShaOf(root), now = Date.now }) {
  return {
    role: 'supervisor', root, current,
    records: () => m.supEvents({ kind: NOTICE_EVENT, limit: 500 }).reverse().map((event) => recordOf(event.payload ?? parseJsonOr(event.payload_json))).filter(Boolean),
    append: (payload) => m.transaction(() => supervisorEvent(m, { kind: NOTICE_EVENT, payload, now: now() })),
    storeList: (rows) => putBlob(listBytes(rows), { mediaType: LIST_TYPE }).sha,
  };
}
