// status-block.mjs — the [Supervisor] block the Telegram /status adds after the progress report
// (scripts/connectors/telegram-bridge.mjs onStatus; modules/supervisor/supervise.yaml chat): the seat, the OWED
// count and its trend over the last ticks, the active workers (agent, cluster, age), the land-gate queue and the
// last push of each main, and the base pool (Qwen, owner ruling 2026-09-24) with its provider-health circuit
// state across the product ledgers. Read-only; null when the Supervisor was never started.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { withSupervisorRead, seatOf, enabledOf, supervisorMode, SUPERVISOR_WF } from './home.mjs';
import { workerBoard } from './workers.mjs';
import { landStatus } from './land.mjs';
import { probeAll as probeAllQuota } from '../api/quota/index.mjs';
import { machineLedgerFiles } from '../agent/balance.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { inspectOwnerConfig, configRoot } from '../../engine/config.mjs';
import { parseJsonOr as parse, withPayload } from '../lib/json.mjs';

const require = createRequire(import.meta.url);
const SKILL_DIR = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
export const BASE_POOL = 'qwen-agent';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ago = (ms, now) => { const m = Math.max(0, Math.round((now - ms) / 60000)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };

/** Everything the block shows, from the supervisor ledger: {seat, enabled, ticks, board, pushes, lands}. */
export function supervisorSnapshot(db, { now = Date.now() } = {}) {
  const events = (kinds, limit) => db.prepare(`SELECT kind, entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN (${kinds.map(() => '?').join(',')}) ORDER BY seq DESC LIMIT ?`)
    .all(SUPERVISOR_WF, ...kinds, limit).map((e) => withPayload(e));
  const ticks = events(['supervisor-tick'], 6).map((e) => ({ at: e.created_at, owed: e.payload.owed ?? null, clusters: e.payload.clusters ?? null }));
  const pushes = new Map();
  for (const e of events(['push-main', 'push-refused'], 40)) if (!pushes.has(e.entity_id)) pushes.set(e.entity_id, e);
  return { seat: seatOf(db, now), enabled: enabledOf(db), ticks, board: workerBoard(db, { now }), pushes: [...pushes.values()], lands: events(['land-passed', 'land-failed'], 3) };
}

const TEXT = {
  en: { head: 'Supervisor', chat: 'in the owner chat', off: 'disabled', none: 'no seat', owed: 'OWED', trend: 'trend', noTick: 'no tick yet', workers: 'Workers', idle: 'none active',
    queue: 'Land queue', empty: 'empty', landing: 'landing now', pushes: 'Last pushes', lastLand: 'Last land', tick: 'last tick', quota: 'Quota', used: 'used',
    base: 'Base pool', share: 'share', closed: 'circuit closed', open: 'circuit OPEN', inLedgers: (n, of) => `in ${n}/${of} ledger(s)`, until: 'until',
    probe: 'last probe', never: 'not probed yet', ago: 'ago', noLedgers: 'no ledger read' },
  vi: { head: 'Supervisor', chat: 'trong chat của owner', off: 'đang tắt', none: 'chưa có terminal', owed: 'OWED', trend: 'xu hướng', noTick: 'chưa chạy tick này', workers: 'Worker', idle: 'không có worker nào chạy',
    queue: 'Hàng chờ land', empty: 'trống', landing: 'đang land', pushes: 'Lần push gần nhất', lastLand: 'Land gần nhất', tick: 'tick gần nhất', quota: 'Hạn mức', used: 'đã dùng',
    base: 'Pool nền', share: 'tỉ trọng', closed: 'circuit đóng', open: 'circuit MỞ', inLedgers: (n, of) => `ở ${n}/${of} ledger`, until: 'đến',
    probe: 'probe gần nhất', never: 'chưa probe', ago: 'trước', noLedgers: 'chưa đọc được ledger nào' },
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
    if (name === 'qwen') continue; // the base pool is not metered: its line is the base-pool line below
    if (typeof q?.usedPercent !== 'number' || !Number.isFinite(q.usedPercent)) continue;
    const mark = q.state === 'dead' ? ' ⛔' : q.state === 'limited' ? ' ⚠' : '';
    const resetAt = Date.parse(q.resetsAt ?? '');
    const reset = Number.isFinite(resetAt) ? ` ↻${new Date(resetAt).toISOString().slice(5, 16).replace('T', ' ')}Z` : '';
    parts.push(`${esc(name)} ${Math.round(q.usedPercent)}% ${t.used}${mark}${esc(reset)}`);
  }
  return parts.length ? `📶 ${t.quota}: ${parts.join(' · ')}` : null;
}

const openReadOnly = (file) => { const { DatabaseSync } = require('node:sqlite'); return new DatabaseSync(file, { readOnly: true }); };
const shortIso = (ms) => new Date(ms).toISOString().slice(5, 16).replace('T', ' ') + 'Z';

