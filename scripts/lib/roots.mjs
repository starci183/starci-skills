// roots.mjs - the one place that names a root of the runtime and says which tree wins when two hold the same record.
//
// A component that needs "which directory" asks here, so no component resolves it by itself (the wrong-tree reads of 2026-10-08/09:
// a brand record read from the product's main checkout, a capture tool looked up only in product dirs, generated files written
// through a home record, a Kernel start gated by another tree's build). The roots, each with its one resolver:
//   runtime tree       runtimeTree        the checkout this code runs from (derived from the module location, never from a record)
//   runtime state      runtimeState       <runtime tree>/.runtime, or STARCI_LOCAL_ROOT
//   temp root          tempRoot           STARCI_TEMP_ROOT, the owner config, else the OS directory
//   invocation dir     invocationDir      where the command was started; only ever a default for a flag the caller may override
//   work dir           workDirName        the name of the Work records directory inside a product tree
//   product trees      treesInOrder       the workflow tree first, then the product's main checkout
//   Work records       workRecordPath     the first tree that holds the record, else the main checkout's path
//   tool lookups       toolSearchDirs     the tree the work happens in first, the runtime's own install last
// The workflow tree itself, a job's placement and the Critic directory are registry facts: scripts/machine/workflow-tree.mjs,
// placement-rebound.mjs and the worktree registry resolve them, and a caller hands the result in as `tree`.
// The `root-adhoc` self-check (scripts/checks/check-root-adhoc.mjs, rule R240) refuses a new path built from the process working
// directory or from the Work directory name outside this module.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot, runtimeStateDir, starciLocalRoot, starciSourceRoot } from '../../engine/runtime-root.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';

export { tempRoot, starciLocalRoot, starciSourceRoot };

/** The runtime tree this code runs from. */
export const runtimeTree = skillRoot;

/** The state directory of a runtime tree (default: this one). */
export const runtimeState = (tree = runtimeTree) => runtimeStateDir(tree);

/** The name of the Work records directory inside a product tree. */
export const WORK_DIR_NAME = '.starciwork';

/** The directory a command was started in: `io.cwd` when the caller injects one, else the process working directory. A default for flags only. */
export const invocationDir = (io = undefined) => path.resolve(io?.cwd ?? process.cwd());

/** The distinct, resolved trees that may hold a product's records, in precedence order: the workflow tree, then the main checkout. */
export const treesInOrder = ({ tree = null, repo = null } = {}) => [...new Set([tree, repo].filter(Boolean).map((dir) => path.resolve(dir)))];

/** The Work directories of those trees, in the same order. */
export const workDirsInOrder = ({ tree = null, repo = null, workDirName = WORK_DIR_NAME } = {}) => treesInOrder({ tree, repo }).map((dir) => path.join(dir, workDirName));

/**
 * The first Work directory (workflow tree first, then the main checkout) that `holds` accepts, else the main checkout's own (the
 * path a refusal names), else the tree's when there is no main checkout.
 */
export function workDirHolding(holds, { tree = null, repo = null, workDirName = WORK_DIR_NAME } = {}) {
  const dirs = workDirsInOrder({ tree, repo, workDirName });
  return dirs.find((dir) => holds(dir)) ?? (repo ? path.join(path.resolve(repo), workDirName) : (dirs[0] ?? null));
}

/** The file of a Work record (`rel` under the Work directory) from the first tree that has it, else the main checkout's path. */
export function workRecordPath(rel, { tree = null, repo = null, workDirName = WORK_DIR_NAME, exists = fs.existsSync } = {}) {
  const parts = String(rel).split('/');
  return path.join(workDirHolding((dir) => exists(path.join(dir, ...parts)), { tree, repo, workDirName }) ?? '', ...parts);
}

/** The directories a tool is looked up from: the caller's (the tree the work happens in, then the project) first, the runtime's own install last. */
export const toolSearchDirs = (dirs, runtime = runtimeTree) => [...dirs.filter(Boolean), runtime].filter(Boolean);
