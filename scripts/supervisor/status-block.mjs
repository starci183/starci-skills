// status-block.mjs — the [Supervisor] block the Telegram /status adds after the progress report
// (scripts/supervisor/telegram-bridge.mjs onStatus; modules/supervisor/supervise.yaml chat): the seat, the OWED
// count and its trend over the last ticks, the active workers (agent, cluster, age), the land-gate queue and the
// last push of each main. Read-only over machine.sqlite; null when it does not exist yet.
import path from 'node:path';
import { readSupervisor, seatOf, enabledOf, supervisorMode } from '../machine/home.mjs';
import { workerBoard } from './workers.mjs';
import { landStatus } from './land.mjs';
import { probeAll as probeAllQuota } from '../agent/quota/index.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { fmtAgo as ago, stampMinuteShort as shortIso } from '../lib/time.mjs';


const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Everything the block shows, from machine.sqlite over the machine handle `m` (seats row 'supervisor', sup_signals,
 * sup_events ticks, pushes, land_runs, the [Worker] board): {seat, enabled, ticks, board, pushes, lands}.
 */
export function supervisorSnapshot(m, { now = Date.now() } = {}) {
  const events = (kinds, limit) => m.supEvents({ kinds, limit }).map((e) => ({ kind: e.kind, entity_id: e.entity_id, created_at: e.created_at, payload: e.payload ?? {} }));
  const ticks = events(['supervisor-tick'], 6).map((e) => ({ at: e.created_at, owed: e.payload.owed ?? null, clusters: e.payload.clusters ?? null }));
  // The newest push per repository (machine.sqlite pushes) and the newest land-gate runs (land_runs).
  const pushes = new Map();
  for (const p of m.pushes({ limit: 40 })) {
    if (pushes.has(p.repo_root) || p.result === 'skipped') continue;
    pushes.set(p.repo_root, { kind: p.result === 'pushed' ? 'push-main' : 'push-refused', entity_id: p.repo_root, created_at: p.at,
      payload: { head: p.head, refused: p.result === 'pushed' ? null : (p.failure_signature ?? p.reason) } });
  }
  const lands = m.landRuns({ limit: 3 }).map((r) => ({ kind: r.result === 'passed' ? 'land-passed' : 'land-failed', entity_id: r.lane ?? r.commit_sha,
    created_at: r.finished_at ?? r.started_at, payload: { landed: r.landed_sha, lane: r.lane, reason: r.reason } }));
  return { seat: seatOf(m, now), enabled: enabledOf(m), ticks, board: workerBoard(m, { now }), pushes: [...pushes.values()], lands };
}

const TEXT = {
  en: { head: 'Supervisor', chat: 'in the owner chat', off: 'disabled', none: 'no seat', owed: 'OWED', trend: 'trend', noTick: 'no tick yet', workers: 'Workers', idle: 'none active',
    queue: 'Land queue', empty: 'empty', landing: 'landing now', pushes: 'Last pushes', lastLand: 'Last land', tick: 'last tick', quota: 'Quota', used: 'used' },
  vi: { head: 'Supervisor', chat: 'trong chat của owner', off: 'đang tắt', none: 'chưa có terminal', owed: 'OWED', trend: 'xu hướng', noTick: 'chưa chạy tick này', workers: 'Worker', idle: 'không có worker nào chạy',
    queue: 'Hàng chờ land', empty: 'trống', landing: 'đang land', pushes: 'Lần push gần nhất', lastLand: 'Land gần nhất', tick: 'tick gần nhất', quota: 'Hạn mức', used: 'đã dùng' },
};

/**
 * One Quota line from a probeAll() result map: providers whose probe saw a
 * usedPercent render `name NN% used ↻MM-DD HH:mm` (the next reset), with ⛔ on
 * 'dead' and ⚠ on 'limited'. Providers with no number are skipped; nothing is
 * rendered when no provider reports a figure.
 */
export function renderQuotaLine(quota, { language = 'en' } = {}) {
  const t = TEXT[language] ?? TEXT.en;
  const parts = [];
  for (const [name, q] of Object.entries(quota ?? {})) {
    if (typeof q?.usedPercent !== 'number' || !Number.isFinite(q.usedPercent)) continue;
    const mark = q.state === 'dead' ? ' ⛔' : q.state === 'limited' ? ' ⚠' : '';
    const resetAt = Date.parse(q.resetsAt ?? '');
    const reset = Number.isFinite(resetAt) ? ` ↻${shortIso(resetAt)}` : '';
    parts.push(`${esc(name)} ${Math.round(q.usedPercent)}% ${t.used}${mark}${esc(reset)}`);
  }
  return parts.length ? `📶 ${t.quota}: ${parts.join(' · ')}` : null;
}


