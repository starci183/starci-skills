// R272: lite proves each app's real Nest composition with doubles; full keeps its e2e proof.
import { appWiring } from '../app-wiring.mjs';

export const BE_APP_BOOT_PROOF_MISSING = 'BE_APP_BOOT_PROOF_MISSING';

/** Root scopes delegate to the be side, so each app is compiled once. */
export function bootProofFindings({ repoRoot, files, all = files, repo, isRoot = Boolean(repo?.sides), inScope = () => true }) {
  if (repo?.edition !== 'lite' || isRoot || repo?.profile === 'fe' || repo?.kind === 'fe') return [];
  return appWiring({ repoRoot, files: all, repo }).findings.filter(finding => inScope(finding.path));
}
