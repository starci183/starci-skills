// reap-agent-process.mjs — stop the one agent process a settled op left running.
//
// Orca closes an op terminal's pane and tab, answers ok, and on Windows can
// leave the PTY's agent process alive (exitCause stop_unverified, no renderer
// pane): five settled Claude/Codex op workers kept running hidden on a machine
// already short of memory, and a Kernel's ask form was reaped for lack of it.
// Orca names no pid, so the process is found the way the supervisor found them
// by hand: the agent binary started within a short window of the op's
// dispatch. Only an unambiguous match is stopped - exactly one candidate
// process in the window that no OTHER live agent on this host can own - and
// anything else is reported, never guessed.
//
// The single candidate is usually NOT the settled op's own process: that one
// already quit (quit-agent.mjs) or died, so the one left in the window is a
// live worker another Kernel dispatched in the same minute, on any ledger of
// the host. On 2026-09-23 the reaper killed 34 processes this way, among them
// the live Codex workers of nivo, Mia Mia and StarCi Next ops, which each froze
// at "Working (Nm Ns)" above a bare PowerShell prompt and never filed a report
// (inc-305adcb1d3c1, inc-9912c049df82, inc-19086ab88d7a, inc-83eadbb53ebb,
// inc-31f2b6e59275, inc-9501f02ca59d, inc-09ec4247c3d6, inc-1e98f8d44ad8,
// inc-591629353910, inc-731c37c9e7d1, inc-2de345cd4068, inc-2ce87e0e7703).
// So a candidate is stopped only when the caller proves the window is the
// settled op's alone: `otherLaunches` is the launch time of every other live
// agent the host's ledgers know (running/answering/leased ops, running
// kernels), and a candidate that started inside the window of one of them may
// be that agent's. Without that census nothing is stopped.
import { spawnSync } from 'node:child_process';
import { allocationMs } from '../../engine/config.mjs';

export const REAP_WINDOW_MS = allocationMs('reap.windowMs');

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
 * or why there is none: {pid, candidates} | {pid:null, reason, candidates, rival?}.
 * `otherLaunches` [{id, at}]: the launches of the host's other live agents; a
 * candidate that started within `windowMs` of one of them is never matched.
 */
export function matchAgentProcess(processes, { agent, dispatchedAt, windowMs = REAP_WINDOW_MS, otherLaunches = [] }) {
  const image = AGENT_IMAGE[agent];
  if (!image) return { pid: null, reason: `agent ${agent} has no known op worker image`, candidates: [] };
  if (!Number.isFinite(Number(dispatchedAt))) return { pid: null, reason: 'dispatch time unknown', candidates: [] };
  const candidates = processes.filter((p) => image.test(p.image || p.commandLine.split(/\s/)[0].replace(/"/g, ''))
    && !NOT_A_WORKER.test(p.commandLine)
    && Math.abs(p.startedAt - Number(dispatchedAt)) <= windowMs);
  if (candidates.length !== 1) return { pid: null, reason: candidates.length ? `${candidates.length} ${agent} processes started inside the window; ambiguous` : `no ${agent} process started inside the window`, candidates: candidates.map((p) => p.pid) };
  const [candidate] = candidates;
  const rival = (otherLaunches ?? []).find((launch) => Number.isFinite(Number(launch?.at)) && Math.abs(candidate.startedAt - Number(launch.at)) <= windowMs);
  if (rival) return { pid: null, reason: `${agent} process ${candidate.pid} started inside the launch window of live ${rival.id}; it may be that agent's`, candidates: [candidate.pid], rival: rival.id };
  return { pid: candidate.pid, candidates: [candidate.pid] };
}

/**
 * Stop the matched process tree. Returns a receipt; never throws. `otherLaunches`
 * is required: null (the census could not be read) stops nothing. A spec run
 * (NODE_TEST_CONTEXT) never reads or stops the host's real processes.
 */
export function reapAgentProcess({ agent, dispatchedAt, windowMs = REAP_WINDOW_MS, otherLaunches = null, list = listAgentProcesses, run = spawnSync, platform = process.platform, env = process.env } = {}) {
  if (env.NODE_TEST_CONTEXT && (list === listAgentProcesses || run === spawnSync)) return { reaped: false, reason: 'test context: the host process table is never read or stopped', candidates: [] };
  if (!Array.isArray(otherLaunches)) return { reaped: false, reason: 'live launch census unavailable: another live agent may own every candidate', candidates: [] };
  const match = matchAgentProcess(list({ platform }), { agent, dispatchedAt, windowMs, otherLaunches });
  if (!match.pid) return { reaped: false, reason: match.reason, candidates: match.candidates, ...(match.rival ? { rival: match.rival } : {}) };
  const r = platform === 'win32'
    ? run('taskkill', ['/PID', String(match.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
    : { status: 1, stderr: 'not windows' };
  return { reaped: r.status === 0, pid: match.pid, ...(r.status === 0 ? {} : { reason: String(r.stderr ?? '').trim().slice(0, 200) || `taskkill exited ${r.status}` }) };
}
