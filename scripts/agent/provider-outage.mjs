// scripts/agent/provider-outage.mjs — "this provider cannot serve now", as evidence.
//
// A provider whose agent card declares an outage key is classified from what it actually printed, and the
// match opens its provider-health circuit with that key's failureKind (scripts/kernel/api.mjs):
//   quotaExhausted     failureKind quota: the plan quota is spent. The circuit lasts until the plan reset
//                      (or allocation.cooldownMs.quota) and its `probe` clears it earlier.
//   capacityExhausted  failureKind capacity: the provider refuses to serve the model for now. The circuit
//                      lasts allocation.cooldownMs.capacity, lengthened by allocation.circuitBackoff when it
//                      reopens.
// Each key carries:
//   text     regexes (case-insensitive) over a launch failure's signal/error text (api.mjs rejectDispatch).
//   screen   ONE regex (multiline, case-insensitive) a terminal row must match: an error row the CLI itself
//            rendered, anchored at the row start, so a worker that merely reads or edits text about the
//            error never matches.
//   probe    quotaExhausted only: the recovery probe (scripts/agent/credential-probe.mjs probeProviderQuota),
//            {kind: openai-chat, everyMs} — a real 1-token chat completion at most once per everyMs while
//            the circuit is open, and right after the plan's reset.
// A card without an outage key is never classified: no guessing for other providers.
import { agentCardOf, providerKeyOf } from './credential-fingerprint.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const AGENTS_DIR = path.join(skillRoot, 'modules', 'models', 'agents');
export const QUOTA_FAILURE_KIND = 'quota';
export const CAPACITY_FAILURE_KIND = 'capacity';
/** The card keys that classify an outage, and the circuit failureKind each opens. */
export const OUTAGE_KEYS = Object.freeze({ quotaExhausted: QUOTA_FAILURE_KIND, capacityExhausted: CAPACITY_FAILURE_KIND });
export const DEFAULT_QUOTA_PROBE_EVERY_MS = 3600000;

const compile = (source, flags) => { try { return new RegExp(source, flags); } catch { return null; } };
const cardFor = (provider, card) => (card === undefined ? agentCardOf(provider) : card);

// One outage key of a card compiled: {provider, failureKind, text: RegExp[], screen: RegExp|null, probe} or null.
function outageSpecFrom(provider, card, key) {
  const spec = card?.[key];
  if (!spec || typeof spec !== 'object') return null;
  const text = (Array.isArray(spec.text) ? spec.text : []).map((s) => compile(String(s), 'i')).filter(Boolean);
  const screen = typeof spec.screen === 'string' ? compile(spec.screen, 'im') : null;
  const probe = key === 'quotaExhausted' && spec.probe && typeof spec.probe === 'object'
    ? { ...spec.probe, everyMs: Number(spec.probe.everyMs) > 0 ? Number(spec.probe.everyMs) : DEFAULT_QUOTA_PROBE_EVERY_MS } : null;
  return { provider: providerKeyOf(provider), failureKind: OUTAGE_KEYS[key], text, screen, probe };
}

/** The card's quotaExhausted spec compiled, or null. */
export const quotaSpecOf = (provider, { card } = {}) => outageSpecFrom(provider, cardFor(provider, card), 'quotaExhausted');

/** Every outage spec the card declares, quota first. */
export function outageSpecsOf(provider, { card } = {}) {
  const resolved = cardFor(provider, card);
  return Object.keys(OUTAGE_KEYS).map((key) => outageSpecFrom(provider, resolved, key)).filter(Boolean);
}

const clip = (s) => String(s).replace(/\s+/g, ' ').trim().slice(0, 200);
const joinTexts = (texts) => (Array.isArray(texts) ? texts : [texts]).map((t) => {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  try { return JSON.stringify(t); } catch { return String(t); }
}).join('\n');
const textMatch = (spec, joined) => {
  for (const re of spec.text) {
    const m = re.exec(joined);
    if (m) return { provider: spec.provider, failureKind: spec.failureKind, source: 'text', match: clip(m[0]) };
  }
  return null;
};
const screenMatch = (spec, screen) => {
  const m = spec.screen?.exec(screen);
  if (!m) return null;
  const start = screen.lastIndexOf('\n', m.index) + 1;
  const end = screen.indexOf('\n', m.index);
  return { provider: spec.provider, failureKind: spec.failureKind, source: 'screen', match: clip(screen.slice(start, end < 0 ? undefined : end)) };
};

/** Quota evidence in free failure text (a quota probe's answer): {provider, failureKind, source:'text', match} or null. */
export function quotaExhaustedInText(provider, texts, { card } = {}) {
  const spec = quotaSpecOf(provider, { card });
  return spec?.text.length ? textMatch(spec, joinTexts(texts)) : null;
}

/**
 * Outage evidence in free failure text (signal, error): {provider, failureKind, source:'text', match} or null.
 * `texts` is any list of strings/objects; objects are JSON-stringified.
 */
export function outageInText(provider, texts, { card } = {}) {
  const joined = joinTexts(texts);
  for (const spec of outageSpecsOf(provider, { card })) {
    const found = textMatch(spec, joined);
    if (found) return found;
  }
  return null;
}

/** Outage evidence on a rendered terminal screen: {provider, failureKind, source:'screen', match} (the row) or null. */
export function outageOnScreen(provider, screen, { card } = {}) {
  if (typeof screen !== 'string' || !screen) return null;
  for (const spec of outageSpecsOf(provider, { card })) {
    const found = screenMatch(spec, screen);
    if (found) return found;
  }
  return null;
}

/** The providers whose card declares a quota recovery probe. */
export function quotaProbeProviders() {
  let files = [];
  try { files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.yaml')); } catch { return []; }
  return files.map((f) => f.slice(0, -5)).filter((p) => quotaSpecOf(p)?.probe);
}
