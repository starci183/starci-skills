#!/usr/bin/env node
// check-gate-loosening.mjs - RT_GATE_LOOSENING (R236; part of `npm run check`).
//   runs in the check stage (self-check gate-loosening)
//
// Every commit since the last release commit (the last commit that changed the "version" of package.json) is judged against its parent by
// scripts/lib/gate-loosening.mjs and modules/kernel/gate-loosening.yaml. A commit that loosens a gate or check is owner-class
// (modules/kernel/roles.yaml rulings.loosening-is-owner-class): it is a finding unless its parent already holds the owner's approval,
// an owner-rulings entry gate-loosening-<fingerprint>. The land gate refuses the same change before it reaches main
// (scripts/supervisor/land-gate-loosening.mjs).
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { log } from '../api/git/log.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { judgeChange, looseningRules } from '../supervisor/land-gate-loosening.mjs';

export const CODE = 'RT_GATE_LOOSENING';
const COMMIT_LIMIT = 400;

const finding = (sha, message) => ({ code: CODE, path: `commit ${sha.slice(0, 10)}`, line: 0, message: `commit ${sha.slice(0, 10)} ${message}` });

/** The release commit of the tree: the newest commit that changed the "version" line of package.json, or null. */
function releaseCommit(root) {
  const found = log(['-1', '--format=%H', '-G"version":', '--', 'package.json'], { cwd: root });
  return found.status === 0 ? found.stdout.trim() || null : null;
}

/** The RT_GATE_LOOSENING findings over the commits since the release commit of the tree at `root`. */
export function checkGateLoosening(root = skillRoot) {
  const rules = looseningRules(root);
  const base = rules ? releaseCommit(root) : null;
  if (!base) return [];
  const listed = revList(['--no-merges', '--reverse', `--max-count=${COMMIT_LIMIT}`, `${base}..HEAD`], { cwd: root });
  if (listed.status !== 0) return [];
  return listed.stdout.split(/\r?\n/).filter(Boolean).flatMap((sha) => {
    const judged = judgeChange({ dir: root, base: `${sha}^`, head: sha, rules });
    if (!judged || judged.approved) return [];
    const what = judged.findings.map((entry) => `${entry.kind} ${entry.file}: ${entry.detail}`).join('; ');
    return [finding(sha, `loosens a gate (${what}) without the owner's approval: add the owner-rulings entry ${judged.id} first, or restore the gate`)];
  });
}

if (isMain(import.meta.url)) process.exitCode = printFindings(checkGateLoosening(), 'OK: no commit since the last release loosens a gate without the owner\'s approval.');
