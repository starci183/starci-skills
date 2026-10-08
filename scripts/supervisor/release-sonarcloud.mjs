// release-sonarcloud.mjs - the SonarCloud side of the release's Sonar proof. The runtime repository is public and holds no secret file, so the three example apps are analysed on SonarCloud
// with the ONE token of the runtime's untracked secret.env (SONAR_TOKEN) and the organization key of the owner config (config.yaml sonar.organization, the env SONAR_ORGANIZATION over it;
// docs/application-stacks.md, STACKS_EXAMPLE_FORM): the same names the runtime's own ci.yml reads as a repository secret and variable. The values come through scripts/gates/runtime-host.mjs runtimeSecretEnv (engine/secrets.mjs secretEnv), are held
// in memory, travel only in an Authorization header and the scanner's environment, and are never printed. The project key on SonarCloud is <organization>_<key the example declares>.
import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../gates/sonar-local.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { runtimeSecretEnv } from '../gates/runtime-host.mjs';
import { readEnv } from '../lib/env.mjs';
import { freshFetch } from '../api/sonar/fresh-fetch.mjs';

const SONARCLOUD = 'https://sonarcloud.io';
/** The branch a release proof analyses on a project that already has its main branch, so a proof never lands in the main history of the example's project. */
export const PROOF_BRANCH = 'release-proof';
const TOKEN = 'SONAR_TOKEN';
const ORGANIZATION = 'SONAR_ORGANIZATION';

/** The SonarCloud organization key: the env SONAR_ORGANIZATION over the owner config `sonar.organization`, or null. */
export const sonarOrganization = (env = process.env, config = loadConfig()) => readEnv(ORGANIZATION, env)?.trim() || config?.sonar?.organization || null;

/** The settings the proof reads: {SONAR_TOKEN} from the runtime's secret.env (and the environment over it), {SONAR_ORGANIZATION} from the organization above. */
export const hostSettings = () => ({ [TOKEN]: runtimeSecretEnv(process.env)[TOKEN], [ORGANIZATION]: sonarOrganization() });

const withoutHost = (env) => Object.fromEntries(Object.entries(env).filter(([name]) => name !== 'SONAR_HOST_URL'));

/** The `sonar.projectKey` of an example's sonar-project.properties (rendered from the key its declaration names), or null. */
function declaredKey(appDir) {
  const text = fs.existsSync(path.join(appDir, 'sonar-project.properties')) ? fs.readFileSync(path.join(appDir, 'sonar-project.properties'), 'utf8') : '';
  return /^sonar\.projectKey=(.+)$/m.exec(text)?.[1]?.trim() ?? null;
}

/** {cfg, key, org}: the gate config of the example in `appDir` for SonarCloud with the token of `settings`, and the project key `<organization>_<declared key>`. */
export function cloudConfig(appDir, settings) {
  const cfg = resolveConfig({ cwd: appDir, host: SONARCLOUD, fetch: freshFetch, runtimeSecretEnv: (env) => ({ ...withoutHost(env), [TOKEN]: settings[TOKEN] }) });
  const base = declaredKey(appDir);
  if (!base) throw new Error(`${appDir} has no sonar.projectKey in sonar-project.properties`);
  return { cfg, key: `${settings[ORGANIZATION]}_${base}`, org: settings[ORGANIZATION] };
}

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

/** The findings [{what, fix}] that keep the proof from reaching SonarCloud, in seconds: the two variables, the API, the token and the organization. [] when ready. `deps.settings`, `deps.fetch` are spec seams. */
export async function sonarCloudFindings(apps, deps = {}) {
  if (!apps.length) return [];
  const settings = deps.settings ?? hostSettings();
  const send = deps.fetch ?? freshFetch;
  const missing = [
    !settings[TOKEN] && { what: `${TOKEN} is not set in the runtime's secret.env`, fix: 'owner: put a SonarCloud token as SONAR_TOKEN in .claude/secret.env (sonarcloud.io > My Account > Security > Generate Tokens); the same token is the repository secret SONAR_TOKEN' },
    !settings[ORGANIZATION] && { what: 'the SonarCloud organization is not set (config.yaml sonar.organization, or the env SONAR_ORGANIZATION)', fix: 'owner: set `sonar: {organization: <the organization key shown on sonarcloud.io>}` in .claude/config.yaml (the repository variable SONAR_ORGANIZATION holds the same)' },
  ].filter(Boolean);
  if (missing.length) return missing;
  try {
    const status = await send(`${SONARCLOUD}/api/system/status`, { signal: AbortSignal.timeout(15_000) });
    if (status.status !== 200) return [{ what: `SonarCloud answers HTTP ${status.status} on /api/system/status`, fix: 'retry when sonarcloud.io is up' }];
    const valid = await send(`${SONARCLOUD}/api/authentication/validate`, { ...auth(settings[TOKEN]), signal: AbortSignal.timeout(15_000) });
    if (valid.status !== 200 || (await valid.json())?.valid !== true) {
      return [{ what: `SonarCloud rejects ${TOKEN}${/^sq[apu]_/.test(settings[TOKEN]) ? ' (its prefix is that of a self-hosted SonarQube token)' : ''}`, fix: 'owner: replace SONAR_TOKEN in .claude/secret.env with a SonarCloud token (sonarcloud.io > My Account > Security > Generate Tokens)' }];
    }
    const org = await send(`${SONARCLOUD}/api/organizations/search?organizations=${encodeURIComponent(settings[ORGANIZATION])}`, { ...auth(settings[TOKEN]), signal: AbortSignal.timeout(15_000) });
    if (org.status === 200 && !(await org.json())?.organizations?.length) return [{ what: `SonarCloud has no organization ${settings[ORGANIZATION]}`, fix: 'owner: set sonar.organization in .claude/config.yaml to the key of your SonarCloud organization' }];
    return [];
  } catch (error) {
    return [{ what: `SonarCloud is unreachable (${String(error?.cause?.code ?? error?.message ?? error).slice(0, 80)})`, fix: 'the release cut needs network access to sonarcloud.io' }];
  }
}

/**
 * The project of `cloud` ({cfg, key, org}) on SonarCloud, created when absent: {created: false} or {created: true}, else {error} naming what refused (a token that may not create projects
 * needs the project created once by the owner). `send` is the fetch seam.
 */
export async function ensureCloudProject(cloud, token, send = freshFetch) {
  const found = await send(`${SONARCLOUD}/api/components/show?component=${encodeURIComponent(cloud.key)}`, auth(token));
  if (found.status === 200) return { created: false };
  if (found.status !== 404) return { error: `the project ${cloud.key} could not be looked up: HTTP ${found.status}` };
  const form = new URLSearchParams({ organization: cloud.org, project: cloud.key, name: cloud.key, visibility: 'public' });
  const made = await send(`${SONARCLOUD}/api/projects/create`, { method: 'POST', headers: { ...auth(token).headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  return made.status === 200 ? { created: true } : { error: `the project ${cloud.key} does not exist and the token may not create it (HTTP ${made.status}): create it once in organization ${cloud.org} on sonarcloud.io` };
}
