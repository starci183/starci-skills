// docker-stack.mjs - the function-backed `starci docker up|down|ps` lifecycle. Destructive selection is always the
// intersection of starci.project and Compose project labels; names are presentation only and never removal selectors.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { composeConfig as realComposeConfig } from '../api/docker/compose-config.mjs';
import { composeDown as realComposeDown } from '../api/docker/compose-down.mjs';
import { composeUp as realComposeUp } from '../api/docker/compose-up.mjs';
import { composePs as realComposePs } from '../api/docker/compose-ps.mjs';
import { ps as realDockerPs } from '../api/docker/ps.mjs';
import { resourceList as realResourceList } from '../api/docker/resource-list.mjs';
import { resourceRemove as realResourceRemove } from '../api/docker/resource-remove.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { resultDetail as detail, resultOk as ok } from '../lib/verb-call.mjs';
import { underHostLock } from './verb-lock.mjs';
import {
  DOCKER_PORT_POLICY,
  PROJECT_LABEL_KEY,
  dockerProjectName,
  isForeignContainer,
  ownershipFilters,
  refusePortPolicy,
} from './docker-policy.mjs';

const refused = (message) => ({
  code: 2,
  stderr: `${DOCKER_PORT_POLICY}: ${message}`,
  data: { schema: 'starci/docker-refusal@1', ok: false, code: DOCKER_PORT_POLICY, message },
});
const failed = (verb, result) => ({ code: 1, stderr: `starci docker ${verb}: ${detail(result) || `docker exited ${result?.status ?? 'without a status'}`}` });

const hostEffect = async (ctx, deps, purpose, fn) => {
  try {
    const result = await (deps.underHostLock ?? underHostLock)({ role: ctx.role ?? 'owner', purpose, env: ctx.env }, fn, deps);
    if (result?.ok === true && Object.hasOwn(result, 'value')) return result.value;
    if (result?.ok === false && result?.code === undefined) return { code: 1, stderr: `starci docker ${purpose}: host lock refused (${result.reason ?? 'held'})` };
    return result;
  } catch (error) { return { code: 1, stderr: `starci docker ${purpose}: host lock failed (${error.message})` }; }
};

function appIdentity(cwd) {
  let declaration;
  try { declaration = JSON.parse(fs.readFileSync(path.join(cwd, 'hfs.json'), 'utf8')); }
  catch (error) { return { error: `the app root ${cwd} needs a readable hfs.json (${error.message})` }; }
  if (declaration?.kind !== 'app' || !/^[a-z0-9][a-z0-9-]*$/.test(String(declaration?.project ?? '')))
    return { error: `hfs.json at ${cwd} must declare kind app and a kebab-case project` };
  return { project: declaration.project, declaration };
}

const stackOptions = (ctx) => {
  const [stack, ...extra] = ctx.positionals ?? [];
  const env = ctx.args?.env ?? 'dev';
  if (!stack || extra.length || !/^[a-z0-9][a-z0-9-]*$/.test(String(stack)) || !/^[a-z0-9][a-z0-9-]*$/.test(String(env)))
    return { error: 'a stack and --env must be kebab-case names' };
  return { stack: String(stack), env: String(env) };
};

const jsonRows = (text) => {
  const input = String(text ?? '').trim();
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return input.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
};

const labelsOf = (row) => Object.fromEntries(String(row.Labels ?? row.labels ?? '').split(',').filter(Boolean).map((item) => {
  const at = item.indexOf('=');
  return at < 0 ? [item, ''] : [item.slice(0, at), item.slice(at + 1)];
}));

const portsOfComposeRow = (row) => (Array.isArray(row.Publishers ?? row.publishers) ? (row.Publishers ?? row.publishers).map((entry) => {
  const published = entry.PublishedPort ?? entry.published;
  const target = entry.TargetPort ?? entry.target;
  const host = entry.URL ?? entry.url ?? '0.0.0.0';
  return published ? `${host}:${published}->${target}/${entry.Protocol ?? entry.protocol ?? 'tcp'}` : `${target}/${entry.Protocol ?? entry.protocol ?? 'tcp'}`;
}) : String(row.Ports ?? row.ports ?? '').split(/,\s*/).filter(Boolean));

