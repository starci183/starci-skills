// status-block.mjs — the [Supervisor] block the Telegram /status adds after the progress report
// (scripts/connectors/telegram-bridge.mjs onStatus; modules/supervisor/supervise.yaml chat): the seat, the OWED
// count and its trend over the last ticks, the active workers (agent, cluster, age), the land-gate queue and the
// last push of each main. Read-only; null when the Supervisor was never started.
import path from 'node:path';
import { withSupervisorRead, seatOf, enabledOf, SUPERVISOR_WF } from './home.mjs';
import { workerBoard } from './workers.mjs';
import { landStatus } from './land.mjs';
import { probeAll as probeAllQuota } from '../api/quota/index.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const parse = (t) => { try { return JSON.parse(t ?? '') ?? {}; } catch { return {}; } };
const ago = (ms, now) => { const m = Math.max(0, Math.round((now - ms) / 60000)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };

/** Everything the block shows, from the supervisor ledger: {seat, enabled, ticks, board, pushes, lands}. */
export function supervisorSnapshot(db, { now = Date.now() } = {}) {
  const events = (kinds, limit) => db.prepare(`SELECT kind, entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN (${kinds.map(() => '?').join(',')}) ORDER BY seq DESC LIMIT ?`)
    .all(SUPERVISOR_WF, ...kinds, limit).map((e) => ({ ...e, payload: parse(e.payload_json) }));
  const ticks = events(['supervisor-tick'], 6).map((e) => ({ at: e.created_at, owed: e.payload.owed ?? null, clusters: e.payload.clusters ?? null }));
  const pushes = new Map();
  for (const e of events(['push-main', 'push-refused'], 40)) if (!pushes.has(e.entity_id)) pushes.set(e.entity_id, e);
  return { seat: seatOf(db, now), enabled: enabledOf(db), ticks, board: workerBoard(db, { now }), pushes: [...pushes.values()], lands: events(['land-passed', 'land-failed'], 3) };
}

const TEXT = {
  en: { head: 'Supervisor', off: 'disabled', none: 'no seat', owed: 'OWED', trend: 'trend', noTick: 'no tick yet', workers: 'Workers', idle: 'none active',
    queue: 'Land queue', empty: 'empty', landing: 'landing now', pushes: 'Last pushes', lastLand: 'Last land', tick: 'last tick', quota: 'Quota', used: 'used' },
  vi: { head: 'Supervisor', off: 'đang tắt', none: 'chưa có terminal', owed: 'OWED', trend: 'xu hướng', noTick: 'chưa chạy tick này', workers: 'Worker', idle: 'không có worker nào chạy',
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
    const reset = Number.isFinite(resetAt) ? ` ↻${new Date(resetAt).toISOString().slice(5, 16).replace('T', ' ')}Z` : '';
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
  lines.push(`<b>🧭 ${t.head}</b> — ${snap.enabled === false ? t.off : seat}`);
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

/** The /status block for `language`, or null (never started, or a spec run without its own supervisor home). */
export function supervisorStatusMessage({ language = 'en', env = process.env, now = Date.now(), quota = undefined } = {}) {
  if ((env.NODE_TEST_CONTEXT || process.env.NODE_TEST_CONTEXT) && !env.STARCI_SUPERVISOR_HOME) return null;
  const snap = withSupervisorRead((db) => supervisorSnapshot(db, { now }), null, { env });
  // The provider quota line: a live probeAll() unless the caller injected one;
  // a probing failure just drops the line.
  let q = quota;
  if (q === undefined) { try { q = probeAllQuota({ env }); } catch { q = null; } }
  return renderSupervisorBlock(snap, { language, land: landStatus({ env }), now, quota: q });
}
