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
import { readYamlFile } from './yaml.mjs';

export const USAGE_SOURCE = 'cli-transcript';
export const USAGE_UNAVAILABLE = 'unavailable';
export const USAGE_AGENTS = Object.freeze(['claude', 'codex']);
export const PRICES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules', 'models', 'prices.yaml');

const COUNT_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];
const int = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.trunc(Number(v)) : 0);
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

/** Claude Code session lines -> {agent, models:[row], turns, sessionId}. A message counts once; sub-agent (sidechain) messages count too. */
export function claudeUsage(lines) {
  const byId = new Map();
  const toolModel = new Map();
  const errSeen = new Set();
  const rows = new Map();
  let sessionId = null;
  const rowOf = (model) => { if (!rows.has(model)) rows.set(model, emptyRow(model)); return rows.get(model); };
  for (const line of lines) {
    const isAssistant = line.includes('"type":"assistant"');
    if (!isAssistant && !line.includes('"is_error":true')) continue;
    const o = parse(line);
    if (!o) continue;
    sessionId ??= o.sessionId ?? null;
    if (o.type === 'assistant' && o.message?.usage) {
      const model = o.message.model;
      if (!model || model === '<synthetic>') continue;
      const u = o.message.usage;
      const id = o.message.id ?? o.uuid;
      const rec = byId.get(id) ?? { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
      rec.inputTokens = Math.max(rec.inputTokens, int(u.input_tokens));
      rec.outputTokens = Math.max(rec.outputTokens, int(u.output_tokens));
      rec.cacheReadTokens = Math.max(rec.cacheReadTokens, int(u.cache_read_input_tokens));
      rec.cacheWriteTokens = Math.max(rec.cacheWriteTokens, int(u.cache_creation_input_tokens));
      rec.reasoningTokens = Math.max(rec.reasoningTokens, int(u.output_tokens_details?.thinking_tokens));
      byId.set(id, rec);
      if (Array.isArray(o.message.content)) for (const block of o.message.content) {
        if (block?.type === 'tool_use' && block.id && !toolModel.has(block.id)) { toolModel.set(block.id, model); rowOf(model).toolCalls += 1; }
      }
    } else if (o.type === 'user' && Array.isArray(o.message?.content)) {
      for (const block of o.message.content) {
        if (block?.type === 'tool_result' && block.is_error === true && block.tool_use_id && !errSeen.has(block.tool_use_id)) {
          errSeen.add(block.tool_use_id);
          const model = toolModel.get(block.tool_use_id);
          if (model) rowOf(model).toolErrors += 1;
        }
      }
    }
  }
  for (const rec of byId.values()) {
    const row = rowOf(rec.model);
    for (const f of [...COUNT_FIELDS, 'reasoningTokens']) row[f] += rec[f];
    row.turns += 1;
  }
  return { agent: 'claude', sessionId, models: [...rows.values()].filter(hasActivity), turns: byId.size };
}

const CODEX_TOOL_CALLS = new Set(['function_call', 'custom_tool_call', 'local_shell_call', 'tool_search_call']);

/** Codex rollout lines -> {agent, models:[row], turns, sessionId}: cumulative token_count deltas attributed to the model of the latest turn_context. */
export function codexUsage(lines) {
  const rows = new Map();
  let model = 'unknown', sessionId = null, prev = null, turns = 0;
  const rowOf = (m) => { if (!rows.has(m)) rows.set(m, emptyRow(m, { toolErrors: false })); return rows.get(m); };
  for (const line of lines) {
    const tokenCount = line.includes('"token_count"');
    const turnContext = line.includes('"turn_context"');
    const sessionMeta = line.includes('"session_meta"');
    const toolCall = !tokenCount && !turnContext && line.includes('"response_item"');
    if (!tokenCount && !turnContext && !sessionMeta && !toolCall) continue;
    const o = parse(line);
    if (!o) continue;
    if (o.type === 'session_meta') { sessionId ??= o.payload?.id ?? o.payload?.session_id ?? null; continue; }
    if (o.type === 'turn_context') { model = o.payload?.model ?? o.payload?.collaboration_mode?.settings?.model ?? model; continue; }
    if (o.type === 'response_item' && CODEX_TOOL_CALLS.has(o.payload?.type)) { rowOf(model).toolCalls += 1; continue; }
    const total = o.payload?.type === 'token_count' ? o.payload.info?.total_token_usage : null;
    if (!total) continue;
    const cur = {
      input: int(total.input_tokens), cached: int(total.cached_input_tokens), write: int(total.cache_write_input_tokens),
      output: int(total.output_tokens), reasoning: int(total.reasoning_output_tokens),
    };
    // A cumulative total that shrank (a fresh baseline after compaction) is a new base, never a negative delta.
    const base = prev && cur.input >= prev.input && cur.output >= prev.output ? prev : { input: 0, cached: 0, write: 0, output: 0, reasoning: 0 };
    const d = { input: cur.input - base.input, cached: cur.cached - base.cached, write: cur.write - base.write, output: cur.output - base.output, reasoning: cur.reasoning - base.reasoning };
    prev = cur;
    if (!d.input && !d.output) continue;
    const row = rowOf(model);
    row.cacheReadTokens += Math.max(0, d.cached);
    row.cacheWriteTokens += Math.max(0, d.write);
    row.inputTokens += Math.max(0, d.input - Math.max(0, d.cached) - Math.max(0, d.write));
    row.outputTokens += Math.max(0, d.output);
    row.reasoningTokens += Math.max(0, d.reasoning);
    row.turns += 1;
    turns += 1;
  }
  return { agent: 'codex', sessionId, models: [...rows.values()].filter(hasActivity), turns };
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
export function extractUsage(agent, file) {
  const extractor = EXTRACTORS[agent];
  if (!extractor) return { ok: false, source: USAGE_UNAVAILABLE, agent: agent ?? null, reason: UNAVAILABLE_REASON[agent] ?? `no usage adapter for agent ${agent ?? 'unknown'}`, definitive: true };
  if (!file || !fs.existsSync(file)) return { ok: false, source: USAGE_UNAVAILABLE, agent, reason: 'session file not found' };
  const out = extractor(fileLines(file));
  if (!out.models.length) return { ok: false, source: USAGE_UNAVAILABLE, agent, reason: 'session file holds no usage record' };
  return { ok: true, source: USAGE_SOURCE, ...out, file };
}

/** Sum of normalized rows (models merged): the totals a status line shows. */
export function sumRows(rows) {
  const t = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, turns: 0, toolCalls: 0, toolErrors: 0 };
  for (const r of rows) for (const k of Object.keys(t)) t[k] += Number(r[k] ?? 0);
  return t;
}

/** Every prompt-side token the model read (fresh + cache read + cache write): op_attempts.tokens_in. */
export const promptTokens = (r) => Number(r.inputTokens ?? 0) + Number(r.cacheReadTokens ?? 0) + Number(r.cacheWriteTokens ?? 0);

let priceCache = null;
/** modules/models/prices.yaml, read once per process (`file` overrides for a spec). */
export function loadPrices(file = PRICES_FILE) {
  if (file === PRICES_FILE && priceCache) return priceCache;
  const doc = readYamlFile(file, null) ?? {};
  const table = { asOf: doc.asOf ?? null, source: doc.source ?? null, models: doc.models ?? {} };
  if (file === PRICES_FILE) priceCache = table;
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

/** Total cost of rows: the sum when every row is priced, else null. */
export function costOfRows(rows, prices = loadPrices()) {
  if (!rows.length) return null;
  let total = 0;
  for (const r of rows) { const c = costOfRow(r, prices); if (c === null) return null; total += c; }
  return Math.round(total * 1e6) / 1e6;
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