const healthOf = (row) => {
  const explicit = row.Health ?? row.health;
  if (explicit) return String(explicit);
  const status = String(row.Status ?? row.status ?? '');
  return /\((healthy|unhealthy|starting)\)/i.exec(status)?.[1]?.toLowerCase() ?? String(row.State ?? row.state ?? 'unknown').toLowerCase();
};

/** Compose override that adds the ownership label to every resource this project creates. External resources are not created. */
function labelsOverride(model, project) {
  const labels = { [PROJECT_LABEL_KEY]: project };
  const entries = (value, skipExternal = false) => Object.fromEntries(Object.entries(value ?? {})
    .filter(([, definition]) => !skipExternal || definition?.external !== true)
    .map(([name]) => [name, { labels }]));
  return {
    services: entries(model?.services),
    networks: entries(model?.networks, true),
    volumes: entries(model?.volumes, true),
  };
}

const withOverride = async (model, project, fn, deps) => {
  if (deps.withOverride) return deps.withOverride(labelsOverride(model, project), fn);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-docker-'));
  const file = path.join(dir, 'labels.compose.json');
  try {
    fs.writeFileSync(file, `${JSON.stringify(labelsOverride(model, project), null, 2)}\n`);
    return await fn(file);
  } finally { safeRemove(dir); }
};

/** Start one app stack after rendering and checking the Compose model, then map its waited health result. */
export async function dockerUp(ctx, deps = {}) {
  const cwd = path.resolve(ctx.cwd ?? process.cwd());
  const identity = appIdentity(cwd);
  const selected = stackOptions(ctx);
  if (identity.error || selected.error) return { code: 2, stderr: `starci docker up: ${identity.error ?? selected.error}` };
  const projectName = dockerProjectName(identity.project, selected.stack);
  if (!projectName || isForeignContainer(projectName)) return refused(`project ${projectName ?? identity.project} is foreign`);
  const composeFile = path.join(cwd, '.starcistacks', selected.env, 'infra', 'compose', `${selected.stack}.yaml`);
  if (!fs.existsSync(composeFile)) return { code: 2, stderr: `starci docker up: stack file not found: ${path.relative(cwd, composeFile)}` };
  return hostEffect(ctx, deps, 'docker-up', async () => {
    const config = await (deps.composeConfig ?? realComposeConfig)(composeFile, { cwd });
    if (!ok(config)) return failed('up', config);
    let model;
    try { model = JSON.parse(String(config.stdout ?? '')); }
    catch (error) { return { code: 1, stderr: `starci docker up: Compose returned invalid JSON (${error.message})` }; }
    const policy = refusePortPolicy(model);
    if (policy) return refused(policy.message);
    const waitSeconds = ctx.args?.['wait-seconds'] ?? 120;
    if (!Number.isInteger(Number(waitSeconds)) || Number(waitSeconds) < 1) return { code: 2, stderr: 'starci docker up: --wait-seconds must be a positive integer' };
    return withOverride(model, identity.project, async (override) => {
      const request = { files: [composeFile, override], projectName, waitSeconds: Number(waitSeconds), build: ctx.args?.build === true };
      const started = await (deps.composeUp ?? realComposeUp)(request, { cwd });
      if (!ok(started)) return failed('up', started);
      const listed = await (deps.composePs ?? realComposePs)(request, { cwd });
      if (!ok(listed)) return failed('up', listed);
      let rows;
      try { rows = jsonRows(listed.stdout); } catch (error) { return { code: 1, stderr: `starci docker up: Compose ps returned invalid JSON (${error.message})` }; }
      const containers = rows.map((row) => ({ name: String(row.Name ?? row.name ?? ''), ports: portsOfComposeRow(row), health: healthOf(row) }));
      if (containers.some(({ name }) => isForeignContainer(name))) return refused('Compose reported a protected foreign container after startup');
      const text = [`starci docker up: ${projectName}`, ...containers.map((item) => `${item.name} ${item.health} ${item.ports.join(', ') || 'no published ports'}`)].join('\n');
      return { code: 0, text, data: { schema: 'starci/docker-up@1', project: identity.project, stack: selected.stack, containers } };
    }, deps);
  });
}

