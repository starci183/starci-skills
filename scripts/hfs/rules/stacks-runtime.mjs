// R10 runtime consistency: app-owned scheduling, managed lite backing and Swarm deployment safety.
import fs from 'node:fs';
import path from 'node:path';
import { isPlainObject as plain } from '../../../engine/plain-object.mjs';
import { deploymentFindings } from '../../lib/deployment-findings.mjs';
import { findStackDeclaration, readDeclaration } from '../../lib/stack-declaration.mjs';
import { isInside } from '../../lib/walk.mjs';
import { composeIncludePaths, swarmInventoryIssues, swarmModelIssues } from '../../lib/swarm-stack.mjs';
import { found, readText } from './read.mjs';

const CODE = 'HFS_STACKS_SHAPE';
const DECLARATION = '.starcistacks/application-stacks.yaml';
const HOST_CRON_PATH = /^(?:\.github\/workflows|deploy|scripts|\.starcistacks)\//;
const HOST_CRON = /\bcrontab\s+(?:-l\b|-(?=\s|[;|&)]|$))|(?:\/etc\/)?\bcron\.d(?:\/|\b)|@reboot\b/i;
const mapping = value => plain(value) ? value : {};
const issueFinding = (file, issue) => found(CODE, file, `${file}: ${issue.at}: ${issue.message}`);

/** The app's tracked automation sources; locations are reported without returning any source text. */
export function hostCrontabFindings({ repoRoot, files }) {
  const findings = [];
  for (const file of files.filter(file => HOST_CRON_PATH.test(file) && !file.endsWith('.enc'))) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (HOST_CRON.test(line)) findings.push(found(CODE, file,
        `${file}:${index + 1}: host crontab installation is forbidden; recurring work must use an app scheduler, pgmq/pg_cron, or a declared Swarm scheduler and replicated-job`, { line: index + 1 }));
    }
  }
  return findings;
}

function safeStackFile(repoRoot, envDir, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) return null;
  const target = path.resolve(envDir, relative);
  const base = path.resolve(repoRoot);
  if (!isInside(base, envDir) || !isInside(envDir, target)) return null;
  let cursor = target;
  while (true) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) return null;
    if (cursor === base) break;
    cursor = path.dirname(cursor);
  }
  return target;
}

function mergeMapping(current, incoming) {
  const result = { ...mapping(current) };
  for (const [key, value] of Object.entries(mapping(incoming))) {
    result[key] = plain(value) ? mergeMapping(result[key], value) : value;
  }
  return result;
}

function includePaths(doc, relative, file, findings) {
  const { paths, errors } = composeIncludePaths(doc);
  for (const message of errors) findings.push(issueFinding(file, { at: 'include', message }));
  return paths.map(value => path.isAbsolute(value) ? value : path.posix.join(path.posix.dirname(relative), value));
}

function loadSwarmModel({ repoRoot, environment, spec, files, findings }) {
  const prefix = `.starcistacks/${environment}/`, envDir = path.resolve(repoRoot, prefix);
  const queue = [...(Array.isArray(spec.composeFiles) ? spec.composeFiles : [])], seen = new Set();
  let model = {};
  if (!queue.length) findings.push(found(CODE, DECLARATION, `${DECLARATION}: environments.${environment}.composeFiles must declare the Swarm stack sources`));
  while (queue.length) {
    const relative = queue.shift();
    if (seen.has(relative)) continue;
    seen.add(relative);
    const file = `${prefix}${relative}`, target = safeStackFile(repoRoot, envDir, relative);
    const parsed = target && files.includes(file) ? readDeclaration(target) : { error: 'missing, untracked or unsafe stack source' };
    if (parsed.error) {
      findings.push(found(CODE, file, `${file}: Swarm stack cannot be read: ${parsed.error}`));
      continue;
    }
    model = mergeMapping(model, parsed.doc);
    queue.push(...includePaths(parsed.doc, relative, file, findings));
  }
  return { model, sources: new Set([...seen].map(relative => `${prefix}${relative}`)) };
}

function swarmDeploymentFiles(repoRoot, files) {
  return files.filter(file => {
    const environment = /^\.starcistacks\/([^/]+)\/infra\/swarm\//.exec(file)?.[1];
    if (!environment || file.endsWith('.enc')) return false;
    const target = safeStackFile(repoRoot, path.resolve(repoRoot, '.starcistacks', environment), file.split('/').slice(2).join('/'));
    if (!target) return true;
    const parsed = readDeclaration(target);
    return path.basename(file) === 'stack.yaml' || plain(parsed.doc?.services) || Array.isArray(parsed.doc?.include);
  });
}

