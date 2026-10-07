// worktrees-clean.mjs - remove only clean, locally merged lane worktrees, through the link-safe Git/Orca owners.
import fs from 'node:fs';
import path from 'node:path';
import { isAncestor as realIsAncestor } from '../api/git/is-ancestor.mjs';
import { porcelainStatus as realStatus } from '../api/git/porcelain-status.mjs';
import { worktreeListPorcelain as realList } from '../api/git/worktree-list-porcelain.mjs';
import { worktreePs as realOrcaPs } from '../api/orca/worktree-ps.mjs';
import { samePath } from '../lib/path-key.mjs';
import { removeOrcaWorktree as realRemoveOrca } from './worktree-orca.mjs';
import { safeRemoveWorktree as realRemoveGit } from './worktree-git.mjs';
import { findInOrder } from '../lib/in-order.mjs';

const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const namedAncestor = (input, name) => {
  for (let at = path.resolve(input); ; at = path.dirname(at)) {
    if (path.basename(at).toLowerCase() === name) return at;
    if (path.dirname(at) === at) return null;
  }
};

const globExpression = (glob) => {
  let source = '^';
  for (const char of String(glob)) {
    if (char === '*') source += '.*';
    else if (char === '?') source += '.';
    else source += char.replace(/[\\^$+?.()|{}[\]]/g, String.raw`\$&`);
  }
  return new RegExp(`${source}$`, process.platform === 'win32' ? 'i' : '');
};

function cleanPreflight(entry, target, { primary, lanesRoot, only, lstat }) {
  if (samePath(target, primary)) return { path: target, branch: entry.branch, action: 'primary' };
  const relative = path.relative(lanesRoot, target).split(path.sep).join('/');
  const selected = !only || [entry.branch ?? '', path.basename(target), relative].some((value) => only.test(value));
  if (!selected) return { skip: true };
  if (!inside(lanesRoot, target)) return { path: target, branch: entry.branch, action: 'outside-lanes-root' };
  try { lstat(target); }
  catch (error) {
    return { path: target, branch: entry.branch, action: error?.code === 'ENOENT' ? 'missing' : 'lstat-refused', refused: error?.code === 'ENOENT' ? 0 : 1 };
  }
  if (!entry.branch || entry.branch === 'main') return { path: target, branch: entry.branch, action: 'not-a-lane' };
  return null;
}

async function checkCleanLane(entry, target, { primary, status, isAncestor, ctx }) {
  const state = await status(target, { untracked: 'no' });
  if (!state?.ok || String(state.stdout ?? '').trim()) return {
    row: { path: target, branch: entry.branch, action: 'refused-dirty-tracked' }, line: `refused ${target}: uncommitted tracked changes`, refused: 1,
  };
  if (!(await isAncestor(primary, entry.head, 'refs/heads/main'))) return {
    row: { path: target, branch: entry.branch, action: 'refused-unmerged' }, line: `refused ${target}: ${entry.branch} is not merged into local main`, refused: 1,
  };
  if (ctx.args?.['dry-run'] === true) return { row: { path: target, branch: entry.branch, action: 'would-remove' }, line: `would remove ${target}` };
  return null;
}

async function removeCleanLane(entry, target, { primary, orcaRows, ctx, deps }) {
  const orca = orcaRows.find((row) => row.id && row.path && samePath(row.path, target));
  const result = orca
    ? await (deps.removeOrca ?? realRemoveOrca)({ repoRoot: primary, orcaId: orca.id, dir: target, branch: entry.branch, deleteBranch: 'merged', main: 'main', env: ctx.env })
    : await (deps.removeGit ?? realRemoveGit)(target, { repo: primary });
  if (result?.ok) return { row: { path: target, branch: entry.branch, action: 'removed', links: result.links ?? 0 }, line: `removed ${target}` };
  return {
    row: { path: target, branch: entry.branch, action: 'remove-failed', reason: result?.reason ?? 'unknown' },
    line: `refused ${target}: ${result?.reason ?? 'removal failed'}`, refused: 1, stop: result?.fatal,
  };
}

