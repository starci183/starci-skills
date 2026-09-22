// scripts/api/orca/lib.mjs — the one place Orca is called from.
// It owns: binary resolution (orca.cmd cannot spawn on Windows without a
// shell), STARCI_ORCA_COMMAND/STARCI_ORCA_ARGS overrides, the calls.yaml
// contract (argv assembly, declared-flag refusal, timeouts, receipt
// classification), the live agent-context comparison before the first
// mutation, terminal frame extraction and sleepSync.
// Wrappers name a verb and shape its receipt; they never build argv.
import { spawnSync } from 'node:child_process';
import { readDistJson } from '../../../engine/runtime-root.mjs';

export const CALLS = readDistJson('modules', 'host', 'orca', 'calls.yaml');

export const ORCA = (() => {
  if (process.env.STARCI_ORCA_COMMAND) return process.env.STARCI_ORCA_COMMAND;
  if (process.platform !== 'win32') return 'orca';
  const w = spawnSync('where.exe', ['orca'], { encoding: 'utf8' });
  const exe = (w.stdout || '').split(/\r?\n/).find((l) => l.trim().endsWith('.exe'));
  return exe ? exe.trim() : 'orca.exe';
})();

export const ORCA_PREFIX_ARGS = (() => {
  try { return JSON.parse(process.env.STARCI_ORCA_ARGS || '[]'); } catch { return []; }
})();

export function orcaRun(args, { timeout = 120000 } = {}) {
  const r = spawnSync(ORCA, [...ORCA_PREFIX_ARGS, ...args], { encoding: 'utf8', timeout, windowsHide: true });
  return { status: r.status, error: r.error?.message, stdout: r.stdout?.trim(), stderr: r.stderr?.trim() };
}

export const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export const jsonOf = (text) => { try { return JSON.parse(text || 'null'); } catch { return null; } };
export const terminalOf = (envelope) => envelope?.result?.terminal ?? jsonOf(envelope?.stdout)?.result?.terminal ?? null;

export function frameText(terminal) {
  if (!terminal) return '';
  if (typeof terminal.screen === 'string') return terminal.screen;
  if (Array.isArray(terminal.tail)) return terminal.tail.join('\n');
  if (typeof terminal.tail === 'string') return terminal.tail;
  return terminal.preview ?? '';
}

