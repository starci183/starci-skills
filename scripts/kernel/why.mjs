// why.mjs — the owner-facing reason an attempt failed, was blocked, refused, is waiting or was requeued.
//
// Pure and read-only: every function takes an open ledger handle (or its `db`) and reads; nothing here writes, so the
// harness UI imports it exactly like scripts/kernel/progress-state.mjs. The runtime persists the result in
// op_attempts.why_json at settle / dispatch-reject time (`computeWhy` + updateAttempt); `whyOf` returns the stored value
// and computes the same value for a row that has none (an attempt settled before why existed, a read-only opener).
//
// Shape (starci/why@1, docs/why.md):
//   { schema, lang:'vi', state, headline, cause, disagreement|null, next, owner, codes[], refs[], attemptId, opId, tryNo }
// The Vietnamese text comes from modules/kernel/failure-codes.yaml (a flat map keyed by code) and from the ledger rows
// the settle judged: check_runs, the filed report, settle_json. The language is the owner's config.yaml `language`; the
// catalog carries Vietnamese only, so the text is Vietnamese.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { blobPath } from '../lib/artifact-store.mjs';
import { parseJson } from '../lib/json.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WHY_SCHEMA = 'starci/why@1';
export const WHY_STATES = Object.freeze(['failed', 'blocked', 'awaiting-owner', 'dispatch-rejected', 'requeued', 'worker-dead', 'cancelled', 'waiting-settle']);
const CATALOG_PATH = path.join(root, 'modules', 'kernel', 'failure-codes.yaml');

let catalogCache = null;
/** The catalog: a flat map code -> {title, title_vi, meaning_vi, causes_vi[], nextStep_vi, owner, kind}. */
export function loadCatalog(file = CATALOG_PATH) {
  if (file === CATALOG_PATH && catalogCache) return catalogCache;
  const catalog = parseYaml(fs.readFileSync(file, 'utf8')) ?? {};
  if (file === CATALOG_PATH) catalogCache = catalog;
  return catalog;
}

/** One code explained: the catalog entry, or {code, known:false} for a code the catalog does not carry. */
export function explainCode(code, catalog = loadCatalog()) {
  const e = catalog[code];
  return e ? { code, known: true, ...e } : { code, known: false, title_vi: code, meaning_vi: null, nextStep_vi: null, owner: 'runtime-core', kind: null };
}

