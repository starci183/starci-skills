// R275 and R266: each Swarm environment has one declared, digest-pinned ingress, or declares that the ingress is an external shared stack
// (`ingress.external: { stack }` with `hosts`): then the stack renders no ingress of its own and publishes no port.
import { isPlainObject as plain } from '../../../engine/plain-object.mjs';
import { repositoryOf } from '../../lib/stack-services.mjs';
import { stacksDeploymentFindings } from './stacks-runtime.mjs';

const PINNED = /@sha256:[a-f0-9]{64}$/i;
const SUPPORTED = new Set(['traefik', 'caddy', 'caddy-docker-proxy']);
const mapping = value => plain(value) ? value : {};
const present = value => typeof value === 'string' && Boolean(value.trim());
const imageName = image => present(image) ? repositoryOf(image).toLowerCase() : '';
const ingressImage = image => SUPPORTED.has(imageName(image));

function ingressIds(components, bindings, services, chosen) {
  const ids = new Set();
  if (present(chosen)) ids.add(chosen);
  for (const id of Object.keys(bindings)) {
    const component = mapping(components[id]);
    if (component.role === 'ingress' || ingressImage(component.image)) ids.add(id);
  }
  for (const [id, entry] of Object.entries(services)) {
    const service = mapping(entry), component = mapping(components[id]);
    if (component.role === 'ingress' || ingressImage(service.image)) ids.add(id);
  }
  return [...ids];
}

/** The name of the shared external ingress stack the environment declares, or null. */
export const externalIngressStack = spec => present(spec?.ingress?.external?.stack) ? spec.ingress.external.stack : null;

function externalIssues({ spec, candidates, at }) {
  const ingress = mapping(spec.ingress), errors = [];
  if (externalIngressStack(spec) === null || present(ingress.component) || !Array.isArray(ingress.hosts) || ingress.hosts.length === 0)
    errors.push({ code: 'STACKS_INGRESS_UNDECLARED', at,
      message: 'an external ingress is declared as ingress.external.stack with ingress.hosts and without ingress.component' });
  if (candidates.length > 0)
    errors.push({ code: 'STACKS_SECOND_INGRESS', at,
      message: 'a stack that declares an external shared ingress must not render an ingress of its own' });
  return errors;
}

function declarationIssues({ chosen, components, bindings, services, candidates, at }) {
  const errors = [];
  if (!present(chosen) || components[chosen]?.role !== 'ingress' || !Object.hasOwn(bindings, chosen) || !Object.hasOwn(services, chosen))
    errors.push({ code: 'STACKS_INGRESS_UNDECLARED', at,
      message: 'Swarm ingress must name one component with role ingress that is inventoried, bound and present in the rendered model' });
  const undeclared = candidates.filter(id => id !== chosen);
  if (undeclared.length)
    errors.push({ code: 'STACKS_INGRESS_UNDECLARED', at,
      message: 'every rendered ingress must be the environment\'s declared ingress component' });
  if (candidates.length > 1)
    errors.push({ code: 'STACKS_SECOND_INGRESS', at,
      message: 'a Swarm environment must run exactly one ingress component; a second ingress is forbidden' });
  return errors;
}

function ingressImageIssues(ids, components, services) {
  const errors = [];
  for (const id of ids) {
    for (const [prefix, source] of [['components', components], ['services', services]]) {
      if (!Object.hasOwn(source, id)) continue;
      const image = source[id]?.image;
      if (!SUPPORTED.has(imageName(image)) || !PINNED.test(String(image)))
        errors.push({ code: 'STACKS_INGRESS_UNKNOWN', at: `${prefix}.${id}.image`,
          message: 'the declared ingress must use Traefik or Caddy pinned by a sha256 digest' });
    }
  }
  return errors;
}

/** Static ingress contract shared by HFS and the rendered stacks gate. */
export function ingressIssues({ doc, environment, spec = doc?.environments?.[environment], model }) {
  if (spec?.runtime !== 'docker-swarm') return [];
  const components = mapping(doc?.components), bindings = mapping(spec.components), services = mapping(model?.services);
  const chosen = spec.ingress?.component, candidates = ingressIds(components, bindings, services, chosen);
  const at = `environments.${environment}.ingress`;
  if (mapping(spec.ingress).external !== undefined) return externalIssues({ spec, candidates, at });
  return [
    ...declarationIssues({ chosen, components, bindings, services, candidates, at }),
    ...ingressImageIssues(candidates, components, services),
  ];
}

/** HFS finder over the tracked rendered Swarm environments of either edition. */
export function stacksIngressFindings(context) {
  return stacksDeploymentFindings(context, ingressIssues);
}
