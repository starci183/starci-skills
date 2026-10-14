// Shared static Swarm contract for app checks and rendered deployment evidence.
import { isPlainObject as plain } from '../../engine/plain-object.mjs';

const PINNED_IMAGE = /@sha256:[a-f0-9]{64}$/i;
const VERSIONED_SECRET = /-v[1-9][0-9]*$/;
const BACKING_IMAGE = /^(?:postgres(?:ql)?|postgresql-repmgr|redis(?:-stack(?:-server)?)?|(?:cp-)?kafka(?:-native)?|keycloak|minio|rabbitmq|mysql(?:-server)?|mongo(?:db)?|mongodb-community-server)$/i;
const mapping = value => plain(value) ? value : {};
const present = value => typeof value === 'string' && Boolean(value.trim());
const configured = value => Object.keys(mapping(value)).length > 0;
const schedulerImage = image => present(image) && /(?:^|\/)swarm-cronjob(?:[:@]|$)/.test(image);

/** Compose includes may be a path or an object whose path is a string or a list of source paths. */
export function composeIncludePaths(doc) {
  const paths = [], errors = [];
  if (doc.include === undefined) return { paths, errors };
  if (!Array.isArray(doc.include)) return { paths, errors: ['Compose include must be an array of source paths'] };
  for (const entry of doc.include) {
    let values = [entry];
    if (plain(entry)) values = Array.isArray(entry.path) ? entry.path : [entry.path];
    if (!values.length || values.some(value => !present(value))) errors.push('Compose include must declare nonempty string source paths');
    else paths.push(...values);
  }
  return { paths, errors };
}

function runnableHealthcheck(value) {
  if (present(value)) return value !== 'NONE';
  if (!Array.isArray(value) || !['CMD', 'CMD-SHELL'].includes(value[0])) return false;
  return value.slice(1).some(present);
}

/** Match image repository names, including registry and vendor namespaces, without matching application tags. */
export function duplicatesManagedBacking(image) {
  if (!present(image)) return false;
  const repository = image.split('@')[0].split('/').at(-1).split(':')[0];
  return BACKING_IMAGE.test(repository);
}

function jobDeclarationIssues(id, component, components, add) {
  if (component.mode !== 'replicated-job') return;
  const scheduler = components[component.scheduler];
  if (!present(component.scheduler) || !plain(scheduler) || scheduler.role !== 'scheduler' || scheduler.mode === 'replicated-job')
    add(`components.${id}.scheduler`, 'replicated-job must name a declared service component with role scheduler');
  else if (!schedulerImage(scheduler.image)) add(`components.${id}.scheduler`, 'replicated-job scheduler must declare the swarm-cronjob image');
  if (!present(component.schedule)) add(`components.${id}.schedule`, 'replicated-job must declare its cron schedule');
}

/** Inventory rules are independent of a selected environment or rendered deployment model. */
export function swarmInventoryIssues({ components, lite = false }) {
  const errors = [], catalog = mapping(components);
  const add = (at, message) => errors.push({ at, message });
  for (const [id, entry] of Object.entries(catalog)) {
    const component = mapping(entry);
    if (lite && duplicatesManagedBacking(component.image))
      add(`components.${id}.image`, 'lite must use managed Supabase backing services; this image duplicates a Supabase-provided service');
    jobDeclarationIssues(id, component, catalog, add);
  }
  return errors;
}

function serviceSafetyIssues(id, service, add) {
  const at = `services.${id}`, deploy = mapping(service.deploy), healthcheck = mapping(service.healthcheck);
  if (!present(service.image)) add(`${at}.image`, 'managed Swarm service needs a nonempty rendered image');
  else if (!PINNED_IMAGE.test(service.image)) add(`${at}.image`, 'Swarm image must be pinned by a sha256 digest');
  if (service.build !== undefined) add(`${at}.build`, 'rendered Swarm model must not retain a build section');
  if (!runnableHealthcheck(healthcheck.test) || healthcheck.disable === true)
    add(`${at}.healthcheck`, 'every Swarm service needs an enabled healthcheck with a test');
  const update = mapping(deploy.update_config);
  if (!['start-first', 'stop-first'].includes(update.order) || update.failure_action !== 'rollback' || !update.monitor)
    add(`${at}.deploy.update_config`, 'Swarm update_config must declare order, failure_action: rollback and monitor');
  if (!configured(deploy.rollback_config)) add(`${at}.deploy.rollback_config`, 'every Swarm service needs deploy.rollback_config');
  if (!['none', 'any', 'on-failure'].includes(deploy.restart_policy?.condition))
    add(`${at}.deploy.restart_policy`, 'every Swarm service needs deploy.restart_policy with a condition');
}