/** Stop and remove only ids first selected by both exact ownership labels; optional volumes use the same selectors. */
export async function dockerDown(ctx, deps = {}) {
  const cwd = path.resolve(ctx.cwd ?? process.cwd());
  const identity = appIdentity(cwd);
  const selected = stackOptions(ctx);
  if (identity.error || selected.error) return { code: 2, stderr: `starci docker down: ${identity.error ?? selected.error}` };
  const projectName = dockerProjectName(identity.project, selected.stack);
  if (!projectName || isForeignContainer(projectName)) return refused(`project ${projectName ?? identity.project} is foreign`);
  return hostEffect(ctx, deps, 'docker-down', async () => {
    const filters = ownershipFilters(identity.project, projectName);
    const dockerPs = deps.dockerPs ?? realDockerPs;
    const resourceList = deps.resourceList ?? realResourceList;
    const remove = deps.resourceRemove ?? realResourceRemove;
    const containersResult = await dockerPs({ all: true, filters }, { cwd });
    if (!ok(containersResult)) return failed('down', containersResult);
    let containerRows;
    try { containerRows = jsonRows(containersResult.stdout); } catch (error) { return { code: 1, stderr: `starci docker down: Docker ps returned invalid JSON (${error.message})` }; }
    const containers = containerRows.filter((row) => !isForeignContainer(row.Names ?? row.Name ?? row.name)).map((row) => String(row.ID ?? row.Id ?? row.id ?? '')).filter(Boolean);
    const networkResult = await resourceList('network', filters, { cwd });
    if (!ok(networkResult)) return failed('down', networkResult);
    const networks = String(networkResult.stdout ?? '').split(/\s+/).filter(Boolean);
    let volumes = [];
    if (ctx.args?.volumes === true) {
      const volumeResult = await resourceList('volume', filters, { cwd });
      if (!ok(volumeResult)) return failed('down', volumeResult);
      volumes = String(volumeResult.stdout ?? '').split(/\s+/).filter(Boolean);
    }
    if (containers.length) {
      const result = await (deps.composeDown ?? realComposeDown)(containers, { cwd });
      if (!ok(result)) return failed('down', result);
    }
    for (const [kind, ids] of [['network', networks], ['volume', volumes]]) {
      if (!ids.length) continue;
      const result = await remove(kind, ids, { cwd });
      if (!ok(result)) return failed('down', result);
    }
    const data = { schema: 'starci/docker-down@1', project: identity.project, stack: selected.stack, removed: { containers, networks, volumes } };
    const text = [
      `starci docker down: removed ${containers.length} container(s), ${networks.length} network(s), ${volumes.length} volume(s)`,
      ...(containers.length ? [`containers: ${containers.join(', ')}`] : []),
      ...(networks.length ? [`networks: ${networks.join(', ')}`] : []),
      ...(volumes.length ? [`volumes: ${volumes.join(', ')}`] : []),
    ].join('\n');
    return { code: 0, text, data };
  });
}

/** List StarCi-labelled containers; --all additionally exposes protected containers as foreign, but never mutates them. */
export async function dockerPs(ctx, deps = {}) {
  const all = ctx.args?.all === true;
  const result = await (deps.dockerPs ?? realDockerPs)({ all, filters: all ? [] : [`label=${PROJECT_LABEL_KEY}`] }, { cwd: ctx.cwd });
  if (!ok(result)) return failed('ps', result);
  let rows;
  try { rows = jsonRows(result.stdout); } catch (error) { return { code: 1, stderr: `starci docker ps: Docker returned invalid JSON (${error.message})` }; }
  const containers = rows.map((row) => {
    const labels = labelsOf(row);
    const name = String(row.Names ?? row.Name ?? row.name ?? '');
    return { name, project: labels[PROJECT_LABEL_KEY] ?? null, ports: String(row.Ports ?? row.ports ?? '').split(/,\s*/).filter(Boolean), health: healthOf(row), foreign: isForeignContainer(name) };
  }).filter((row) => row.project !== null || (all && row.foreign));
  const text = containers.length ? containers.map((item) => `${item.name}${item.foreign ? ' [foreign]' : ''} ${item.health} ${item.ports.join(', ') || 'no published ports'}`).join('\n') : 'no StarCi containers';
  return { code: 0, text, data: { schema: 'starci/docker-ps@1', containers } };
}
