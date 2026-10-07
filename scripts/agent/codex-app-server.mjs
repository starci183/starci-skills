// scripts/agent/codex-app-server.mjs — the runtime's `codex app-server` client (kept out of trust.mjs, which is over
// its size budget).
//
// Codex computes the hash it trusts a hook by; launch trust asks it through the app-server protocol the way Orca
// trusts its own hooks (scripts/agent/trust.mjs trustCodexToolGuard). The client is a node one-shot: it spawns
// `codex app-server`, sends initialize then each request, and prints one stdout line — the results array, or
// {failed} when codex ended (or never started) before answering. Without that line an early exit only drained the
// client's event loop: exit 0, nothing printed, and codex's stderr discarded — so "answered nothing (exit 0)" was
// the client's exit, never codex's. The failure names codex's exit/signal, the request it left unanswered, its
// stderr tail, `codex --version` and the CODEX_HOME it ran with; its text starts with APP_SERVER_FAILURE, which
// scripts/agent/provider-outage.mjs reads as a worker-start strike of the codex circuit.
//
// The probe is a runtime-owned child: it gets the caller's env without the seat identity or the seat's guard-shim
// PATH (scripts/lib/seat-env.mjs). A launch-trust call made under a Kernel seat otherwise inherits both — and
// `codex`'s own launcher resolves `node` through PATH, so the seat's tool wrapper bound the seat's role to it and
// refused the probe as a raw tool call (RIGHTS_RAW_TOOL, exit 2; `codex --version` printed the same refusal).
import { runNode } from '../api/node/run-node.mjs';
import { parseJson } from '../lib/json.mjs';
import { withoutSeatEnv, withoutSeatShim } from '../lib/seat-env.mjs';

// Every launch-trust app-server failure starts with this text; provider-outage.mjs classifies it.
export const APP_SERVER_FAILURE = 'codex app-server answered nothing';

const APP_SERVER_CLIENT = String.raw`
const { spawn, spawnSync } = require('node:child_process');
const reqs = JSON.parse(process.argv[1]);
const p = spawn('codex app-server', { shell: true, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
const out = []; let buf = ''; let next = 0; let ready = false; let err = '';
const send = (o) => p.stdin.write(JSON.stringify(o) + '\n');
const ask = () => { if (next >= reqs.length) { console.log(JSON.stringify(out)); p.kill(); process.exit(0); } send({ id: 100 + next, ...reqs[next] }); };
const fail = (exit, signal, spawnError) => {
  const v = spawnSync('codex --version', { shell: true, encoding: 'utf8', timeout: 15000, windowsHide: true });
  const version = String(v.stdout || v.stderr || '').trim() || null;
  console.log(JSON.stringify({ failed: { exit, signal, spawnError, stage: ready ? reqs[next].method : 'initialize', stderr: err.trim(), version } }));
  process.exit(3);
};
p.stdin.on('error', () => {});
p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(line); } catch { continue; }
  if (m.id === 1) { ready = true; send({ method: 'initialized' }); ask(); }
  else if (m.id === 100 + next) { out.push(m.error ? { error: m.error } : m.result); next += 1; ask(); } } });
p.on('error', (e) => fail(null, null, e.message));
p.on('close', (code, signal) => fail(code, signal, null));
send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'starci-launch-trust', version: '1' } } });
`;

const tail = (text, n) => { const t = String(text ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? '...' + t.slice(-n) : t; };

// The error of an app-server call that returned no results: what ended it (codex's exit/signal or the client's own),
// codex's stderr tail and version, and the CODEX_HOME it ran with.
function appServerFailure({ home, timeoutMs, r, failed }) {
  const parts = [];
  if (failed) {
    parts.push(
      failed.spawnError ? 'did not start: ' + failed.spawnError
        : 'exited ' + (failed.exit ?? 'on ' + failed.signal) + ' before answering ' + failed.stage,
      failed.stderr ? 'stderr: ' + tail(failed.stderr, 400) : 'no stderr',
      failed.version ? 'codex --version: ' + tail(failed.version, 120) : 'codex --version printed nothing');
  } else {
    parts.push('client exit ' + r.status + (r.error ? ': ' + r.error.message : ''));
    if (r.error?.code === 'ETIMEDOUT') parts.push('no answer within ' + timeoutMs + 'ms');
    const stderr = tail(r.stderr, 400);
    if (stderr) parts.push('client stderr: ' + stderr);
  }
  parts.push('CODEX_HOME ' + home);
  return APP_SERVER_FAILURE + ' (' + parts.join('; ') + ')';
}

/**
 * The app-server calls of one Codex home, in order: `requests` [{method, params}] -> results[] (an error result is
 * {error}). No results throws the precise failure (appServerFailure).
 */
export function codexAppServer({ home, requests, timeoutMs = 60_000, env = process.env }) {
  const r = runNode(['-e', APP_SERVER_CLIENT, JSON.stringify(requests)], { timeout: timeoutMs,
    env: { ...withoutSeatShim(withoutSeatEnv(env)), CODEX_HOME: home } });
  const last = parseJson(String(r.stdout ?? '').trim().split(/\r?\n/).pop() ?? '', null);
  if (Array.isArray(last)) return last;
  throw new Error(appServerFailure({ home, timeoutMs, r, failed: last?.failed ?? null }));
}