const clip = (s, n = 220) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
/** A Windows or POSIX absolute path shortened to its last three segments (the owner reads names, not temp roots). */
const shortPaths = (s) => String(s ?? '').replace(/(?:[A-Za-z]:)?[\\/](?:[^\s"'\\/:*?<>|]+[\\/])+([^\s"'\\/:*?<>|]+[\\/][^\s"'\\/:*?<>|]+[\\/][^\s"'\\/:*?<>|]+|[^\s"'\\/:*?<>|]+)/g, '…/$1').replace(/\\/g, '/');
const BRACKET = /\[([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\]/g;
const uniq = (list) => [...new Set(list.filter((x) => typeof x === 'string' && x))];
const many = (db, sql, ...args) => db.prepare(sql).all(...args);
const one = (db, sql, ...args) => db.prepare(sql).get(...args) ?? null;

/* ------------------------------------------------------------ what a red check said */

const readBlobText = (sha, limit = 256 * 1024) => {
  if (!sha) return null;
  try {
    const file = blobPath(sha);
    if (!file) return null;
    const fd = fs.openSync(file, 'r');
    try { const buf = Buffer.alloc(Math.min(limit, fs.fstatSync(fd).size)); fs.readSync(fd, buf, 0, buf.length, 0); return buf.toString('utf8'); } finally { fs.closeSync(fd); }
  } catch { return null; }
};

/**
 * Parse one check_runs row into {name, runner, authority, status, exit, declaredExit, codes[], lines[], failing[], evidence}.
 * `codes`/`lines` come from summary_json (codes, evidence, failing) and from the check's stdout/output blob
 * (a refused[] / findings[] list, or `[CODE]` tokens in plain text).
 */
export function checkFacts(row, readBlob = readBlobText) {
  const summary = parseJson(row.summary_json, null) ?? {};
  const codes = [...(Array.isArray(summary.codes) ? summary.codes : [])];
  const lines = [];
  const take = (text) => { for (const m of String(text ?? '').matchAll(BRACKET)) codes.push(m[1]); };
  const evidence = typeof summary.evidence === 'string' ? summary.evidence : typeof summary.entry?.evidence === 'string' ? summary.entry.evidence : null;
  if (evidence) take(evidence);
  if (RED.has(row.status) && /not re-verifiable/i.test(evidence ?? '')) codes.push('check-not-reverifiable');
  if (row.status === 'unavailable') codes.push('check-status:unavailable');
  for (const sha of [row.output_sha, row.stdout_sha]) {
    const text = readBlob(sha);
    if (!text) continue;
    const doc = parseJson(text, null);
    if (doc && typeof doc === 'object') {
      for (const item of [...(Array.isArray(doc.refused) ? doc.refused : []), ...(Array.isArray(doc.findings) ? doc.findings : [])]) {
        const line = typeof item === 'string' ? item : item?.detail ?? item?.message ?? item?.text ?? '';
        if (typeof item === 'object' && item?.code) codes.push(item.code);
        if (line) { lines.push(String(line)); take(line); }
      }
      if (Array.isArray(doc.codes)) codes.push(...doc.codes);
      if (doc.status === 'unavailable') { codes.push('check-status:unavailable'); lines.push(String(doc.reason ?? doc.message ?? 'checker unavailable on this machine')); }
      for (const issue of Array.isArray(doc.issues) ? doc.issues : []) if (issue?.code) { codes.push(issue.code); if (issue.detail || issue.message) lines.push(String(issue.detail ?? issue.message)); }
    } else {
      const first = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 5);
      for (const l of first) { lines.push(l); take(l); }
    }
    if (lines.length) break;
  }
  return {
    name: row.name, runner: row.runner, authority: row.authority, status: row.status, phase: row.phase,
    exit: row.exit_code ?? null, declaredExit: row.declared_exit_code ?? null,
    codes: uniq(codes), lines, failing: Array.isArray(summary.failing) ? summary.failing : [], evidence,
  };
}

const RED = new Set(['fail', 'error']);

/** Catalog kebab codes named as whole tokens in a check's evidence text (a parity reason, a settle reason). */
const kebabTokens = (text, catalog) => [...new Set(String(text).match(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g) ?? [])].filter((t) => catalog[t]);

/* ------------------------------------------------------------ the sentence builders */

const isScratch = (text) => /starci-job-scratch/i.test(String(text ?? ''));
const scratchNote = 'thư mục tạm của op (starci-job-scratch) đã bị xóa khi op nộp report, nên lúc runtime chạy lại đường dẫn đó không còn';

/** The one-line human reading of a red check: its first refused line without absolute paths, else its evidence. */
function checkDetail(fact) {
  if (fact.lines.length && fact.lines.some(isScratch) && fact.codes.includes('TARGET_MISSING')) return scratchNote;
  const raw = fact.lines[0] ?? fact.evidence ?? '';
  return clip(shortPaths(raw).replace(/\s*\[[A-Z][A-Z0-9_]+\]\s*$/, ''), 200);
}

const nextTry = (unit, tryNo) => (unit ? `lần ${Number(tryNo) + 1}/${unit.try_budget}` : `lần ${Number(tryNo) + 1}`);

/** What happens now, from the recorded next step of the failed job (enqueueNextStep) and the unit's try budget. */
function nextOf({ step, unit, tryNo, primary, catalog }) {
  const c = primary ? catalog[primary] : null;
  if (step?.kind === 'retry') return { text: `Kernel sẽ giao lại op (${nextTry(unit, tryNo)}${step.limit ? `, tuyến ${step.route} ${step.firing}/${step.limit}` : ''}).`, owner: 'op-retry' };
  if (step?.kind === 'repair') return { text: `Kernel giao op sửa gốc lỗi trước rồi chạy lại op này (tuyến ${step.route}${step.jobs?.length ? `, ${step.jobs.length} job` : ''}).`, owner: step.owner?.op ? `other-op:${step.owner.op}` : 'runtime-core' };
  if (step?.kind === 'owner-gate') return { text: `Chờ owner quyết định: ${clip(step.reason ?? step.classReason, 200)}`, owner: 'owner' };
  if (step?.kind === 'supervisor-gate') return { text: `Chờ Supervisor xử lý sự cố ${step.incidentId ?? ''}: ${clip(step.reason, 200)}`.trim(), owner: 'supervisor' };
  if (step?.kind === 'peer-blocked' || step?.kind === 'root-elsewhere') return { text: `Gốc lỗi nằm ở nơi khác${step.rootCause ? ` (${clip(typeof step.rootCause === 'string' ? step.rootCause : JSON.stringify(step.rootCause), 120)})` : ''}; op này không tốn lượt thử, chờ bên đó sửa.`, owner: 'runtime-core' };
  if (step?.kind === 'deferred') return { text: `Hoãn tới buổi duyệt cuối: ${clip(step.reason, 200)}`, owner: 'owner' };
  if (step?.kind === 'none') return { text: `Không có bước tiếp tự động: ${clip(step.reason, 200)}`, owner: 'supervisor' };
  if (unit && Number(unit.tries) >= Number(unit.try_budget)) return { text: `Đã dùng hết ${unit.try_budget} lần thử của việc này; chờ owner hoặc Supervisor quyết định.`, owner: 'owner' };
  if (c?.nextStep_vi) return { text: c.nextStep_vi, owner: c.owner };
  return { text: 'Kernel sẽ quyết định bước tiếp theo.', owner: 'runtime-core' };
}

const REFS = (attempt, checks, report) => {
  const refs = [];
  for (const c of checks) refs.push({ kind: 'check', name: c.name, runner: c.runner, status: c.status });
  if (report?.reportId != null) refs.push({ kind: 'report', reportId: report.reportId });
  if (attempt.head_sha) refs.push({ kind: 'commit', sha: attempt.head_sha });
  return refs;
};

const catalogLine = (code, catalog) => {
  const e = catalog[code];
  return e ? `${e.title_vi}: ${e.meaning_vi}` : null;
};

/**
 * The why of one attempt from already-read facts. `ctx`: {attempt, checks[] (checkFacts), report (row {report_id, report_json}|null),
 * settle (parsed settle_json), unit (work_units row|null), catalog}. Returns null for an attempt that needs no explanation
 * (passed, or still running).
 */
export function buildWhy(ctx) {
  const { attempt, unit = null, catalog = loadCatalog() } = ctx;
  const checks = ctx.checks ?? [];
  const settle = ctx.settle ?? {};
  const rep = ctx.report ? parseJson(ctx.report.report_json, {}) : {};
  const outcome = attempt.report_outcome ?? rep.outcome ?? null;
  const step = settle.nextStep ?? parseJson(attempt.next_step, null);
  const base = { schema: WHY_SCHEMA, lang: 'vi', attemptId: attempt.attempt_id, opId: attempt.op_id, tryNo: attempt.try_no };
  const reportRef = ctx.report ? { reportId: ctx.report.report_id } : null;
  // Key order is the reading order: headline first (a reader that prints one line prints the headline).
  const done = (state, headline, cause, disagreement, next, owner, codes, extraRefs = []) => ({
    headline, state, cause, disagreement: disagreement ?? null, next, owner,
    codes: uniq(codes), refs: [...REFS(attempt, checks.filter((c) => RED.has(c.status) || c.authority === 'runtime'), reportRef), ...extraRefs],
    ...base,
  });

  // Passed, or still running: nothing to explain.
  if (attempt.verdict === 'pass') return null;

  // A refused launch: the host would not start the op; nothing ran, no try is spent.
  if (settle.reason === 'dispatch-rejected' || (attempt.end_state && ['requeued', 'effect-unknown'].includes(attempt.end_state) && settle.step)) {
    const codes = [settle.signal, settle.reason === 'dispatch-rejected' ? 'dispatch-rejected' : null].filter(Boolean);
    const unknownEffect = attempt.end_state === 'effect-unknown';
    return done(unknownEffect ? 'requeued' : 'dispatch-rejected',
      `Không khởi chạy được op${settle.step ? ` (bước ${settle.step}${settle.signal ? `, ${settle.signal}` : ''})` : ''}; runtime từ chối lúc giao việc.`,
      clip(shortPaths(settle.detail ?? settle.message ?? settle.error ?? 'không có chi tiết'), 260) + (catalogLine(settle.signal, catalog) ? ` — ${catalogLine(settle.signal, catalog)}` : ''),
      null,
      unknownEffect ? 'Có thể worker đã chạy được một phần: reconcile kiểm chứng trạng thái trước khi giao lại; không tính vào số lần thử.' : 'Không tính vào số lần thử; việc quay về hàng chờ và Kernel giao lại.',
      catalog[settle.signal]?.owner ?? 'runtime-core', codes);
  }
  if (attempt.end_state === 'worker-dead') {
    return done('worker-dead', 'Worker của op chết giữa chừng, không nộp được kết quả.',
      settle.reason ? clip(settle.reason) : 'Terminal hoặc tiến trình của worker biến mất trước khi op nộp report.', null,
      'Reconcile dọn lease và giao lại op; Kernel sẽ chạy lại.', 'runtime-core', [settle.reason ?? 'worker-died-no-report']);
  }
  if (attempt.end_state === 'requeued') {
    return done('requeued', 'Lần chạy này bị hủy và xếp lại hàng chờ, chưa có phán quyết.', clip(settle.reason ?? 'runtime xếp lại việc sau khi worker không còn'), null,
      'Việc quay về hàng chờ; Kernel giao lại, không tính vào số lần thử.', 'runtime-core', [settle.reason]);
  }
  if (attempt.end_state === 'cancelled' || attempt.verdict === 'cancelled' || attempt.verdict === 'dropped') {
    return done('cancelled', 'Lần chạy này đã bị hủy.', clip(settle.reason ?? 'workflow bị lưu trữ hoặc việc bị bỏ'), null, 'Không có bước tiếp theo cho lần chạy này.', 'runtime-core', [settle.reason]);
  }

  // Waiting on the owner: the op ended with a question.
  if (attempt.verdict === 'blocked' && outcome === 'ask') {
    const q = rep.question?.text ?? '';
    return done('awaiting-owner', `Op dừng lại để hỏi owner${q ? `: ${clip(q, 200)}` : '.'}`,
      'Op cần một quyết định hoặc thông tin mà chỉ owner có; đây là chờ, không phải lỗi.', null,
      'Chờ owner trả lời. Trả lời xong Kernel giao lại op; lần hỏi này không tính vào số lần thử.', 'owner', []);
  }

  // Blocked by what the op itself declared.
  if (attempt.verdict === 'blocked') {
    const b = rep.blocker ?? {};
    const kindKey = b.kind ? `blocker:${b.kind}` : null;
    const found = uniq([...String(b.detail ?? '').matchAll(BRACKET)].map((m) => m[1]).concat([...String(b.detail ?? '').matchAll(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g)].map((m) => m[1]).filter((c) => catalog[c])));
    const primary = found[0] ?? kindKey;
    const kindEntry = kindKey ? catalog[kindKey] : null;
    const next = nextOf({ step, unit, tryNo: attempt.try_no, primary: kindKey, catalog });
    return done('blocked',
      `Op báo bị chặn${kindEntry ? ` (${kindEntry.title_vi.replace(/^Bị chặn:\s*/, '')})` : ''}: ${clip(shortPaths(b.detail ?? rep.summary ?? ''), 230)}`,
      [kindEntry?.meaning_vi, found.length ? `Mã liên quan: ${found.slice(0, 4).map((c) => `${catalog[c]?.title_vi ?? c} (${c})`).join('; ')}.` : null].filter(Boolean).join(' ') || 'Op khai báo không thể tiếp tục.',
      null, next.text, kindEntry?.owner ?? next.owner, [kindKey, ...found].filter((c) => c && (catalog[c] || c === primary)));
  }

  // Failed: the runtime's verdict is fail.
  if (attempt.verdict === 'fail' || attempt.verdict === 'partial') {
    const runtimeRed = checks.filter((c) => c.authority === 'runtime' && RED.has(c.status));
    const declaredRed = checks.filter((c) => c.authority === 'declared' && RED.has(c.status));
    const claimOverruled = settle.claimOverruled === true || (outcome === 'done' && attempt.verdict === 'fail');
    const red = runtimeRed[0] ?? declaredRed[0] ?? null;
    const codes = uniq([...(red?.codes ?? []), ...runtimeRed.slice(1).flatMap((c) => c.codes)]);
    const primary = codes.find((c) => catalog[c]) ?? codes[0] ?? null;
    const next = nextOf({ step, unit, tryNo: attempt.try_no, primary, catalog });
    const detail = red ? checkDetail(red) : '';
    const codeTag = primary ? ` (${primary})` : '';
    if (!ctx.report && outcome == null) {
      return done('failed', 'Op kết thúc mà không nộp report, nên runtime chấm thất bại.',
        settle.reason ? clip(settle.reason) : 'Worker dừng hoặc thoát trước khi nộp báo cáo.', null, next.text, next.owner === 'op-retry' ? 'op-retry' : next.owner, ['worker-died-no-report']);
    }
    if (claimOverruled && red) {
      const own = checks.find((c) => c.name === red.name && c.authority === 'declared');
      const declared = own?.declaredExit ?? red.declaredExit ?? null;
      const disagreement = declared != null && declared !== 0
        ? `Op báo xong nhưng chính check ${red.name} nó khai đã thoát ${declared} (đỏ)${red.authority === 'runtime' ? `; runtime chạy lại cũng thoát ${red.exit ?? declared}` : ''}${detail ? `: ${detail}` : ''}.`
        : `Op khai check ${red.name} thoát 0 (xanh) khi chạy trong thư mục làm việc của nó; runtime chạy lại sau khi report được nộp thì thoát ${red.exit ?? 1}${detail ? `: ${detail}` : ''}.`;
      return done('failed',
        `Op báo xong nhưng runtime ${red.authority === 'runtime' ? 'chạy lại' : 'đọc lại'} check ${red.name} thì đỏ${codeTag}.`,
        [detail ? `${detail.charAt(0).toUpperCase()}${detail.slice(1)}${detail.endsWith('.') ? '' : '.'}` : null, primary ? catalogLine(primary, catalog) : null].filter(Boolean).join(' ') || 'Check độc lập của runtime không đạt.',
        disagreement, next.text, primary && catalog[primary] ? (next.owner === 'op-retry' ? catalog[primary].owner : next.owner) : next.owner, codes);
    }
    if (settle.peerBlocked) {
      const peers = (settle.peerBlocked.peers ?? []).join(', ');
      return done('failed', 'Check đỏ vì thay đổi của workflow khác, không phải lỗi của op này.',
        `Các check đỏ (${(settle.peerBlocked.checks ?? []).join(', ')}) do thay đổi của ${peers || 'một peer'}.`, null,
        'Chờ bên kia sửa; lần này không tốn lượt thử.', 'runtime-core', codes);
    }
    const said = outcome === 'failed' ? 'Op tự báo thất bại' : outcome === 'partial' ? 'Op chỉ làm được một phần' : `Runtime chấm thất bại (op báo ${outcome ?? 'không rõ'})`;
    return done('failed', `${said}${red ? `; check ${red.name} đỏ${codeTag}` : ''}: ${clip(shortPaths(rep.summary ?? detail ?? ''), 200)}`.replace(/: $/, '.'),
      [detail ? `${detail.charAt(0).toUpperCase()}${detail.slice(1)}${detail.endsWith('.') ? '' : '.'}` : null, primary ? catalogLine(primary, catalog) : null,
        settle.failureClass?.reason ? `Phân loại: ${settle.failureClass.class} — ${clip(settle.failureClass.reason, 160)}` : null].filter(Boolean).join(' ') || 'Runtime không tìm thấy check nào đạt cho lần chạy này.',
      null, next.text, next.owner, codes.length ? codes : (settle.failureClass?.class ? [`failure-class:${settle.failureClass.class}`] : []));
  }

  // Reported, not yet judged: a wait.
  if (attempt.settled_at == null && (attempt.reported_at != null || outcome)) {
    return done('waiting-settle', 'Op đã nộp report và đang chờ runtime hoặc Kernel phán quyết.',
      `Report (${outcome ?? 'chưa rõ'}) đã được ghi; các check độc lập chưa chốt.`, null, 'Runtime settle tự động; nếu cần quyết định của Kernel, Kernel sẽ xử lý ở lượt kế.', 'runtime-core', []);
  }
  return null;
}

/* ------------------------------------------------------------ reading the ledger */

const handleDb = (h) => (h?.db ?? h);

/** Gather the facts of one attempt row and build its why (never stored). */
export function computeWhy(ledger, attemptRow, { catalog = loadCatalog(), readBlob = readBlobText } = {}) {
  const db = handleDb(ledger);
  const attempt = typeof attemptRow === 'object' ? attemptRow : one(db, 'SELECT * FROM op_attempts WHERE attempt_id=?', attemptRow);
  if (!attempt) return null;
  const checks = many(db, 'SELECT name,phase,runner,authority,status,exit_code,declared_exit_code,summary_json,stdout_sha,output_sha FROM check_runs WHERE attempt_id=? ORDER BY check_id', attempt.attempt_id)
    .map((row) => checkFacts(row, readBlob));
  for (const c of checks) for (const key of kebabTokens(`${c.evidence ?? ''} ${c.lines.join(' ')}`, catalog)) if (!c.codes.includes(key)) c.codes.push(key);
  const report = one(db, 'SELECT report_id, report_json FROM reports WHERE attempt_id=?', attempt.attempt_id);
  const unit = attempt.unit_id ? one(db, 'SELECT tries, try_budget, state FROM work_units WHERE workflow_id=? AND unit_id=?', attempt.workflow_id, attempt.unit_id) : null;
  return buildWhy({ attempt, checks, report, settle: parseJson(attempt.settle_json, {}) ?? {}, unit, catalog });
}

/** The why of an attempt: the stored op_attempts.why_json, else computed now. Read-only. */
export function whyOf(ledger, attemptRow, options) {
  const db = handleDb(ledger);
  const attempt = typeof attemptRow === 'object' ? attemptRow : one(db, 'SELECT * FROM op_attempts WHERE attempt_id=?', attemptRow);
  if (!attempt) return null;
  const stored = attempt.why_json ? parseJson(attempt.why_json, null) : null;
  return stored ?? computeWhy(db, attempt, options);
}

/** The whys of a workflow's attempts that need one (failed, blocked, waiting, refused), newest first. */
export function whysOfWorkflow(ledger, workflowId, { limit = 100, ...options } = {}) {
  const db = handleDb(ledger);
  const out = [];
  for (const a of many(db, 'SELECT * FROM op_attempts WHERE workflow_id=? ORDER BY attempt_id DESC LIMIT ?', workflowId, limit * 3)) {
    const why = whyOf(db, a, options);
    if (why) out.push(why);
    if (out.length >= limit) break;
  }
  return out;
}

/** A leg's (op's) why: the latest attempt of the op that has one, or null when its latest attempt passed. */
export function whyOfOp(ledger, workflowId, opId, options) {
  const db = handleDb(ledger);
  const latest = one(db, 'SELECT * FROM op_attempts WHERE workflow_id=? AND op_id=? AND dispatched_at IS NOT NULL ORDER BY attempt_id DESC LIMIT 1', workflowId, opId);
  return latest ? whyOf(db, latest, options) : null;
}

/* ------------------------------------------------------------ what the Kernel wrote down */

/**
 * The Kernel's own notes of a workflow, oldest first: decisions (events kernel-decision, closed by kernel-decision-result)
 * and proposals for shared .claude (events kernel-proposal). [{kind:'decision'|'proposal', id, at, status, headline, ...}].
 * Table events (entity_type 'decision' | 'kernel-proposal', entity_id = the note id, payload_json), so the UI reads them
 * without api status.
 */
export function kernelNotesOf(ledger, workflowId, { limit = 50 } = {}) {
  const db = handleDb(ledger);
  const notes = new Map();
  for (const e of many(db, "SELECT kind, entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN ('kernel-decision','kernel-decision-result','kernel-proposal') ORDER BY seq", workflowId)) {
    const p = parseJson(e.payload_json, {}) ?? {};
    if (e.kind === 'kernel-decision') {
      notes.set(e.entity_id, { kind: 'decision', id: e.entity_id, at: Number(e.created_at), status: 'open', headline: clip(p.hypothesis, 240), actionKey: p.actionKey ?? null, metric: p.metric ?? null, observed: null });
    } else if (e.kind === 'kernel-decision-result') {
      const n = notes.get(e.entity_id);
      if (n) Object.assign(n, { status: p.result === 'keep' ? 'kept' : p.result === 'revert' ? 'reverted' : p.result ?? 'closed', observed: clip(p.observed, 240), closedAt: Number(e.created_at) });
    } else {
      notes.set(e.entity_id, { kind: 'proposal', id: e.entity_id, at: Number(e.created_at), status: p.status ?? 'open', headline: clip(p.title, 240), evidence: clip(p.evidence, 400), tier: p.tier ?? null, files: Array.isArray(p.files) ? p.files.slice(0, 20) : [] });
    }
  }
  return [...notes.values()].slice(-limit);
}
