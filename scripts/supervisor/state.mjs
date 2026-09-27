// state.mjs — the Supervisor's state for a reader (ui/server.mjs /api/supervisor/state, ui/CONTRACT.md SupervisorState):
// read-only over the supervisor ledger (<supervisor home>/.starciwork/runtime.sqlite) and its channel files. Where each
// part lives:
//   seat        signals supervisor-seat / supervisor-enabled (home.mjs seatOf, enabledOf), events supervisor-booted |
//               supervisor-restarted | supervisor-adopted, config.yaml supervisor.mode
//   tick        events supervisor-tick (OWED counts) and supervisor-tick-duties (ok, alerts, errors)
//   workflows   the newest supervisor-owed-actions event: per running workflow its frontier state, ready ops and holds
//               (api status queuedCauses) - the sequence each workflow waits in
//   owed        the same event's items: every stuck item with its class, action, age, SLA breach and matching lessons
//   actions     events supervisor-action (actions.mjs record) and supervisor-notice (notify.mjs)
//   messages    the channel 'main' inbox / outbox (scripts/connectors/telegram-bridge.mjs readInbox / readOutbox)
//   learning    events supervisor-hypothesis | -experiment | -experiment-result | -lesson | -proposal (lessons.mjs)
//   digest      events supervisor-owner-digest
// The typed rows are in the same ledger's `logs` table (sup-log.mjs; /api/supervisor/logs).
import { parseJsonOr } from '../lib/json.mjs';
import { redactText } from '../kernel/typed-logs.mjs';
import { readInbox, readOutbox } from '../connectors/telegram-bridge.mjs';
import { SUPERVISOR_ID, SUPERVISOR_WF, enabledOf, seatOf, supervisorSettings, withSupervisorRead } from './home.mjs';
import { ACTION_KIND, DIGEST_KIND, NOTICE_KIND, OWED_ACTIONS_KIND } from './actions.mjs';
import { learningState } from './lessons.mjs';

