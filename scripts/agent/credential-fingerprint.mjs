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
// Resolution follows the agent card (modules/models/agents/<provider>.yaml):
//   quota.probe orca-account (Orca-managed claude/codex) — the host account
//     identity from `orca account list` (activeAccountIdsByRuntime.host, then
//     activeAccountId, then systemDefault.providerAccountId). The caller passes
//     the account list; without one the identity is unresolved.
// The fingerprint is the first 12 hex digits of sha256 over the resolved
// value. The value itself never leaves this module: no key, command, receipt
// or log line carries it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {sha256} from '../../engine/digest.mjs';
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
