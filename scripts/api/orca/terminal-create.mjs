// terminal-create.mjs — one plain PowerShell shell for the owner-authorized runtime release.
// No caller-supplied worktree, shell, command, environment, focus, agent or retry identity.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot, starciSourceRoot } from '../../../engine/runtime-root.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { orcaCall } from './lib.mjs';
import { worktreeList } from './worktree-list.mjs';

const notIssued = (error) => ({ outcome: 'failed', effectState: 'none', result: null, receipt: null, error, issued: false });
const real = (value) => { try { return fs.realpathSync(value); } catch { return null; } };

/**
 * Open a plain PowerShell terminal in this Source's registered runtime or Source worktree.
 * The Source/runtime binding and the native inventory determine the selector; no input is accepted.
 * Native custody is preserved verbatim, including unknown outcomes. This call never retries.
 * @returns {object} The native typed envelope, or an explicit local refusal before any mutation.
 */
export function createReleaseTerminal() {
  if (arguments.length !== 0) throw new Error('release terminal creation accepts no input');
  const source = real(starciSourceRoot());
  const runtime = source ? real(path.join(source, '.claude')) : null;
  if (!runtime || runtime !== real(skillRoot)) return notIssued('release terminal creation requires the canonical Source runtime');
  const inventory = worktreeList();
  if (!inventory.ok || !Array.isArray(inventory.worktrees)) return notIssued('the native worktree inventory is unreadable');
  const runtimeRows = inventory.worktrees.filter((row) => real(row.path) === runtime);
  const sourceRows = inventory.worktrees.filter((row) => real(row.path) === source);
  const candidates = runtimeRows.length ? runtimeRows : sourceRows;
  if (candidates.length !== 1 || typeof candidates[0].id !== 'string' || !candidates[0].id.trim())
    return notIssued('the canonical Source has no unique registered native worktree');
  const selected = candidates[0];
  return orcaCall('terminal-create', { worktree: selected.id, shell: 'powershell.exe', title: '[Release] StarCi runtime' });
}

if (isMain(import.meta.url)) {
  process.stderr.write('Internal adapter: enter through starci release cut. No direct terminal creation.\n');
  process.exitCode = 2;
}
