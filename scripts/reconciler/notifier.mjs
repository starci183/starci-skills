#!/usr/bin/env node
// notifier.mjs — the ONE owner-bound sender (reconciler DESIGN §10.2, §17.2, §19; lane rc-workers).
//
// Two channels, nothing else reaches the owner's Telegram once the Workers controller owns notify.owner:
//   digest   at most once per allocation.supervisorTick.ownerDigestMs: progress per workflow (units that passed their
//            gates, units/hour, ETA, why slow), what was fixed, what is being handled, what waits on the owner (only
//            credentials at the end and the handover), the GC line, open invariant violations by code, the AUTO lands
//            of the day, and the latest `supervisor-judgement` lines the Supervisor wrote (`judge --text`). Built on
//            scripts/supervisor/actions.mjs digestText; sent with scripts/connectors/telegram.mjs ownerPush.
//   urgent   key-deduped, at most once per URGENT_KEY_MS (6 h) per key, only for URGENT_CLASSES (DESIGN §19): an owner
//            service quarantined, a crash loop, RAM critical, a corrupt ledger, a Supervisor DI overdue x3.
// Each send is one machine.sqlite sup_events row (notifier-digest-sent | notifier-urgent-sent), which is also the
// dedupe state; the AUTO lands are the land_runs rows. Language: config.yaml language.
//
//   node scripts/reconciler/notifier.mjs judge --text "<one line>" [--json]
//   node scripts/reconciler/notifier.mjs digest [--send] [--force] [--json]
//   node scripts/reconciler/notifier.mjs urgent --class <class> --key <key> --text "<text>" [--send] [--json]
//
// The Workers controller calls `digest --send` / `urgent --send` through ctx.run, so in shadow nothing is sent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipLine } from '../lib/clip.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { isMain } from '../lib/is-main.mjs';

export const JUDGEMENT_KIND = 'supervisor-judgement';
export const DIGEST_SENT_KIND = 'notifier-digest-sent';
export const URGENT_SENT_KIND = 'notifier-urgent-sent';
export const URGENT_KEY_MS = 6 * 3_600_000;
export const URGENT_CLASSES = Object.freeze(['service-quarantined', 'crash-loop', 'ram-critical', 'ledger-corrupt', 'supervisor-di-overdue']);
const DAY = 86_400_000;

/* ------------------------------------------------------------ pure planners */

/** Whether a digest is due: never sent, or the last one is at least `everyMs` old; `force` always. Pure. */
export const digestDue = ({ lastSentAt = null, now, everyMs, force = false }) => force || lastSentAt == null || now - lastSentAt >= everyMs;

/**
 * Which urgent items to send now: an allowed class, and no send of the same key within `perKeyMs`; one per key per
 * call. Pure over `items` [{class, key, text}] and `sent` {key: lastSentAt}. {due, skipped: [{key, why}]}.
 */
export function planUrgent(items, sent = {}, { now, perKeyMs = URGENT_KEY_MS } = {}) {
  const due = [], skipped = [], seen = new Set();
  for (const i of items) {
    if (!URGENT_CLASSES.includes(i.class)) { skipped.push({ key: i.key, why: `class ${i.class} is not an urgent class` }); continue; }
    if (seen.has(i.key)) { skipped.push({ key: i.key, why: 'duplicate in this call' }); continue; }
    seen.add(i.key);
    const last = sent[i.key];
    if (last != null && now - last < perKeyMs) { skipped.push({ key: i.key, why: `sent ${Math.round((now - last) / 60_000)}m ago` }); continue; }
    due.push(i);
  }
  return { due, skipped };
}

const T = (tr) => ({ judge: tr('Supervisor judgement'), viol: tr('Open invariant violations'), lands: tr('AUTO lands today'), owner: tr('Waiting on the owner'), none: tr('none'), slow: tr('Why slow') });

