// leg-proposal.mjs - the write set the runtime proposes for an approved plan leg whose plan declares none.
// The plan author (goal define / `starci kernel plan`) lists the legs by op and, today, no paths; the Kernel was then asked for free text and guessed (live, 2026-10-09:
// interface.draw, "the plan declares no write set for it", answered with ui/** of the feature). The op contract already says what the op may write: each
// `.starciwork/features/<feature>/<family>/...` entry of its manifest `writes`, and every `.starciwork/_resources/<category>/...` entry (the planned identity, environment and fixture slots). The proposal is that family directory of every feature the work tree holds,
// the Work paths of the leg. It is a proposal the Kernel picks as a typed choice (kernel-menu.yaml leg-ready `enqueue-proposed`), never a silent enqueue:
// a leg the plan did not size is still the Kernel's judgment, but a pick, not a guess. Reads only.
import fs from 'node:fs';
import path from 'node:path';
import { readOpManifest } from '../lib/op-shared.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { workflowWorktreeOf } from '../machine/workflow-tree.mjs';

const FEATURE_WRITE = /^\.starciwork\/features\/<feature>\/([^<{/]+)\//;
const WORK = '.starciwork';
const RESOURCE_WRITE = /^\.starciwork\/(_resources\/[^<{/]+)\//;
const NODE_FEATURE = /\.starciwork\/features\/([^/]+)/;

/** The literal families (`ui`, `sds`, ...) the manifest writes under a feature, in code-unit order. */
export function featureFamiliesOf(brief) {
  const families = new Set();
  for (const write of Array.isArray(brief?.writes) ? brief.writes : []) {
    const found = FEATURE_WRITE.exec(typeof write?.path === 'string' ? write.path.trim() : '');
    if (found) families.add(found[1]);
  }
  return [...families].sort(byCodeUnit);
}

/**
 * The names of the parameters the op's manifest requires and only the Kernel sets, with no default: `starci kernel enqueue` refuses the op without them (params-invalid), so the leg-ready
 * item cannot offer a plain pick and asks for them instead.
 */
export function requiredKernelParamsOf({ skillRoot, op }) {
  let brief;
  try { brief = readOpManifest(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`)); } catch { return []; }
  return Object.entries(brief?.params ?? {}).filter(([, spec]) => spec?.required === true && spec.setBy === 'kernel' && spec.default === undefined).map(([name]) => name).sort(byCodeUnit);
}

/** The literal resource directories (`.starciwork/_resources/identities`, ...) the manifest writes: the planned slots an op declares are granted with the leg. */
export function resourceDirsOf(brief) {
  const dirs = new Set();
  for (const write of Array.isArray(brief?.writes) ? brief.writes : []) {
    const found = RESOURCE_WRITE.exec(typeof write?.path === 'string' ? write.path.trim() : '');
    if (found) dirs.add(`${WORK}/${found[1]}`);
  }
  return [...dirs].sort(byCodeUnit);
}

/** The features a tree holds: the directories of `.starciwork/features` that carry an index.yaml. */
function featuresIn(root) {
  const dir = path.join(root, WORK, 'features');
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'index.yaml'))).map((e) => e.name); } catch { return []; }
}

/**
 * The proposed write set of `op` as a comma list, or '' when the op writes no feature family or the trees hold no feature.
 * `trees`: the roots to read the features from (the workflow tree first, the checkout after). `nodePaths`: the owned paths of the work-graph node the leg is partitioned for;
 * the features they name narrow the proposal to that node (a node that names none leaves every feature).
 */
export function proposedLegPaths({ skillRoot, op, trees, nodePaths = [] }) {
  let brief;
  try { brief = readOpManifest(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`)); } catch { return ''; }
  const families = featureFamiliesOf(brief);
  const named = new Set((nodePaths ?? []).map((p) => NODE_FEATURE.exec(String(p).replaceAll('\\', '/'))?.[1]).filter(Boolean));
  const held = [...new Set((trees ?? []).filter(Boolean).flatMap(featuresIn))];
  const features = (named.size ? [...named] : held).sort(byCodeUnit);
  return [...features.flatMap((feature) => families.map((family) => `${WORK}/features/${feature}/${family}`)), ...resourceDirsOf(brief)].join(',');
}

/** The trees a workflow's features are read from: its own worktree first (a finished leg wrote its records there), then the ledger repository's checkout. */
export function treesOfWorkflow(db, workflowId, { env = process.env } = {}) {
  let tree = null;
  try { tree = workflowWorktreeOf({ env }, workflowId)?.path ?? null; } catch { tree = null; }
  const repo = db.prepare("SELECT value FROM meta WHERE key='repo_root'").get()?.value ?? null;
  return [tree, repo].filter(Boolean);
}
