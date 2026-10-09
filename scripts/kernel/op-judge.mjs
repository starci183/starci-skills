// op-judge.mjs — who judges the product of an op, read from the one place it is declared: the required field `judge` of the op's
// contract (modules/ops/ops/<op>.yaml), against the vocabulary of modules/kernel/op-judges.yaml. The status line of a leg, the
// op prompt and the op-judge self-check (scripts/checks/check-op-judge.mjs) all read it here, so they cannot disagree.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

export const JUDGES_FILE = 'modules/kernel/op-judges.yaml';
export const OPS_DIR = 'modules/ops/ops';

const readYaml = (root, rel) => parseYaml(fs.readFileSync(path.join(root, rel), 'utf8'));

/** The registry of judge kinds, measures, owner gates and reviewers. */
export const judgeRegistry = (root = skillRoot) => readYaml(root, JUDGES_FILE);

/** The judge entries an op's contract declares ([] for an unreadable contract or a missing field). */
export function judgeOf(op, root = skillRoot) {
  try {
    const entries = readYaml(root, `${OPS_DIR}/${op}.yaml`)?.judge;
    return Array.isArray(entries) ? entries : [];
  } catch { return []; }
}

const tagOf = (entry) => (entry.by === 'next-leg' ? `next:${entry.leg}` : String(entry.by));

/** The one short tag of a leg: the kinds that judge it, such as `machine+critic` or `machine+next:review.verify`. */
const judgeTag = (entries) => [...new Set(entries.map(tagOf))].join('+') || 'undeclared';

/** The tag of an op, from its contract. */
export const judgeTagOf = (op, root = skillRoot) => judgeTag(judgeOf(op, root));

/** The one line of the op prompt that says who will judge the product. */
export function judgePromptLine(op, root = skillRoot) {
  const entries = judgeOf(op, root);
  if (!entries.length) return null;
  const judges = entries.map((entry) => `${tagOf(entry)} (${entry.why})`).join('; ');
  return `judged_by: ${judges} - declared in the judge field of your contract; the maker never judges its own work, so run no Critic of your own and offer your own tests and checks as evidence for these judges, never as your claim of proof`;
}
