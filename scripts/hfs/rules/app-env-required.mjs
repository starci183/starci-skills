// R289: every declared back-end app owns a tracked typed environment boundary.
// ESLint's app-env-required rule checks its interface, reader and bootstrap delegation.
import { found, readText } from './read.mjs';

export const REQUIRED_CODE = 'BE_APP_ENV_REQUIRED';

/** Missing files cannot be visited by ESLint, so the content check owns their presence. */
export function appEnvRequiredFindings({ repoRoot, files, all = files, repo, inScope = () => true }) {
  if (repo.profile !== 'be' || !['lite', 'full'].includes(repo.edition ?? 'full')) return [];
  const tracked = new Set(all);
  const findings = [];
  for (const app of repo.apps ?? []) {
    const file = `apps/${app.name}/src/${app.name}.env.ts`;
    if (!inScope(file)) continue;
    if (tracked.has(file) && readText(repoRoot, file) !== null) continue;
    findings.push(found(REQUIRED_CODE, file,
      `${app.name} requires a tracked ${file} exporting its environment interface and read<App>Env(env: EnvSource); main.ts builds EnvSource once and delegates environment reads to that boundary`));
  }
  return findings;
}
