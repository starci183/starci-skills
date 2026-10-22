// land-gate-loosening.mjs — the land gate's loosening step and the `gate-loosening` self-check's reader: the diff of one change judged by
// scripts/lib/gate-loosening.mjs against the table modules/kernel/gate-loosening.yaml. A change that loosens a gate is always red (owner
// ruling loosening-always-red, 2026-10-22): no approval lets it land; the way out is to restore the gate.
import path from 'node:path';
import { readYamlFile } from '../lib/read-yaml.mjs';
import { diff } from '../api/git/diff.mjs';
import { looseningStep, looseningsOf, renamedPrefixesOf } from '../lib/gate-loosening.mjs';

const RULES_FILE = 'modules/kernel/gate-loosening.yaml';
const DIFF_BUFFER = 64 * 1024 * 1024;

/** The loosening table of the tree at `root`, or null when it has none. */
export const looseningRules = (root) => readYamlFile(path.join(root, RULES_FILE));

/**
 * The loosenings of `base..head` in the repository at `dir`: the findings, or null when the change loosens nothing (or `rules` is null,
 * or git cannot diff the range).
 */
export function judgeChange({ dir, base, head, rules }) {
  if (!rules) return null;
  const changed = diff([`${base}..${head}`, '--no-color', '--no-renames', '-U0'], { cwd: dir, maxBuffer: DIFF_BUFFER });
  if (changed.status !== 0) return null;
  // The paths the change renamed (git's own rename detection, with no candidate limit): entries that only move with them are no loosening.
  const statuses = diff([`${base}..${head}`, '--no-color', '--name-status', '-M', '-l0'], { cwd: dir, maxBuffer: DIFF_BUFFER });
  if (statuses.status !== 0) return null;
  const findings = looseningsOf(changed.stdout, rules, { renamed: renamedPrefixesOf(statuses.stdout) });
  return findings.length ? findings : null;
}

/** The land gate's step: null when the change loosens nothing, else the red step {name, ok: false, findings, output, hint}. */
export function gateLooseningCheck({ dir, base, head }) {
  const findings = judgeChange({ dir, base, head, rules: looseningRules(dir) });
  return findings ? looseningStep(findings) : null;
}
