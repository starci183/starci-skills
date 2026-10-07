// scripts/reconciler/reload-bounds.mjs — what makes the engine reload itself, and how long a reload may take.
import { allocationMs } from '../../engine/config.mjs';
import { HANDOVER_WAIT_MS, RELOAD_MIN_INTERVAL_MS } from '../machine/self-reload.mjs';

/**
 * What the engine imports in process (controllers, the supervisor helpers they wrap, the ledger engine, the numbers):
 * a new runtime HEAD reloads the engine only when it changed a file under these (MB-01: every land of docs or ops
 * contracts re-exec'd the engine about every 6 minutes). Children (cli.mjs, push-mains.mjs, ...) start fresh anyway.
 */
export const RELOAD_HEAD_PATHS = Object.freeze(['scripts/reconciler/', 'scripts/supervisor/', 'scripts/machine/', 'scripts/lib/', 'scripts/connectors/lib.mjs',
  'scripts/kernel/', 'scripts/api/orca/', 'engine/', 'modules/reconciler/', 'modules/models/runtimes.yaml']);

/** The engine looks for a reload this often. */
export const RELOAD_CHECK_MS = allocationMs('selfReload.checkMs');

/** How long a live revision that changed a watched path may differ from the engine's: one restart-storm interval, one check, one handover, one grace. */
export const reloadBoundMs = () => RELOAD_MIN_INTERVAL_MS + RELOAD_CHECK_MS + HANDOVER_WAIT_MS + allocationMs('selfReload.driftGraceMs');
