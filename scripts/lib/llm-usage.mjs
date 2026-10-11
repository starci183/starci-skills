// llm-usage.mjs — token usage of an agent CLI session, read from the CLI's own session log (never guessed).
//
// One extractor per agent adapter, each over a session file that exists on disk:
//   claude  Claude Code  <home>/.claude/projects/<cwd slug>/<session>.jsonl — every `assistant` record carries
//                        message.id, message.model and message.usage {input_tokens, output_tokens,
//                        cache_creation_input_tokens, cache_read_input_tokens, output_tokens_details.thinking_tokens};
//                        the several records of one message repeat the same usage, so a message counts once (max per field).
//   codex   Codex CLI    <home>/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl — `event_msg` token_count events carry the
//                        session's cumulative total_token_usage {input_tokens (cached included), cached_input_tokens,
//                        output_tokens (reasoning included), reasoning_output_tokens}; `turn_context` names the model.
//   devin   Devin CLI    keeps its sessions in sessions.db, which no adapter reads: usage is 'unavailable'.
// Every other agent is 'unavailable' too. A terminal scrollback (op_attempts.transcript_sha) is rendered screen text,
// not a token record, so it is not a source.
//
// Normalized counts (one row per model): inputTokens = fresh, non-cached input; cacheReadTokens = cached input read;
// cacheWriteTokens = cache creation; outputTokens = generated tokens INCLUDING reasoning; reasoningTokens is the reasoning
// subset of outputTokens (null when the CLI does not report it). input + cacheRead + cacheWrite + output is the CLI's total.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readYamlFile } from './read-yaml.mjs';
import { positiveNumber } from './number.mjs';

export const USAGE_SOURCE = 'cli-transcript';
export const USAGE_UNAVAILABLE = 'unavailable';
export const USAGE_AGENTS = Object.freeze(['claude', 'codex']);
// The price table lives in the ONE model catalog: modules/models/registry.yaml
// `pricing` + `models.<id>.price`.
const PRICES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules', 'models', 'registry.yaml');

const COUNT_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];
const int = (v) => positiveNumber(v, 0, { int: true });
const emptyRow = (model, { reasoning = true, toolErrors = true } = {}) => ({
  model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
  reasoningTokens: reasoning ? 0 : null, turns: 0, toolCalls: 0, toolErrors: toolErrors ? 0 : null,
});

/** Lines of `file`, decoded per line (a chunk boundary never splits a multi-byte character). Missing file: nothing. */
export function* fileLines(file, { chunkBytes = 8 << 20 } = {}) {
  let fd = null;
  try { fd = fs.openSync(file, 'r'); } catch { return; }
  try {
    const buf = Buffer.allocUnsafe(chunkBytes);
    let carry = Buffer.alloc(0);
    for (;;) {
      const n = fs.readSync(fd, buf, 0, chunkBytes, null);
      if (n <= 0) break;
      let data = carry.length ? Buffer.concat([carry, buf.subarray(0, n)]) : Buffer.from(buf.subarray(0, n));
      let start = 0;
      for (let i = data.indexOf(10, start); i >= 0; i = data.indexOf(10, start)) {
        const line = data.toString('utf8', start, i);
        if (line.trim()) yield line;
        start = i + 1;
      }
      carry = data.subarray(start);
    }
    if (carry.length && carry.toString('utf8').trim()) yield carry.toString('utf8');
  } finally { fs.closeSync(fd); }
}

const parse = (line) => { try { return JSON.parse(line); } catch { return null; } };

