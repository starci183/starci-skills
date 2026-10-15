// stacks-deploy.mjs - R294: `environments.<env>.deploy` in .starcistacks/application-stacks.yaml is coherent.
// The block is judged by the same `normalizeDeploy` the `starci app stack` verbs use (scripts/hfs/stack-deploy-config.mjs), against a
// probe of the real tree: the files below .starcistacks/<env>/, the services of the first composeFiles entry and the sealed members.
// One finding per problem; an environment without a deploy block is not a finding.
import fs from 'node:fs';
import path from 'node:path';
import { isPlainObject as plain } from '../../../engine/plain-object.mjs';
import { findStackDeclaration, readDeclaration, STACK_ROOT } from '../../lib/stack-declaration.mjs';
import { normalizeDeploy } from '../stack-deploy-config.mjs';
import { found, readJson } from './read.mjs';

const DECLARATION = `${STACK_ROOT}/application-stacks.yaml`;
const ENV_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const mapping = (value) => (plain(value) ? value : {});

/** Service names of the first composeFiles entry; an unreadable stack source means unknown services (empty set). */
function stackServices(envDir, spec) {
  const relative = Array.isArray(spec.composeFiles) ? spec.composeFiles[0] : undefined;
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) return new Set();
  const { doc } = readDeclaration(path.join(envDir, relative));
  return new Set(Object.keys(mapping(doc?.services)));
}

function sealedMembers(envDir) {
  try {
    return new Set(fs.readdirSync(path.join(envDir, 'secrets')).filter((name) => name.endsWith('.enc')).map((name) => name.slice(0, -4)));
  } catch { return new Set(); }
}

function probeOf(envDir, spec) {
  return { exists: (relative) => fs.existsSync(path.join(envDir, relative)), services: stackServices(envDir, spec), members: sealedMembers(envDir) };
}

/** The shell scripts below the environment directory (node_modules aside), as absolute paths. */
function shellScripts(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : shellScripts(file);
    return entry.name.endsWith('.sh') ? [file] : [];
  });
}

/** A shell script with CRLF line endings fails inside the container (`set: Illegal option -`): one finding per such file. */
function lineEndingFindings({ repoRoot, envDir, environment }) {
  if (!fs.existsSync(envDir)) return [];
  const crlf = String.fromCodePoint(13, 10);
  return shellScripts(envDir).filter((file) => fs.readFileSync(file, 'utf8').includes(crlf)).map((file) => found(
    'STACKS_DEPLOY_CONFIG_INVALID',
    path.relative(repoRoot, file).split(path.sep).join('/'),
    `environments.${environment}: this shell script has CRLF line endings and fails in the container; commit it with LF (.gitattributes: *.sh text eol=lf) and save it again`,
  ));
}

function environmentFindings({ repoRoot, project, environment, spec }) {
  const envDir = path.join(repoRoot, STACK_ROOT, environment);
  const { problems } = normalizeDeploy(spec.deploy, { project, probe: probeOf(envDir, spec) });
  return [...problems.map((problem) => found(
    'STACKS_DEPLOY_CONFIG_INVALID',
    DECLARATION,
    `environments.${environment}.${problem.at}: ${problem.message}`,
  )), ...lineEndingFindings({ repoRoot, envDir, environment })];
}

/** Only docker-swarm environments that declare a deploy block are judged. */
function judged([environment, spec]) {
  return ENV_NAME.test(environment) && plain(spec) && spec.runtime === 'docker-swarm' && spec.deploy !== undefined;
}

/** Findings of every declared deploy block of the app root, in both editions. */
export function stacksDeployFindings({ repoRoot, repo, isRoot }) {
  if (repo?.kind !== 'app' || !['lite', 'full'].includes(repo.edition) || isRoot === false) return [];
  const { doc } = findStackDeclaration(repoRoot);
  const project = String(readJson(repoRoot, 'hfs.json')?.project ?? 'app');
  return Object.entries(mapping(mapping(doc).environments)).filter(judged)
    .flatMap(([environment, spec]) => environmentFindings({ repoRoot, project, environment, spec }));
}
