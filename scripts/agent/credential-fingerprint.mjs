// scripts/agent/credential-fingerprint.mjs — which credential a provider
// launch would use right now, as a non-reversible fingerprint.
//
// An auth circuit (scripts/kernel/api.mjs writeProviderCircuit) records the
// fingerprint of the credential in effect when it opened. A later reader
// (scripts/agent/models.mjs providerCircuitOf) treats that circuit as CLOSED
// when the current fingerprint is a different one: the credential that was
// rejected is no longer the one a launch would present. An unresolvable
// credential (null) on either side proves nothing and keeps the circuit.
//
// Resolution follows the launch path, per agent card
// (modules/models/agents/<provider>.yaml):
//   credentialRefresh {secretsFile, secretName}  — the line the terminal's own
//     shell reads (scripts/agent/lib.mjs credentialRefreshCommand), value
//     cleaned exactly as the card's step for this platform cleans it; when the
//     file has no such line the step unsets envKey and the CLI reads its own
//     env file, credentialRefresh.providerEnvFile (<home> = os.homedir()).
//   quota.probe orca-account (Orca-managed claude/codex) — the host account
//     identity from `orca account list` (activeAccountIdsByRuntime.host, then
//     activeAccountId, then systemDefault.providerAccountId). The caller passes
//     the account list; without one the identity is unresolved.
// The fingerprint is the first 12 hex digits of sha256 over the resolved
// value. The value itself never leaves this module: no key, command, receipt
// or log line carries it.
//
// Test seam: STARCI_CREDENTIAL_ROOT replaces the runtime root that
// credentialRefresh.secretsFile resolves against. Never set it for a kernel.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../engine/index.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const AGENTS_DIR = path.join(skillRoot, 'modules', 'models', 'agents');

export const providerKeyOf = (provider) => String(provider ?? '').trim().toLowerCase().replace(/-agent$/, '');

/** First 12 hex of sha256(value); null for an empty value. */
export const fingerprintOf = (value) => (typeof value === 'string' && value.length
  ? sha256(value).slice(0, 12) : null);

export function agentCardOf(provider) {
  const key = providerKeyOf(provider);
  if (!key || /[\\/]|\.\./.test(key)) return null;
  const file = path.join(AGENTS_DIR, `${key}.yaml`);
  try { return fs.existsSync(file) ? parseYaml(fs.readFileSync(file, 'utf8')) : null; } catch { return null; }
}

const homePath = (spec) => (typeof spec === 'string' && spec.trim()
  ? path.normalize(spec.trim().replace(/^<home>/, os.homedir())) : null);

const credentialRootOf = () => process.env.STARCI_CREDENTIAL_ROOT || skillRoot;

// One `NAME=value` line of an env file, cleaned the way the card's step cleans it.
const envFileValue = (file, name, plat) => {
  if (!file || !name) return null;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = text.split('\n').find((row) => new RegExp(`^\\s*${escaped}\\s*=`).test(row));
  if (line === undefined) return null;
  const raw = line.replace(new RegExp(`^\\s*${escaped}\\s*=\\s*`), '');
  // win32: .Trim().Trim([char]34,[char]39); posix: tr -d '\r"'.
  const value = plat === 'win32' ? raw.trim().replace(/^["']+|["']+$/g, '') : raw.replace(/[\r"]/g, '');
  return value.length ? value : null;
};

/**
 * The secret a card's credentialRefresh step would put in the terminal, with
 * its source (names and paths only). Internal to the credential fingerprint
 * and the recovery probe; callers must never print `.value`.
 */
export function resolveRefreshedSecret(card, plat = process.platform === 'win32' ? 'win32' : 'posix') {
  const refresh = card?.credentialRefresh;
  if (!refresh) return null;
  const rel = refresh.secretsFile;
  if (typeof rel === 'string' && rel.trim() && !path.isAbsolute(rel) && !rel.split(/[\\/]/).includes('..') && refresh.secretName) {
    const value = envFileValue(path.join(credentialRootOf(), rel), String(refresh.secretName), plat);
    if (value) return { value, source: `secrets-file:${rel}#${refresh.secretName}` };
  }
  const own = homePath(refresh.providerEnvFile);
  if (own && refresh.envKey) {
    const value = envFileValue(own, String(refresh.envKey), plat);
    if (value) return { value, source: `provider-env-file:${refresh.providerEnvFile}#${refresh.envKey}` };
  }
  return { value: null, source: `unresolved:${rel ?? refresh.providerEnvFile ?? 'credentialRefresh'}` };
}

// The Orca host account identity for one provider from an `account list` result.
const orcaAccountIdentity = (provider, accounts) => {
  const entry = accounts?.accounts?.[provider];
  if (!entry) return null;
  const id = entry.activeAccountIdsByRuntime?.host || entry.activeAccountId || entry.systemDefault?.providerAccountId || null;
  return id ? `${provider}:${id}` : null;
};

/**
 * {fingerprint, source, resolved}: fingerprint is the 12-hex digest or null;
 * resolved is false only when the credential could not be looked at (an
 * Orca-managed provider with no account list passed).
 */
export function credentialFingerprintOf(provider, { accounts, card } = {}) {
  const key = providerKeyOf(provider);
  const adapter = card ?? agentCardOf(key);
  if (adapter?.credentialRefresh) {
    const secret = resolveRefreshedSecret(adapter);
    return { fingerprint: fingerprintOf(secret?.value ?? null), source: secret?.source ?? null, resolved: true };
  }
  if (adapter?.quota?.probe === 'orca-account') {
    if (accounts === undefined) return { fingerprint: null, source: 'orca-account', resolved: false };
    return { fingerprint: fingerprintOf(orcaAccountIdentity(key, accounts)), source: 'orca-account', resolved: true };
  }
  return { fingerprint: null, source: null, resolved: true };
}

/**
 * True when a recorded auth circuit was opened against a credential that is no
 * longer the one in effect. Either side unknown → false (the circuit stands).
 */
export function credentialRotated(recorded, current) {
  const was = recorded?.credentialFingerprint ?? null;
  const now = typeof current === 'string' ? current : current?.fingerprint ?? null;
  return Boolean(was && now && was !== now);
}