function recordClaudeAssistant(o, { byId, toolModel, rowOf }) {
  const model = o.message.model;
  if (!model || model === '<synthetic>') return;
  const usage = o.message.usage;
  const id = o.message.id ?? o.uuid;
  const rec = byId.get(id) ?? { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
  rec.inputTokens = Math.max(rec.inputTokens, int(usage.input_tokens));
  rec.outputTokens = Math.max(rec.outputTokens, int(usage.output_tokens));
  rec.cacheReadTokens = Math.max(rec.cacheReadTokens, int(usage.cache_read_input_tokens));
  rec.cacheWriteTokens = Math.max(rec.cacheWriteTokens, int(usage.cache_creation_input_tokens));
  rec.reasoningTokens = Math.max(rec.reasoningTokens, int(usage.output_tokens_details?.thinking_tokens));
  byId.set(id, rec);
  if (Array.isArray(o.message.content)) for (const block of o.message.content) {
    if (block?.type === 'tool_use' && block.id && !toolModel.has(block.id)) { toolModel.set(block.id, model); rowOf(model).toolCalls += 1; }
  }
}

function recordClaudeToolErrors(o, { toolModel, errSeen, rowOf }) {
  for (const block of o.message.content) {
    if (block?.type === 'tool_result' && block.is_error === true && block.tool_use_id && !errSeen.has(block.tool_use_id)) {
      errSeen.add(block.tool_use_id);
      const model = toolModel.get(block.tool_use_id);
      if (model) rowOf(model).toolErrors += 1;
    }
  }
}

function addClaudeTotals(byId, rowOf) {
  for (const rec of byId.values()) {
    const row = rowOf(rec.model);
    for (const field of [...COUNT_FIELDS, 'reasoningTokens']) row[field] += rec[field];
    row.turns += 1;
  }
}

/** Claude Code session lines -> {agent, models:[row], turns, sessionId}. A message counts once; sub-agent (sidechain) messages count too. */
function claudeUsage(lines) {
  const byId = new Map();
  const toolModel = new Map();
  const errSeen = new Set();
  const rows = new Map();
  const marks = [];
  let sessionId = null;
  const rowOf = (model) => { if (!rows.has(model)) { rows.set(model, emptyRow(model)); } return rows.get(model); };
  for (const line of lines) {
    if (line === BOUNDARY) { marks.push(claudeCumulative(byId, rows)); continue; }
    const isAssistant = line.includes('"type":"assistant"');
    if (!isAssistant && !line.includes('"is_error":true')) continue;
    const o = parse(line);
    if (!o) continue;
    sessionId ??= o.sessionId ?? null;
    if (o.type === 'assistant' && o.message?.usage) {
      recordClaudeAssistant(o, { byId, toolModel, rowOf });
    } else if (o.type === 'user' && Array.isArray(o.message?.content)) {
      recordClaudeToolErrors(o, { toolModel, errSeen, rowOf });
    }
  }
  return { agent: 'claude', sessionId, ...claudeCumulative(byId, rows), marks };
}

/** The usage so far as {models, turns}: a copy of the per-model rows with the message totals added, so the running state is not changed. */
function claudeCumulative(byId, rows) {
  const copy = new Map([...rows].map(([model, row]) => [model, { ...row }]));
  addClaudeTotals(byId, (model) => { if (!copy.has(model)) { copy.set(model, emptyRow(model)); } return copy.get(model); });
  return { models: [...copy.values()].filter(hasActivity), turns: byId.size };
}

const CODEX_TOOL_CALLS = new Set(['function_call', 'custom_tool_call', 'local_shell_call', 'tool_search_call']);

const codexEventLine = (line) => {
  const tokenCount = line.includes('"token_count"');
  const turnContext = line.includes('"turn_context"');
  const sessionMeta = line.includes('"session_meta"');
  const toolCall = !tokenCount && !turnContext && line.includes('"response_item"');
  return tokenCount || turnContext || sessionMeta || toolCall;
};

function applyCodexControlEvent(o, state, rowOf) {
  if (o.type === 'session_meta') { state.sessionId ??= o.payload?.id ?? o.payload?.session_id ?? null; return true; }
  if (o.type === 'turn_context') { state.model = o.payload?.model ?? o.payload?.collaboration_mode?.settings?.model ?? state.model; return true; }
  if (o.type === 'response_item' && CODEX_TOOL_CALLS.has(o.payload?.type)) { rowOf(state.model).toolCalls += 1; return true; }
  return false;
}

function addCodexUsage(total, state, rowOf) {
  const cur = {
    input: int(total.input_tokens), cached: int(total.cached_input_tokens), write: int(total.cache_write_input_tokens),
    output: int(total.output_tokens), reasoning: int(total.reasoning_output_tokens),
  };
  // A cumulative total that shrank (a fresh baseline after compaction) is a new base, never a negative delta.
  const base = state.prev && cur.input >= state.prev.input && cur.output >= state.prev.output ? state.prev : { input: 0, cached: 0, write: 0, output: 0, reasoning: 0 };
  const d = { input: cur.input - base.input, cached: cur.cached - base.cached, write: cur.write - base.write, output: cur.output - base.output, reasoning: cur.reasoning - base.reasoning };
  state.prev = cur;
  if (!d.input && !d.output) return;
  const row = rowOf(state.model);
  row.cacheReadTokens += Math.max(0, d.cached);
  row.cacheWriteTokens += Math.max(0, d.write);
  row.inputTokens += Math.max(0, d.input - Math.max(0, d.cached) - Math.max(0, d.write));
  row.outputTokens += Math.max(0, d.output);
  row.reasoningTokens += Math.max(0, d.reasoning);
  row.turns += 1;
  state.turns += 1;
}

/** Codex rollout lines -> {agent, models:[row], turns, sessionId}: cumulative token_count deltas attributed to the model of the latest turn_context. */
function codexUsage(lines) {
  const rows = new Map();
  const state = { model: 'unknown', sessionId: null, prev: null, turns: 0 };
  const marks = [];
  const rowOf = (m) => { if (!rows.has(m)) { rows.set(m, emptyRow(m, { toolErrors: false })); } return rows.get(m); };
  for (const line of lines) {
    if (line === BOUNDARY) { marks.push({ models: [...rows.values()].map((row) => ({ ...row })).filter(hasActivity), turns: state.turns }); continue; }
    if (!codexEventLine(line)) continue;
    const o = parse(line);
    if (!o) continue;
    if (applyCodexControlEvent(o, state, rowOf)) continue;
    const total = o.payload?.type === 'token_count' ? o.payload.info?.total_token_usage : null;
    if (!total) continue;
    addCodexUsage(total, state, rowOf);
  }
  return { agent: 'codex', sessionId: state.sessionId, models: [...rows.values()].filter(hasActivity), turns: state.turns, marks };
}

const hasActivity = (row) => COUNT_FIELDS.some((f) => row[f] > 0) || row.turns > 0;
const EXTRACTORS = { claude: claudeUsage, codex: codexUsage };
const UNAVAILABLE_REASON = {
  devin: 'no usage adapter for devin: it keeps its sessions in sessions.db, which no adapter reads',
};

/**
 * The usage of one session file for `agent`: {ok:true, source:'cli-transcript', agent, sessionId, models, turns} or
 * {ok:false, source:'unavailable', reason} — an agent without an adapter, an unreadable file or a file that holds no usage
 * record is never given a number.
 */
export function extractUsage(agent, file, { cuts = [] } = {}) {
  const extractor = EXTRACTORS[agent];
  if (!extractor) return { ok: false, source: USAGE_UNAVAILABLE, agent: agent ?? null, reason: UNAVAILABLE_REASON[agent] ?? `no usage adapter for agent ${agent ?? 'unknown'}`, definitive: true };
  if (!file || !fs.existsSync(file)) return { ok: false, source: USAGE_UNAVAILABLE, agent, reason: 'session file not found' };
  const { marks, ...out } = extractor(cuts.length ? withBoundaries(fileLines(file), cuts, agent) : fileLines(file));
  if (!out.models.length) return { ok: false, source: USAGE_UNAVAILABLE, agent, reason: 'session file holds no usage record' };
  return { ok: true, source: USAGE_SOURCE, ...out, ...(cuts.length ? { buckets: bucketsOf(marks, out) } : {}), file };
}

/** The marker a cut leaves in the line stream: the extractor snapshots its running totals when it meets one. */
const BOUNDARY = Symbol('cut');
const STAMPED = { claude: '"type":"assistant"', codex: 'token_count' };
const stampOf = (line) => { const at = Date.parse(parse(line)?.timestamp); return Number.isFinite(at) ? at : null; };

/** The lines of a session with a BOUNDARY before the first usage record stamped later than each cut (ms, ascending); the cuts no record passes close at the end. */
function* withBoundaries(lines, cuts, agent) {
  let next = 0;
  for (const line of lines) {
    if (next < cuts.length && line.includes(STAMPED[agent])) {
      const at = stampOf(line);
      while (at !== null && next < cuts.length && at > cuts[next]) { yield BOUNDARY; next += 1; }
    }
    yield line;
  }
  while (next < cuts.length) { yield BOUNDARY; next += 1; }
}

/** The usage between the cuts: [{models, turns}] with bucket 0 before the first cut and bucket i after cut i-1, from the running totals taken at each cut and at the end. */
function bucketsOf(marks, total) {
  let before = { models: [], turns: 0 };
  return [...marks, total].map((cumulative) => {
    const bucket = { models: deltaRows(cumulative.models, before.models), turns: Math.max(0, cumulative.turns - before.turns) };
    before = cumulative;
    return bucket;
  });
}

/** Sum of normalized rows (models merged): the totals a status line shows. */
export function sumRows(rows) {
  const t = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, turns: 0, toolCalls: 0, toolErrors: 0 };
  for (const r of rows) for (const k of Object.keys(t)) t[k] += Number(r[k] ?? 0);
  return t;
}

