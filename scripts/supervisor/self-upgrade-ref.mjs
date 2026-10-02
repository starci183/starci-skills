// self-upgrade-ref.mjs - the revertable ref of a Supervisor self-upgrade land (owner 2026-10-03, the three change paths): after a land of a
// sup/<id> lane (or a Supervisor [Worker] job) fast-forwards LOCAL main, refs/self-upgrade/<id>[-N] keeps the land's result commit, so one
// self-upgrade is reverted by naming one ref. Local only (never pushed), collision-safe (the first free name, never an overwrite) and best
// effort: a ref that cannot be written is reported on the land result and never turns a green land red.
import { branchList } from '../api/git/branch-list.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { updateRef } from '../api/git/update-ref.mjs';
import { skillRoot as SKILL_ROOT } from '../../engine/runtime-root.mjs';

const SELF_UPGRADE_PREFIX = 'refs/self-upgrade/';
/** A branch/job id made safe as one git-ref path component. */
function sanitizeSelfUpgradeId(value) {
  let id = String(value ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.\.+/g, '_');
  if (!id) id = 'upgrade';
  if (id.startsWith('.')) id = `_${id.slice(1)}`;
  if (id.endsWith('.')) id = `${id.slice(0, -1)}_`;
  if (/\.lock$/i.test(id)) id = `${id.slice(0, -5)}_lock`;
  return id;
}

/** The ref id of a sup/<id> source branch, or of a Supervisor [Worker] job land. */
export function selfUpgradeIdOf({ branch = null, lane = null, jobId = null } = {}) {
  for (const value of [branch, lane]) {
    const name = String(value ?? '').replace(/^refs\/heads\//, '');
    const match = /^sup\/(.+)$/.exec(name);
    if (match) return sanitizeSelfUpgradeId(match[1]);
  }
  return jobId ? sanitizeSelfUpgradeId(jobId) : null;
}

/** The local sup/<id> branch containing a land's source commit, if it has one. */
export function selfUpgradeBranchContaining({ root = SKILL_ROOT, commit, list = branchList } = {}) {
  if (!commit) return null;
  try {
    const r = list(['--format=%(refname:short)', '--contains', commit, 'sup/*'], { dir: root, timeout: 20_000 });
    if (r.status !== 0) return null;
    return String(r.stdout ?? '').split(/\r?\n/).map((s) => s.trim()).find((s) => s.startsWith('sup/')) ?? null;
  } catch { return null; }
}

/** Create the first free refs/self-upgrade/<id>[-N] ref without overwriting; failures are data, never throws. */
export function writeSelfUpgradeRef({ root = SKILL_ROOT, id, head, exists = null, update = updateRef } = {}) {
  const safeId = sanitizeSelfUpgradeId(id);
  const zeroOid = '0'.repeat(/^[0-9a-f]{40,64}$/i.test(String(head ?? '')) ? String(head).length : 40);
  const has = exists ?? ((ref) => revParseQuery(['--verify', '--quiet', ref], { cwd: root }).status === 0);
  for (let serial = 1; serial <= 10_000; serial += 1) {
    const ref = `${SELF_UPGRADE_PREFIX}${safeId}${serial === 1 ? '' : `-${serial}`}`;
    try { if (has(ref)) continue; } catch (error) { return { ok: false, ref, error: String(error?.message ?? error) }; }
    let written;
    try { written = update(root, ref, head, { old: zeroOid, message: `starci self-upgrade ${safeId}` }); }
    catch (error) { return { ok: false, ref, error: String(error?.message ?? error) }; }
    if (written?.status === 0 || written?.ok === true) return { ok: true, ref };
    try { if (has(ref)) continue; } catch { /* report the update failure below */ }
    return { ok: false, ref, error: String(written?.stderr ?? written?.error?.message ?? written?.error ?? 'git update-ref failed').trim().slice(0, 500) };
  }
  return { ok: false, ref: `${SELF_UPGRADE_PREFIX}${safeId}-10001`, error: 'no free self-upgrade ref name in the first 10000 candidates' };
}

/** Add the best-effort self-upgrade ref receipt to a successful land result. */
export function withSelfUpgradeRef(result, { root = SKILL_ROOT, id, write = writeSelfUpgradeRef } = {}) {
  if (!result?.ok || !result.landed || !id) return result;
  const fallback = `${SELF_UPGRADE_PREFIX}${sanitizeSelfUpgradeId(id)}`;
  let receipt;
  try { receipt = write({ root, id, head: result.landed }); }
  catch (error) { receipt = { ok: false, ref: fallback, error: String(error?.message ?? error) }; }
  return receipt?.ok
    ? { ...result, selfUpgradeRef: receipt.ref }
    : { ...result, selfUpgradeRef: receipt?.ref ?? fallback, selfUpgradeRefError: String(receipt?.error ?? 'git update-ref failed').slice(0, 500) };
}
