import { timingSafeEqual } from 'node:crypto';
import { canonicalJSON } from '../../../engine/canonical-json.mjs';
import { isPlainObject as record } from '../../../engine/plain-object.mjs';
import { argThrow as fail } from '../../lib/cli-arg.mjs';
import { inspectRegistryNative } from './inspect-registry-native.mjs';
import { runProgram } from './run-program.mjs';

const outcome = (state, code, writeAck = false, publicReadback = false) => ({
  outcome: state, code, writeAck, publicReadback, consumerVerified: false,
  proof: { credentialAccepted: writeAck },
});
const samePrivate = (left, right) => {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

const runOptions = (native, resource) => ({
  env: native.nativeEnvironment, shell: false, timeout: resource.timeoutMs,
  maxBuffer: 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
});

function invoke(run, file, args, options) {
  try { return run(file, args, options); } catch { return null; }
}

function successful(result) {
  return result !== null && !result.error && result.status === 0;
}

function nativeEntry(native, resource, run) {
  const options = runOptions(native, resource), host = native.host;
  const listed = invoke(run, native.helper.path, ['list'], { ...options, input: '' });
  if (!successful(listed)) return { state: 'unknown' };
  let entries;
  try { entries = JSON.parse(String(listed.stdout)); } catch { return { state: 'unknown' }; }
  if (!record(entries) || Object.values(entries).some(value => typeof value !== 'string')) return { state: 'unknown' };
  const aliases = [host, `https://${host}`, `https://${host}/v1/`].filter(server => Object.hasOwn(entries, server));
  if (aliases.length === 0) return { state: 'empty' };
  if (aliases.length !== 1 || aliases[0] !== host) return { state: 'unknown' };
  const got = invoke(run, native.helper.path, ['get'], { ...options, input: `${host}\n` });
  if (!successful(got)) return { state: 'unknown' };
  try {
    const value = JSON.parse(String(got.stdout));
    if (!record(value) || value.ServerURL !== undefined && value.ServerURL !== host || typeof value.Username !== 'string' || typeof value.Secret !== 'string'
      || !value.Secret || value.Username !== entries[host]) return { state: 'unknown' };
    return { state: 'present', username: value.Username, secret: value.Secret };
  } catch { return { state: 'unknown' }; }
}

function passwordOf(credential) {
  const value = credential();
  if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value)) fail('GHCR_PASSWORD_INVALID');
  return value;
}

function existingOutcome(entry, resource, credential, reconcile) {
  const state = reconcile ? 'unknown' : 'failed';
  if (entry.state === 'unknown') return outcome(state, 'GHCR_NATIVE_CUSTODY_HELD');
  if (entry.state === 'empty') return null;
  if (entry.username !== resource.username || !samePrivate(entry.secret, passwordOf(credential))) return outcome(state, 'GHCR_NATIVE_CONFLICT');
  return outcome('verified', 'GHCR_NATIVE_CREDENTIAL_REUSED', false, true);
}

function currentNative(resource, parentEnv, expected) {
  const native = inspectRegistryNative(resource, parentEnv);
  if (canonicalJSON(native) !== canonicalJSON(expected)) fail('GHCR_NATIVE_IDENTITY_DRIFT');
  return native;
}

function loginOnce(native, resource, password, state, run) {
  state.checkpoint({ phase: 'ghcr-login' });
  const login = invoke(run, native.docker.path, ['--host', native.endpoint, 'login', native.host, '--username', resource.username, '--password-stdin'], {
    ...runOptions(native, resource), input: `${password}\n`,
  });
  if (!successful(login)) return outcome('unknown', 'GHCR_LOGIN_UNCONFIRMED');
  state.acknowledge({ phase: 'ghcr-login-acknowledged' });
  const after = inspectRegistryNative(resource, state.parentEnv);
  if (canonicalJSON(after) !== canonicalJSON(state.expected)) return outcome('partial', 'GHCR_LOGIN_READBACK_UNCONFIRMED', true);
  const entry = nativeEntry(after, resource, run);
  if (entry.state !== 'present' || entry.username !== resource.username || !samePrivate(entry.secret, password))
    return outcome('partial', 'GHCR_LOGIN_READBACK_UNCONFIRMED', true);
  return outcome('applied', 'GHCR_LOGIN_NATIVE_READBACK', true, true);
}

/**
 * Uses the existing native Docker helper. Matching entries are retained and conflicting or unreadable
 * custody is held. An empty entry may log in once against the declared local daemon; acknowledgement
 * and private native readback remain separate. Reconciliation never repeats a login.
 */
export function provisionRegistry({ resource, expected, parentEnv, credential, reconcile = false, checkpoint, acknowledge }, { run = runProgram } = {}) {
  const native = currentNative(resource, parentEnv, expected);
  const reused = existingOutcome(nativeEntry(native, resource, run), resource, credential, reconcile);
  if (reused) return reused;
  if (reconcile) return outcome('unknown', 'GHCR_LOGIN_UNCONFIRMED');
  const password = passwordOf(credential);
  const current = currentNative(resource, parentEnv, expected);
  const final = existingOutcome(nativeEntry(current, resource, run), resource, () => password, false);
  if (final) return final;
  return loginOnce(current, resource, password, { parentEnv, expected, checkpoint, acknowledge }, run);
}