/** One progress line per workflow (starci/progress@1 + rca.why). Pure. */
export function progressLines(rows, language = ownerLanguage()) {
  const tr = translator(language);
  const t = T(tr);
  return rows.map((r) => {
    const p = r.progress;
    const eta = p.eta ? `ETA ${String(p.eta).slice(0, 16).replace('T', ' ')}Z` : 'ETA ?';
    const head = `- ${r.name ?? r.workflowId}: ${p.unitsDone}/${p.unitsTotal} ${tr('units')}, ${p.unitsPerHour}/h, ${eta}${p.stall?.stalled ? ` - STALL ${p.stall.sinceMin}m` : ''}`;
    return r.why && (p.stall?.stalled || (p.minUnitsPerHour > 0 && p.unitsPerHour < p.minUnitsPerHour)) ? `${head}\n  ${t.slow}: ${String(r.why).replace(/^Why slow: /, '')}` : head;
  });
}

/**
 * The digest text. Pure over what the caller read: `progress` rows, `actions`/`owed` for digestText, `gc` line,
 * `violations` [{code}], `lands` [{kind, id, at}], `judgements` [{text, at}], `ownerWaits` [text].
 */
export function composeDigest({ digestText, progress = [], actions = [], owed = null, gc = null, trend = null, violations = [], lands = [], judgements = [], ownerWaits = [], language = ownerLanguage(), now }) {
  const t = T(translator(language));
  const base = digestText({ actions, owed: { ...(owed ?? {}), items: owed?.items ?? [], ownerWaits }, gc, trend, progress: progressLines(progress, language), language, now });
  const lines = [base];
  const byCode = {};
  for (const v of violations) byCode[v.code ?? '?'] = (byCode[v.code ?? '?'] ?? 0) + 1;
  lines.push(`${t.viol}: ${Object.keys(byCode).length ? Object.entries(byCode).map(([c, n]) => `${c} x${n}`).join(', ') : t.none}`);
  const today = lands.filter((l) => l.kind === 'land-passed' && now - l.at < DAY);
  lines.push(`${t.lands}: ${today.length}${today.length ? ` (${today.slice(0, 8).map((l) => String(l.id).slice(0, 12)).join(', ')})` : ''}`);
  if (judgements.length) { lines.push(`${t.judge}:`); for (const j of judgements.slice(-3)) lines.push(`- ${clipLine(j.text, 300)}`); }
  return lines.join('\n');
}

/* ------------------------------------------------------------ reads (machine.sqlite) */

async function supervisorRead(fn, fallback, env) {
  const { readSupervisor } = await import('../machine/home.mjs');
  return readSupervisor(fn, fallback, { env });
}

/** The land_runs of the last day as the digest's lands: [{kind: land-passed|land-failed, id, at}], newest first. Pure over `m`. */
export const landsOf = (m, { now = Date.now(), limit = 60 } = {}) => m.landRuns({ limit })
  .map((r) => ({ kind: r.result === 'passed' ? 'land-passed' : 'land-failed', id: r.lane ?? r.commit_sha, at: Number(r.finished_at ?? r.started_at) }))
  .filter((l) => l.at >= now - DAY);

/** {lastDigestAt, urgentSent: {key: at}, judgements: [{text, at}], lands: [{kind, id, at}]} since `sinceMs`. */
export async function notifierState({ env = process.env, now = Date.now(), sinceMs = DAY } = {}) {
  return supervisorRead((m) => {
    const lastDigestAt = m.db.prepare('SELECT created_at FROM sup_events WHERE kind=? ORDER BY seq DESC LIMIT 1').get(DIGEST_SENT_KIND)?.created_at ?? null;
    const urgentSent = {};
    for (const r of m.db.prepare('SELECT entity_id, created_at FROM sup_events WHERE kind=? AND created_at>=? ORDER BY seq').all(URGENT_SENT_KIND, now - URGENT_KEY_MS)) urgentSent[r.entity_id] = Number(r.created_at);
    const judgements = m.db.prepare('SELECT payload_json, created_at FROM sup_events WHERE kind=? AND created_at>=? ORDER BY seq').all(JUDGEMENT_KIND, lastDigestAt ?? now - sinceMs)
      .map((r) => ({ text: parseJsonOr(r.payload_json, {})?.text ?? '', at: Number(r.created_at) })).filter((j) => j.text);
    return { lastDigestAt: lastDigestAt == null ? null : Number(lastDigestAt), urgentSent, judgements, lands: landsOf(m, { now }) };
  }, { lastDigestAt: null, urgentSent: {}, judgements: [], lands: [] }, env);
}

