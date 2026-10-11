// scripts/reconciler/engine-process.mjs — what the engine process says about itself: the `--once` result line, the crash
// handler of the long-lived engine, and the recovery a new engine process runs before it leads (engine.mjs main()).
import { reapProviderReservations } from '../machine/provider-reservation-reap.mjs';
import { bootIdentity } from './boot-id.mjs';
import { previousBootRev, recordSwap } from './revision-swap.mjs';
import { driftOfRuntime, syncRuntime } from '../hfs/sync-runtime.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { migrateInstalledArtefacts } from './installed-artefacts.mjs';

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
 * When the previous engine booted on another revision it records the swap with the actions this start performed (revision-swap.mjs).
 */
/**
 * The generated package runtime copies (packages/hfs/runtime, packages/eslint/{be,fe}/runtime) are git-ignored output of the runtime sources; a `git merge` on the
 * live checkout moves the sources and leaves them stale. A new engine process checks them against their sources and regenerates what drifted; when it cannot,
 * it does not lead (typed cause runtime-copies-stale, RT_GENERATED_DRIFT): a runtime serving stale generated copies is not the revision it reports.
 */
export function ensureRuntimeCopies(engine, { driftOf = driftOfRuntime, sync = syncRuntime } = {}) {
  const drift = driftOf();
  if (!drift.length) return null;
  try {
    const files = sync();
    engine.log('reconciler.event', `engine start regenerated the runtime copies (${drift.length} difference(s), ${files} file(s) written)`, { kind: 'reconciler.runtime-copies-synced', drift: drift.slice(0, 10) });
    return { action: 'runtime-copies-synced', count: drift.length };
  } catch (error) {
    engine.log('reconciler.error', `engine start could not regenerate the runtime copies: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.runtime-copies-stale', drift: drift.slice(0, 10) });
    throw Object.assign(new Error(`runtime-copies-stale: RT_GENERATED_DRIFT ${drift.length} generated copy difference(s) and starci release sync-runtime failed: ${String(error?.message ?? error).slice(0, 200)}`), { code: 'runtime-copies-stale' });
  }
}

export function startRecovery(engine, safeStart, { reap = reapProviderReservations, boot = bootIdentity, copies = ensureRuntimeCopies, artefacts = migrateInstalledArtefacts } = {}) {
  if (safeStart.reevaluated) logSafeReevaluated(engine, safeStart);
  const priorRev = previousBootRev(engine.state);
  const applied = [{ action: 'engine-restarted', count: 1 }];
  const synced = copies(engine);
  if (synced) applied.push(synced);
  recoveryStep(engine, 'boot-id', () => {
    const identity = boot({ now: engine.now?.() });
    engine.log('reconciler.event', `engine start on host boot ${identity.bootId}`, { kind: 'reconciler.boot', ...identity, pid: process.pid, rev: engine.rev ?? null });
  });
  recoveryStep(engine, 'provider-receipts', () => {
    const reaped = reap({ env: process.env });
    if (!reaped.released.length) return;
    applied.push({ action: 'provider-receipts-released', count: reaped.released.length });
    engine.log('reconciler.event', `engine start released ${reaped.released.length} provider receipt(s) the host restart ended`, { kind: 'reconciler.provider-receipts-released', released: reaped.released, held: reaped.held ?? [] });
  });
  recoveryStep(engine, 'installed-artefacts', () => {
    // What a deploy could not reach (a workflow that started, or a tree that appeared, after it): migrated here, lazily, for the revision this engine runs.
    const report = artefacts({ root: skillRoot, machine: engine.state });
    if (!report.counts.migrated && !report.counts.refused) return;
    if (report.counts.migrated) applied.push({ action: 'installed-artefacts-migrated', count: report.counts.migrated });
    engine.log(report.counts.refused ? 'reconciler.error' : 'reconciler.event', `engine start migrated ${report.counts.migrated} installed artefact(s), ${report.counts.refused} refused`,
      { kind: 'reconciler.artefacts-migrated', counts: report.counts, refused: report.refused.slice(0, 10) });
  });
  recoveryStep(engine, 'queue', () => {
    const rearmed = engine.queue.rearmParked();
    if (!rearmed.length) return;
    applied.push({ action: 'queue-rearmed', count: rearmed.length });
    engine.log('reconciler.event', `engine start re-armed ${rearmed.length} parked queue key(s)`, { kind: 'reconciler.queue-rearmed', keys: rearmed.slice(0, 20) });
  });
  if (priorRev && engine.rev && priorRev !== engine.rev) recordSwap(engine.state, { cause: 'engine-start', fromRev: priorRev, toRev: engine.rev, applied, at: engine.now?.() });
}

/** A self-reload re-evaluated the crash-loop plan: say what it decided. */
function logSafeReevaluated(engine, safeStart) {
  const { safe } = safeStart;
  engine.log('reconciler.event', `self-reload re-evaluated safe mode: ${safe ? 'SAFE (a real crash loop is on record)' : 'normal'} (was ${safeStart.inherited ? '--safe' : 'normal'}; ${safeStart.starts} abnormal start(s) in the window, limit ${safeStart.max})`,
    { kind: 'reconciler.safe-reevaluated', safe, wasSafe: safeStart.inherited, abnormalStarts: safeStart.starts, max: safeStart.max, windowMs: safeStart.windowMs });
}
