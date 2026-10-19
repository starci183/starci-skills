// Only fixed installed app CLI verbs can cross this native process boundary.
import { nativeAppEntry } from './native-app-entry.mjs';
import { spawnCapture } from './spawn-capture.mjs';

const unknown = () => ({ outcome: 'unknown', code: 'native-consumer-outcome-unknown', writeAck: false,
  publicReadback: false, consumerVerified: false });

function nativeArguments({ family, action, endpoint, revision, images }) {
  const binding = ['--target-binding', JSON.stringify(endpoint), '--json'];
  if (family === 'stack' && ['deploy', 'verify'].includes(action)) {
    const args = ['app', 'stack', action, '--env', endpoint.environment, ...binding];
    if (action === 'deploy') args.push('--execute', '--source-sha', revision,
      ...Object.entries(images).flatMap(([service, image]) => ['--image', `${service}=${image}`]));
    return args;
  }
  if (family === 'db' && ['migrate', 'inspect'].includes(action)) {
    const selector = endpoint.mode === 'url-env' ? ['--url-env', endpoint.urlEnv] : [`--${endpoint.mode}`];
    return ['app', 'db', 'migrate', ...selector, ...binding, ...(action === 'migrate' ? ['--execute'] : [])];
  }
  throw new Error('NATIVE_CONSUMER_ACTION_REFUSED');
}

function stackResult(value, action) {
  if (action === 'verify') {
    if (value?.verb !== 'verify' || value.ok !== true || !Array.isArray(value.checks) || !value.checks.length
      || value.checks.some(check => check?.ok !== true)) return unknown();
    return { outcome: 'partial', code: 'native-stack-health-only', writeAck: false, publicReadback: true,
      consumerVerified: false };
  }
  const steps = value?.steps;
  if (value?.verb !== 'deploy' || !Array.isArray(steps)) return unknown();
  const ack = steps.some(step => ['provision', 'store', 'deploy'].includes(step?.step) && step.ok === true);
  if (value.ok !== true || value.pendingAccept === true || value.rolledBack === true
    || !/^[a-f0-9]{16}$/.test(value.releaseId ?? '')
    || ['render', 'provision', 'store', 'pre-pull', 'deploy', 'edge', 'converge', 'verify', 'accept']
      .some(name => steps.filter(step => step?.step === name && step.ok === true).length !== 1)
    || steps.some(step => step?.ok !== true)) return { ...unknown(), outcome: ack ? 'partial' : 'unknown', writeAck: ack };
  return { outcome: 'applied', code: 'native-stack-deploy-verified', writeAck: true, publicReadback: true,
    consumerVerified: true, resourceId: value.releaseId };
}

function databaseResult(value, action) {
  if (value?.verb !== 'db migrate' || typeof value.executed !== 'boolean' || typeof value.done !== 'boolean') return unknown();
  if (value.ok !== true) return { ...unknown(), outcome: value.executed ? 'partial' : 'unknown', writeAck: value.executed };
  if (action === 'inspect' && value.executed) return unknown();
  // The linked owner reports the pre-apply plan's done flag; a successful executed run separately verifies its final history.
  const current = value.done || (action === 'migrate' && value.executed && Array.isArray(value.pushed)
    && value.pushed.every(stamp => typeof stamp === 'string') && Number.isSafeInteger(value.remoteCountAfter));
  let outcome = 'partial';
  if (current) outcome = action === 'migrate' ? 'applied' : 'verified';
  return { outcome,
    code: current ? 'native-database-current' : 'native-database-pending', writeAck: value.executed,
    publicReadback: true, consumerVerified: current };
}

/**
 * Inspect or invoke the app's installed native owner without a shell. Raw child streams never
 * leave this boundary. Lost output remains unknown; reconciliation selects inspect/verify and
 * cannot repeat a deployment or migration. Stack health alone cannot prove an exact lost rollout.
 */
export async function provisionNativeApp({ repoRoot, mode = 'inspect', expectedIdentity, requiredHfsFiles, supabaseVersion,
  family, action, endpoint, revision, images = {}, env, timeoutMs }) {
  const installed = nativeAppEntry({ repoRoot, requiredHfsFiles, supabaseVersion });
  if (mode === 'inspect') return installed.public;
  if (mode !== 'run' || JSON.stringify(installed.public) !== JSON.stringify(expectedIdentity)
    || !/^[a-f0-9]{40}$/.test(revision ?? '') || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 7200000)
    throw new Error('NATIVE_CONSUMER_IDENTITY_DRIFT');
  const argv = nativeArguments({ family, action, endpoint, revision, images });
  const result = await spawnCapture(process.execPath, [installed.entry, ...argv], { cwd: repoRoot, env, timeoutMs });
  if (!result.outputComplete) return unknown();
  let value;
  try { value = JSON.parse(result.stdout); } catch { return unknown(); }
  if (result.code !== 0 && value?.ok !== false) return unknown();
  return family === 'stack' ? stackResult(value, action) : databaseResult(value, action);
}
