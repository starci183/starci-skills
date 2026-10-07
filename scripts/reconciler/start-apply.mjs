// start-apply.mjs — the host actions `starci reconciler start` applies: the harness UI build, the engine, the services
// that are down and the Supervisor and Kernel seats. Each step takes the `api` seam and appends its outcome to `applied`.
import path from 'node:path';
import { eachInOrder, repeatInOrder } from '../lib/in-order.mjs';
import { SKILL_ROOT } from './state.mjs';
import { serviceWanted } from './start-items.mjs';
import { startOutcome } from './task-health.mjs';

/** Services `start` never launches itself: Orca is a GUI app (the owner opens it); the scheduled task is the owner's. */
const NOT_ACTUATED = new Set(['orca']);

/** Rebuild a stale harness UI: `{ rebuilt, failed }`. */
export async function applyUiBuild(api, env, applied) {
  const ui = api.uiBuildState();
  if (!ui.stale) return { rebuilt: false, failed: false };
  const b = await api.buildUi({ env });
  applied.push(b.ok ? `ui/dist rebuilt (${ui.reason})` : `ui build FAILED: ${b.output}`);
  return { rebuilt: b.ok, failed: !b.ok };
}

/** The log line of an engine restarted out of safe mode (`l` the leader record, `r` the restart receipt). */
function restartedLine(l, r, shadowed) {
  const reasons = l.safeModes?.length ? `controller_modes: ${l.safeModes.join(', ')}` : 'configured active but running shadow';
  const shadowNote = shadowed.length ? `: ${shadowed.join(', ')}` : '';
  const safeNote = r.safe ? ' SAFE (real crash loop)' : '';
  return `engine restarted out of safe mode (${reasons}${shadowNote}): ${r.action} pid ${r.pid ?? '-'}${safeNote}`;
}

/** The engine: down -> ensure; safe without a real crash loop -> a planned restart; a config change applies live (refreshConfig). */
export async function applyEngine(api, { env, leader: l, plan, shadowed }, applied) {
  if (l.fresh && (l.safe || shadowed.length) && !plan.looping) {
    applied.push(restartedLine(l, await api.restartEngine({ env }), shadowed));
  } else if (l.fresh && (l.safe || shadowed.length)) applied.push(`engine left in safe mode: a real crash loop is on record (${plan.starts.length} abnormal start(s) in the window)`);
  else if (!l.fresh) {
    const r = await api.ensure({ env, reason: 'start' });
    const pid = r.pid ? ` pid ${r.pid}` : '';
    const safe = r.safe ? ' SAFE (real crash loop)' : '';
    applied.push(`engine ${r.action}${pid}${safe}`);
  }
}

/** Wait up to `waitMs` for a fresh engine leader, polling every 3 s. */
export async function waitForLeader(api, env, waitMs) {
  const deadline = Date.now() + waitMs;
  await repeatInOrder(async () => {
    if (Date.now() < deadline) {
      if (api.leaderState({ env }).fresh) return true;
      await api.sleep(3000);
      return undefined;
    }
    return true;
  });
}

/** Start every wanted service that is down (never Orca); the harness UI is restarted once more after a rebuild. */
export async function startDownServices(api, { loadConfig, rebuilt }, applied) {
  const probes = await api.probeServices();
  await eachInOrder(probes, async (p) => {
    if (p.ok || NOT_ACTUATED.has(p.name) || !serviceWanted(p.name, loadConfig()) || p.name.startsWith('sched-task:') || !p.entry.restart) return;
    const r = await api.startService(p.name);
    const result = r.ok ? await startOutcome(api, p) : `start FAILED ${String(r.error ?? r.output ?? '').slice(0, 120)}`;
    applied.push(`service ${p.name}: ${result}`);
  });
  if (rebuilt && probes.find((p) => p.name === 'harness-ui')?.ok) { const r = await api.startService('harness-ui'); applied.push(`service harness-ui restarted to serve the new build: ${r.ok ? 'ok' : 'FAILED'}`); }
}

/** The Supervisor seat (kernel mode only) and the Kernel seats of running workflows, once Orca answers. */
export async function startSeats(api, { env, orcaUp, config, workflowSeats }, applied) {
  if (!orcaUp) { applied.push('Orca is not reachable: services, Supervisor seat and Kernel seats were not touched (open Orca, run start again)'); return; }
  if (api.supervisorMode({ env, config }) === 'kernel') {
    const r = await api.json([path.join(SKILL_ROOT, 'scripts', 'supervisor', 'start-supervisor.mjs'), '--json'], { timeoutMs: 300_000 });
    const detail = r?.detail ? ': ' + String(r.detail).slice(0, 240) : '';
    const error = r?.ok === false ? ` (${String(r.error ?? r.reason ?? '').slice(0, 120)}${detail})` : '';
    applied.push(`Supervisor seat: ${r?.action ?? 'no answer'}${error}`);
  }
  if (workflowSeats) {
    const seats = await api.kernelSeatItems({ orcaOk: true, config, repair: true });
    applied.push(`Kernel seats: ${seats.filter((i) => i.status === 'green').length}/${seats.length} live after repair`);
  }
}
