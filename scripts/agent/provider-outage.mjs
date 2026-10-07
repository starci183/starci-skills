// scripts/agent/provider-outage.mjs — "this provider cannot serve now", as evidence.
//
// A provider whose agent card declares an outage key is classified from what it actually printed, and the
// match opens its provider-health circuit with that key's failureKind (scripts/kernel/cli.mjs):
//   quotaExhausted     failureKind quota: the plan quota is spent. The circuit lasts until the plan reset
//                      (or allocation.cooldownMs.quota) and its `probe` clears it earlier.
//   capacityExhausted  failureKind capacity: the provider refuses to serve the model for now. The circuit
//                      lasts allocation.cooldownMs.capacity, lengthened by allocation.circuitBackoff when it
//                      reopens.
// Each key carries:
//   text     regexes (case-insensitive) over a launch failure's signal/error text (cli.mjs rejectDispatch).
//   screen   ONE regex (multiline, case-insensitive) a terminal row must match: an error row the CLI itself
//            rendered, anchored at the row start, so a worker that merely reads or edits text about the
//            error never matches.
//   probe    quotaExhausted only: the recovery probe (scripts/agent/credential-probe.mjs probeProviderQuota),
//            {kind, everyMs}, run at most once per everyMs while the circuit is open. kind orca-account: the Orca
//            account's weekly window (passes under 100% used).
//   A key may declare only `probe`: nothing classifies an outage for that provider, and the probe clears a
//   quota circuit opened some other way.
// A card without an outage key is never classified: no guessing for other providers.
//
// A launch-path failure the runtime itself reports for a provider's CLI is classified too (LAUNCH_PATH_FAILURES),
// as failureKind worker-start: the launch never got a worker because the provider's own CLI failed it. It is a strike
// (runtimes.yaml allocation.providerStrikes.worker-start): one unrelated failure never opens the circuit, a repeat
// does, and routing (scripts/agent/pool-selection.mjs) skips the open circuit until it expires or is recovered.
import { agentCardOf } from './credential-fingerprint.mjs';
import { APP_SERVER_FAILURE } from './codex-app-server.mjs';
import { normalizeProvider } from '../lib/provider.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const AGENTS_DIR = path.join(skillRoot, 'modules', 'models', 'agents');
export const QUOTA_FAILURE_KIND = 'quota';
const CAPACITY_FAILURE_KIND = 'capacity';
/** The card keys that classify an outage, and the circuit failureKind each opens. */
export const OUTAGE_KEYS = Object.freeze({ quotaExhausted: QUOTA_FAILURE_KIND, capacityExhausted: CAPACITY_FAILURE_KIND });
const DEFAULT_QUOTA_PROBE_EVERY_MS = 3600000;
const LAUNCH_FAILURE_KIND = 'worker-start';
// Runtime-owned launch failure texts, per provider. codex: scripts/agent/codex-app-server.mjs codexAppServer, the launch-trust
// step that asks `codex app-server` for the guard hook's hash - every failure of it starts with this text.
const LAUNCH_PATH_FAILURES = Object.freeze({ codex: [new RegExp(APP_SERVER_FAILURE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*')] });

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
  return { provider: normalizeProvider(provider), failureKind: OUTAGE_KEYS[key], text, screen, probe };
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
  return launchFailureInText(provider, joined);
}

/** A runtime-owned launch failure of the provider's CLI (LAUNCH_PATH_FAILURES): {failureKind:'worker-start', ...} or null. */
function launchFailureInText(provider, joined) {
  const key = normalizeProvider(provider);
  const text = LAUNCH_PATH_FAILURES[key] ?? [];
  return textMatch({ provider: key, failureKind: LAUNCH_FAILURE_KIND, text }, joined);
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