/** Every prompt-side token the model read (fresh + cache read + cache write): op_attempts.tokens_in. */
export const promptTokens = (r) => Number(r.inputTokens ?? 0) + Number(r.cacheReadTokens ?? 0) + Number(r.cacheWriteTokens ?? 0);

/**
 * modules/models/registry.yaml, read at each call so hot-loaded pricing uses current bytes. The returned
 * table is the shape callers have always read: {asOf, source, models:{<id>: {input, output,
 * cacheRead, cacheWrite, provider, tier, source}}} — each row is the model's `price` entry flattened
 * with its provider/tier.
 */
export function loadPrices(file = PRICES_FILE) {
  const doc = readYamlFile(file, null) ?? {};
  const models = {};
  for (const [id, m] of Object.entries(doc.models ?? {}))
    models[id] = m?.price && typeof m.price === 'object'
      ? { ...m.price, provider: m.provider ?? null, tier: m.tier ?? null }
      : { input: m?.input ?? null, output: m?.output ?? null, cacheRead: m?.cacheRead ?? null, cacheWrite: m?.cacheWrite ?? null,
          provider: m?.provider ?? null, tier: m?.tier ?? null, ...(m?.source !== undefined ? { source: m.source } : {}) };
  const table = { asOf: doc.pricing?.asOf ?? doc.asOf ?? null, source: doc.pricing?.source ?? doc.source ?? null, models };
  return table;
}