async function record(kind, entityId, payload, { env, now }) {
  const { withSupervisor, supervisorEvent } = await import('../machine/home.mjs');
  withSupervisor((m) => supervisorEvent(m, { entityType: 'notifier', entityId, kind, payload, now }), { env });
}

/** The Supervisor's one-line judgement for the next digest (DESIGN §17.2). */
export async function judge(text, { env = process.env, now = Date.now() } = {}) {
  const line = clipLine(String(text ?? '').replace(/\s+/g, ' ').trim(), 400);
  if (!line) return { ok: false, error: 'empty --text' };
  await record(JUDGEMENT_KIND, 'main', { text: line }, { env, now });
  return { ok: true, text: line };
}

/* ------------------------------------------------------------ the digest */

async function languageOf() {
  return ownerLanguage();
}

/** Everything the digest reads: live workflows' progress (progress-rca.mjs), GC line, violations, owner waits. `repos` defaults to config.yaml supervisor.repos. */
export async function digestInputs({ env = process.env, now = Date.now(), repos = null } = {}) {
  const [{ productRepos, supervisorSettings }, { openLedgerReader, ledgerFileFor }, { workflowView }, { listDecisions }] = await Promise.all([
    import('../machine/home.mjs'), import('../../engine/db/ledger.mjs'), import('../kernel/progress-rca.mjs'), import('../machine/decisions.mjs')]);
  const progress = [], ownerWaits = [];
  if (repos == null) { try { repos = productRepos(supervisorSettings()); } catch { repos = []; } }
  for (const repo of repos) {
    let db;
    try {
      // A repo's runtime ledger is the one file ledgerFileFor resolves (machine.ledgers names it).
      const resolved = ledgerFileFor(repo, { env });
      if (fs.existsSync(resolved)) db = openLedgerReader(resolved);
    } catch { continue; }
    if (!db) continue;
    try {
      for (const w of db.prepare("SELECT * FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY created_at").all()) {
        try {
          const v = workflowView({ db, workflowId: w.workflow_id, repo, now });
          progress.push({ workflowId: w.workflow_id, name: w.display_name ?? w.workflow_id, progress: v.progress, why: v.rca.why });
        } catch { /* one workflow unreadable */ }
      }
      try {
        // listDecisions, not a raw read: it applies the ended-phase join (decisions.mjs ENDED), so a leftover
        // owner DI of an archived|finished workflow — unresolvable there — never reaches the owner's digest.
        for (const d of listDecisions(db, { decider: 'owner', now })) {
          ownerWaits.push(`${d.workflowId}: ${clipLine(d.summary ?? d.kind, 160)}`);
        }
      } catch { /* a ledger without decision_items */ }
    } finally { db.close(); }
  }
  let violations = [];
  try { const { openViolations } = await import('./sla.mjs'); violations = openViolations({ env }); } catch { violations = []; }
  const gc = await supervisorRead((m) => m.db.prepare("SELECT msg FROM machine_logs WHERE actor='gc' AND kind='gc.summary' ORDER BY seq DESC LIMIT 1").get()?.msg ?? null, null, env);
  let actions = [], owed = null;
  try { const a = await import('../supervisor/actions.mjs'); owed = a.latestOwedActions({ env }); } catch { owed = null; }
  // The op-health trend: the Workers controller's supervisor-op-metrics snapshots (op-metrics.mjs currentTrend).
  let trend = null;
  try { trend = await (await import('../machine/op-metrics.mjs')).currentTrend({ env, language: await languageOf() }); } catch { trend = null; }
  return { progress, ownerWaits, violations, gc, trend, actions, owed };
}

