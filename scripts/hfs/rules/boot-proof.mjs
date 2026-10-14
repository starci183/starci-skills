// R272: lite proves each app's real Nest composition with doubles; full keeps its e2e proof.
import fs from 'node:fs';
import path from 'node:path';
import { appWiring } from '../app-wiring.mjs';

export const BE_APP_BOOT_PROOF_MISSING = 'BE_APP_BOOT_PROOF_MISSING';

/** Root scopes delegate to the be side, so each app is compiled once. */
export function bootProofFindings({ repoRoot, files, all = files, repo, isRoot = Boolean(repo?.sides), inScope = () => true }) {
  if (repo?.edition !== 'lite' || isRoot || repo?.profile === 'fe' || repo?.kind === 'fe') return [];
  // Dependencies not installed (a fresh scaffold, a lint-only checkout): the Nest graph cannot be compiled, so the proof is unavailable here; CI and every installed app judge it.
  const installed = [repoRoot, path.dirname(repoRoot ?? '.')].some((dir) => dir && fs.existsSync(path.join(dir, 'node_modules')));
  return appWiring({ repoRoot, files: all, repo }).findings
    .filter(finding => installed || finding.reason !== 'module or proof could not be compiled')
    .filter(finding => inScope(finding.path));
}