/** The block as Telegram HTML, or null. `quota` is a probeAll() result map (null/absent hides the line). */
export function renderSupervisorBlock(snap, { language = 'en', land = { busy: false, current: null }, now = Date.now(), quota = null } = {}) {
  if (!snap) return null;
  const t = TEXT[language] ?? TEXT.en;
  const lines = [];
  const seat = snap.seat?.value?.terminal ? `${esc(snap.seat.value.agent ?? '')} ${esc(snap.seat.value.terminal.slice(0, 13))}…` : t.none;
  // chat mode (config.yaml supervisor.mode): the owner's chat is the Supervisor; there is no seat to show.
  lines.push(`<b>🧭 ${t.head}</b> — ${snap.mode === 'chat' ? t.chat : snap.enabled === false ? t.off : seat}`);
  const [last, ...older] = snap.ticks;
  if (last) {
    const series = [...snap.ticks].reverse().map((x) => x.owed ?? '?').join(' → ');
    const prev = older[0]?.owed;
    const arrow = prev == null || last.owed == null ? '' : last.owed > prev ? ' ↑' : last.owed < prev ? ' ↓' : ' =';
    lines.push(`${t.owed}: <b>${esc(last.owed ?? '?')}</b>${arrow}${last.clusters != null ? ` (${esc(last.clusters)} cluster)` : ''} · ${t.trend} ${esc(series)} · ${t.tick} ${ago(last.at, now)}`);
  } else lines.push(`${t.owed}: ${t.noTick}`);
  const quotaLine = renderQuotaLine(quota, { language });
  if (quotaLine) lines.push(quotaLine);
  const active = snap.board.active;
  lines.push(`${t.workers} (${active.length}): ${active.length ? '' : t.idle}`);
  for (const w of active) lines.push(`  • ${esc(w.agent ?? '?')} — ${esc(w.cluster)} — ${esc(w.ageMin)}m`);
  const queue = snap.board.reported;
  lines.push(`${t.queue}: ${land.busy ? `${t.landing} ${esc(land.current?.jobId ?? (land.current?.commits ?? []).map((c) => String(c).slice(0, 9)).join(','))}; ` : ''}${queue.length ? queue.map((q) => esc(q.jobId)).join(', ') : (land.busy ? '' : t.empty)}`);
  if (snap.lands[0]) lines.push(`${t.lastLand}: ${snap.lands[0].kind === 'land-passed' ? '✅' : '❌'} ${esc(snap.lands[0].entity_id).slice(0, 40)} ${ago(snap.lands[0].created_at, now)}`);
  if (snap.pushes.length) {
    lines.push(`${t.pushes}:`);
    for (const p of snap.pushes) lines.push(`  • ${esc(path.basename(p.entity_id))} ${p.kind === 'push-main' ? `✅ ${esc(p.payload.head ?? '')}` : `❌ ${esc(String(p.payload.refused ?? p.payload.error ?? '').slice(0, 80))}`} ${ago(p.created_at, now)}`);
  }
  return lines.join('\n');
}

/**
 * The /status block for `language`, or null (machine.sqlite not created yet or unreadable, or a spec run whose `env`
 * names no test machine.sqlite).
 */
export function supervisorStatusMessage({ language = 'en', env = process.env, now = Date.now(), quota = undefined } = {}) {
  if ((env.NODE_TEST_CONTEXT || process.env.NODE_TEST_CONTEXT) && !env[TEST_REGISTRY_ENV]) return null;
  const read = readSupervisor((m) => supervisorSnapshot(m, { now }), null, { env });
  const snap = read ? { ...read, mode: supervisorMode({ env }) } : null;
  // The provider quota line: a live probeAll() unless the caller injected one;
  // a probing failure just drops the line.
  let q = quota;
  if (q === undefined) { try { q = probeAllQuota({ env }); } catch { q = null; } }
  return renderSupervisorBlock(snap, { language, land: landStatus({ env }), now, quota: q });
}