/**
 * The base pool's state for /status: {pool, provider, model, sharePercent, ledgers, open:[{ledger, failureKind,
 * expiresAt, observedAt, probe}]}. The circuit is the provider-health row of each product ledger the machine
 * arbiter registered (`files` overrides the list for specs); an unreadable ledger is skipped.
 */
export function basePoolState({ env = process.env, now = Date.now(), files = undefined, config = undefined, runtimes = undefined } = {}) {
  let rt = runtimes;
  if (rt === undefined) { try { rt = parseYaml(fs.readFileSync(path.join(SKILL_DIR, 'modules', 'models', 'runtimes.yaml'), 'utf8')); } catch { rt = null; } }
  const card = rt?.runtimes?.[BASE_POOL] ?? {};
  const provider = card.provider ?? 'qwen';
  let cfg = config;
  if (cfg === undefined) { try { cfg = inspectOwnerConfig(configRoot).config; } catch { cfg = null; } }
  const shares = cfg?.allocation?.shares ?? null;
  const total = Object.values(shares ?? {}).reduce((sum, v) => sum + (Number(v) > 0 ? Number(v) : 0), 0);
  const sharePercent = total > 0 ? Math.round((Math.max(0, Number(shares?.[BASE_POOL] ?? 0)) / total) * 100) : null;
  const list = files ?? machineLedgerFiles({ env });
  const open = [];
  let read = 0;
  for (const file of list) {
    let db = null;
    try {
      db = openReadOnly(file);
      read += 1;
      const row = db.prepare("SELECT value_json,expires_at FROM signals WHERE scope='provider-health' AND key=?").get(provider);
      if (!row || (row.expires_at != null && row.expires_at <= now)) continue;
      const value = parse(row.value_json);
      if (value.status !== 'unavailable') continue;
      open.push({ ledger: file, failureKind: value.failureKind ?? 'auth', expiresAt: row.expires_at ?? null, observedAt: value.observedAt ?? null,
        probe: value.quotaProbe ? { at: value.quotaProbe.at, state: value.quotaProbe.state } : null });
    } catch { /* unreadable ledger */ } finally { try { db?.close(); } catch { /* read-only */ } }
  }
  const models = Object.values(card.models ?? {});
  return { pool: BASE_POOL, provider, model: models[0] ?? null, sharePercent, ledgers: read, open };
}

/** The base-pool line: pool, model, share, circuit state (open: in how many ledgers, why, until when, last probe). */
export function renderBasePoolLine(base, { language = 'en', now = Date.now() } = {}) {
  if (!base) return null;
  const t = TEXT[language] ?? TEXT.en;
  const head = `${esc(base.pool)}${base.model ? ` (${esc(base.model)})` : ''}${base.sharePercent != null ? ` · ${t.share} ${base.sharePercent}%` : ''}`;
  if (!base.open?.length) return `🟢 ${t.base}: ${head} · ${t.closed}${base.ledgers ? '' : ` (${t.noLedgers})`}`;
  const kinds = [...new Set(base.open.map((o) => o.failureKind))].join('/');
  const until = Math.max(...base.open.map((o) => Number(o.expiresAt) || 0));
  const probes = base.open.map((o) => o.probe).filter((p) => Number.isFinite(Number(p?.at)));
  const last = probes.sort((a, b) => b.at - a.at)[0] ?? null;
  const probe = last ? `${t.probe} ${ago(last.at, now)} ${t.ago} (${esc(last.state ?? '?')})` : t.never;
  return `⛔ ${t.base}: ${head} · ${t.open} (${esc(kinds)}) ${t.inLedgers(base.open.length, base.ledgers)}${until ? ` ${t.until} ${shortIso(until)}` : ''} · ${probe}`;
}

/** The block as Telegram HTML, or null. `quota` is a probeAll() result map (null/absent hides the line). */
export function renderSupervisorBlock(snap, { language = 'en', land = { busy: false, current: null }, now = Date.now(), quota = null, base = null } = {}) {
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
  const baseLine = renderBasePoolLine(base, { language, now });
  if (baseLine) lines.push(baseLine);
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
export function supervisorStatusMessage({ language = 'en', env = process.env, now = Date.now(), quota = undefined, base = undefined } = {}) {
  if ((env.NODE_TEST_CONTEXT || process.env.NODE_TEST_CONTEXT) && !env.STARCI_SUPERVISOR_HOME) return null;
  const read = withSupervisorRead((db) => supervisorSnapshot(db, { now }), null, { env });
  const snap = read ? { ...read, mode: supervisorMode({ env }) } : null;
  // The provider quota line: a live probeAll() unless the caller injected one;
  // a probing failure just drops the line.
  let q = quota;
  if (q === undefined) { try { q = probeAllQuota({ env }); } catch { q = null; } }
  let b = base;
  if (b === undefined) { try { b = basePoolState({ env, now }); } catch { b = null; } }
  return renderSupervisorBlock(snap, { language, land: landStatus({ env }), now, quota: q, base: b });
}
