// release-terminal.mjs — prepare only the missing shell; a prepared shell never satisfies the cut's live-context gate.
import fs from 'node:fs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { terminalCreate } from '../api/orca/terminal-create.mjs';

/**
 * Prepare this runtime's plain release shell, without commands or an invented terminal environment.
 * The native receipt belongs to the refusal result, not to a successful release or agent launch.
 * @param {object} input - The exact runtime repository being cut.
 * @returns {object} Native custody and a next step; unknown outcomes explicitly prohibit automatic retry.
 */
export function prepareReleaseTerminal({ repo }) {
  let canonical = false;
  try { canonical = fs.realpathSync(repo) === fs.realpathSync(skillRoot); } catch { /* local refusal below */ }
  if (!canonical) return { outcome: 'failed', effectState: 'none', native: null, why: 'terminal preparation is limited to the canonical runtime release' };
  let native;
  try { native = terminalCreate(); }
  catch (error) { return { outcome: 'unknown', effectState: 'unknown', native: null, why: 'terminal custody is unknown: ' + error.message + '; do not retry automatically' }; }
  const terminal = native.result?.terminal ?? null;
  const received = native.outcome === 'ok' && native.effectState === 'committed';
  let why = 'terminal custody is unknown; preserve this receipt and inspect native inventory before any deliberate retry; do not retry automatically';
  if (received) why = 'a plain release shell was requested; inspect the actual native receipt, then run the cut inside that terminal';
  else if (native.effectState === 'none') why = 'no shell was issued: ' + (native.error ?? 'native refusal');
  return { outcome: native.outcome, effectState: native.effectState, native, terminal, why };
}
