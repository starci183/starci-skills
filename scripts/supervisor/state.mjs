// state.mjs — the Supervisor's state for a reader (ui/server.mjs /api/supervisor/state, ui/CONTRACT.md SupervisorState):
// read-only over machine.sqlite (home.mjs readSupervisor). Where each part lives:
//   seat        seats row 'supervisor' and sup_signals supervisor-enabled (home.mjs seatOf, enabledOf), sup_events
//               supervisor-booted | supervisor-restarted | supervisor-adopted, config.yaml supervisor.mode
//   tick        sup_events supervisor-tick (OWED counts) and supervisor-tick-duties (ok, alerts, errors)
//   workflows   the newest supervisor-owed-actions event: per running workflow its frontier state, ready ops and holds
//               (starci kernel status queuedCauses) - the sequence each workflow waits in
//   owed        the same event's items: every stuck item with its class, action, age, SLA breach and matching lessons
//   actions     sup_events supervisor-action (actions.mjs record) and supervisor-notice (notify.mjs)
//   messages    sup_messages direction 'in' (inbox) and 'out' (outbox)
//   learning    sup_learning (lessons.mjs learningState)
//   digest      sup_events supervisor-owner-digest
// The typed rows are machine_logs actor supervisor (sup-log.mjs; /api/supervisor/logs).
import { redactText } from '../lib/redact.mjs';
import { enabledOf, newestEvent, readSupervisor, seatOf, supervisorSettings } from '../machine/home.mjs';
import { ACTION_KIND, DIGEST_KIND, NOTICE_KIND, OWED_ACTIONS_KIND } from './actions.mjs';
import { learningState } from '../machine/lessons.mjs';

export const STATE_SCHEMA = 'starci/supervisor-state@1';
const txt = (v, n = 600) => { const s = redactText(String(v ?? '').replace(/\s+/g, ' ').trim()); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const orNull = (v, n) => (v == null || v === '' ? null : txt(v, n));
const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const int = (v, d = 0) => (Number.isInteger(Number(v)) ? Number(v) : d);
const iso = (at) => (Number.isFinite(Number(at)) ? new Date(Number(at)).toISOString() : '');

/** The whole state, every field typed as ui/src/contract.ts SupervisorState says. Never throws. */
export function readSupervisorState({ env = process.env, now = Date.now(), limit = 50, settings = null } = {}) {
  let mode = 'chat';
  try { mode = (settings ?? supervisorSettings()).mode; } catch { /* the default */ }
  const message = (r) => ({ id: String(r.msg_id ?? ''), at: iso(r.at), from: r.from_ref ? String(r.from_ref) : (r.chat_id ? 'telegram' : null), text: txt(r.text, 600), read: r.read_at != null });
  const reply = (r) => ({ id: String(r.msg_id ?? ''), at: iso(r.at), to: r.to_ref ? String(r.to_ref) : null, via: r.via ? String(r.via) : null, ok: r.ok !== 0, text: txt(r.text, 600) });
  const base = readSupervisor((m) => {
    const seat = seatOf(m, now);
    const boot = m.supEvents({ kinds: ['supervisor-booted', 'supervisor-restarted', 'supervisor-adopted'], limit: 1 })[0] ?? null;
    const tick = newestEvent(m, 'supervisor-tick');
    const duties = newestEvent(m, 'supervisor-tick-duties');
    const owed = newestEvent(m, OWED_ACTIONS_KIND);
    const digest = newestEvent(m, DIGEST_KIND);
    const acts = m.supEvents({ kinds: [ACTION_KIND, NOTICE_KIND], limit }).map((r) => ({ at: r.created_at, kind: r.kind, p: r.payload ?? {} }));
    const learning = learningState(m);
    let inbox = [], outbox = [];
    try { inbox = m.supMessages({ direction: 'in', limit }).map(message); } catch { inbox = []; }
    try { outbox = m.supMessages({ direction: 'out', limit }).map(reply); } catch { outbox = []; }
    return {
      seat: { mode, enabled: enabledOf(m), terminal: seat?.value?.terminal ?? null, agent: seat?.value?.agent ?? null, model: seat?.value?.model ?? null,
        state: seat ? (seat.starting ? 'starting' : seat.expired ? 'expired' : seat.value?.state ?? 'live') : null,
        since: num(seat?.at), lastBoot: num(boot?.created_at) },
      tick: tick || duties ? { at: int(duties?.at ?? tick?.at), ok: duties?.ok !== false, alerts: int((duties?.alerts ?? []).length), errors: int((duties?.errors ?? []).length),
        owed: int(tick?.owed), clusters: int(tick?.clusters),
        ramThrottle: duties?.ramThrottle ? { effectiveCap: num(duties.ramThrottle.effectiveCap), maxParallelOps: num(duties.ramThrottle.maxParallelOps),
          running: int(duties.ramThrottle.running), queued: int(duties.ramThrottle.queued), mode: String(duties.ramThrottle.mode ?? ''),
          why: orNull(duties.ramThrottle.why, 400), capWhy: orNull(duties.ramThrottle.capWhy, 400), freeRamPct: num(duties.ramThrottle.freeRamPct), cpuBusy: num(duties.ramThrottle.cpuBusy) } : null } : null,
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
        proposals: Object.values(learning.proposals).map((p) => ({ id: p.id, title: txt(p.title, 200), evidence: txt(p.evidence, 800), options: txt(p.options, 600), recommendation: txt(p.recommendation, 400), status: String(p.status ?? 'open'), at: int(p.at) })),
      },
      digest: digest ? { at: int(digest.at), sent: Boolean(digest.telegram?.ok !== false && !digest.telegram?.skipped) } : null,
      messages: { inbox, outbox },
    };
  }, null, { env });
  return {
    schema: STATE_SCHEMA, at: now,
    ...(base ?? { seat: { mode, enabled: null, terminal: null, agent: null, model: null, state: null, since: null, lastBoot: null }, tick: null, workflows: [], owed: { at: null, items: [] }, actions: [],
      learning: { hypotheses: [], experiments: [], lessons: [], proposals: [] }, digest: null, messages: { inbox: [], outbox: [] } }),
  };
}
