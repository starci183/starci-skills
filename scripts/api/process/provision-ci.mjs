import path from 'node:path';
import { runProgram } from './run-program.mjs';
import { ciNativeArguments, ciChildEnvironment } from '../../lib/provision-ci-contract.mjs';

const held = (code, writeAck = false, publicReadback = false, name) => ({
  outcome: writeAck ? 'partial' : 'unknown', code, writeAck, publicReadback, consumerVerified: false,
  ...(name === undefined ? {} : { proof: { name, valueToNameBindingVerified: false } }),
});

function runNative(input, value, env, run) {
  return run(process.execPath, ciNativeArguments(input), { cwd: input.repoRoot, env, shell: false,
    input: value, timeout: input.timeoutMs, maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}

function metadataEndpoint(input) {
  const base = `repos/${input.repository}/`;
  if (input.scope === 'environment') return `${base}environments/${encodeURIComponent(input.environment)}/secrets/${input.name}`;
  return `${base}${input.scope === 'dependabot' ? 'dependabot' : 'actions'}/secrets/${input.name}`;
}

function readback(input, env, run) {
  let result;
  try {
    result = run('gh', ['api', '--hostname', 'github.com', '--method', 'GET', metadataEndpoint(input)], {
      cwd: input.repoRoot, env, shell: false, timeout: input.timeoutMs, maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return !result.error && result.status === 0 && JSON.parse(String(result.stdout ?? '')).name === input.name;
  } catch { return false; }
}

function writeSecret(input, { source, checkpoint, acknowledge }, env, run) {
  const value = source();
  if (typeof value !== 'string' || !value.length) throw new Error('CI_ACCESS_SOURCE_REQUIRED');
  checkpoint();
  let result;
  try { result = runNative(input, value, env, run); }
  catch { return false; }
  if (!result || result.error || result.status !== 0) return false;
  acknowledge();
  return true;
}

function metadataOutcome(input, env, run, writeAck, reconcile) {
  const present = readback(input, env, run);
  if (!writeAck) return held('CI_ACCESS_MASKED_VALUE_UNRECONCILED', false, present, input.name);
  if (!present) return held('CI_ACCESS_READBACK_HELD', true, false, input.name);
  return { outcome: reconcile ? 'verified' : 'applied', code: 'CI_ACCESS_ACK_AND_NAME_VERIFIED',
    writeAck: true, publicReadback: true, consumerVerified: false,
    proof: { name: input.name, credentialAccepted: true, valueToNameBindingVerified: false } };
}

/**
 * Run admitted native CI work in the caller-owned configuration directory. A successful set is acknowledged before metadata
 * readback. GitHub never returns a secret value: a matching name cannot reconcile a lost write ACK,
 * and this bridge never claims consumer behavior or value equality from masked metadata.
 */
export function provisionCi(input, { principal, source, checkpoint, acknowledge, configDirectory, reconcile = false, priorWriteAck = false }, { run = runProgram } = {}) {
  if (typeof configDirectory !== 'string' || !path.isAbsolute(configDirectory))
    throw new TypeError('an absolute owned configuration directory is required');
  const token = principal();
  if (typeof token !== 'string' || !token.length) throw new Error('CI_ACCESS_PRINCIPAL_REQUIRED');
  const env = { ...ciChildEnvironment(input.parentEnv), 'GH_TOKEN': token, 'GH_HOST': 'github.com', 'GH_PROMPT_DISABLED': '1', 'GH_CONFIG_DIR': configDirectory };
  let writeAck = reconcile && priorWriteAck;
  if (!reconcile) {
    const written = writeSecret(input, { source, checkpoint, acknowledge: () => {
      writeAck = true; acknowledge();
    } }, env, run);
    if (!written) return held('CI_ACCESS_WRITE_UNKNOWN');
  }
  return metadataOutcome(input, env, run, writeAck, reconcile);
}
