// scripts/reconciler/engine-process.mjs — what the engine process says about itself: the `--once` result line, the crash
// handler of the long-lived engine, and the log of a re-evaluated safe mode after a self-reload (engine.mjs main()).

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

/** A self-reload re-evaluated the crash-loop plan: say what it decided. */
export function logSafeReevaluated(engine, safeStart) {
  const { safe } = safeStart;
  engine.log('reconciler.event', `self-reload re-evaluated safe mode: ${safe ? 'SAFE (a real crash loop is on record)' : 'normal'} (was ${safeStart.inherited ? '--safe' : 'normal'}; ${safeStart.starts} abnormal start(s) in the window, limit ${safeStart.max})`,
    { kind: 'reconciler.safe-reevaluated', safe, wasSafe: safeStart.inherited, abnormalStarts: safeStart.starts, max: safeStart.max, windowMs: safeStart.windowMs });
}
