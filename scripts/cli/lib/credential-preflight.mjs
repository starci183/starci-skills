import { isFile } from '../../lib/fs-kind.mjs';
import { connectorsConfig, connectorSecret, loadConfig } from '../../../engine/config.mjs';
import { runtimeSecretEnv } from '../../gates/runtime-host.mjs';
import { credentialRequirements } from '../../lib/credential-requirements.mjs';
import { importModule } from '../../api/node/import-module.mjs';
import { credentialPresent } from '../../../engine/secrets.mjs';
import { sonarAnalysisAction } from '../../gates/sonar-credentials.mjs';

const HOST_SERVICES = ['ask-tunnel', 'telegram-bridge'];

function selectedAction({ group, verb, command, args, positionals }) {
  const action = positionals[0] ?? null, key = group + ' ' + verb;
  const selected = (services = []) => ({ services });
  // Custody reads decrypt too; all three modes need the canonical identity environment.
  if (key === 'gate custody-exec') return selected();
  if (command.effect === 'read') return null;
  if (key === 'reconciler up') return args.check === true ? null : selected(HOST_SERVICES);
  if (key === 'reconciler start' || key === 'reconciler restart') return selected(HOST_SERVICES);
  if (key === 'reconciler once') {
    if (args.apply !== true) return null;
    const host = !args.controller || ['host', 'workflow'].includes(args.controller);
    const services = args.controller === 'host' && args.key ? HOST_SERVICES.filter(name => name === args.key) : HOST_SERVICES;
    return selected(host ? services : []);
  }
  if (key === 'workflow start') return args.plan === true ? null : selected(HOST_SERVICES);
  if (key === 'supervisor bridge')
    return action === 'bridge' && args.start === true && args['dry-run'] !== true ? selected(HOST_SERVICES) : null;
  if (key === 'kernel dispatch') return args.spawn === true ? selected() : null;
  if (key === 'kernel dispatch-ready') return args['dry-run'] === true ? null : selected();
  if (key === 'supervisor start') return args.plan === true ? null : selected();
  if (key === 'connect tunnel') return ['start', 'run'].includes(action) ? selected(['ask-tunnel']) : null;
  if (key === 'supervisor telegram-bridge')
    return ['start', 'run'].includes(action) ? selected(['telegram-bridge']) : null;
  if (key === 'connect telegram') {
    if (['test', 'discover-chat'].includes(action) || (!action && args['discover-chat'] === true))
      return selected([{ name: 'telegram-bridge', explicit: true }]);
    return ['notify', 'sweep'].includes(action) ? selected(['telegram-bridge']) : null;
  }
  if (key === 'connect telegram-media') return selected(['telegram-bridge']);
  if (key === 'gate sonar')
    return sonarAnalysisAction(action) ? { services: [], sonar: action } : null;
  return ['local-write', 'host', 'remote', 'publish'].includes(command.effect) ? selected() : null;
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
