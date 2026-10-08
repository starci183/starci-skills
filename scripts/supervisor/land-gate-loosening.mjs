// land-gate-loosening.mjs — the land gate's loosening step and the `gate-loosening` self-check's reader: the diff of one change judged by
// scripts/lib/gate-loosening.mjs against the table modules/kernel/gate-loosening.yaml. A change that loosens a gate is owner-class
// (modules/kernel/roles.yaml rulings.loosening-is-owner-class): it passes only when the tree it is judged against (the base of a land,
// the parent of a commit) already holds the owner's approval of exactly that loosening, an owner-rulings entry gate-loosening-<fingerprint>.
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { readYamlFile } from '../lib/read-yaml.mjs';
import { diff } from '../api/git/diff.mjs';
import { show } from '../api/git/show.mjs';
import { approvalIdOf, approved, looseningsOf } from '../lib/gate-loosening.mjs';

const RULES_FILE = 'modules/kernel/gate-loosening.yaml';
const RULINGS_FILE = 'modules/kernel/owner-rulings.yaml';
const DIFF_BUFFER = 64 * 1024 * 1024;

/** The loosening table of the tree at `root`, or null when it has none. */
export const looseningRules = (root) => readYamlFile(path.join(root, RULES_FILE));

/** The owner's rulings of the tree at `rev` in the repository at `cwd`, or null when that tree holds none. */
export const rulingsAt = (cwd, rev) => {
  const shown = show([`${rev}:${RULINGS_FILE}`], { cwd, maxBuffer: DIFF_BUFFER });
  return shown.status === 0 ? parseYaml(shown.stdout) : null;
};

/**
 * The loosenings of `base..head` in the repository at `dir` and whether the owner approved them: {findings, id, approved}, or null when
 * the change loosens nothing (or `rules` is null). `base` is also the tree the approval is read from.
 */
export function judgeChange({ dir, base, head, rules }) {
  if (!rules) return null;
  const changed = diff([`${base}..${head}`, '--no-color', '--no-renames', '-U0'], { cwd: dir, maxBuffer: DIFF_BUFFER });
  if (changed.status !== 0) return null;
  const findings = looseningsOf(changed.stdout, rules);
  if (!findings.length) return null;
  return { findings, id: approvalIdOf(findings), approved: approved(findings, rulingsAt(dir, base)) };
}

const lineOf = (finding) => `${finding.kind} ${finding.file}: ${finding.detail}`;

/** The land gate's step: null when the change loosens nothing, else {name, ok, findings, output?, hint?}. */
export function gateLooseningCheck({ dir, base, head }) {
  const judged = judgeChange({ dir, base, head, rules: looseningRules(dir) });
  if (!judged) return null;
  if (judged.approved) return { name: 'gate-loosening', ok: true, advisory: true, findings: judged.findings, output: `loosens ${judged.findings.length} gate(s), approved by the owner (${judged.id})` };
  return { name: 'gate-loosening', ok: false, findings: judged.findings, output: judged.findings.map(lineOf).join('\n'),
    hint: `a change that loosens a gate is owner-class: it lands only when the owner has approved it. The owner approves exactly this loosening with an entry of ${RULINGS_FILE} whose id is ${judged.id}, landed before this change` };
}
