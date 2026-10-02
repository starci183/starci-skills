// scripts/api/orca/lib.mjs — the one place Orca is called from.
// It owns: binary resolution (orca.cmd cannot spawn on Windows without a
// shell), STARCI_ORCA_COMMAND/STARCI_ORCA_ARGS overrides, the calls.yaml
// contract (argv assembly, declared-flag refusal, timeouts, receipt
// classification) and the live agent-context comparison before the first
// mutation (scripts/lib/orca-listing.mjs compares).
// Wrappers name a verb and shape its receipt; they never build argv.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readModuleJson } from '../../../engine/runtime-root.mjs';
import { listingOf, missingFrom } from '../../lib/orca-listing.mjs';
import { readEnv } from '../../lib/env.mjs';
import { dotGet } from '../../lib/dot-path.mjs';

const CALLS = readModuleJson('modules', 'host', 'orca', 'calls.yaml');

export const ORCA = (() => {
  if (readEnv('STARCI_ORCA_COMMAND')) return readEnv('STARCI_ORCA_COMMAND');
  if (process.platform !== 'win32') return 'orca';
  const w = spawnSync('where.exe', ['orca'], { encoding: 'utf8' });
  const exe = (w.stdout || '').split(/\r?\n/).find((l) => l.trim().endsWith('.exe'));
  return exe ? exe.trim() : 'orca.exe';
})();

/** The Orca desktop app beside the CLI (<app>/resources/bin/orca.exe -> <app>/Orca.exe), or null. */
export const orcaAppExe = (cli = ORCA) => {
  if (!path.isAbsolute(String(cli))) return null;
  const exe = path.resolve(path.dirname(cli), '..', '..', 'Orca.exe');
  return fs.existsSync(exe) ? exe : null;
};

const ORCA_PREFIX_ARGS = (() => {
  try { return JSON.parse(readEnv('STARCI_ORCA_ARGS') || '[]'); } catch { return []; }
})();

// A read can answer more than spawnSync's 1 MB default (a worker-read
// transcript page, a terminal scrollback, a worker-list page of 100 rows), and
// a clipped stdout is a lost receipt (ENOBUFS, inc-13ab4be5059f). Reads get 64 MB.
const READ_MAX_BUFFER = 64 * 1024 * 1024;

export function orcaRun(args, { timeout = 120000, maxBuffer } = {}) {
  const r = spawnSync(ORCA, [...ORCA_PREFIX_ARGS, ...args], { encoding: 'utf8', timeout, windowsHide: true, ...(maxBuffer ? { maxBuffer } : {}) });
  return { status: r.status, error: r.error?.message, spawnError: r.error?.code ?? (r.error ? 'spawn-error' : null),
    stdout: r.stdout?.trim(), stderr: r.stderr?.trim() };
}

// ---- host outage ------------------------------------------------------------
// An Orca that is not answering says nothing about any terminal. On 2026-09-24
// Orca auto-updated (1.4.188 -> 1.4.209) and restarted: for about a minute the
// CLI answered runtime_unavailable ("Could not read Orca runtime metadata ...
// Start the Orca app first") and, while the binary was being replaced, spawning
// orca.exe failed with ENOENT. The terminal daemon and every kernel survived,
// but the watchdogs read both answers as dead kernels: six workflows lost their
// kernel seat and one got a second kernel. A host-unavailable answer is never
// evidence about a terminal - callers wait and re-verify once Orca answers.
const HOST_UNAVAILABLE_CODES = new Set(['runtime_unavailable']);
const HOST_DOWN_TEXT = /could not read orca runtime metadata|start the orca app first/i;

/**
 * True when an Orca call got no answer from a running Orca: the binary could
 * not be spawned (ENOENT/EACCES while an update replaces it), the call timed
 * out or was killed, or Orca answered its own runtime_unavailable.
 */
export function hostUnavailableOf(run, receipt) {
  if (!run) return false;
  if (run.spawnError) return true;
  if (run.status === null || run.status === undefined) return true;
  const code = receipt?.error?.code;
  if (typeof code === 'string' && HOST_UNAVAILABLE_CODES.has(code)) return true;
  const message = typeof receipt?.error === 'string' ? receipt.error : receipt?.error?.message;
  return run.status !== 0 && HOST_DOWN_TEXT.test(`${message ?? ''}\n${run.stderr ?? ''}\n${receipt ? '' : run.stdout ?? ''}`);
}

export const jsonOf = (text) => { try { return JSON.parse(text || 'null'); } catch { return null; } };
export const terminalOf = (envelope) => envelope?.result?.terminal ?? jsonOf(envelope?.stdout)?.result?.terminal ?? null;

const JSON_FLAG = CALLS.defaults?.jsonFlag ?? 'json';
const ENVELOPE_SCHEMA = CALLS.envelope?.schema ?? 'starci/orca-call-result@1';

