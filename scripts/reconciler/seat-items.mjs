// seat-items.mjs — the agent-seat rows of the host checklist (Supervisor, Kernel, core debug) and the read of the running
// workflows that decide whether an idle seat is a problem. A seat consumes provider quota, so it is started only by
// `workflow start`, `supervisor start` or an explicit owner request; a read-only pass shows a seat that is not running
// as idle (green, `idle: true`) until a running workflow, or the owner's own start, needs it.
import path from 'node:path';
import { execNode } from '../api/node/exec-node.mjs';
import { eachInOrder } from '../lib/in-order.mjs';
import { DEFAULT_SUPERVISOR_MODE, supervisorMode } from '../machine/home.mjs';
import { SKILL_ROOT } from './state.mjs';
import { green, red, warn } from './checklist-items.mjs';

const IDLE_SEAT = 'not running (starts with a workflow)';
const idleRow = (id, name) => green('seats', id, name, IDLE_SEAT, { required: false, idle: true });

/** The last JSON object a node child printed, or null (`{ok: false, error: 'timeout'}` when it timed out). */
export async function json(args, { timeoutMs = 120_000 } = {}) {
  const { error, stdout } = await execNode(args, { cwd: SKILL_ROOT, timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
  const lines = String(stdout ?? '').trim().split(/\r?\n/).reverse();
  for (const line of lines) { try { const v = JSON.parse(line); if (v && typeof v === 'object') return v; } catch { /* next */ } }
  return error?.killed || error?.code === 'ETIMEDOUT' ? { ok: false, error: 'timeout' } : null;
}

/** The Supervisor seat row from `start-supervisor.mjs --status --json` (or the mode). `needed` is false for an idle host. Pure. */
function supervisorItem({ mode, statusJson, needed = true }) {
  if (mode !== 'kernel') return green('seats', 'supervisor', 'Supervisor seat', 'chat mode: the owner\'s desktop chat is the Supervisor (nothing to start)');
  const h = statusJson?.health;
  if (h?.live) {
    const terminal = h.terminal ? ` (${h.terminal})` : '';
    const starting = h.starting ? ', starting' : '';
    return green('seats', 'supervisor', 'Supervisor seat', `live${terminal}${starting}`);
  }
  const fix = 'starci supervisor start --json';
  if (needed) return red('seats', 'supervisor', 'Supervisor seat', h ? `not live: ${h.reason ?? 'unknown'}` : 'status unreadable', fix);
  return h ? idleRow('supervisor', 'Supervisor seat') : warn('seats', 'supervisor', 'Supervisor seat', 'status unreadable', fix);
}

/** A Kernel seat row from a watchdog `--once --json` answer. Pure. */
function kernelSeatItem({ ledger, workflowId, answer, seatState }) {
  const name = `Kernel seat ${workflowId}`;
  const id = `seat:kernel:${ledger}:${workflowId}`;
  const action = answer?.action ?? null;
  if (seatState === 'live' && answer?.ok !== false) return green('seats', id, name, `live (${action ?? 'ok'})`);
  const state = seatState ?? 'unknown';
  const actionText = action ? ` (${action})` : '';
  const error = answer?.error ? `: ${String(answer.error).slice(0, 120)}` : '';
  return red('seats', id, name, `${state}${actionText}${error}`,
    `starci machine kernel-watchdog --repo <repo> --workflow ${workflowId} --once --repair --json`);
}

const modeOf = (env, config) => { try { return supervisorMode({ env, config }); } catch { return DEFAULT_SUPERVISOR_MODE; } };

/** The Supervisor seat row (read through `start-supervisor --status` when its seat can be reached). Seam: read. */
export async function supervisorRow({ env, config, orca, seats, orcaProbe, needed = true, read = json }) {
  const mode = modeOf(env, config);
  if (mode === 'kernel' && seats && orcaProbe.ok) {
    const st = await read([path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs'), '--status', '--json'], { timeoutMs: 90_000 });
    return supervisorItem({ mode, statusJson: st, needed });
  }
  if (mode !== 'kernel') return supervisorItem({ mode });
  if (!needed) return idleRow('supervisor', 'Supervisor seat');
  return red('seats', 'supervisor', 'Supervisor seat', orca ? 'Orca is not reachable' : 'not checked', 'open Orca, then run start again');
}

/** The Core debug seat row; `needed` false turns a seat that is not ready into an idle row. Seam: status. */
export async function coreDebugRow(env, { needed = true, status = null } = {}) {
  let health;
  try { health = (status ?? (await import('./core-debug.mjs')).coreDebugStatus)({ env }); }
  catch (error) { health = { ready: false, error: String(error?.message ?? error) }; }
  if (health.ready === true) return green('seats', 'core-debug', 'Core debug seat', 'native worker live on its bound caller route');
  if (!needed) return idleRow('core-debug', 'Core debug seat');
  return red('seats', 'core-debug', 'Core debug seat', health.error ?? health.health?.reason ?? 'not ready', 'run the approved StarCi start with its declared caller route');
}

/** Every running workflow of every managed repo: [{repo, workflowId}]. Read-only. */
async function runningWorkflowRows({ config = null } = {}) {
  const { resumeRepos, runningWorkflows } = await import('../kernel/managed-repos.mjs');
  const { repos } = resumeRepos({ config });
  return repos.flatMap((repo) => runningWorkflows(repo).map((wf) => ({ repo, workflowId: wf.workflowId })));
}

/**
 * Whether an idle agent seat is a problem: a start path (`seatsRequested`: the owner's own start or a workflow's) needs every
 * seat, a read-only pass needs one only while a workflow runs. {needed, rows}; `rows` are the running workflows of a read-only
 * pass (null on a start path, which reads them itself). Seam: running.
 */
export async function seatNeed({ config = null, seatsRequested = true }, { running = runningWorkflowRows } = {}) {
  if (seatsRequested) return { needed: true, rows: null };
  let rows = [];
  try { rows = await running({ config }); } catch { rows = []; }
  return { needed: rows.length > 0, rows };
}

/** The Kernel seat of every running workflow, read through the watchdog's pass (read-only unless `repair`). Seam: rows. */
export async function kernelSeatItems({ orcaOk = true, config = null, repair = false, rows = null } = {}) {
  const { seatStateOf } = await import('./controllers/host.mjs');
  const running = rows ?? await runningWorkflowRows({ config });
  if (!running.length) return [green('seats', 'seat:kernel', 'Kernel seats', 'no running workflow', { required: false })];
  const out = [];
  await eachInOrder(running, async ({ repo, workflowId }) => {
    const ledger = path.basename(repo);
    if (!orcaOk) { out.push(red('seats', `seat:kernel:${ledger}:${workflowId}`, `Kernel seat ${workflowId}`, 'Orca is not reachable', 'open Orca, then run start again')); return; }
    const args = [path.join(SKILL_ROOT, 'scripts', 'kernel', 'kernel-watchdog.mjs'), '--repo', repo, '--workflow', workflowId, '--once', '--json', ...(repair ? ['--repair'] : [])];
    const answer = await json(args, { timeoutMs: 300_000 });
    out.push(kernelSeatItem({ ledger, workflowId, answer, seatState: answer?.action ? seatStateOf(answer.action) : null }));
  });
  return out;
}