function liteEnvironmentFindings({ doc, environments, deployments }) {
  const findings = [];
  const delivery = deployments.length || Object.values(environments).some(spec => Array.isArray(spec?.composeFiles) && spec.composeFiles.length);
  if (delivery && (doc.backing?.supabase?.provider !== 'supabase' || doc.backing?.supabase?.managed !== true))
    findings.push(found(CODE, DECLARATION, `${DECLARATION}: lite Swarm delivery must declare backing.supabase with provider: supabase and managed: true`));
  for (const [environment, spec] of Object.entries(environments)) {
    if (!Array.isArray(spec?.composeFiles) || !spec.composeFiles.length) continue;
    if (spec.runtime !== 'docker-swarm' || spec.composeFiles.some(file => typeof file !== 'string' || !file.startsWith('infra/swarm/')))
      findings.push(found(CODE, DECLARATION, `${DECLARATION}: environments.${environment} lite delivery must use runtime: docker-swarm and infra/swarm sources`));
  }
  return findings;
}

function undeclaredSwarmFindings(deployments, environments, sources) {
  return deployments.filter(file => !sources.has(file)).map(file => {
    const environment = file.split('/')[1], spec = environments[environment];
    const reason = spec?.runtime === 'docker-swarm' ? 'is not declared or reachable from composeFiles' : 'has no declared docker-swarm environment';
    return found(CODE, file, `${file}: Swarm deployment ${reason}`);
  });
}

/** Declared Swarm sources are checked for both editions; lite additionally refuses local managed backing images. */
export function stacksRuntimeFindings({ repoRoot, files, doc, edition = 'full' }) {
  const findings = [], lite = edition === 'lite', components = mapping(doc?.components), environments = mapping(doc?.environments);
  const deployments = swarmDeploymentFiles(repoRoot, files), sources = new Set();
  findings.push(...swarmInventoryIssues({ components, lite }).map(issue => issueFinding(DECLARATION, issue)));
  if (lite) findings.push(...liteEnvironmentFindings({ doc, environments, deployments }));
  for (const [environment, entry] of Object.entries(environments)) {
    const spec = mapping(entry);
    if (spec.runtime !== 'docker-swarm') continue;
    const loaded = loadSwarmModel({ repoRoot, environment, spec, files, findings });
    for (const file of loaded.sources) sources.add(file);
    const rendered = renderedDeployment({ repoRoot, environment, spec, files, edition });
    if (spec.renderedModel !== undefined && !rendered.unavailable) sources.add(rendered.file);
    const file = `.starcistacks/${environment}/${spec.composeFiles?.[0] ?? 'infra/swarm/stack.yaml'}`;
    findings.push(...swarmModelIssues({ model: loaded.model, components, bindings: spec.components, lite }).map(issue => issueFinding(file, issue)));
  }
  findings.push(...undeclaredSwarmFindings(deployments, environments, sources));
  return findings;
}

function renderedDeployment({ repoRoot, environment, spec, files, edition }) {
  const relative = spec.renderedModel ?? spec.composeFiles?.[0] ?? 'infra/swarm/stack.yaml';
  const prefix = `.starcistacks/${environment}/`, file = `${prefix}${relative}`;
  const envDir = path.resolve(repoRoot, prefix);
  const target = safeStackFile(repoRoot, envDir, relative);
  const modelDirectory = edition === 'lite' ? 'infra/swarm/' : 'infra/';
  const allowed = typeof relative === 'string' && relative.startsWith(modelDirectory) && /\.(?:ya?ml|json)$/i.test(relative);
  const parsed = allowed && target && files.includes(file) ? readDeclaration(target) : {};
  const model = mapping(parsed.doc);
  const rendered = plain(model.services) && Object.keys(model.services).length > 0 && model.include === undefined;
  const complete = spec.renderedModel !== undefined || spec.composeFiles?.length === 1;
  return { environment, spec, model, file, unavailable: !rendered || !complete };
}

/** Tracked rendered Swarm models shared by the alpha.15 finders and the app-check gate. */
export function stacksDeploymentContexts(context = {}) {
  const files = context.all ?? context.files ?? [];
  const empty = { doc: {}, deployments: [], files };
  if (!context.repoRoot || context.isRoot === false) return empty;
  if (context.repo?.profile && context.repo.profile !== 'app') return empty;
  if (!files.includes(DECLARATION)) return empty;
  if (!safeStackFile(context.repoRoot, path.resolve(context.repoRoot, '.starcistacks'), 'application-stacks.yaml')) return empty;
  const doc = findStackDeclaration(context.repoRoot).doc;
  if (!doc) return empty;
  const deployments = Object.entries(mapping(doc.environments))
    .filter(([, spec]) => spec?.runtime === 'docker-swarm')
    .map(([environment, spec]) => renderedDeployment({ repoRoot: context.repoRoot, environment, spec, files, edition: context.repo?.edition }));
  return { doc, deployments, files };
}

/** Apply a static Swarm contract to tracked rendered models and project standard HFS findings. */
export function stacksDeploymentFindings(context, issuesFor) {
  const { doc, deployments, files } = stacksDeploymentContexts(context);
  return deploymentFindings(deployments,
    entry => issuesFor({ doc, ...entry, files, repoRoot: context.repoRoot, repo: context.repo }), found, DECLARATION);
}
