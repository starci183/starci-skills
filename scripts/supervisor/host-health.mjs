// host-health.mjs — the process table the reconciler host and resource controllers read: node.exe and git.exe
// counts, the runaway guard-shim chains it may stop on its own, and the per-owner grouping each bottleneck sample
// records.
//
// Incident (2026-09-27, fixed in 1034cdabd): a PATH that looped back to runtime/guards/bin made every git call
// re-enter scripts/guards/shim.mjs; two orphaned chains grew to ~1,400 git and ~1,500 node processes and 59 GB of
// RAM, and Orca stopped answering. Only chains whose every process is part of the shim chain are ever stopped:
//   guard-shim-recursion   shims nested deeper than the shim's own depth limit allows, or a chain of chainMin+
//   orphaned-shim-rev-parse  a `shim.mjs git rev-parse` chain whose parent is gone, older than orphanMinAgeMs
// Anything else over a threshold is reported, never stopped.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { MAX_SHIM_DEPTH } from '../guards/shim.mjs';
import { killProcessTree } from '../lib/kill-tree.mjs';
import { listHostProcesses, listHostProcessesAsync } from '../lib/process-list.mjs';

const SHIM_CMD = /[\\/]scripts[\\/]guards[\\/]shim\.mjs["']?\s+(?:git|npm)\b/i;
const SHIM_EXE = /[\\/]runtime[\\/]guards[\\/]bin[\\/](?:git|npm)(?:\.exe)?$/i;
const REV_PARSE = /\bgit(?:\.exe)?["']?\s+rev-parse\b/i;
// What a shim runs beneath itself: the launcher, node, the real git and its helpers, their consoles.
const CHAIN_IMAGES = new Set(['git.exe', 'node.exe', 'conhost.exe', 'sh.exe', 'bash.exe', 'git-remote-https.exe']);

export const isShim = (p) => SHIM_CMD.test(p?.cmd ?? '') || SHIM_EXE.test(p?.exe ?? '');

/** Every process on this host: [{pid, ppid, name, exe, cmd, ws, created, cpu}] (cpu: % of one core), or null when unreadable. */
export function listProcesses({ platform = process.platform, run = spawnSync } = {}) {
  if (platform !== 'win32') return null;
  return listHostProcesses({ cmdMax: 600, cpu: true, run, platform, timeoutMs: 180_000 });
}

/** listProcesses without blocking the thread (the reconciler engine's read): same rows, or null. */
export function listProcessesAsync({ platform = process.platform, run = null } = {}) {
  if (platform !== 'win32') return Promise.resolve(null);
  return listHostProcessesAsync({ cmdMax: 600, cpu: true, run, platform, timeoutMs: 180_000 });
}

const indexOf = (procs) => {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const children = new Map();
  for (const p of procs) { if (!children.has(p.ppid)) children.set(p.ppid, []); children.get(p.ppid).push(p); }
  return { byPid, children };
};

/** The live parent of `p`, or null: a recorded ppid that is gone, or was reused by a younger process, is no parent. */
export const parentOf = (p, byPid) => {
  const parent = byPid.get(p.ppid);
  return parent && parent.pid !== p.pid && !(p.created && parent.created > p.created) ? parent : null;
};

/** {node, git, all} process counts. */
export const processCounts = (procs) => ({
  all: procs.length,
  node: procs.filter((p) => String(p.name).toLowerCase() === 'node.exe').length,
  git: procs.filter((p) => String(p.name).toLowerCase() === 'git.exe').length,
});

/**
 * The runaway guard-shim chains in a process table:
 *   [{kind, rootPid, size, nesting, safe, orphaned, ageMs, cmd}]
 * `nesting`: the most `node shim.mjs` processes on one path down the chain (a launcher exe is not counted).
 * `safe`: every process under the root belongs to the shim chain, so stopping the tree stops nothing else.
 * Pure over `procs`.
 */
export function findRunaways(procs, { now = Date.now(), chainMin, orphanMinAgeMs, maxDepth = MAX_SHIM_DEPTH } = {}) {
  const { byPid, children } = indexOf(procs);
  const member = new Map();
  const isMember = (p) => {
    if (member.has(p.pid)) return member.get(p.pid);
    member.set(p.pid, false);
    const parent = parentOf(p, byPid);
    const yes = isShim(p) || (CHAIN_IMAGES.has(String(p.name).toLowerCase()) && parent != null && isMember(parent));
    member.set(p.pid, yes);
    return yes;
  };
  const out = [];
  for (const root of procs.filter((p) => isShim(p))) {
    const parent = parentOf(root, byPid);
    if (parent && isMember(parent)) continue;
    let size = 0, nesting = 0, safe = true;
    const shimNode = (p) => SHIM_CMD.test(p.cmd ?? '');
    const stack = [[root, shimNode(root) ? 1 : 0]];
    const seen = new Set();
    while (stack.length) {
      const [p, depth] = stack.pop();
      if (seen.has(p.pid)) continue;
      seen.add(p.pid);
      size += 1;
      nesting = Math.max(nesting, depth);
      if (!isMember(p)) safe = false;
      for (const c of children.get(p.pid) ?? []) if (parentOf(c, byPid) === p) stack.push([c, depth + (shimNode(c) ? 1 : 0)]);
    }
    const ageMs = root.created ? now - root.created : 0;
    const base = { rootPid: root.pid, size, nesting, safe, orphaned: parent == null, ageMs, cmd: String(root.cmd ?? '').slice(0, 200) };
    // A shim at depth maxDepth refuses before it spawns: more nested shims than that, plus the refusing one, is recursion.
    if (nesting > maxDepth + 1 || size >= chainMin) out.push({ kind: 'guard-shim-recursion', ...base });
    else if (parent == null && ageMs >= orphanMinAgeMs && (REV_PARSE.test(root.cmd ?? '') || (children.get(root.pid) ?? []).some((c) => isShim(c) && REV_PARSE.test(c.cmd ?? ''))))
      out.push({ kind: 'orphaned-shim-rev-parse', ...base });
  }
  return out;
}

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
 * The host-health verdict over one process table: {counts, over, runaways, stop, alert, topParents}.
 * `stop`: the safe runaways; `alert`: over a threshold with nothing safe to stop, or an unsafe runaway. Pure.
 */
export function hostVerdict(procs, { maxNode, maxGit, chainMin, orphanMinAgeMs, now = Date.now() }) {
  const counts = processCounts(procs);
  const over = counts.node > maxNode || counts.git > maxGit;
  if (!over) return { counts, over, runaways: [], stop: [], alert: false, topParents: [] };
  const runaways = findRunaways(procs, { now, chainMin, orphanMinAgeMs });
  const stop = runaways.filter((r) => r.safe);
  return { counts, over, runaways, stop, alert: stop.length === 0 || runaways.some((r) => !r.safe), topParents: topParents(procs) };
}

/** Stop one runaway chain: its whole tree, forced. {ok, rootPid, output}. */
export function stopTree(rootPid, { platform = process.platform, run = spawnSync } = {}) {
  const r = killProcessTree(rootPid, { platform, run, timeoutMs: 120_000 });
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
