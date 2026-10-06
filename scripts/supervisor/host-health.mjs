// host-health.mjs — the process table the reconciler host and resource controllers read: node.exe and git.exe
// counts, the parents holding the most of them, and the per-owner grouping each bottleneck sample records. A count
// over its threshold is reported, never stopped.
import os from 'node:os';
import { killTree } from '../api/process/kill-tree.mjs';
import { processList } from '../api/process/process-list.mjs';
import { processListAsync } from '../api/process/process-list-async.mjs';

/** Every process on this host: [{pid, ppid, name, exe, cmd, ws, created, cpu}] (cpu: % of one core), or null when unreadable. */
export function listProcesses({ platform = process.platform, run = undefined } = {}) {
  if (platform !== 'win32') return null;
  return processList({ cmdMax: 600, cpu: true, run, platform, timeoutMs: 180_000 });
}

/** listProcesses without blocking the thread (the reconciler engine's read): same rows, or null. */
export function listProcessesAsync({ platform = process.platform, run = null } = {}) {
  if (platform !== 'win32') return Promise.resolve(null);
  return processListAsync({ cmdMax: 600, cpu: true, run, platform, timeoutMs: 180_000 });
}

const indexOf = (procs) => {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const children = new Map();
  for (const p of procs) {
    if (!children.has(p.ppid)) { children.set(p.ppid, []); }
    children.get(p.ppid).push(p);
  }
  return { byPid, children };
};

/** The live parent of `p`, or null: a recorded ppid that is gone, or was reused by a younger process, is no parent. */
export const parentOf = (p, byPid) => {
  const parent = byPid.get(p.ppid);
  return parent && parent.pid !== p.pid && !(p.created && parent.created > p.created) ? parent : null;
};

/** {node, git, all} process counts. */
const processCounts = (procs) => ({
  all: procs.length,
  node: procs.filter((p) => String(p.name).toLowerCase() === 'node.exe').length,
  git: procs.filter((p) => String(p.name).toLowerCase() === 'git.exe').length,
});

/** The parents that hold the most node/git processes: [{parentPid, count, cmd}], top `limit`. Pure. */
export function topParents(procs, { limit = 5 } = {}) {
  const { byPid } = indexOf(procs);
  const by = new Map();
  for (const p of procs.filter((x) => ['node.exe', 'git.exe'].includes(String(x.name).toLowerCase()))) {
    const parent = parentOf(p, byPid);
    const key = parent?.pid ?? 0;
    by.set(key, { parentPid: key, count: (by.get(key)?.count ?? 0) + 1, cmd: parent ? `${parent.name} ${String(parent.cmd ?? '').slice(0, 160)}` : '(parent gone)' });
  }
  return [...by.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * The host-health verdict over one process table: {counts, over, alert, topParents}. `alert`: a count over its
 * threshold. Pure.
 */
export function hostVerdict(procs, { maxNode, maxGit }) {
  const counts = processCounts(procs);
  const over = counts.node > maxNode || counts.git > maxGit;
  if (!over) return { counts, over, alert: false, topParents: [] };
  return { counts, over, alert: true, topParents: topParents(procs) };
}

/** Stop one process tree, forced. {ok, rootPid, output}. */
export function stopTree(rootPid, { platform = process.platform, run = undefined } = {}) {
  const r = killTree(rootPid, { platform, run, timeoutMs: 120_000 });
  return { ok: r.ok, rootPid, output: r.output };
}

const OP_ID = /\b(op-[a-z][\w.]*-[0-9a-f]{10})\b/i;
const KERNEL_JOB = /\b(kernel-wf-[\w.-]+)/i;
const WORKFLOW = /--(?:workflow|goal)\s+"?(wf-[\w.-]+)/i;
const LANE = /starci-lanes[\\/]([\w.-]+)/i;
const AGENTS = [['claude', /(?:^|[\\/])claude\.exe$/i], ['codex', /(?:^|[\\/])codex\.exe$/i], ['devin', /(?:^|[\\/])devin\.exe$/i]];

/** Who owns one process, read from its own command line: an op job, a kernel, a watchdog, a lane, an agent. */
const identityOf = (p) => {
  const cmd = String(p.cmd ?? '');
  const op = OP_ID.exec(cmd); if (op) return `op:${op[1]}`;
  const kernel = KERNEL_JOB.exec(cmd); if (kernel) return `job:${kernel[1]}`;
  const wf = WORKFLOW.exec(cmd); if (wf) return /watchdog\.mjs/i.test(cmd) ? `watchdog:${wf[1]}` : `workflow:${wf[1]}`;
  const lane = LANE.exec(cmd); if (lane) return `lane:${lane[1]}`;
  if (/[\\/]scripts[\\/]supervisor[\\/]/i.test(cmd)) return 'supervisor';
  for (const [name, re] of AGENTS) if (re.test(p.exe ?? '') || re.test(String(p.name ?? ''))) return `agent:${name}`;
  return null;
};

/**
 * Processes grouped by the nearest ancestor (or self) whose command line names its owner; the rest by image name:
 * [{key, procs, ramMb, cpuPct}], the top limit/2 by CPU and the top limit/2 by RAM, sorted by CPU then RAM. A
 * process's cpu is % of one core; cpuPct is % of the host.
 */
export function groupByOwner(procs, { cores = os.cpus().length || 1, limit = 12 } = {}) {
  const { byPid } = indexOf(procs);
  const memo = new Map();
  const ownerOf = (p, hops = 0) => {
    if (memo.has(p.pid)) return memo.get(p.pid);
    memo.set(p.pid, null);
    const parent = parentOf(p, byPid);
    const found = identityOf(p) ?? (parent && hops < 40 ? ownerOf(parent, hops + 1) : null);
    memo.set(p.pid, found);
    return found;
  };
  const groups = new Map();
  for (const p of procs) {
    const key = ownerOf(p) ?? `image:${String(p.name).toLowerCase()}`;
    const g = groups.get(key) ?? { key, procs: 0, ramMb: 0, cpuPct: 0 };
    g.procs += 1; g.ramMb += Number(p.ws || 0) / 1048576; g.cpuPct += Number(p.cpu || 0) / cores;
    groups.set(key, g);
  }
  const all = [...groups.values()].map((g) => ({ ...g, ramMb: Math.round(g.ramMb), cpuPct: Math.round(g.cpuPct * 10) / 10 }));
  const half = Math.ceil(limit / 2);
  const picked = new Set([...[...all].sort((a, b) => b.cpuPct - a.cpuPct).slice(0, half), ...[...all].sort((a, b) => b.ramMb - a.ramMb).slice(0, half)]);
  return [...picked].sort((a, b) => b.cpuPct - a.cpuPct || b.ramMb - a.ramMb);
}
