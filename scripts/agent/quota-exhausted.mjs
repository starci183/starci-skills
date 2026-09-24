// scripts/agent/quota-exhausted.mjs — "this provider's plan quota is spent", as evidence.
//
// Owner ruling 2026-09-24: Qwen is the base pool every task uses, unmetered; it is
// blocked only when it is dead. A provider whose agent card declares
// `quotaExhausted` is classified from what it actually printed:
//   text     regexes (case-insensitive) over a launch failure's signal/error text
//            (scripts/kernel/api.mjs rejectDispatch). The card lists the provider's
//            own quota codes: for Qwen Throttling.AllocationQuota, insufficient_quota
//            ("free allocated quota exceeded", Qwen Code isQwenQuotaExceededError),
//            quota-exhausted, and HTTP 429 carrying a quota code.
//   screen   ONE regex (multiline, case-insensitive) a terminal row must match: an
//            error row the CLI itself rendered, anchored at the row start, so a
//            worker that merely reads or edits text about quotas never matches.
//            For Qwen: its "Quota exhausted: " prefix (formatQuotaExhaustedMessage)
//            or an "[API Error: ...]" row naming a quota code.
//   probe    the recovery probe (scripts/agent/credential-probe.mjs probeProviderQuota):
//            {kind: openai-chat, everyMs} — a real 1-token chat completion at most
//            once per everyMs while the circuit is open, and right after the plan's reset.
// A card without `quotaExhausted` is never classified: no guessing for other providers.
import { agentCardOf, providerKeyOf } from './credential-fingerprint.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const AGENTS_DIR = path.join(skillRoot, 'modules', 'models', 'agents');
export const QUOTA_FAILURE_KIND = 'quota';
export const DEFAULT_QUOTA_PROBE_EVERY_MS = 3600000;

const compile = (source, flags) => { try { return new RegExp(source, flags); } catch { return null; } };

/** The card's quotaExhausted spec compiled: {text: RegExp[], screen: RegExp|null, probe} or null. */
export function quotaSpecOf(provider, { card } = {}) {
  const spec = (card === undefined ? agentCardOf(provider) : card)?.quotaExhausted;
  if (!spec || typeof spec !== 'object') return null;
  const text = (Array.isArray(spec.text) ? spec.text : []).map((s) => compile(String(s), 'i')).filter(Boolean);
  const screen = typeof spec.screen === 'string' ? compile(spec.screen, 'im') : null;
  const probe = spec.probe && typeof spec.probe === 'object'
    ? { ...spec.probe, everyMs: Number(spec.probe.everyMs) > 0 ? Number(spec.probe.everyMs) : DEFAULT_QUOTA_PROBE_EVERY_MS } : null;
  return { provider: providerKeyOf(provider), text, screen, probe };
}

const clip = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 200);

/**
 * Quota-exhausted evidence in free failure text (signal, error): {provider, source:'text', match} or null.
 * `texts` is any list of strings/objects; objects are JSON-stringified.
 */
export function quotaExhaustedInText(provider, texts, { card } = {}) {
  const spec = quotaSpecOf(provider, { card });
  if (!spec?.text.length) return null;
  const joined = (Array.isArray(texts) ? texts : [texts]).map((t) => {
    if (t == null) return '';
    if (typeof t === 'string') return t;
    try { return JSON.stringify(t); } catch { return String(t); }
  }).join('\n');
  for (const re of spec.text) {
    const m = re.exec(joined);
    if (m) return { provider: spec.provider, source: 'text', match: clip(m[0]) };
  }
  return null;
}

/** Quota-exhausted evidence on a rendered terminal screen: {provider, source:'screen', match} (the row) or null. */
export function quotaExhaustedOnScreen(provider, screen, { card } = {}) {
  const spec = quotaSpecOf(provider, { card });
  if (!spec?.screen || typeof screen !== 'string' || !screen) return null;
  const m = spec.screen.exec(screen);
  if (!m) return null;
  const start = screen.lastIndexOf('\n', m.index) + 1;
  const end = screen.indexOf('\n', m.index);
  return { provider: spec.provider, source: 'screen', match: clip(screen.slice(start, end < 0 ? undefined : end)) };
}

/** The providers whose card declares a quota recovery probe. */
export function quotaProbeProviders() {
  let files = [];
  try { files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.yaml')); } catch { return []; }
  return files.map((f) => f.slice(0, -5)).filter((p) => quotaSpecOf(p)?.probe);
}
