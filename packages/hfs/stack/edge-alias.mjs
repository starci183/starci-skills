// edge-alias.mjs - the network aliases of a service on a SHARED EXTERNAL (edge) overlay network.
// `docker stack deploy` adds the compose service name (`api`) as an implicit alias on EVERY network a service joins, whatever `aliases:` the compose
// file lists. On a network that other tenants share, `api` then resolves to this stack's service too (the 2026-10-15 incident: tayson-web proxied
// http://api:3074 and got nivo_api for 17 hours). So an edge attachment must carry ONLY its declared aliases:
//   edgeAttachments       the services of a rendered (or source) stack attached to an external network, with their declared aliases
//   edgeCollisions        read-only preflight: does a short service name equal a name another container or service of that network resolves?
//   reconcileEdgeAliases  after `docker stack deploy`: `service update --network-rm <edge>` then `--network-add name=<edge>,alias=<declared>`
//   verifyEdgeAttachment  the service spec carries exactly the declared aliases (used by `stack verify`)
// Docker is reached through the same seams as the neighbouring steps: ctx.spawn (the docker transport) for the deploy-time steps, and the ssh runner
// with shell-quoted arguments for the read-only preflight.
import fs from 'node:fs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { toolOutput } from './context.mjs';
import { refusal } from './errors.mjs';
import { remoteDocker } from './remote.mjs';

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u;
const NETWORK_FORMAT = '{{json .}}';

const networkMap = (value) => (Array.isArray(value) ? Object.fromEntries(value.map((name) => [name, null])) : value ?? {});
const sameSet = (left, right) => [...new Set(left)].sort().join('\n') === [...new Set(right)].sort().join('\n');
const show = (aliases) => `[${aliases.join(', ')}]`;

/** [{ service, network, aliases }]: every service attached to an `external: true` network of the stack, with the aliases it declares. */
export function edgeAttachments(bytes) {
  const model = parseYaml(bytes) ?? {};
  const external = new Map(Object.entries(model.networks ?? {}).filter(([, definition]) => definition?.external === true).map(([key, definition]) => [key, String(definition.name ?? key)]));
  return Object.entries(model.services ?? {}).flatMap(([service, entry]) => Object.entries(networkMap(entry?.networks))
    .filter(([key]) => external.has(key))
    .map(([key, attachment]) => ({ service, network: external.get(key), aliases: (attachment?.aliases ?? []).map(String) })));
}

/** The attachments of the stack file `file`. */
export const edgeAttachmentsOf = (file) => edgeAttachments(fs.readFileSync(file, 'utf8'));

