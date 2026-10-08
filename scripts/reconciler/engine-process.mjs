// scripts/reconciler/engine-process.mjs — what the engine process says about itself: the `--once` result line, the crash
// handler of the long-lived engine, and the recovery a new engine process runs before it leads (engine.mjs main()).
import { reapProviderReservations } from '../machine/provider-reservation-reap.mjs';
import { bootIdentity } from './boot-id.mjs';

/** The text line of a `--once` result. */
export const onceLine = (result) => '[reconciler --once] ' + ((result.ok && 'ok') || 'NOT OK') + ' ' + (result.controllers.map((c) => `${c.name}(${c.mode}) keys=${c.keys} ok=${c.ok} failed=${c.failed.length}`).join('; ') || 'no controller on') + ((result.error && ` ${result.error}`) || '');

/** The crash handler of the long-lived engine: log, end the run row, release, exit 1. */
export function crashHandler(engine, endRun) {
  return (error) => {
    try { engine.log('reconciler.error', `engine crashed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.crash', detail: String(error?.stack ?? error).slice(0, 4000) }); } catch { console.error(error); }
    endRun({ exitCode: 1, exitReason: 'crash' });
    try { engine.close({ reason: 'crash' }); } catch { /* closing */ }
    process.exit(1);
  };
}

// One best-effort recovery step: a throw is logged with its step and never stops the engine from starting.
function recoveryStep(engine, step, run) {
  try { run(); } catch (error) {
    engine.log('reconciler.error', `engine start recovery step ${step} failed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.start-recovery-failed', step });
  }
}

/**
 * What a new engine process settles before it leads: it names the host boot it started in, says what a self-reload decided, releases the provider
 * receipts the host restart ended (a reboot leaves the whole batch stale) and re-arms the queue keys whose retry budget an earlier process spent.
 */
export function startRecovery(engine, safeStart, { reap = reapProviderReservations, boot = bootIdentity } = {}) {
  if (safeStart.reevaluated) logSafeReevaluated(engine, safeStart);
  recoveryStep(engine, 'boot-id', () => {
    const identity = boot({ now: engine.now?.() });
    engine.log('reconciler.event', `engine start on host boot ${identity.bootId}`, { kind: 'reconciler.boot', ...identity, pid: process.pid, rev: engine.rev ?? null });
  });
  recoveryStep(engine, 'provider-receipts', () => {
    const reaped = reap({ env: process.env });
    if (reaped.released.length) engine.log('reconciler.event', `engine start released ${reaped.released.length} provider receipt(s) the host restart ended`, { kind: 'reconciler.provider-receipts-released', released: reaped.released, held: reaped.held ?? [] });
  });
  recoveryStep(engine, 'queue', () => {
    const rearmed = engine.queue.rearmParked();
    if (rearmed.length) engine.log('reconciler.event', `engine start re-armed ${rearmed.length} parked queue key(s)`, { kind: 'reconciler.queue-rearmed', keys: rearmed.slice(0, 20) });
  });
}

/** A self-reload re-evaluated the crash-loop plan: say what it decided. */
function logSafeReevaluated(engine, safeStart) {
  const { safe } = safeStart;
  engine.log('reconciler.event', `self-reload re-evaluated safe mode: ${safe ? 'SAFE (a real crash loop is on record)' : 'normal'} (was ${safeStart.inherited ? '--safe' : 'normal'}; ${safeStart.starts} abnormal start(s) in the window, limit ${safeStart.max})`,
    { kind: 'reconciler.safe-reevaluated', safe, wasSafe: safeStart.inherited, abnormalStarts: safeStart.starts, max: safeStart.max, windowMs: safeStart.windowMs });
}
