// config.mjs - loads `environments.<env>.deploy` of .starcistacks/application-stacks.yaml for the stack verbs.
// The block is read and judged by the same module `starci app check` uses (runtime/scripts/hfs/stack-deploy-config.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { DEPLOY_CONFIG_CODE, NAME, normalizeDeploy } from '../runtime/scripts/hfs/stack-deploy-config.mjs';
import { refusal } from './errors.mjs';

export const STACKS_DIR = '.starcistacks';
export const STACKS_FILE = 'application-stacks.yaml';

const readYaml = (file, what) => {
  let source;
  try { source = fs.readFileSync(file, 'utf8'); } catch { throw refusal('STACKS_DEPLOY_FILE_MISSING', `${what} (${file}) is not readable`); }
  try { return parseYaml(source); } catch { throw refusal('STACKS_DEPLOY_FILE_INVALID', `${what} is not valid YAML`); }
};

const projectOf = (repoRoot) => {
  const doc = JSON.parse(fs.readFileSync(path.join(repoRoot, 'hfs.json'), 'utf8'));
  return String(doc.project);
};

const sealedMembers = (secretsDir) => {
  try { return new Set(fs.readdirSync(secretsDir).filter((name) => name.endsWith('.enc')).map((name) => name.slice(0, -4))); } catch { return new Set(); }
};

const stackServices = (stackFile) => {
  const model = readYaml(stackFile, 'the stack source');
  return new Set(Object.keys(model?.services ?? {}));
};

/**
 * The normalised deploy configuration of one environment, with absolute paths:
 *   { env, project, stack, repoRoot, envDir, stackFile, secretsDir, members, services, ...deploy block }.
 * Throws StackError (exit 2) naming every problem when the block is missing or invalid.
 */
export function loadDeployConfig({ repoRoot, env }) {
  if (!NAME.test(String(env))) throw refusal(DEPLOY_CONFIG_CODE, `--env ${env} must match ${NAME}`);
  const declaration = readYaml(path.join(repoRoot, STACKS_DIR, STACKS_FILE), STACKS_FILE);
  const environment = declaration?.environments?.[env];
  if (!environment) throw refusal('STACKS_DEPLOY_ENV_UNKNOWN', `${STACKS_FILE} declares no environment ${env}`);
  if (environment.runtime !== 'docker-swarm') throw refusal('STACKS_DEPLOY_NOT_SWARM', `environment ${env} runs ${environment.runtime}; stack deploy verbs need docker-swarm`);
  if (environment.deploy === undefined) throw refusal('STACKS_DEPLOY_UNDECLARED', `environment ${env} has no deploy block in ${STACKS_FILE}`);
  const envDir = path.join(repoRoot, STACKS_DIR, env);
  const stackFile = path.join(envDir, String(environment.composeFiles?.[0] ?? ''));
  const secretsDir = path.join(envDir, 'secrets');
  const services = stackServices(stackFile);
  const members = sealedMembers(secretsDir);
  const probe = { exists: (rel) => fs.existsSync(path.join(envDir, rel)), services, members };
  const project = projectOf(repoRoot);
  const { config, problems } = normalizeDeploy(environment.deploy, { project, probe });
  if (!config) {
    const first = problems.slice(0, 6).map((item) => `${item.at}: ${item.message}`).join('; ');
    throw refusal(DEPLOY_CONFIG_CODE, `${problems.length} problem${problems.length === 1 ? '' : 's'} in environments.${env}.deploy: ${first}`);
  }
  return { env, project, repoRoot, envDir, stackFile, secretsDir, members, services, ...config };
}
