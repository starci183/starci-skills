#!/usr/bin/env node
// Deep map WRAP WT1, WT6: links are removed as links before the rm, and the git branch -d fallback stays (Orca deletes a branch only when it proves the merge).
// worktree-rm.mjs — the calls.yaml `worktree-rm` call as a callable function.
// Internal entry: spawned by scripts/machine/worktree-orca.mjs; not invoked directly.
// Args: --worktree <sel> [--force]
// Removes the worktree from Orca and git. Called only by scripts/machine/worktree-orca.mjs removeOrcaWorktree (check-worktree-rm),
// after every link in the tree was removed as a link. The call itself reads the tree the selector names and hands it to Orca only
// while it holds no link: Orca walks a junction and deletes what it leads to (measured by tests/api-orca/orca-worktree-rm-live.spec.mjs).
// Returns {ok, removed, error}.
import fs from 'node:fs';
import { orcaCall } from './lib.mjs';
import { arg, flag } from '../../lib/cli-arg.mjs';
import { linksUnder } from '../fs/links-under.mjs';
import { isInside } from '../../lib/walk.mjs';
import { tempRoot } from '../../../engine/temp-root.mjs';

/** The refusal code of a removal whose tree still holds a link, or whose tree the selector does not name. */
export const LINKS_PRESENT = 'worktree-links-present';
/** The refusal code of a measurement over a tree whose links do not all lead into the temp root. */
const MEASURE_REFUSED = 'worktree-measure-refused';

/** The directory a selector names - `path:<dir>`, `id:<repo-id>::<dir>` or a bare `<repo-id>::<dir>` - or null. */
function treeOfSelector(selector) {
  const text = String(selector ?? '');
  if (text.startsWith('path:')) return text.slice('path:'.length) || null;
  const at = text.indexOf('::');
  return at < 0 ? null : text.slice(at + 2) || null;
}

const refusal = (errorCode, error) => ({ ok: false, outcome: 'refused', removed: false, errorCode, error, hostUnavailable: false });

function rmCall({ worktree, force }) {
  const r = orcaCall('worktree-rm', { worktree, force });
  return {
    ok: r.outcome === 'ok' && r.result?.removed === true,
    outcome: r.outcome,
    removed: r.result?.removed === true,
    errorCode: r.receipt?.error?.code ?? null,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

/**
 * Ask Orca to remove the exact caller-admitted worktree and its Git registration, once the tree holds no link.
 * removeOrcaWorktree owns preservation, link removal, main-checkout protection, and readback; this call refuses
 * (errorCode worktree-links-present, Orca never asked) when the selector names no directory or the directory still
 * holds a link, because Orca deletes through a junction. force forwards a host option, not new authority.
 * ok requires both a classified successful outcome and removed true; an unknown receipt keeps custody.
 * @param {object} input - Required worktree selector and optional force.
 * @returns {object} Outcome, confirmed removal, typed error, and hostUnavailable.
 */
export function worktreeRm({ worktree, force = false }) {
  const dir = treeOfSelector(worktree);
  if (!dir) return refusal(LINKS_PRESENT, `${worktree} names no directory, so the tree could not be checked for links`);
  const links = fs.existsSync(dir) ? linksUnder(dir) : [];
  if (links.length) return refusal(LINKS_PRESENT, `${dir} still holds ${links.length} link(s), first ${links[0]}: Orca would delete through them`);
  return rmCall({ worktree, force });
}

/**
 * The measurement of Orca's own removal, links left in place: it asks Orca to remove a tree that holds links, which
 * deletes what they lead to. It runs only when the selector names a directory with at least one link and every link
 * leads into the temp root (a throwaway fixture); anything else is refused with errorCode worktree-measure-refused.
 * Used by tests/api-orca/orca-worktree-rm-live.spec.mjs alone.
 */
export function measureWorktreeRm({ worktree, force = false }) {
  const dir = treeOfSelector(worktree);
  const links = dir && fs.existsSync(dir) ? linksUnder(dir) : [];
  if (!links.length) return refusal(MEASURE_REFUSED, `${worktree} names no directory holding a link: nothing to measure`);
  const temp = fs.realpathSync.native(tempRoot());
  const outside = links.find((link) => !isInside(temp, fs.realpathSync.native(link)));
  if (outside) return refusal(MEASURE_REFUSED, `${outside} leads outside the temp root ${temp}: a measurement removes only a throwaway fixture`);
  return rmCall({ worktree, force });
}

if (process.argv[1]?.endsWith('worktree-rm.mjs')) {
  const argv = process.argv.slice(2);
  const out = worktreeRm({ worktree: arg(argv, 'worktree'), force: flag(argv, 'force') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