function safe(attachment) {
  for (const name of [attachment.service, attachment.network, ...attachment.aliases]) {
    if (!SAFE_NAME.test(name)) throw refusal('STACK_DEPLOY_EDGE_NAME', `the name ${JSON.stringify(name)} (service ${attachment.service}, network ${attachment.network}) is not a plain docker name`);
  }
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/** The names of the containers and services attached to the external network, read-only through the ssh runner (`docker network inspect`). */
async function networkNames(run, network) {
  const result = await remoteDocker(run, ['network', 'inspect', network, '--verbose', '--format', NETWORK_FORMAT]);
  const model = result.status === 0 ? parseJson(result.stdout) : null;
  if (model === null || typeof model !== 'object') throw refusal('STACK_DEPLOY_EDGE_UNREADABLE', `cannot read the external network ${network} (docker network inspect failed): the edge network must exist before a deploy; nothing was changed`);
  return [...Object.values(model.Containers ?? {}).map((container) => String(container.Name)), ...Object.keys(model.Services ?? {})];
}

/**
 * Read-only: for each external network of `bytes`, which implicit short service names (`api` for nivo_api) another container or service of that
 * network already resolves. Returns { networks, clashes: [{ service, alias, network, holder }] }; throws STACK_DEPLOY_EDGE_UNREADABLE when a
 * network cannot be inspected. This stack's own services (`<stack>_*`) are not "others".
 */
export async function edgeCollisions(run, config, bytes) {
  const attachments = edgeAttachments(bytes);
  const networks = [...new Set(attachments.map((item) => item.network))];
  const taken = await Promise.all(networks.map(async (network) => [network, (await networkNames(run, network)).filter((name) => !name.startsWith(`${config.stack}_`))]));
  const clashes = taken.flatMap(([network, others]) => attachments
    .filter((item) => item.network === network && others.includes(item.service))
    .map((item) => ({ service: `${config.stack}_${item.service}`, alias: item.service, network, holder: item.service })));
  return { networks, clashes };
}

/** The refusal text of one clash. */
export const describeClash = (clash) => `service ${clash.service} would carry the implicit short-name alias ${clash.alias} on the external network ${clash.network}, which ${clash.holder} (another tenant) already resolves: rename the service or the other name; nothing was changed`;

const docker = (ctx, args) => toolOutput(ctx, 'docker', args);

const networkId = (ctx, network) => docker(ctx, ['network', 'inspect', network, '--format', '{{.Id}}']).trim();

/** The edge entry of the service spec ({ Target, Aliases }) or null when the service is not attached. */
function edgeEntry(ctx, service, id) {
  const inspect = JSON.parse(docker(ctx, ['service', 'inspect', service, '--format', '{{json .}}']));
  return (inspect.Spec?.TaskTemplate?.Networks ?? []).find((entry) => entry.Target === id) ?? null;
}

const aliasesOf = (entry) => (entry === null ? [] : entry.Aliases ?? []);

/**
 * After `docker stack deploy`: makes the edge attachment of every edge-attached service carry exactly its declared aliases. `docker service update`
 * ignores a `--network-add` of an attached network, so the attachment is removed first and added again with the declared aliases. Idempotent (an exact
 * attachment is left alone). Throws STACK_DEPLOY_EDGE_ALIAS when the aliases still differ afterwards. Returns { ok, lines }.
 */
export function reconcileEdgeAliases(ctx, config, file) {
  const lines = [];
  const ids = new Map();
  for (const item of edgeAttachmentsOf(file)) {
    safe(item);
    const service = `${config.stack}_${item.service}`;
    if (!ids.has(item.network)) ids.set(item.network, networkId(ctx, item.network));
    const id = ids.get(item.network);
    const before = edgeEntry(ctx, service, id);
    if (before !== null && sameSet(aliasesOf(before), item.aliases)) {
      lines.push(`edge: ${service} on ${item.network}: aliases ${show(item.aliases)} (already exact)`);
      continue;
    }
    if (before !== null) docker(ctx, ['service', 'update', '--detach=true', '--network-rm', item.network, service]);
    docker(ctx, ['service', 'update', '--detach=true', '--network-add', ['name=' + item.network, ...item.aliases.map((alias) => `alias=${alias}`)].join(','), service]);
    const after = aliasesOf(edgeEntry(ctx, service, id));
    if (!sameSet(after, item.aliases)) throw refusal('STACK_DEPLOY_EDGE_ALIAS', `${service} carries the aliases ${show(after)} on ${item.network} after the reconcile, declared ${show(item.aliases)}`);
    lines.push(`edge: ${service} on ${item.network}: aliases ${show(aliasesOf(before))} -> ${show(item.aliases)}`);
  }
  return { ok: true, lines };
}

/** `stack verify`: throws when the service is not attached to the edge network or carries any alias other than the declared ones. */
export function verifyEdgeAttachment(ctx, config, item) {
  const service = `${config.stack}_${item.service}`;
  const entry = edgeEntry(ctx, service, networkId(ctx, item.network));
  if (entry === null) throw new Error(`${service} is not attached to ${item.network}`);
  if (!sameSet(aliasesOf(entry), item.aliases)) throw new Error(`${service} carries the aliases ${show(aliasesOf(entry))} on ${item.network}, declared ${show(item.aliases)}`);
  return `aliases ${show(item.aliases)}`;
}
