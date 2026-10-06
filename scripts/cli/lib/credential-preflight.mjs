import { isFile } from '../../lib/fs-kind.mjs';
import { connectorsConfig, connectorSecret, loadConfig } from '../../../engine/config.mjs';
import { runtimeSecretEnv } from '../../gates/runtime-host.mjs';
import { credentialRequirements } from '../../lib/credential-requirements.mjs';
import { importModule } from '../../api/node/import-module.mjs';
import { credentialPresent } from '../../../engine/secrets.mjs';
import { sonarAnalysisAction } from '../../gates/sonar-credentials.mjs';

const HOST_SERVICES = ['ask-tunnel', 'telegram-bridge'];
const selectedFor = (command, condition, action) => command.effect !== 'read' && condition ? action() : null;

const reconcilerOnceAction = (args, selected) => {
  if (args.apply !== true) return null;
  const host = !args.controller || ['host', 'workflow'].includes(args.controller);
  const services = args.controller === 'host' && args.key ? HOST_SERVICES.filter(name => name === args.key) : HOST_SERVICES;
  return selected(host ? services : []);
};

const telegramAction = (action, args, selected) => {
  if (['test', 'discover-chat'].includes(action) || (!action && args['discover-chat'] === true))
    return selected([{ name: 'telegram-bridge', explicit: true }]);
  return ['notify', 'sweep'].includes(action) ? selected(['telegram-bridge']) : null;
};

function selectedAction({ group, verb, command, args, positionals }) {
  const action = positionals[0] ?? null, key = group + ' ' + verb;
  const selected = (services = []) => ({ services });
  // Custody reads decrypt too; all three modes need the canonical identity environment.
  switch (key) {
    case 'gate custody-exec': return selected();
    case 'reconciler up': return selectedFor(command, args.check !== true, () => selected(HOST_SERVICES));
    case 'reconciler start':
    case 'reconciler restart': return selectedFor(command, true, () => selected(HOST_SERVICES));
    case 'reconciler once': return selectedFor(command, true, () => reconcilerOnceAction(args, selected));
    case 'workflow start': return selectedFor(command, args.plan !== true, () => selected(HOST_SERVICES));
    case 'supervisor bridge': return selectedFor(command, action === 'bridge' && args.start === true && args['dry-run'] !== true, () => selected(HOST_SERVICES));
    case 'kernel dispatch': return selectedFor(command, args.spawn === true, () => selected());
    case 'kernel dispatch-ready': return selectedFor(command, args['dry-run'] !== true, () => selected());
    case 'supervisor start': return selectedFor(command, args.plan !== true, () => selected());
    case 'connect tunnel': return selectedFor(command, ['start', 'run'].includes(action), () => selected(['ask-tunnel']));
    case 'supervisor telegram-bridge': return selectedFor(command, ['start', 'run'].includes(action), () => selected(['telegram-bridge']));
    case 'connect telegram': return selectedFor(command, true, () => telegramAction(action, args, selected));
    case 'connect telegram-media': return selectedFor(command, true, () => selected(['telegram-bridge']));
    case 'gate sonar': return selectedFor(command, sonarAnalysisAction(action), () => ({ services: [], sonar: action }));
    default: return ['local-write', 'host', 'remote', 'publish'].includes(command.effect) ? selected() : null;
  }
}

const actionName = input => [input.group, input.verb, input.positionals[0]].filter(Boolean).join(' ');
const failure = (input, code, missing = []) => ({
  ok: false,
  data: { schema: 'starci/credential-preflight@1', ok: false, code, action: actionName(input),
    missing, verification: 'not-performed' },
});

function judge(input, env, requirements) {
  const missing = requirements.requirements.filter(row => row.present !== true
    || (row.kind === 'env' && !credentialPresent(connectorSecret(row.name, env))))
    .map(({ feature, kind, name }) => ({ feature, kind, name }));
  return missing.length ? failure(input, 'credential-missing', missing) : { ok: true, env };
}

async function sonarRequirements(input, env, dependencies) {
  const owners = dependencies.loadSonarOwners
    ? await dependencies.loadSonarOwners()
    : { ...(await importModule(new URL('../../gates/sonar-local.mjs', import.meta.url).href)),
      ...(await importModule(new URL('../../gates/sonar-credentials.mjs', import.meta.url).href)) };
  const options = { cwd: input.cwd, runtimeRoot: input.runtimeRoot, runtimeSecretEnv: value => value };
  for (const name of ['host', 'stack', 'declaration']) if (input.args[name]) options[name] = input.args[name];
  const config = owners.resolveConfig(options, env);
  return owners.sonarCredentialRequirements({ action: input.positionals[0], config });
}

/**
 * Check only the selected action's declared credential presence before its implementation runs.
 * Shared values stay in the forwarded environment; refusals contain names, never values or an auth claim.
 * Native account authentication remains in its actual provider owner. Selected Sonar resolution is lazy.
 */
export function credentialPreflight(input, dependencies = {}) {
  const selected = selectedAction(input);
  if (!selected) return { ok: true, env: input.env };
  try {
    const env = (dependencies.loadEnv ?? runtimeSecretEnv)(input.env, input.runtimeRoot);
    if (selected.sonar) return sonarRequirements(input, env, dependencies)
      .then(declaredRequirements => judge(input, env, credentialRequirements({ declaredRequirements })))
      .catch(() => failure(input, 'credential-preflight-unavailable'));
    let connectors = null;
    if (selected.services.length) {
      const config = (dependencies.readConfig ?? loadConfig)(input.runtimeRoot);
      connectors = connectorsConfig(config, env, input.runtimeRoot);
    }
    const requirements = credentialRequirements({ services: selected.services, connectors });
    for (const row of requirements.requirements) {
      if (row.kind === 'file') row.present = row.present && isFile(connectors.cloudflare.credentialsFile, { followLinks: false });
    }
    return judge(input, env, requirements);
  } catch {
    // Configuration/loader errors can contain secret text; the dispatcher exposes only this stable refusal.
    return failure(input, 'credential-preflight-unavailable');
  }
}
