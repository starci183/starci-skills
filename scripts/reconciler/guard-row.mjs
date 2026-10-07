// guard-row.mjs — the host checklist row of the command guard hook: the exact hook command launch trust registers is run
// the way a seat's shell runs it (scripts/api/process/probe-guard-command.mjs), because a hook that does not resolve is a
// non-blocking error and leaves every guarded command unguarded. Required: red names each failing shell.
import { probeGuardCommand } from '../api/process/probe-guard-command.mjs';
import { toolGuardCommand } from '../lib/guard-command.mjs';
import { green, red } from './checklist-items.mjs';

const NAME = 'command guard resolvable';
const FIX = 'starci runtime link (writes the POSIX and the cmd launcher the hook command names), then start again';

/** The row of one probe of `toolGuardCommand()`; never throws. Seam: `probe`. */
export function guardCommandRow({ probe = probeGuardCommand } = {}) {
  const command = toolGuardCommand();
  let result;
  try { result = probe({ command }); }
  catch (error) { return red('preflight', 'guard-command', NAME, `${command}: ${String(error?.message ?? error).slice(0, 200)}`, FIX); }
  if (!result.ok) return red('preflight', 'guard-command', NAME, `${command} does not run: ${result.reason}`.slice(0, 400), FIX);
  const ran = result.shells.filter((entry) => !entry.skipped).map((entry) => entry.shell).join(', ');
  const skipped = result.shells.filter((entry) => entry.skipped).map((entry) => entry.skipped);
  const note = skipped.length ? ` (skipped: ${skipped.join('; ')})` : '';
  return green('preflight', 'guard-command', NAME, `${command} runs through ${ran}${note}`);
}