// --name value CLI arg reader shared by the thin wrappers.
export const arg = (argv, name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
export const flag = (argv, name) => argv.includes(`--${name}`);

const JSON_FLAG = CALLS.defaults?.jsonFlag ?? 'json';
const ENVELOPE_SCHEMA = CALLS.envelope?.schema ?? 'starci/orca-call-result@1';

const entryOf = (verb) => {
  const entry = CALLS.calls?.[verb];
  if (!entry) throw new Error(`orcaCall: modules/host/orca/calls.yaml declares no call '${verb}'`);
  return entry;
};

const words = (command) => String(command ?? '').split(/\s+/).filter(Boolean);
const at = (root, dotted) => String(dotted).split('.').reduce((o, k) => (o == null ? o : o[k]), root);
const filled = (v) => v !== undefined && v !== null && v !== false && v !== '';
const nonEmpty = (v) => Array.isArray(v) ? v.length > 0
  : (v && typeof v === 'object' ? Object.keys(v).length > 0 : Boolean(v));

function buildArgv(verb, entry, params) {
  const declared = entry.flags ?? [];
  for (const key of Object.keys(params)) {
    if (key === JSON_FLAG) continue;
    if (!declared.includes(key))
      throw new Error(`orcaCall ${verb}: --${key} is not a flag calls.yaml declares for '${entry.command}'`);
  }
  for (const key of entry.required ?? []) {
    if (!filled(params[key])) throw new Error(`orcaCall ${verb}: missing required --${key}`);
  }
  const argv = words(entry.command);
  for (const key of declared) {
    if (key === JSON_FLAG) continue;
    const value = params[key];
    if (value === undefined || value === null || value === false) continue;
    if (value === true) { argv.push(`--${key}`); continue; }
    argv.push(`--${key}`, Array.isArray(value) ? JSON.stringify(value) : String(value));
  }
  if (entry.json !== false) argv.push(`--${JSON_FLAG}`);
  return argv;
}

function matches(when, exitCode, receipt) {
  if (when === undefined || when === null) return true;
  if (Object.hasOwn(when, 'exitCode') && when.exitCode !== exitCode) return false;
  if (when.path === undefined) return true;
  const value = at(receipt, when.path);
  if (Array.isArray(when.in)) return when.in.includes(value);
  if (when.nonEmpty === true) return nonEmpty(value);
  if (when.exists === true) return value !== undefined && value !== null;
  return value !== undefined;
}

function classify(entry, exitCode, receipt) {
  for (const rule of entry.classify ?? []) {
    if (matches(rule?.when, exitCode, receipt))
      return { outcome: rule.outcome, effectState: rule.effectState, reason: rule.reason ?? null };
  }
  return exitCode === 0
    ? { outcome: 'ok', effectState: 'committed', reason: null }
    : { outcome: 'failed', effectState: 'none', reason: null };
}

// ---- live agent-context comparison (calls.yaml liveSchema) -----------------
// One listing per process, fetched lazily before the first mutation. A verb
// whose command or declared flags the live binary does not offer is refused
// before any effect; the listing itself failing to read is the same refusal.
let liveListing;

const commandName = (c) => typeof c === 'string' ? c
  : (typeof c?.command === 'string' ? c.command
    : typeof c?.name === 'string' ? c.name
      : typeof c?.usage === 'string' ? c.usage.split(/\s+--?/)[0].trim() : null);

function liveFlags(c) {
  const out = new Set();
  if (!c || typeof c !== 'object') return out;
  const raw = c.flags ?? c.options ?? c.arguments ?? [];
  for (const f of Array.isArray(raw) ? raw : Object.keys(raw)) {
    const name = typeof f === 'string' ? f : (f?.flag ?? f?.name ?? f?.long ?? null);
    if (typeof name === 'string') out.add(name.replace(/^--?/, '').split(/[\s=,]/)[0]);
  }
  return out;
}

/** An agent-context `commands` array as Map<command, Set<flag>>, or null. */
export function listingOf(commands) {
  if (!Array.isArray(commands)) return null;
  const listing = new Map();
  for (const c of commands) {
    const name = commandName(c);
    if (name) listing.set(name, liveFlags(c));
  }
  return listing.size ? listing : null;
}

/** The commands calls.yaml requires of `listing`, or null when it satisfies them. */
export function missingFrom(listing, entry, jsonFlag = JSON_FLAG) {
  if (!listing) return { listing: 'unreadable' };
  const flags = listing.get(entry?.command);
  if (!flags) return { command: entry?.command ?? null };
  const missing = (entry.flags ?? []).filter((f) => f !== jsonFlag && !flags.has(f));
  return missing.length ? { command: entry.command, flags: missing } : null;
}

function agentContextListing() {
  if (liveListing !== undefined) return liveListing;
  const entry = CALLS.calls?.['agent-context'];
  liveListing = null;
  if (!entry) return liveListing;
  const r = orcaRun([...words(entry.command), `--${JSON_FLAG}`],
    { timeout: entry.timeoutMs ?? CALLS.defaults?.timeoutMs ?? 30000 });
  const receipt = jsonOf(r.stdout);
  liveListing = listingOf(receipt?.commands ?? receipt?.result?.commands ?? null);
  return liveListing;
}

const liveDrift = (entry) => missingFrom(agentContextListing(), entry);

const driftEnvelope = (verb, entry, missing) => ({
  schema: ENVELOPE_SCHEMA,
  verb,
  command: entry.command,
  kind: entry.kind ?? null,
  outcome: 'failed',
  effectState: 'none',
  reason: 'host-contract-drift',
  missing,
  exitCode: null,
  receipt: null,
  result: null,
  stdout: '',
  stderr: '',
  error: missing.listing === 'unreadable'
    ? `host-contract-drift: ${verb} was refused because orca agent-context returned no command listing to compare '${entry.command}' against`
    : missing.flags
      ? `host-contract-drift: ${verb} needs '${entry.command}' flags the live orca agent-context does not offer: ${missing.flags.map((f) => `--${f}`).join(', ')}`
      : `host-contract-drift: ${verb} needs command '${entry.command}', which the live orca agent-context does not offer`,
});

/**
 * Issue one calls.yaml call. `params` are keyed by the flag names calls.yaml
 * declares; anything else is a contract violation and throws. Returns the
 * starci/orca-call-result@1 envelope — never a raw SpawnResult.
 */
export function orcaCall(verb, params = {}, { timeout } = {}) {
  const entry = entryOf(verb);
  const argv = buildArgv(verb, entry, params);
  if (entry.kind === 'mutation' && process.env.STARCI_ORCA_SKIP_LIVE_CHECK !== '1') {
    const missing = liveDrift(entry);
    if (missing) return driftEnvelope(verb, entry, missing);
  }
  const r = orcaRun(argv, { timeout: timeout ?? entry.timeoutMs ?? CALLS.defaults?.timeoutMs ?? 30000 });
  const receipt = jsonOf(r.stdout);
  const { outcome, effectState, reason } = classify(entry, r.status, receipt);
  return {
    schema: ENVELOPE_SCHEMA,
    verb,
    command: entry.command,
    kind: entry.kind ?? null,
    outcome,
    effectState,
    reason,
    missing: null,
    exitCode: r.status,
    receipt,
    result: receipt?.result ?? null,
    stdout: r.stdout,
    stderr: r.stderr,
    error: r.error ?? r.stderr,
  };
}
