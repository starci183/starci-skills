#!/usr/bin/env node
// check-gate-loosening.mjs - RT_GATE_LOOSENING (R236; part of `npm run check`).
//   runs in the check stage (self-check gate-loosening)
//
// At a runtime Git top-level, every commit since the nearest annotated, manifest-bound release is judged against its parent by
// scripts/lib/gate-loosening.mjs and modules/kernel/gate-loosening.yaml. A commit that loosens a gate or check is owner-class
// (modules/kernel/roles.yaml rulings.loosening-is-owner-class): it is a finding unless the owner approved it, an owner-rulings entry
// gate-loosening-<fingerprint> held by its parent or by the checked-out tree (history that reached the branch by a merge was not judged
// when it was written: the owner approves it after the fact, in a commit of its own). Only what the release shipped can be loosened
// (scripts/checks/lib/released-state.mjs): a check or a spec added after the release and folded away before the next one is no finding. The land gate refuses the same change before it reaches main
// (scripts/supervisor/land-gate-loosening.mjs).
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { judgeChange, looseningRules, rulingsAt } from '../supervisor/land-gate-loosening.mjs';
import { approvalIdOf, approved } from '../lib/gate-loosening.mjs';
import { fileReader, loosensReleased, releaseCommit } from './lib/released-state.mjs';

export const CODE = 'RT_GATE_LOOSENING';
const COMMIT_LIMIT = 400;

const finding = (sha, message) => ({ code: CODE, path: `commit ${sha.slice(0, 10)}`, line: 0, message: `commit ${sha.slice(0, 10)} ${message}` });

/** The RT_GATE_LOOSENING findings over the commits since the release commit of the tree at `root`. */
export function checkGateLoosening(root = skillRoot) {
  const rules = looseningRules(root);
  if (!rules) return [];
  const release = releaseCommit(root);
  if (release.status === 'no-repository' || release.status === 'no-runtime-repository') return [];
  if (!release.ok) return [{ code: CODE, path: 'release history', line: 0, message: `cannot judge released gates: ${release.why}` }];
  const base = release.head;
  const listed = revList(['--no-merges', '--reverse', `--max-count=${COMMIT_LIMIT}`, `${base}..HEAD`], { cwd: root });
  if (listed.status !== 0) return [finding(base, 'cannot read the commits since the release; gate judgment is unknown')];
  const standing = rulingsAt(root, 'HEAD');
  const read = fileReader(root);
  return listed.stdout.split(/\r?\n/).filter(Boolean).flatMap((sha) => {
    const judged = judgeChange({ dir: root, base: `${sha}^`, head: sha, rules });
    if (!judged || judged.approved || approved(judged.findings, standing)) return [];
    const findings = judged.findings.filter((entry) => loosensReleased(entry, { base, read, rules }));
    if (!findings.length || approved(findings, standing)) return [];
    const what = findings.map((entry) => `${entry.kind} ${entry.file}: ${entry.detail}`).join('; ');
    return [finding(sha, `loosens a gate (${what}) without the owner's approval: add the owner-rulings entry ${approvalIdOf(findings)} first, or restore the gate`)];
  });
}

if (isMain(import.meta.url)) process.exitCode = printFindings(checkGateLoosening(), 'OK: no commit since the last release loosens a gate without the owner\'s approval.');
