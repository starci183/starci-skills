#!/usr/bin/env node
// starci supervisor actions — the OWED ACTIONS list: every stuck item of every running workflow, classified, with the one action
// the [Supervisor] takes on it and an SLA clock (modules/supervisor/supervise.yaml mission; owner, 2026-09-28:
// "the supervisor must watch, manage, send mail in, and adjust" - autopilot, the owner is asked only for the final
// credentials step and the handover).
//
// It classifies nothing twice: OWED incidents and patterns come from owed.mjs through cluster.mjs, stalls/gates/waits
// from stall.mjs (the poll digest), frontiers from `starci kernel status`, dead kernels and
// pushes from the tick. This file maps each to a class and a concrete action, and keeps the SLA:
//   first seen   tick state owedSeen (the tick's state), a key a tick no longer sees starts over
//   acted        a `supervisor-action` event naming the item (this CLI `record`, notify.mjs --item), or a
//                `supervisor-notice` to the item's workflow, after it was first seen
//   breach       first seen more than runtimes.yaml allocation.supervisorTick.actionSlaMs ago and no action since
// The tick records one `supervisor-owed-actions` event per run; `list` prints the newest. Every event here is a
// machine.sqlite sup_events row (home.mjs supervisorEvent / newestEvent).
//
//   starci supervisor actions list [--json] [--open]
//   starci supervisor actions record --item <key> --action <verb> --reason <text> [--workflow <id>] [--refs <csv>] [--until <iso> | --hold-ms <ms>]
//   starci supervisor actions digest [--json]                       read-only preview of the owner digest
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { clipLine } from '../lib/clip.mjs';
import { hhmm, stampMinute } from '../lib/time.mjs';
import { actionRow, supLog } from '../machine/sup-log.mjs';
import { fullJson } from '../../engine/db/machine.mjs';
import { newestEvent, readSupervisor, SKILL_ROOT, supervisorEvent, supervisorSettings, withSupervisor } from '../machine/home.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { isMain } from '../lib/is-main.mjs';

export const ACTION_KIND = 'supervisor-action';
export const OWED_ACTIONS_KIND = 'supervisor-owed-actions';
export const DIGEST_KIND = 'supervisor-owner-digest';
export const NOTICE_KIND = 'supervisor-notice';

/** The classes, each with what the Supervisor does: modules/supervisor/supervise.yaml mission.classes, the one place the texts live. */
export const CLASSES = Object.freeze(parseYaml(fs.readFileSync(path.join(SKILL_ROOT, 'modules', 'supervisor', 'supervise.yaml'), 'utf8')).mission.classes);

const RETRY_PATTERNS = new Set(['retry-loop', 'repeat-check', 'reroute-loop', 'repeat-reject', 'worker-died']);
const one = (s, n = 220) => clipLine(s, n);










/** sup_events of `kinds` created after `after` (strictly, or at/after with `inclusive`), oldest first, payload parsed. */
function eventsSince(m, kinds, after = 0, { inclusive = false } = {}) {
  return m.db.prepare(`SELECT kind, entity_id, payload_json, created_at FROM sup_events WHERE kind IN (${kinds.map(() => '?').join(',')}) AND created_at${inclusive ? '>=' : '>'}? ORDER BY seq`)
    .all(...kinds, after).map((r) => { let p = null; try { p = fullJson(JSON.parse(r.payload_json ?? 'null')); } catch { p = null; } return { ...r, payload: p ?? {} }; });
}



const actionLine = (i) => {
  let state = 'no action yet';
  if (i.actedAt) {
    state = 'acted ' + hhmm(i.actedAt);
    if (i.heldUntil) state += ' held until ' + hhmm(i.heldUntil);
  }
  const lessons = (i.lessons ?? []).map((lesson) => '\n    lesson: ' + lesson).join('');
  return `OWED-ACTION ${i.breach ? 'SLA-BREACH ' : ''}[${i.class}] ${i.key} age=${i.ageMin}m ${state}: ${i.evidence}\n    do: ${i.do}${lessons}`;
};

