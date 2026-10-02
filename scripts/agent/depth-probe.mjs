// depth-probe.mjs — measure Orca's worker depth limit with no-op workers (contract change worker-depth-limit).
//
// Orca exposes no read of its worker depth setting; config.yaml orca.maxWorkerDepth declares it. This probe proves the
// two agree: it starts a chain of no-op workers, each through startAgent with the previous worker's terminal as its
// coordinator (`--from`), until Orca refuses one with nested_worker_depth_exceeded. The deepest started depth is the
// measured limit. Every worker it started is stopped and released (deepest first), whatever happened. It runs only
// when `start --check` is asked for a live probe (STARCI_ORCA_LIVE=1); specs pass a fake `start`/`stop`/`release`.
import { startAgent } from './lib.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { closeWorker } from '../machine/worker-close.mjs';
import { isOrcaDepthRefusal } from '../lib/worker-depth.mjs';
import { bestEffortCall } from './best-effort-call.mjs';
import { MAX_WORKER_DEPTH_CEILING } from '../../engine/orca-config.mjs';

const PROBE_PROMPT = 'You are a StarCi worker-depth probe. Do nothing: run no command, edit no file, start no worker. Wait to be released.';

/**
 * probeWorkerDepth({entry, worktree, agent}) -> {ok, measured, refusedAt, depths, released, error}. ok only when Orca
 * refused a start for depth (measured = the depth before it); a start that failed for any other reason ends the probe
 * unmeasured. `released` lists each started worker's cleanup: {dispatchId, stopped, released}.
 */
export async function probeWorkerDepth({ entry = null, worktree, agent = 'claude', ceiling = MAX_WORKER_DEPTH_CEILING,
  start = startAgent, stop = workerStop, release = closeWorker } = {}) {
  const started = [];
  let refusedAt = null;
  let error = null;
  try {
    let from = entry;
    for (let depth = 1; depth <= ceiling + 1; depth += 1) {
      // maxDepth past the ceiling: the runtime's own preflight never refuses the probe; only Orca's limit is measured.
      const r = start({ provider: agent, worktree, title: `[Probe] worker depth ${depth}`, prompt: PROBE_PROMPT,
        objective: 'StarCi worker depth probe', entry: from, maxDepth: ceiling + 1 });
      if (!r?.ok) {
        if (isOrcaDepthRefusal(r) || isOrcaDepthRefusal(r?.details)) refusedAt = depth;
        else error = `depth ${depth}: ${r?.step ?? 'start'} ${r?.error ?? 'no receipt'}`;
        break;
      }
      started.push({ depth: Number.isInteger(r.depth) ? r.depth : depth, dispatchId: r.dispatchId, terminal: r.terminal });
      from = r.terminal;
    }
    if (refusedAt == null && !error) error = `no refusal up to depth ${ceiling + 1}`;
  } catch (e) {
    error = String(e?.message ?? e);
  } finally {
    // Deepest first: a coordinator is released only after the workers under it.
    for (const w of [...started].reverse()) {
      const s = attempt(() => stop({ dispatch: w.dispatchId }));
      const rel = attempt(() => release({ dispatch: w.dispatchId }));
      w.cleanup = { stopped: s?.ok === true, released: rel?.ok === true };
    }
  }
  const measured = refusedAt != null ? refusedAt - 1 : null;
  return { ok: refusedAt != null, measured, refusedAt, depths: started.map((w) => w.depth),
    released: started.map((w) => ({ dispatchId: w.dispatchId, ...w.cleanup })), error };
}

const attempt = bestEffortCall;