export const STATE_SCHEMA = 'starci/supervisor-state@1';
const txt = (v, n = 600) => { const s = redactText(String(v ?? '').replace(/\s+/g, ' ').trim()); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const orNull = (v, n) => (v == null || v === '' ? null : txt(v, n));
const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const int = (v, d = 0) => (Number.isInteger(Number(v)) ? Number(v) : d);

const newest = (db, kind) => {
  const r = db.prepare('SELECT created_at, payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(SUPERVISOR_WF, kind);
  return r ? { at: r.created_at, ...(parseJsonOr(r.payload_json, {}) ?? {}) } : null;
};

/** The whole state, every field typed as ui/src/contract.ts SupervisorState says. Never throws. */
export function readSupervisorState({ env = process.env, now = Date.now(), limit = 50, settings = null } = {}) {
  let mode = 'chat';
  try { mode = (settings ?? supervisorSettings()).mode; } catch { /* the default */ }
  const base = withSupervisorRead((db) => {
    const seat = seatOf(db, now);
    const boot = db.prepare("SELECT created_at FROM events WHERE workflow_id=? AND kind IN ('supervisor-booted','supervisor-restarted','supervisor-adopted') ORDER BY seq DESC LIMIT 1").get(SUPERVISOR_WF);
    const tick = newest(db, 'supervisor-tick');
    const duties = newest(db, 'supervisor-tick-duties');
    const owed = newest(db, OWED_ACTIONS_KIND);
    const digest = newest(db, DIGEST_KIND);
    const acts = db.prepare('SELECT kind, created_at, payload_json FROM events WHERE workflow_id=? AND kind IN (?,?) ORDER BY seq DESC LIMIT ?').all(SUPERVISOR_WF, ACTION_KIND, NOTICE_KIND, limit)
      .map((r) => ({ at: r.created_at, kind: r.kind, p: parseJsonOr(r.payload_json, {}) ?? {} }));
    const learning = learningState(db);
    return {
      seat: { mode, enabled: enabledOf(db), terminal: seat?.value?.terminal ?? null, state: seat ? (seat.starting ? 'starting' : seat.expired ? 'expired' : seat.value?.state ?? 'live') : null,
        since: num(seat?.at), lastBoot: num(boot?.created_at) },
      tick: tick || duties ? { at: int(duties?.at ?? tick?.at), ok: duties?.ok !== false, alerts: int((duties?.alerts ?? []).length), errors: int((duties?.errors ?? []).length),
        owed: int(tick?.owed), clusters: int(tick?.clusters) } : null,
      workflows: (owed?.workflows ?? []).map((w) => ({ workflowId: String(w.workflowId), state: orNull(w.state, 80), ready: int(w.ready), holds: Object.fromEntries(Object.entries(w.causes ?? {}).map(([k, v]) => [String(k), int(v)])), error: orNull(w.error, 300) })),
      owed: { at: num(owed?.at), items: (owed?.items ?? []).map((i) => ({ key: String(i.key), class: String(i.class), workflowId: orNull(i.workflowId, 400), subject: orNull(i.subject, 200),
        evidence: txt(i.evidence), do: txt(i.do), ageMin: int(i.ageMin), firstSeenAt: int(i.firstSeenAt), actedAt: num(i.actedAt), breach: i.breach === true, lessons: (i.lessons ?? []).map((l) => txt(l, 300)) })) },
      actions: acts.map(({ at, kind, p }) => ({ at, item: String(p.item ?? (kind === NOTICE_KIND ? `notice|${p.workflowId ?? '?'}` : '?')), action: String(kind === NOTICE_KIND ? `notify:${p.action ?? '?'}` : p.action ?? '?'),
        reason: orNull(p.reason, 600), workflowId: orNull(p.workflowId, 200) })),
      learning: {
        hypotheses: Object.entries(learning.signatures).filter(([, s]) => s.status === 'open' && s.hypothesis).map(([sig, s]) => ({ signature: sig, causeClass: String(s.hypothesis.causeClass ?? 'runtime-flow'),
          symptom: txt(s.hypothesis.symptom), source: String(s.hypothesis.source ?? 'self'), at: int(s.hypothesis.at) })),
        experiments: Object.values(learning.experiments).slice(-limit).map((e) => ({ id: e.id, signature: String(e.signature), status: String(e.status), tier: String(e.tier ?? 'auto'), commits: (e.commits ?? []).map(String),
          lane: orNull(e.lane, 120), landedAt: num(e.landedAt), reason: orNull(e.reason, 600), result: orNull(e.result?.reason, 600) })),
        lessons: learning.lessons.slice(-limit).map((l) => ({ signature: orNull(l.signature, 200), source: String(l.source ?? 'self'), weight: num(l.weight) ?? 1, status: String(l.status ?? 'kept'), text: txt(l.text), at: int(l.at) })),
        proposals: Object.values(learning.proposals).map((p) => ({ id: p.id, title: txt(p.title, 200), recommendation: txt(p.recommendation, 400), status: String(p.status ?? 'open'), at: int(p.at) })),
      },
      digest: digest ? { at: int(digest.at), sent: Boolean(digest.telegram?.ok !== false && !digest.telegram?.skipped) } : null,
    };
  }, null, { env });
  const message = (m) => ({ id: String(m.id ?? ''), at: String(m.at ?? ''), from: m.from ? String(m.from) : (m.chatId ? 'telegram' : null), text: txt(m.text, 600), read: m.read === true });
  const reply = (m) => ({ id: String(m.id ?? ''), at: String(m.at ?? ''), to: m.to ? String(m.to) : null, via: m.via ? String(m.via) : null, ok: m.ok !== false, text: txt(m.text, 600) });
  let inbox = [], outbox = [];
  try { inbox = readInbox(SUPERVISOR_ID, env).slice(-limit).map(message); } catch { inbox = []; }
  try { outbox = readOutbox(SUPERVISOR_ID, env).slice(-limit).map(reply); } catch { outbox = []; }
  return {
    schema: STATE_SCHEMA, at: now,
    ...(base ?? { seat: { mode, enabled: null, terminal: null, state: null, since: null, lastBoot: null }, tick: null, workflows: [], owed: { at: null, items: [] }, actions: [],
      learning: { hypotheses: [], experiments: [], lessons: [], proposals: [] }, digest: null }),
    messages: { inbox, outbox },
  };
}