/** The longest an action may hold its item out of SLA-BREACH: a hold is re-affirmed at least this often. */
const MAX_HOLD_MS = 12 * 3_600_000;

/**
 * Record one supervisor action (the audit trail every action leaves). `until` (epoch ms) marks a standing ruling that
 * holds the item - it stays out of SLA-BREACH until then, at most MAX_HOLD_MS from now.
 */
export function recordAction({ item, action, reason, workflowId = null, refs = [], until = null, by = 'supervisor', env = process.env, now = Date.now() }) {
  if (!item || !action || !String(reason ?? '').trim()) throw Object.assign(new Error('record needs --item, --action and --reason'), { code: 'action-incomplete' });
  if (until != null && !(Number.isFinite(until) && until > now)) throw Object.assign(new Error('--until/--hold-ms must name a time after now'), { code: 'action-until-invalid' });
  const heldUntil = until == null ? null : Math.min(until, now + MAX_HOLD_MS);
  withSupervisor((m) => supervisorEvent(m, { entityType: 'action', entityId: item, kind: ACTION_KIND, now,
    payload: { item, action, reason: one(reason, 600), workflowId, refs, by, ...(heldUntil ? { until: heldUntil } : {}) } }), { env });
  supLog(actionRow({ item, action, reason: one(reason, 600), workflowId, refs, at: now }), { env });
  return { ok: true, item, action, at: now, ...(heldUntil ? { until: heldUntil } : {}) };
}

/** The newest owed-actions record the tick left: {at, items} or null. */
export const latestOwedActions = ({ env = process.env } = {}) => readSupervisor((m) => newestEvent(m, OWED_ACTIONS_KIND), null, { env });

/* ------------------------------------------------------------ the owner's digest */

// The digest's English sources translate through the i18n catalog (modules/i18n/messages, scripts/lib/i18n.mjs).
const digestTexts = (language) => {
  const tr = translator(language);
  return { head: tr('StarCi supervisor digest'), fixed: tr('Handled'), open: tr('Still being handled'), none: tr('nothing new'), wf: tr('Workflows'), owner: tr('Waiting on you (credentials / handover only)'), unacted: tr('not yet acted on') };
};

const appendDigestContext = (lines, { progress, trend, gc }) => {
  if (progress?.length) lines.push(...progress);
  if (trend) lines.push(trend);
  if (gc) lines.push(gc);
};

const appendDigestTail = (lines, learning, owed, texts) => {
  if (learning?.length) lines.push(...learning);
  if (owed?.ownerWaits?.length) {
    lines.push(`${texts.owner}:`);
    for (const item of owed.ownerWaits) lines.push(`- ${item}`);
  }
};

/** The digest text from the ledger (actions since `since`, the newest owed actions). Pure over its inputs. */
export function digestText({ actions = [], owed = null, learning = [], trend = null, gc = null, progress = [], language = ownerLanguage(), now = Date.now() }) {
  const t = digestTexts(language);
  const lines = [`${t.head} ${stampMinute(now)}`];
  appendDigestContext(lines, { progress, trend, gc });
  const noActions = actions.length ? '' : ` ${t.none}`;
  lines.push(`${t.fixed} (${actions.length}):${noActions}`);
  for (const a of actions.slice(-12)) lines.push(`- ${a.action} ${a.item}: ${one(a.reason, 140)}`);
  const items = owed?.items ?? [];
  const open = items.filter((i) => !i.actedAt);
  lines.push(`${t.open}: ${items.length} (${open.length} ${t.unacted})`);
  const byClass = {};
  for (const i of items) byClass[i.class] = (byClass[i.class] ?? 0) + 1;
  if (items.length) lines.push('  ' + Object.entries(byClass).map(([className, count]) => className + ' ' + count).join(', '));
  if (owed?.workflows?.length) {
    lines.push(`${t.wf}:`);
    for (const w of owed.workflows) {
      const ready = w.ready ? `, ${w.ready} ready` : '';
      lines.push(`- ${w.workflowId}: ${w.state ?? w.error ?? '?'}${ready}`);
    }
  }
  appendDigestTail(lines, learning, owed, t);
  return lines.join('\n');
}

