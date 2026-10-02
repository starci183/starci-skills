// worker-verbs-list.mjs - project Orca worker accounting for the lead-facing worker list.
import path from 'node:path';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { worktreePs } from '../api/orca/worktree-ps.mjs';
import { worktreePathOf } from '../lib/worker-accounting.mjs';
import { workerListAll } from './worker-list-all.mjs';

const text = (value) => String(value ?? '').trim();
const pathKey = (value) => path.resolve(String(value ?? '')).replaceAll('\\', '/').toLowerCase();

const startOptionsOf = (row) => {
  if (row?.startOptions && typeof row.startOptions === 'object') return row.startOptions;
  try { return JSON.parse(row?.start_options ?? 'null') ?? {}; } catch { return {}; }
};

export function agentOfWorker(row) {
  const options = startOptionsOf(row);
  return text(row?.agentType ?? row?.agent ?? row?.provider ?? row?.launch?.effective?.agent
    ?? row?.projection?.agent?.id ?? row?.projection?.agent?.type ?? options.agent
    ?? options.launch?.requested?.agent ?? options.launch?.effective?.agent) || 'unknown';
}

export function taskTitleOfWorker(row) {
  const options = startOptionsOf(row);
  return text(row?.taskTitle ?? row?.task_title ?? row?.task?.title ?? row?.projection?.task?.title
    ?? options['task-title'] ?? options.taskTitle) || '-';
}

/** Working agents grouped by registered Orca worktree. */
export function workingByLane(worktrees = [], { worktree = null } = {}) {
  const wanted = worktree ? pathKey(worktree) : null;
  const lanes = [];
  for (const row of worktrees) {
    if (!row?.path || (wanted && pathKey(row.path) !== wanted)) continue;
    const byAgent = {};
    for (const agent of row.agents ?? []) {
      if (agent?.state !== 'working') continue;
      const kind = text(agent.agentType ?? agent.agent ?? agent.type) || 'unknown';
      byAgent[kind] = (byAgent[kind] ?? 0) + 1;
    }
    lanes.push({ worktree: row.path, byAgent });
  }
  lanes.sort((a, b) => a.worktree.localeCompare(b.worktree));
  return lanes;
}

const terminalAgent = (terminal) => {
  const identity = terminal?.agentIdentity;
  const raw = text(typeof identity === 'string' ? identity : identity?.agent ?? identity?.id ?? terminal?.agent ?? terminal?.provider).toLowerCase();
  return ['codex', 'claude', 'devin', 'cursor'].find((agent) => raw === agent || raw.includes(agent)) ?? raw;
};

/** Fill the normalized worktree-ps rows from terminal-list when Orca omits their legacy agents array. */
export async function worktreesWithWorkingAgents(worktrees = [], list = terminalList) {
  const rows = [];
  for (const row of worktrees) {
    if (Array.isArray(row?.agents)) { rows.push(row); continue; }
    const terminals = await list({ worktree: `path:${row.path}` });
    if (!terminals?.ok) return { ok: false, worktrees: rows, error: terminals?.error ?? `terminal listing failed for ${row.path}` };
    const agents = (terminals.terminals ?? []).filter((terminal) => terminal?.connected !== false && terminalAgent(terminal))
      .map((terminal) => ({ state: 'working', agentType: terminalAgent(terminal) }));
    rows.push({ ...row, agents });
  }
  return { ok: true, worktrees: rows };
}

/** Resolve a path to a registered worktree in the same Orca repository as cwd. */
export function registeredWorktree(worktrees, requested, cwd) {
  const targetKey = pathKey(path.resolve(cwd, requested));
  const target = worktrees.find((row) => row?.path && pathKey(row.path) === targetKey) ?? null;
  if (!target) return null;
  const hereKey = pathKey(cwd);
  const here = worktrees.filter((row) => row?.path && (hereKey === pathKey(row.path) || hereKey.startsWith(`${pathKey(row.path)}/`)))
    .sort((a, b) => pathKey(b.path).length - pathKey(a.path).length)[0] ?? null;
  if (here?.repoId && target.repoId && here.repoId !== target.repoId) return null;
  return target;
}

export function projectWorker(row) {
  return {
    dispatchId: row?.dispatchId ?? null,
    state: row?.workerState ?? row?.state ?? null,
    agent: agentOfWorker(row),
    taskTitle: taskTitleOfWorker(row),
    liveness: row?.projection?.liveness?.verdict ?? null,
    terminalState: row?.terminalState ?? null,
    worktree: worktreePathOf(row),
  };
}

const listText = (workers) => workers.length
  ? workers.map((row) => [row.dispatchId ?? '-', row.state ?? '-', row.agent, row.taskTitle, row.liveness ?? '-', row.terminalState ?? '-'].join('\t')).join('\n')
  : 'no workers';

const laneText = (lanes, total) => {
  const rows = lanes.map((lane) => {
    const counts = Object.entries(lane.byAgent).sort(([a], [b]) => a.localeCompare(b)).map(([agent, count]) => `${agent} ${count}`).join('  ');
    return `${lane.worktree}: ${counts || 'no working agents'}`;
  });
  rows.push(`host total ${total}`);
  return rows.join('\n');
};

/** List supervised workers, or aggregate working agents by Orca worktree. */
export async function workerListVerb(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  if (args['by-lane']) {
    const ps = await (deps.worktreePs ?? worktreePs)();
    if (!ps?.ok) return { code: 1, text: `starci worker list: ${ps?.error ?? 'Orca worktree listing failed'}`,
      data: { schema: 'starci/worker-list@1', ok: false, lanes: [], total: 0 } };
    if (ps.truncated || ps.omittedHostIds?.length) return { code: 1, text: 'starci worker list: Orca returned an incomplete host worktree listing',
      data: { schema: 'starci/worker-list@1', ok: false, lanes: [], total: 0 } };
    const populated = await worktreesWithWorkingAgents(ps.worktrees, deps.terminalList ?? terminalList);
    if (!populated.ok) return { code: 1, text: `starci worker list: ${populated.error}`,
      data: { schema: 'starci/worker-list@1', ok: false, lanes: [], total: 0 } };
    const allLanes = workingByLane(populated.worktrees);
    const requested = args.worktree ? path.resolve(ctx?.cwd ?? process.cwd(), args.worktree) : null;
    const lanes = requested ? workingByLane(populated.worktrees, { worktree: requested }) : allLanes;
    const total = allLanes.reduce((sum, lane) => sum + Object.values(lane.byAgent).reduce((n, count) => n + count, 0), 0);
    return { code: 0, text: laneText(lanes, total), data: { schema: 'starci/worker-list@1', ok: true, lanes, total } };
  }

  const listed = await (deps.workerListAll ?? workerListAll)({ run: args.run, terminalState: args.active ? 'active' : undefined });
  if (!listed?.ok) return { code: 1, text: `starci worker list: ${listed?.error ?? 'worker listing failed'}`,
    data: { schema: 'starci/worker-list@1', ok: false, workers: [] } };
  let workers = listed.workers.map(projectWorker);
  if (args.worktree) {
    const wanted = pathKey(path.resolve(ctx?.cwd ?? process.cwd(), args.worktree));
    workers = workers.filter((row) => row.worktree && pathKey(row.worktree) === wanted);
  }
  return { code: 0, text: listText(workers), data: { schema: 'starci/worker-list@1', ok: true, workers, total: workers.length } };
}
