// starcistacks-ci.mjs - service catalog, CI declarations and quality-service example policy.
import { readCiDeclaration } from '../hfs/ci-declaration.mjs';

/** The closed service catalog: its providers and the CI text that shows a workflow calls it. */
export const SERVICE_CATALOG = {
  codecov: { providers: ['codecov'], words: ['codecov'], ci: [/codecov\/codecov-action/i] },
  dependabot: { providers: ['github'], words: ['dependabot'], ci: [] },
  audit: { providers: ['npm'], words: ['audit'], ci: [/\bnpm audit\b/] },
  sonar: { providers: ['sonarqube', 'sonarcloud'], words: ['sonar', 'sonarqube', 'sonarcloud'],
    ci: [/SonarSource\/sonar(?:qube|cloud)-[a-z-]+-action/i, /\bsonar-scanner\b/i, /\bSONAR_TOKEN\b/] },
  'container-registry': { providers: ['ghcr', 'dockerhub', 'ecr', 'gar'], words: ['ghcr', 'registry', 'docker hub', 'dockerhub'],
    ci: [/docker\/login-action/i] },
  analytics: { providers: ['posthog', 'plausible', 'umami', 'google-analytics'], words: ['posthog', 'plausible', 'umami', 'analytics'], ci: [] },
  'error-tracking': { providers: ['sentry', 'glitchtip'], words: ['sentry', 'glitchtip'], ci: [/getsentry\/action-release/i, /\bSENTRY_AUTH_TOKEN\b/] },
};
export const checkServiceForm = (service, id, entry, at, kind, add, ambiguous) => {
  if (service.provider && !SERVICE_CATALOG[id].providers.includes(service.provider))
    add('refuse', 'STACKS_PROVIDER_UNKNOWN', `${at}.provider`, `${service.provider} is not a ${id} provider (${SERVICE_CATALOG[id].providers.join(', ')})`);
  if (Object.hasOwn(entry?.ci ?? {}, 'secrets') || Object.hasOwn(entry?.ci ?? {}, 'vars'))
    add('suspect', 'STACKS_CI_LEGACY_FORM', `${at}.ci`, 'move the names to the top-level ci block and name them by services.<id>.ci.token / hostVar');
  if (id === 'sonar' && service.provider === 'sonarcloud' && !service.organization
    && !(kind === 'example' && service.runtimeSecrets.length && !service.credentials.length && service.ci.organizationVar))
    ambiguous('provider sonarcloud requires organization; the runtime example form may use ci.organizationVar');
  if (kind === 'example' && id === 'sonar' && service.provider !== 'sonarcloud')
    add('refuse', 'STACKS_EXAMPLE_FORM', at, 'an example sonar provider must be sonarcloud');
  if (kind === 'example' && id === 'codecov' && (service.auth !== 'oidc' || service.ci.token))
    add('refuse', 'STACKS_EXAMPLE_FORM', at, 'an example codecov service uses auth oidc without a token');
};
/** Examples may document optional workflow secret names, but never a Codecov token or a required extra secret. */
function forbiddenExampleSecret(item) {
  return item.name === ('CODECOV' + '_TOKEN') || (item.name !== 'SONAR_TOKEN' && item.optional !== true);
}
/** Validate the additive CI declaration and the public example secret policy. */
export function checkCiDeclaration(declaration, declFile, kind, declarationSchema, schemaErrors, add) {
  if (declaration?.doc && Object.hasOwn(declaration.doc, 'ci')) {
    for (const issue of schemaErrors(declaration.doc.ci, declarationSchema().$defs.ciDeclaration, 'ci'))
      add('refuse', 'CI_DECLARATION_INVALID', `${declFile}#${issue.path}`, issue.message);
    const ci = readCiDeclaration(declaration.doc);
    for (const problem of ci.problems) add('refuse', problem.code, `${declFile}#${problem.at}`, problem.message);
    if (kind === 'example' && ci.secrets.some(forbiddenExampleSecret))
      add('refuse', 'STACKS_EXAMPLE_FORM', `${declFile}#ci.secrets`, 'STACKS_EXAMPLE_FORM: an example declares CI secrets other than SONAR_TOKEN only with optional: true to document workflow names; no Codecov token or stored credentials');
  }
}

/** Quality services use their CI binding without requiring hosted project or custody fields. */
export function checkQualityService(service, id, at, context, checkServiceCi) {
  const { ambiguous } = context;
  if (['codecov', 'dependabot', 'audit'].includes(id)) {
    if (id === 'codecov' && !['oidc', 'token'].includes(service.auth)) ambiguous('codecov auth must be oidc or token');
    if (id === 'codecov' && service.auth === 'token' && !service.ci.token) ambiguous('codecov auth token requires ci.token');
    checkServiceCi(service, id, at, context);
    return true;
  }
  return false;
}
