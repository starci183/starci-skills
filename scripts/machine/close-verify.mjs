#!/usr/bin/env node
// close-verify.mjs — close an Orca terminal the runtime owns AND prove it is gone (owner, 2026-09-28: "why does the
// supervisor not delete its workers, and the ops are full of leftovers!!! there has to be a cleanup").
//
// Root cause of the leftovers: every owner of a terminal asked Orca to close it and never read the answer back. A
// close refused with tab_not_found, a close that stopped the PTY but left the tab in Orca's persisted layout (the
// session came back under a new handle after the next Orca restart), a Kernel closing its OWN terminal (the process
// that would verify dies with it), and a [Worker] whose report was its last act (nobody closed it at all) each left
// an agent or a bare shell behind. 322 idle shells held ~20 GB of RAM on 2026-09-28 and the host rebooted at 12:20.
//
// The ownership model (owner clarification, 2026-09-28):
//   1. a Kernel closes its own op workers at settle (scripts/kernel/cli.mjs settle, a verified close it cannot skip);
//   2. the Supervisor closes its own [Worker]s when they report, are cancelled or land (scripts/supervisor/workers.mjs);
//   3. the Supervisor's tick GC (scripts/supervisor/gc.mjs) sweeps what slipped past 1 and 2 and records each leftover
//      as a lesson: a leftover is a bug in 1 or 2.
//
// closeAndVerify(handle): tab close when the terminal is alone in its tab (so Orca drops it from the sidebar and never
// restores it), pane close otherwise; then terminal show is polled until the handle reads disconnected or unknown to a
// running Orca. A terminal still connected gets one more pane close and one more poll. Returns
//   {handle, ok, proof: 'gone'|'disconnected'|null, attempts, tab?, reason?, error?}
// ok is true only on proof. An Orca that does not answer proves nothing (reason host-unavailable).
//
// A caller running INSIDE the terminal it closes (a Kernel finishing its workflow, a [Worker] filing its report) cannot
// verify: the close ends its own process. closeSelfSafe hands the close to a detached verifier process
// (the `closeSelfSafe` detached verifier) that waits for the caller to finish writing,
// closes, verifies and appends the result to the Supervisor's machine log as a gc.collect row.
//
// Internal entry: spawned by scripts/kernel/kernel-watchdog.mjs; not invoked directly.
// Args: --terminal <handle> [--delay-ms <ms>] [--owner <tag>] [--log].
//
// A WORKER's release goes through scripts/machine/worker-close.mjs (release, this terminal close, and a proof that no process of the terminal's
// shell tree remains): `worker-release` alone does not end every agent (a released cursor worker kept running). This file proves a terminal's close.
import { fileURLToPath } from 'node:url';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { terminalWait } from '../api/orca/terminal-wait.mjs';
import { TERMINAL_GONE_CODES } from '../lib/orca-terminal.mjs';
import { terminalClose } from '../api/orca/terminal-close.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { processList } from '../api/process/process-list.mjs';
import { spawnDetached } from '../api/process/spawn-detached.mjs';
import { isMain } from '../lib/is-main.mjs';

const selfFile = fileURLToPath(import.meta.url);
const VERIFY_MS = 6000;
const VERIFY_INTERVAL_MS = 500;
const SELF_CLOSE_DELAY_MS = 2500;
const RUNTIME_SCRIPT = /[\\/](?:scripts[\\/](?:supervisor|kernel|lib|api|work|route|agent)|engine)[\\/][\w.-]+\.mjs/i;
const AGENT_IMAGE = /^(?:codex|claude|devin)(?:\.exe)?$/i;
const AGENT_NODE_CLI = /(?:@openai[\\/]codex|@anthropic-ai[\\/]claude-code|[\\/]codex(?:\.js)?\s|[\\/]claude(?:\.js)?\s)/i;
/** An agent CLI process (the image, or node running the CLI), never a runtime script. Pure. */
export const isAgentProcess = (p) => !RUNTIME_SCRIPT.test(String(p?.cmd ?? ''))
  && (AGENT_IMAGE.test(String(p?.name ?? '')) || (/^node(?:\.exe)?$/i.test(String(p?.name ?? '')) && AGENT_NODE_CLI.test(String(p?.cmd ?? ''))));

/** What terminal show proves about `handle`: 'gone' | 'disconnected' | 'connected' | 'unknown' (Orca silent). */
export function terminalState(handle, { show = terminalShow } = {}) {
  let shown;
  try { shown = show({ terminal: handle }); } catch { return 'unknown'; }
  if (shown?.ok && shown.terminal) return shown.connected === true ? 'connected' : 'disconnected';
  if (shown && !shown.hostUnavailable && TERMINAL_GONE_CODES.has(shown.errorCode)) return 'gone';
  return 'unknown';
}