/** Build and (with `send`, when due) push the digest. {ok, due, sent, text, skipped?}. `push` defaults to ownerPush. */
export async function digest({ send = false, force = false, env = process.env, now = Date.now(), everyMs = null, push = null, inputs = null, state = null, language = null } = {}) {
  const [{ digestText }, st, lang] = await Promise.all([import('../supervisor/actions.mjs'), state ?? notifierState({ env, now }), language ?? languageOf()]);
  let every = everyMs;
  if (every == null) { try { const { allocationSettings } = await import('../../engine/config.mjs'); every = Number(allocationSettings()?.supervisorTick?.ownerDigestMs) || 2 * 3_600_000; } catch { every = 2 * 3_600_000; } }
  const due = digestDue({ lastSentAt: st.lastDigestAt, now, everyMs: every, force });
  const inp = inputs ?? await digestInputs({ env, now });
  const text = composeDigest({ digestText, ...inp, lands: st.lands, judgements: st.judgements, language: lang, now });
  if (!send || !due) return { ok: true, due, sent: false, text, ...(due ? {} : { skipped: `last digest ${Math.round((now - st.lastDigestAt) / 60_000)}m ago` }) };
  const pusher = push ?? (await import('../connectors/telegram.mjs')).ownerPush;
  const r = await pusher(text, { env });
  if (r?.ok && !r.skipped) await record(DIGEST_SENT_KIND, 'owner', { chars: text.length, messageId: r.messageId ?? null }, { env, now });
  return { ok: r?.ok !== false, due, sent: Boolean(r?.ok && !r.skipped), text, ...(r?.skipped ? { skipped: r.skipped } : {}), ...(r?.error ? { error: r.error } : {}) };
}

/** Send urgent items through the key dedupe. {ok, sent: [key], skipped}. */
export async function urgent(items, { send = false, env = process.env, now = Date.now(), push = null, state = null, language = null } = {}) {
  const st = state ?? await notifierState({ env, now });
  const plan = planUrgent(items, st.urgentSent, { now });
  if (!send) return { ok: true, sent: [], due: plan.due.map((i) => i.key), skipped: plan.skipped };
  const pusher = push ?? (await import('../connectors/telegram.mjs')).ownerPush;
  const tr = translator(language ?? await languageOf());
  const sent = [];
  for (const i of plan.due) {
    const r = await pusher(tr('[urgent] {text}', { text: i.text }), { env });
    if (r?.ok && !r.skipped) { sent.push(i.key); if (!state) await record(URGENT_SENT_KIND, i.key, { class: i.class, text: clipLine(i.text, 300) }, { env, now }); else st.urgentSent[i.key] = now; }
  }
  return { ok: true, sent, skipped: plan.skipped };
}

/* ------------------------------------------------------------ CLI */

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const json = argv.includes('--json');
  const out = (v) => console.log(json ? JSON.stringify(v, null, 2) : v.text ?? JSON.stringify(v));
  const verb = argv[0];
  let result;
  if (verb === 'judge') result = await judge(flag('text'));
  else if (verb === 'digest') result = await digest({ send: argv.includes('--send'), force: argv.includes('--force') });
  else if (verb === 'urgent') result = await urgent([{ class: flag('class'), key: flag('key'), text: flag('text') ?? '' }], { send: argv.includes('--send') });
  else { console.error('usage: notifier.mjs judge --text <t> | digest [--send] [--force] | urgent --class <c> --key <k> --text <t> [--send]'); process.exit(2); }
  out(result);
  process.exit(result.ok === false ? 1 : 0);
}