/**
 * Build a read-only preview of the owner's digest. The Owner Notifier owns delivery.
 */
export async function ownerDigest({ env = process.env, now = Date.now(), language = null } = {}) {
  const read = readSupervisor((m) => {
    const last = newestEvent(m, DIGEST_KIND)?.at ?? 0;
    const since = (kind) => eventsSince(m, [kind], last).map((r) => r.payload);
    // What the tick GC collected since the last digest (supervisor-gc events, tick.mjs).
    return { last, actions: since(ACTION_KIND), gcRuns: since('supervisor-gc') };
  }, { last: 0, actions: [], gcRuns: [] }, { env });
  let learning = [];
  try { const l = await import('../machine/lessons.mjs'); learning = l.learningDigest(l.readLearning({ env }), { since: read.last }); } catch { /* the digest goes without it */ }
  const lang = language ?? supervisorSettings().language;
  let trend = null;
  try { trend = await (await import('../machine/op-metrics.mjs')).currentTrend({ env, language: lang }); } catch { /* the digest goes without it */ }
  let progress = [];
  let gc = null;
  if (read.gcRuns?.length) {
    const sum = (k) => read.gcRuns.reduce((n, r) => n + (Number(r[k]) || 0), 0);
    try { gc = (await import('./gc.mjs')).gcLine({ agents: sum('agents'), terminals: sum('terminals'), worktrees: sum('worktrees'), freedBytes: sum('freedBytes'), ramFreedBytes: sum('ramFreedBytes') }, { language: lang }); } catch { gc = null; }
  }
  const text = digestText({ actions: read.actions, owed: latestOwedActions({ env }), learning, trend, gc, progress, language: lang, now });
  return { ok: true, sent: false, text };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const asJson = argv.includes('--json');
  try {
    if (verb === 'list') {
      const r = latestOwedActions() ?? { at: null, items: [] };
      const items = argv.includes('--open') ? (r.items ?? []).filter((i) => !i.actedAt || i.breach) : (r.items ?? []);
      if (asJson) console.log(JSON.stringify({ ...r, items }));
      else {
        console.log(`owed actions of the tick at ${r.at ? new Date(r.at).toISOString() : '(no tick yet)'}: ${items.length} item(s), ${items.filter((i) => i.breach).length} past the SLA`);
        for (const i of items) console.log(actionLine(i));
      }
    } else if (verb === 'record') {
      let until = null;
      const untilText = value('until');
      if (untilText) until = Date.parse(untilText);
      else {
        const holdMs = value('hold-ms');
        if (holdMs) until = Date.now() + Number(holdMs);
      }
      const r = recordAction({ item: value('item'), action: value('action'), reason: value('reason'), workflowId: value('workflow'), refs: (value('refs') ?? '').split(',').filter(Boolean), until });
      const held = r.until ? ` (held until ${new Date(r.until).toISOString()})` : '';
      console.log(asJson ? JSON.stringify(r) : `recorded ${r.action} on ${r.item}${held}`);
    } else if (verb === 'digest') {
      if (argv.includes('--send') || argv.includes('--force')) throw Object.assign(new Error('digest delivery belongs to the Owner Notifier; run digest without --send or --force for a preview'), { code: 'action-incomplete' });
      const r = await ownerDigest();
      console.log(asJson ? JSON.stringify(r) : `${r.text}\n-- preview only; the Owner Notifier sends the owner digest`);
    } else {
      console.error('use: starci supervisor actions list [--json] [--open] | record --item <key> --action <verb> --reason <text> [--workflow <id>] [--refs <csv>] [--until <iso> | --hold-ms <ms>] | digest [--json]');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(`actions: ${error?.message ?? error}`);
    process.exitCode = error?.code === 'action-incomplete' ? 2 : 1;
  }
}
