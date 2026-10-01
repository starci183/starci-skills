// preserve-work.mjs — keep what a worktree holds that main does not as refs/heads/preserved/<name> (`git update-ref`).
import fs from 'node:fs';
import { gitRunner } from './lib.mjs';
import { revParse } from './rev-parse.mjs';
import { isAncestor } from './merge-base.mjs';
import { snapshotCommit } from './snapshot-commit.mjs';
import { PRESERVED_PREFIX } from '../../lib/worktree-registry.mjs';

/**
 * Preserve what a worktree holds that main does not: its uncommitted changes (snapshotCommit) and its unlanded commits,
 * as refs/heads/preserved/<name>. Nothing to preserve (clean and in main) -> no ref. {ok, ref|null, sha|null, dirty}
 */
export function preserveWork({ repoRoot, dir, name, main = 'main' }) {
  const ref = `refs/heads/${PRESERVED_PREFIX}/${name}`;
  if (!fs.existsSync(dir)) return { ok: true, ref: null, sha: null, dirty: false, missing: true };
  const head = revParse(dir, 'HEAD');
  if (!head) return { ok: false, reason: 'preserve-failed', step: 'head' };
  const snap = snapshotCommit(dir, head, `preserve ${name}: uncommitted work of its worktree`);
  if (!snap.ok) return { ok: false, reason: 'preserve-failed', step: snap.step, detail: snap.detail };
  const { sha, dirty } = snap;
  const mainSha = revParse(repoRoot, main);
  if (!dirty && mainSha && isAncestor(repoRoot, sha, mainSha)) return { ok: true, ref: null, sha: null, dirty: false };
  const u = gitRunner(null)(['update-ref', ref, sha], { cwd: repoRoot });
  if (!u.ok) return { ok: false, reason: 'preserve-failed', step: 'update-ref', detail: u.stderr.slice(0, 200) };
  return { ok: true, ref, sha, dirty };
}
