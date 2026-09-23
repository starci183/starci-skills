// reap-agent-process.mjs — stop the one agent process a settled op left running.
//
// Orca closes an op terminal's pane and tab, answers ok, and on Windows can
// leave the PTY's agent process alive (exitCause stop_unverified, no renderer
// pane): five settled Claude/Codex op workers kept running hidden on a machine
// already short of memory, and a Kernel's ask form was reaped for lack of it.
// Orca names no pid, so the process is found the way the supervisor found them
// by hand: the agent binary started within a short window of the op's
// dispatch. Only an unambiguous match is stopped - exactly one candidate
// process in the window - and anything else is reported, never guessed.
import { spawnSync } from 'node:child_process';

export const REAP_WINDOW_MS = 90_000;

// The agent CLI images an op worker runs as. A Kernel of the same CLI started
// inside the window makes the match ambiguous, which is the safe outcome.
const AGENT_IMAGE = { claude: /(^|[\\/])claude\.exe$/i, codex: /(^|[\\/])codex\.exe$/i };
// Claude Desktop's own claude.exe helpers are never op workers.
const NOT_A_WORKER = /--type=|WindowsApps\\Claude_|--output-format stream-json/i;

/** Agent processes on this host: [{pid, image, commandLine, startedAt}]. Windows only; elsewhere []. */
export function listAgentProcesses({ platform = process.platform, run = spawnSync } = {}) {
  if (platform !== 'win32') return [];
  const script = "Get-CimInstance Win32_Process -Filter \"Name='claude.exe' OR Name='codex.exe'\" | ForEach-Object { [pscustomobject]@{pid=$_.ProcessId; image=$_.ExecutablePath; commandLine=$_.CommandLine; startedAt=([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds()} } | ConvertTo-Json -Compress";
  const r = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (r.status !== 0 || !String(r.stdout ?? '').trim()) return [];
  try {
    const parsed = JSON.parse(r.stdout);
    return (Array.isArray(parsed) ? parsed : [parsed]).map((p) => ({ pid: Number(p.pid), image: String(p.image ?? ''), commandLine: String(p.commandLine ?? ''), startedAt: Number(p.startedAt) }));
  } catch { return []; }
}

/**
 * The one process to stop for an op of `agent` dispatched at `dispatchedAt`,
 * or why there is none: {pid, candidates} | {pid:null, reason, candidates}.
 */
export function matchAgentProcess(processes, { agent, dispatchedAt, windowMs = REAP_WINDOW_MS }) {
  const image = AGENT_IMAGE[agent];
  if (!image) return { pid: null, reason: `agent ${agent} has no known op worker image`, candidates: [] };
  if (!Number.isFinite(Number(dispatchedAt))) return { pid: null, reason: 'dispatch time unknown', candidates: [] };
  const candidates = processes.filter((p) => image.test(p.image || p.commandLine.split(/\s/)[0].replace(/"/g, ''))
    && !NOT_A_WORKER.test(p.commandLine)
    && Math.abs(p.startedAt - Number(dispatchedAt)) <= windowMs);
  if (candidates.length !== 1) return { pid: null, reason: candidates.length ? `${candidates.length} ${agent} processes started inside the window; ambiguous` : `no ${agent} process started inside the window`, candidates: candidates.map((p) => p.pid) };
  return { pid: candidates[0].pid, candidates: [candidates[0].pid] };
}

/** Stop the matched process tree. Returns a receipt; never throws. */
export function reapAgentProcess({ agent, dispatchedAt, windowMs = REAP_WINDOW_MS, list = listAgentProcesses, run = spawnSync, platform = process.platform } = {}) {
  const match = matchAgentProcess(list({ platform }), { agent, dispatchedAt, windowMs });
  if (!match.pid) return { reaped: false, reason: match.reason, candidates: match.candidates };
  const r = platform === 'win32'
    ? run('taskkill', ['/PID', String(match.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
    : { status: 1, stderr: 'not windows' };
  return { reaped: r.status === 0, pid: match.pid, ...(r.status === 0 ? {} : { reason: String(r.stderr ?? '').trim().slice(0, 200) || `taskkill exited ${r.status}` }) };
}