/** The price entry for `model`: the exact id, else the longest declared id that prefixes it; null when unpriced. */
export function priceOf(model, prices = loadPrices()) {
  if (!model) return null;
  const id = String(model);
  if (prices.models[id]) return prices.models[id];
  const hit = Object.keys(prices.models).filter((k) => id.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  return hit ? prices.models[hit] : null;
}

/** USD of one normalized row, or null when the model is unpriced or a rate it uses is null (never a partial sum). */
export function costOfRow(row, prices = loadPrices()) {
  const p = priceOf(row.model, prices);
  if (!p) return null;
  const parts = [[row.inputTokens, p.input], [row.outputTokens, p.output], [row.cacheReadTokens, p.cacheRead], [row.cacheWriteTokens, p.cacheWrite]];
  let usd = 0;
  for (const [tokens, rate] of parts) {
    if (!tokens) continue;
    if (typeof rate !== 'number') return null;
    usd += (tokens / 1_000_000) * rate;
  }
  return Math.round(usd * 1e6) / 1e6;
}

/** delta of `now` rows over `recorded` rows per model (each a normalized row); only positive deltas survive. */
export function deltaRows(now, recorded) {
  const before = new Map(recorded.map((r) => [r.model, r]));
  const out = [];
  for (const r of now) {
    const b = before.get(r.model) ?? {};
    const d = { ...r };
    for (const k of [...COUNT_FIELDS, 'turns', 'toolCalls']) d[k] = Math.max(0, Number(r[k] ?? 0) - Number(b[k] ?? 0));
    for (const k of ['reasoningTokens', 'toolErrors']) d[k] = r[k] === null ? null : Math.max(0, Number(r[k] ?? 0) - Number(b[k] ?? 0));
    if (COUNT_FIELDS.some((k) => d[k] > 0) || d.turns > 0) out.push(d);
  }
  return out;
}
