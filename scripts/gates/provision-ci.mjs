import { canonicalJSON } from '../../engine/canonical-json.mjs';
import { isPlainObject } from '../../engine/plain-object.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { provisionCi } from '../api/process/provision-ci.mjs';
import { inspectCiProvisionCli } from '../api/process/inspect-ci-provision-cli.mjs';
import { preflightCiProvision } from '../api/process/preflight-ci-provision.mjs';
import { argThrow } from '../lib/cli-arg.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { resolveProvisionTarget } from './provision-target.mjs';
import { runProvisionOperation } from './provision-operation.mjs';

const RESOURCE_KEYS = new Set(['revision', 'repository', 'scope', 'environment', 'timeoutMs']);
const RESULT_CODES = new Set(['CI_ACCESS_ACK_AND_NAME_VERIFIED', 'CI_ACCESS_WRITE_UNKNOWN', 'CI_ACCESS_READBACK_HELD',
  'CI_ACCESS_MASKED_VALUE_UNRECONCILED', 'CI_ACCESS_CLEANUP_HELD']);

function publicResource(target) {
  const resource = target.resource;
  if (!isPlainObject(resource)
    || Object.keys(resource).some(key => !RESOURCE_KEYS.has(key)) || !/^[a-f0-9]{40}$/.test(resource.revision ?? '')
    || typeof resource.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(resource.repository)
    || !['repository', 'environment', 'dependabot'].includes(resource.scope)
    || !Number.isInteger(resource.timeoutMs) || resource.timeoutMs <= 0) argThrow('CI_ACCESS_TARGET_INVALID');
  if (resource.scope === 'environment' ? typeof resource.environment !== 'string' || !/^[a-z][a-z0-9-]*$/.test(resource.environment)
    : Object.hasOwn(resource, 'environment')) argThrow('CI_ACCESS_SCOPE_INVALID');
  if (target.origin !== 'https://api.github.com' || target.destination !== null) argThrow('CI_ACCESS_TARGET_REFUSED');
  if (Object.keys(target.credentials).length !== 2 || !target.credentials.principal || !target.credentials.source
    || Object.values(target.credentials).some(ref => ref.optional === true || ref.hostConnection !== undefined)) argThrow('CI_ACCESS_CREDENTIAL_BINDING_INVALID');
  return { ...resource };
}

function withOwnedConfiguration(input, callbacks) {
  preflightCiProvision(input);
  const configDirectory = makeTempDir('starci-ci-private-', { env: input.parentEnv });
  let outcome;
  try {
    outcome = provisionCi(input, { ...callbacks, configDirectory });
  } finally {
    let removed = false;
    try {
      removed = safeRemove(configDirectory, { hold: directory => artifactHoldReason(directory, { env: input.parentEnv }) }).ok;
    } catch { removed = false; }
    if (!removed && outcome) outcome = { outcome: outcome.writeAck ? 'partial' : 'unknown',
      code: 'CI_ACCESS_CLEANUP_HELD', writeAck: outcome.writeAck, publicReadback: false, consumerVerified: false,
      proof: { name: input.name, valueToNameBindingVerified: false } };
  }
  return outcome;
}

/** One fixed accepted operation bridges declared sealed custody into the existing native CI owner. */
export async function runProvisionCi(ctx) {
  if (ctx.positionals[0] !== 'secret-set' || typeof ctx.args.name !== 'string' || !ctx.args.name.length
    || ctx.args.name.length > 256 || /[\r\n]/u.test(ctx.args.name)) argThrow('CI_ACCESS_INPUT_INVALID');
  const target = resolveProvisionTarget({ cwd: ctx.cwd, targetId: ctx.args.target, provider: 'github' });
  const resource = publicResource(target), nativeIdentity = inspectCiProvisionCli(target.repoRoot);
  const runtimeRevision = revParse(skillRoot, 'HEAD');
  const input = { ...resource, repoRoot: target.repoRoot, name: ctx.args.name, nativeIdentity, parentEnv: ctx.env };
  const current = () => {
    if (revParse(target.repoRoot, 'HEAD') !== resource.revision || revParse(skillRoot, 'HEAD') !== runtimeRevision
      || resolveProvisionTarget({ cwd: ctx.cwd, targetId: ctx.args.target, provider: 'github' }).declaration.sha256 !== target.declaration.sha256)
      argThrow('CI_ACCESS_SOURCE_DRIFT');
    if (canonicalJSON(inspectCiProvisionCli(target.repoRoot)) !== canonicalJSON(nativeIdentity)) argThrow('CI_ACCESS_NATIVE_DRIFT');
  };
  current();
  preflightCiProvision(input);
  return await runProvisionOperation(ctx, { action: 'ci.secret.set', target, requestId: ctx.args.operation,
    execute: ctx.args.execute, credentialRefs: target.credentials, destination: null, resultCodes: RESULT_CODES,
    publicResource: { ...resource, nativeIdentity, runtimeRevision },
    plan: { name: input.name, repository: resource.repository, scope: resource.scope,
      ...(resource.environment ? { environment: resource.environment } : {}), sourceRevision: resource.revision,
      nativeIdentity, runtimeRevision, credentialRoles: ['principal', 'source'],
      verification: 'write-ack-and-name-metadata', valueReadback: 'unavailable', consumerVerification: 'required-separately',
      reconcile: 'metadata-only-without-write-replay' },
    apply: ({ credentials, checkpoint, acknowledge }) => {
      current();
      return withOwnedConfiguration(input, { principal: () => credentials.principal, source: () => credentials.source,
        checkpoint: () => { current(); checkpoint({ phase: 'ci-secret-set' }); },
        acknowledge: () => acknowledge({ phase: 'ci-secret-set-acknowledged' }) });
    },
    reconcile: ({ credentials, operation }) => {
      current();
      return withOwnedConfiguration(input, { principal: () => credentials.principal, reconcile: true,
        priorWriteAck: operation.writeAck === true });
    },
  });
}
