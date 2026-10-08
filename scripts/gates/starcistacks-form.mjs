// starcistacks-form.mjs - where a secret may live, per repository kind: the example form and the product form of a Sonar declaration (docs/application-stacks.md, "Where a secret may live").
// An example is an app inside the public runtime repository, which holds no secret file: it declares SonarCloud (provider sonarcloud, mode hosted) and names the variables of the runtime's untracked
// secret.env it reads (runtimeSecrets: the token only; the organization is configuration, config.yaml sonar.organization), with no stack, no host.local and no custody credential. A product keeps its own custody and declares no runtimeSecrets. The refusals are STACKS_EXAMPLE_FORM
// and STACKS_PRODUCT_FORM (scripts/gates/starcistacks.mjs calls this module for each enabled service).
import path from 'node:path';

const EXAMPLE_NAMES = Object.freeze(['SONAR_TOKEN']);

/** 'example' for an app that lives inside the runtime repository (its checkout sits under the runtime's examples/), else 'product'. */
export function kindOf(repo, examplesRoot) {
  const relative = path.relative(path.resolve(examplesRoot), repo);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? 'example' : 'product';
}

/** Refuse the form of the other kind in one normalized Sonar service: `add(level, code, where, message)` records a finding. */
export function checkSecretForm(service, id, at, kind, add) {
  if (id !== 'sonar' || service.mode === 'disabled') return;
  if (kind === 'product') {
    if (service.runtimeSecrets.length) add('refuse', 'STACKS_PRODUCT_FORM', `${at}.runtimeSecrets`, 'runtimeSecrets name variables of the runtime repository secret.env, which a product does not read; a product declares its credentials in its own custody');
    return;
  }
  const wrong = [service.stack && 'a stack', service.host.local && 'host.local', service.credentials.length && 'custody credentials'].filter(Boolean);
  if (wrong.length) add('refuse', 'STACKS_EXAMPLE_FORM', at, `an example of the runtime repository declares ${wrong.join(', ')}; the runtime repository holds no secret file, so an example declares provider sonarcloud, mode hosted and runtimeSecrets [${EXAMPLE_NAMES.join(', ')}]`);
  if (service.provider !== 'sonarcloud' || service.mode !== 'hosted') add('refuse', 'STACKS_EXAMPLE_FORM', `${at}.provider`, 'an example of the runtime repository is analysed on SonarCloud: provider sonarcloud and mode hosted');
  if (service.runtimeSecrets.join() !== EXAMPLE_NAMES.join()) add('refuse', 'STACKS_EXAMPLE_FORM', `${at}.runtimeSecrets`, `an example names the one secret.env variable it reads: runtimeSecrets [${EXAMPLE_NAMES.join(', ')}]; the SonarCloud organization is configuration (config.yaml sonar.organization), not a secret`);
}