function labelsOf(value) {
  if (!Array.isArray(value)) return mapping(value);
  return Object.fromEntries(value.map(label => {
    const text = String(label), separator = text.indexOf('=');
    return separator < 0 ? [text, ''] : [text.slice(0, separator), text.slice(separator + 1)];
  }));
}

function jobServiceIssues(id, service, component, services, bindings, add) {
  const deploy = mapping(service.deploy), at = `services.${id}.deploy`;
  if (component.mode !== 'replicated-job') {
    if (deploy.mode === 'replicated-job') add(`${at}.mode`, 'replicated-job deployment must be declared as mode: replicated-job in the component inventory');
    return;
  }
  if (deploy.mode !== 'replicated-job') add(`${at}.mode`, 'replicated-job component must use deploy.mode: replicated-job');
  if (deploy.replicas !== 0) add(`${at}.replicas`, 'scheduled replicated-job must keep deploy.replicas: 0 until its scheduler triggers it');
  if (deploy.restart_policy?.condition !== 'none') add(`${at}.restart_policy.condition`, 'scheduled replicated-job must use restart_policy.condition: none');
  const labels = labelsOf(deploy.labels);
  if (String(labels['swarm.cronjob.enable']) !== 'true') add(`${at}.labels`, 'scheduled replicated-job needs swarm.cronjob.enable: "true"');
  if (!present(component.schedule) || labels['swarm.cronjob.schedule'] !== component.schedule)
    add(`${at}.labels`, 'swarm.cronjob.schedule must match the component cron schedule');
  if (!services[component.scheduler] || !Object.hasOwn(bindings, component.scheduler))
    add(`components.${id}.scheduler`, 'the declared scheduler must be bound and deployed in this environment');
  else if (!schedulerImage(services[component.scheduler].image))
    add(`components.${id}.scheduler`, 'the deployed scheduler must run the declared swarm-cronjob image');
}

function secretIssues(model, services, add) {
  const secrets = mapping(model.secrets);
  for (const [id, entry] of Object.entries(secrets)) {
    const secret = mapping(entry);
    if (secret.external !== true || !present(secret.name) || !VERSIONED_SECRET.test(secret.name) || secret.file !== undefined || secret.environment !== undefined || secret.content !== undefined)
      add(`secrets.${id}`, 'Swarm secrets must be external: true with a versioned name <logical>-v<N> and no embedded value source');
  }
  for (const [id, service] of Object.entries(services)) {
    for (const entry of Array.isArray(service?.secrets) ? service.secrets : []) {
      const source = plain(entry) ? entry.source : entry;
      if (!Object.hasOwn(secrets, source)) add(`services.${id}.secrets`, 'Swarm service secret must reference a declared external versioned secret');
    }
  }
}

/** Validate the same deployment model in HFS and the deployment evidence gate. */
export function swarmModelIssues({ model, components, bindings, lite = false }) {
  const errors = [], services = mapping(model?.services), catalog = mapping(components), bound = mapping(bindings);
  const add = (at, message) => errors.push({ at, message });
  for (const [id, entry] of Object.entries(services)) {
    const service = mapping(entry), component = mapping(catalog[id]);
    serviceSafetyIssues(id, service, add);
    if (!Object.hasOwn(catalog, id)) add(`services.${id}`, 'Swarm service name must be a declared component id');
    if (service.ports !== undefined && !Array.isArray(service.ports))
      add(`services.${id}.ports`, 'Swarm ports must be an array of published port definitions');
    else if (service.ports?.length && component.role !== 'ingress')
      add(`services.${id}.ports`, 'only a component with role ingress may publish Swarm ports');
    if (lite && duplicatesManagedBacking(service.image))
      add(`services.${id}.image`, 'lite stack must not run an image that duplicates a Supabase-provided backing service');
    jobServiceIssues(id, service, component, services, bound, add);
  }
  for (const id of Object.keys(bound)) {
    if (!Object.hasOwn(services, id)) add(`services.${id}`, 'environment component binding has no deployed Swarm service');
  }
  secretIssues(mapping(model), services, add);
  return errors;
}