// The worktrees, primary checkout, lanes root and --only glob of one clean request, or the refusal that stops it.
async function cleanScope(ctx, deps) {
  const refusal = (code, stderr) => ({ refusal: { code, stderr } });
  const positionals = ctx.positionals ?? [];
  if (positionals.length) return refusal(2, 'starci machine worktrees-clean: no positional arguments are accepted');
  let only = null;
  try { if (ctx.args?.only !== undefined) only = globExpression(ctx.args.only); }
  catch (error) { return refusal(2, `starci machine worktrees-clean: invalid --only glob (${error.message})`); }
  const cwd = path.resolve(ctx.cwd ?? process.cwd());
  const list = deps.listWorktrees ?? realList;
  let worktrees;
  try { worktrees = await list(cwd); }
  catch (error) { return refusal(1, `starci machine worktrees-clean: cannot list worktrees (${error.message})`); }
  if (!Array.isArray(worktrees) || !worktrees.length) return refusal(1, 'starci machine worktrees-clean: Git reported no primary worktree');
  const primary = path.resolve(worktrees[0].path);
  const configured = ctx.env?.STARCI_LANES_ROOT ? path.resolve(ctx.env.STARCI_LANES_ROOT) : null;
  const discovered = [cwd, ...worktrees.map((row) => row.path)].map((entry) => namedAncestor(entry, 'starci-lanes')).find(Boolean);
  const lanesRoot = configured ?? discovered;
  if (!lanesRoot) return refusal(2, 'starci machine worktrees-clean: set STARCI_LANES_ROOT when no starci-lanes ancestor can be derived');
  return { only, worktrees, primary, lanesRoot };
}

// One lane: skipped, refused or removed. Adds its row and line to `out`; true when the removal is fatal for the rest.
async function cleanLane(entry, { primary, lanesRoot, only, lstat, status, isAncestor, orcaRows, ctx, deps }, out) {
  const target = path.resolve(entry.path);
  const preflight = cleanPreflight(entry, target, { primary, lanesRoot, only, lstat });
  if (preflight) {
    if (!preflight.skip) out.rows.push(preflight);
    out.refused += preflight.refused ?? 0;
    return false;
  }
  const checked = await checkCleanLane(entry, target, { primary, status, isAncestor, ctx });
  if (checked) {
    out.rows.push(checked.row);
    if (checked.line) out.lines.push(checked.line);
    out.refused += checked.refused ?? 0;
    return false;
  }
  const removed = await removeCleanLane(entry, target, { primary, orcaRows, ctx, deps });
  out.rows.push(removed.row);
  out.lines.push(removed.line);
  out.refused += removed.refused ?? 0;
  return Boolean(removed.stop);
}

/** `starci machine worktrees clean`: select merged lanes and remove each without following any link in it. */
export async function worktreesClean(ctx, deps = {}) {
  const scope = await cleanScope(ctx, deps);
  if (scope.refusal) return scope.refusal;
  const { only, worktrees, primary, lanesRoot } = scope;
  const status = deps.status ?? realStatus;
  const isAncestor = deps.isAncestor ?? realIsAncestor;
  const lstat = deps.lstat ?? fs.lstatSync;
  let orcaRows = [];
  try {
    const found = await (deps.orcaPs ?? realOrcaPs)();
    if (found?.ok && Array.isArray(found.worktrees)) orcaRows = found.worktrees;
  } catch { /* a Git-owned lane still has a safe removal path */ }
  const out = { rows: [], lines: [], refused: 0 };
  const lane = { primary, lanesRoot, only, lstat, status, isAncestor, orcaRows, ctx, deps };
  await findInOrder(worktrees, (entry) => cleanLane(entry, lane, out));
  const { rows, lines, refused } = out;
  const removed = rows.filter((row) => ['removed', 'would-remove'].includes(row.action)).length;
  return {
    code: refused ? 1 : 0,
    text: [...lines, `starci machine worktrees-clean: ${removed} ${ctx.args?.['dry-run'] ? 'would be removed' : 'removed'}, ${refused} refused`].join('\n'),
    data: { schema: 'starci/worktrees-clean@1', dryRun: ctx.args?.['dry-run'] === true, lanesRoot, rows },
  };
}