/** Close `handle` by tab when nothing else lives in its tab, else by pane. {ok, tab?, error?}. */
function closeOnce(handle, { list = terminalList, close = terminalClose, byPane = false } = {}) {
  let tabId = null, alone = false;
  if (!byPane) {
    try {
      const rows = list()?.terminals ?? [];
      tabId = rows.find((t) => t?.handle === handle)?.tabId ?? null;
      alone = Boolean(tabId) && !rows.some((t) => t?.handle !== handle && t?.tabId === tabId && t?.connected !== false);
    } catch { /* an unreadable listing keeps the pane close */ }
  }
  try {
    if (alone) {
      const r = close({ terminal: handle, tab: true });
      if (r?.ok) return { ok: true, tab: tabId };
    }
    const r = close({ terminal: handle });
    return { ok: r?.ok === true, ...(r?.error ? { error: String(r.error) } : {}) };
  } catch (error) { return { ok: false, error: String(error?.message ?? error) }; }
}

/**
 * Close `handle` and prove it is gone. Seams: show, close, list, sleep, verifyMs. See the header for the result.
 */
export function closeAndVerify(handle, { show = terminalShow, close = terminalClose, list = terminalList, sleep = sleepSync,
  verifyMs = VERIFY_MS, intervalMs = VERIFY_INTERVAL_MS, wait = terminalWait } = {}) {
  if (!handle) return null;
  const before = terminalState(handle, { show });
  if (before === 'gone') return { handle, ok: true, proof: 'gone', attempts: 0 };
  if (before === 'unknown') return { handle, ok: false, proof: null, attempts: 0, reason: 'host-unavailable' };
  const out = { handle, ok: false, proof: null, attempts: 0 };
  for (const byPane of [false, true]) {
    const r = closeOnce(handle, { list, close, byPane });
    out.attempts += 1;
    if (r.tab) out.tab = r.tab;
    if (r.error) out.error = r.error;
    // Orca proves the exit (terminal wait --for exit: an exited or closed handle answers at once); only an answer it cannot give
    // (host down, the verb refused) falls back to polling terminal show.
    let proven = null;
    try { proven = wait({ terminal: handle, for: 'exit', timeoutMs: verifyMs }); } catch { proven = null; }
    const viaWait = proven?.ok === true && !proven.hostUnavailable;
    for (let waited = 0; waited <= (viaWait ? 0 : verifyMs); waited += intervalMs) {
      if (waited > 0) sleep(intervalMs);
      let state;
      if (viaWait) state = proven.satisfied ? 'disconnected' : 'connected';
      else state = terminalState(handle, { show });
      if (state === 'gone' || state === 'disconnected') {
        delete out.error;
        return { ...out, ok: true, proof: state };
      }
      if (state === 'unknown') return { ...out, reason: 'host-unavailable' };
    }
  }
  return { ...out, reason: 'still-connected' };
}

/** The host's process table: [{pid, ppid, name, exe, cmd, created}] or null when unreadable (not Windows, CIM failed). */
export function processTable({ run, platform = process.platform } = {}) {
  if (platform !== 'win32') return null;
  return processList({ cmdMax: 300, run, platform });
}

/** True when this process runs inside `handle` (Orca exports the terminal's own handle to it). */
const isOwnTerminal = (handle, env = process.env) => Boolean(handle) && env.ORCA_TERMINAL_HANDLE === handle;

/**
 * Close `handle` from a caller that may be running inside it: inline closeAndVerify when it is another terminal, a
 * detached verifier (this file's CLI) when it is the caller's own. {handle, ok, proof, detached?, pid?}.
 */
export function closeSelfSafe(handle, { owner = 'runtime', env = process.env, delayMs = SELF_CLOSE_DELAY_MS, verify = closeAndVerify, spawnFn = spawnDetached } = {}) {
  if (!handle) return null;
  if (!isOwnTerminal(handle, env)) return { ...verify(handle), owner };
  try {
    const child = spawnFn(process.execPath, [selfFile, '--terminal', handle, '--delay-ms', String(delayMs), '--owner', owner, '--log'],
      { detached: true, stdio: 'ignore', windowsHide: true, env });
    child.unref?.();
    return { handle, ok: true, proof: null, detached: true, pid: child.pid ?? null, owner };
  } catch (error) {
    return { handle, ok: false, proof: null, detached: true, owner, error: String(error?.message ?? error) };
  }
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const handle = value('terminal');
  if (!handle) { console.error('use: close-verify.mjs --terminal <handle> [--delay-ms <ms>] [--owner <tag>] [--log] [--json]'); process.exit(2); }
  const delay = Number(value('delay-ms'));
  if (Number.isFinite(delay) && delay > 0) sleepSync(Math.min(delay, 60_000));
  const out = { ...closeAndVerify(handle), owner: value('owner') ?? 'runtime' };
  if (argv.includes('--log')) {
    try {
      const { supLog } = await import('./sup-log.mjs');
      const result = out.ok ? out.proof : `NOT closed (${out.reason ?? out.error ?? '?'})`;
      supLog({ kind: 'gc.collect', level: out.ok ? 'info' : 'warn', msg: `${out.owner} closed its own terminal ${handle}: ${result}`,
        data: { class: 'self-close', action: 'close-terminal', target: handle, owner: out.owner, ok: out.ok, ...(out.proof ? { proof: out.proof } : {}), ...(out.reason ? { reason: out.reason } : {}) } });
    } catch { /* the log is best effort; the close already happened */ }
  }
  console.log(JSON.stringify(out));
  process.exit(out.ok ? 0 : 1);
}