const entryOf = (verb) => {
  const entry = CALLS.calls?.[verb];
  if (!entry) throw new Error(`orcaCall: modules/host/orca/calls.yaml declares no call '${verb}'`);
  return entry;
};

const words = (command) => String(command ?? '').split(/\s+/).filter(Boolean);
const at = (root, dotted) => dotGet(root, dotted);
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

// Only a read listing is kept: a host that did not answer is asked again at the
// next mutation instead of refusing every later call of this process.
let listingHostUnavailable = false;
function agentContextListing() {
  if (liveListing) return liveListing;
  const entry = CALLS.calls?.['agent-context'];
  if (!entry) return null;
  const r = orcaRun([...words(entry.command), `--${JSON_FLAG}`],
    { timeout: entry.timeoutMs ?? CALLS.defaults?.timeoutMs ?? 30000 });
  const receipt = jsonOf(r.stdout);
  liveListing = listingOf(receipt?.commands ?? receipt?.result?.commands ?? null);
  listingHostUnavailable = !liveListing && hostUnavailableOf(r, receipt);
  return liveListing;
}

const liveDrift = (entry) => missingFrom(agentContextListing(), entry, JSON_FLAG);

const driftEnvelope = (verb, entry, missing) => ({
  hostUnavailable: missing.listing === 'unreadable' && listingHostUnavailable,
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
 * The error text an Orca receipt carries: `<code>: <message>` from
 * {error:{code,message}}, the string of {error:'...'}, or null. Orca writes its
 * refusal as JSON on stdout with an empty stderr, so a caller that read only
 * stderr saw an empty error: nivo's dispatches were rejected at task-create
 * with error "" for a whole restart (inc-5c0ff394e676).
 */
function receiptErrorText(receipt) {
  const e = receipt?.error;
  if (e == null || e === false) return null;
  if (typeof e === 'string') return e || null;
  if (typeof e === 'object') {
    const code = typeof e.code === 'string' ? e.code : null;
    const message = typeof e.message === 'string' ? e.message : null;
    if (code && message) return message.includes(code) ? message : `${code}: ${message}`;
    return code ?? message ?? JSON.stringify(e);
  }
  return String(e);
}

/**
 * The error an envelope reports: spawn error, the receipt's own error (it names the refusal; stderr may carry only a
 * harmless crashpad line of the orca CLI), then stderr, else a failed call's stdout.
 */
const envelopeError = (r, receipt) => r.error || receiptErrorText(receipt) || r.stderr
  || (r.status !== 0 && r.status != null ? String(r.stdout ?? '').slice(0, 500) || `exit ${r.status}` : r.stderr);

// ---- replay (calls.yaml idempotency) ------------------------------------------
// Every mutation declares `replay`:
//   none     never re-issued by the runner; the caller reconciles from a read.
//   reissue  naturally idempotent on its target (stop, release, a status write):
//            a lost receipt is recovered by issuing the same call once more.
//   request  not idempotent (a second Run, a second rebind, a second worker): the
//            first issue already carries --retry-request <id>, the id derived
//            from the caller's ledger identity, so a lost receipt is settled by
//            request-show and one replay under the same id. Orca answers a
//            replay with the recorded outcome instead of a second effect, also
//            after a process restart that re-derives the same id.
const REPLAY_MODES = Object.freeze(['none', 'reissue', 'request']);
const RETRY_FLAG = CALLS.idempotency?.flag ?? 'retry-request';

const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : (v && typeof v === 'object'
    ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
    : JSON.stringify(v ?? null));

/**
 * The deterministic --retry-request id of one mutation: the verb plus the
 * caller's ledger identity (workflow, job, lease, run, handle - never a clock
 * or a random value), so a restarted process derives the same id. Orca 1.4.209
 * accepts only a UUID here, so the id is the UUIDv5 of that name under the one
 * namespace below.
 */
// The namespace of every --retry-request id the runtime derives: generated once, never changed (a new value would
// make a restarted process derive different ids and lose its replays).
export const ORCA_REQUEST_NAMESPACE = '96fe63b0-5b42-4411-8490-6b5ae7b7dcb2';

/** RFC 9562 UUIDv5: SHA-1 over the namespace's 16 bytes then the name's UTF-8 bytes, version 5, variant 10. */
export function uuidv5(namespace, name) {
  const ns = Buffer.from(String(namespace).replace(/-/g, ''), 'hex');
  const b = crypto.createHash('sha1').update(ns).update(Buffer.from(String(name), 'utf8')).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function orcaRequestIdOf(verb, identity) {
  if (!identity || typeof identity !== 'object' || !Object.keys(identity).some((k) => filled(identity[k])))
    throw new Error(`orcaCall ${verb}: a request-replay mutation needs its ledger identity (request: {...})`);
  return uuidv5(ORCA_REQUEST_NAMESPACE, `${verb}\0${canonical(identity)}`);
}

/** The process timed out, or Orca answered without a JSON receipt: the effect is unknown, not refused. */
const receiptLost = (r, receipt) => r.spawnError === 'ETIMEDOUT' || (r.status !== null && r.status !== undefined && !r.spawnError && receipt === null);

function issue(verb, entry, argv, timeout) {
  const r = orcaRun(argv, { timeout: timeout ?? entry.timeoutMs ?? CALLS.defaults?.timeoutMs ?? 30000,
    ...(entry.kind === 'read' ? { maxBuffer: READ_MAX_BUFFER } : {}) });
  return { r, receipt: jsonOf(r.stdout) };
}

function envelopeOf(verb, entry, { r, receipt }, request = null, override = null) {
  const { outcome, effectState, reason } = override ?? classify(entry, r.status, receipt);
  return {
    schema: ENVELOPE_SCHEMA,
    verb,
    command: entry.command,
    kind: entry.kind ?? null,
    outcome,
    effectState,
    reason,
    hostUnavailable: hostUnavailableOf(r, receipt),
    missing: null,
    exitCode: r.status,
    receipt,
    result: receipt?.result ?? null,
    stdout: r.stdout,
    stderr: r.stderr,
    error: envelopeError(r, receipt),
    request,
  };
}

/** request-show for one id: its state (completed | pending | absent) or null when Orca gave no readable answer. */
export function requestStateOf(id) {
  const entry = entryOf('request-show');
  const { receipt } = issue('request-show', entry, buildArgv('request-show', entry, { request: id }));
  const state = receipt?.result?.state;
  return ['completed', 'pending', 'absent'].includes(state) ? state : null;
}

/**
 * Runs one wrapper as its CLI: `node <file>` prints the wrapper's result as JSON and exits non-zero when it is not ok.
 */
export function runAsCli(file, call) {
  if (!process.argv[1]?.endsWith(file)) return;
  const out = call(process.argv.slice(2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

/**
 * Issue one calls.yaml call. `params` are keyed by the flag names calls.yaml
 * declares; anything else is a contract violation and throws. A `replay:
 * request` mutation needs `request` (its ledger identity); no other call takes
 * one. Returns the starci/orca-call-result@1 envelope — never a raw SpawnResult.
 */
export function orcaCall(verb, params = {}, { timeout, request } = {}) {
  const entry = entryOf(verb);
  const mode = entry.replay ?? null;
  if (entry.kind === 'mutation' && !REPLAY_MODES.includes(mode))
    throw new Error(`orcaCall ${verb}: calls.yaml must declare replay ${REPLAY_MODES.join('|')} for a mutation`);
  if (Object.hasOwn(params, RETRY_FLAG) && mode === 'request')
    throw new Error(`orcaCall ${verb}: --${RETRY_FLAG} is derived from the request identity, never passed`);
  if (request !== undefined && request !== null && mode !== 'request')
    throw new Error(`orcaCall ${verb}: a request identity is only for replay: request mutations (calls.yaml declares ${mode ?? 'a read'})`);
  const requestId = mode === 'request' ? orcaRequestIdOf(verb, request) : null;
  const argv = buildArgv(verb, entry, requestId ? { ...params, [RETRY_FLAG]: requestId } : params);
  if (entry.kind === 'mutation' && readEnv('STARCI_ORCA_SKIP_LIVE_CHECK') !== '1') {
    const missing = liveDrift(entry);
    if (missing) return driftEnvelope(verb, entry, missing);
  }
  const first = issue(verb, entry, argv, timeout);
  if (entry.kind !== 'mutation' || !receiptLost(first.r, first.receipt)) {
    return envelopeOf(verb, entry, first, requestId ? { id: requestId, replayed: first.receipt?.result?.mutation?.replayed === true, state: null } : null);
  }
  if (mode === 'reissue') return envelopeOf(verb, entry, issue(verb, entry, argv, timeout), { id: null, replayed: true, state: 'reissued' });
  if (mode === 'none') return envelopeOf(verb, entry, first);
  const state = requestStateOf(requestId);
  if (state === 'completed' || state === 'pending')
    return envelopeOf(verb, entry, issue(verb, entry, argv, timeout), { id: requestId, replayed: true, state });
  // Absent is not proof that nothing happened (request-show): unknown, never a blind second issue.
  const unsettled = state === 'absent'
    ? { outcome: 'unknown', effectState: 'unknown', reason: 'request-absent' }
    : { outcome: 'unknown', effectState: 'unknown', reason: 'request-show-unreadable' };
  return envelopeOf(verb, entry, first, { id: requestId, replayed: false, state }, unsettled);
}

/** The normalized result of a worker lifecycle verb (worker-stop, worker-release): {ok, outcome, effectState, dispatchId, state, result, error}. */
export function workerVerb(verb, dispatch) {
  const r = orcaCall(verb, { dispatch });
  const result = r.result;
  return {
    ok: r.outcome === 'ok',
    outcome: r.outcome,
    effectState: r.effectState,
    dispatchId: result?.dispatchId ?? null,
    state: result?.state ?? null,
    result,
    error: r.error,
  };
}
