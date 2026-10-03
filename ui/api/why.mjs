// Owner-facing "why" of an attempt (docs/why.md, starci/why@1), read through the core's pure reader
// scripts/kernel/why.mjs: the stored op_attempts.why_json, else computed now. Read-only; cached per attempt end.
import { explainCode, kernelNotesOf, whyOf } from '../../scripts/kernel/why.mjs';
import { one } from './query.mjs';

const cache = new Map();

/** The why of one v_op_history / op_attempts row, with each code's Vietnamese title; null for a passed or open attempt. */
export function whyFor(db, row) {
  if (!row || row.verdict === 'pass') return null;
  if (row.settled_at == null && row.end_state == null) return null;
  const raw = one(db, 'SELECT why_json,settled_at FROM op_attempts WHERE attempt_id=?', row.attempt_id);
  const source = raw?.why_json ? 'stored' : 'computed';
  // A computed explanation reads current unit/catalog data and must not be cached as historical proof.
  const key = `${row.workflow_id}:${row.attempt_id}:${raw?.why_json ?? ''}`;
  if (source === 'stored' && cache.has(key)) return cache.get(key);
  let why = null;
  try { why = whyOf(db, row.attempt_id); } catch { why = null; }
  if (why) {
    why = { ...why, provenance: { source, at: source === 'stored' ? raw?.settled_at ?? null : null }, codeInfo: (why.codes ?? []).slice(0, 8).map(code => {
      const entry = explainCode(code);
      return { code, known: Boolean(entry.known), title: entry.title_vi ?? entry.title ?? code, meaning: entry.meaning_vi ?? null, next: entry.nextStep_vi ?? null };
    }) };
  }
  if (cache.size > 5000) cache.clear();
  if (source === 'stored') cache.set(key, why);
  return why;
}

/** The Kernel's decisions and proposals for a workflow (events), oldest first. */
export function kernelNotesFor(db, workflowId) {
  try { return kernelNotesOf(db, workflowId, { limit: 30 }); } catch { return []; }
}
