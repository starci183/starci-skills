// scripts/agent/credential-probe.mjs — one cheap live proof that a provider's
// credential in effect is accepted, for `api provider-health --recover --probe`.
//
//   probeProviderCredential(provider) -> {ok, provider, kind, status?, detail,
//                                         credentialFingerprint, credentialSource}
//
// A card that declares credentialProbe.kind openai-models (qwen) is probed
// with GET <baseUrl>/models carrying the key its credentialRefresh step would
// put in the terminal (credential-fingerprint.mjs resolveRefreshedSecret);
// baseUrl is the entry of credentialProbe.settingsFile modelProviders whose id
// is the card's model. It spends no tokens. Any other provider is probed with
// its quota probe (scripts/api/quota): 'ok' or 'limited' passes, 'dead' and
// 'unknown' do not — an unanswered probe is not proof.
// The key is sent only in the Authorization header; no result field, error
// text or log line carries it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agentCardOf, credentialFingerprintOf, fingerprintOf, providerKeyOf, resolveRefreshedSecret } from './credential-fingerprint.mjs';
import { probeQuota } from '../api/quota/index.mjs';

const PROBE_TIMEOUT_MS = 15000;

const settingsBaseUrl = (card) => {
  const spec = card?.credentialProbe?.settingsFile;
  if (typeof spec !== 'string' || !spec.trim()) return { error: 'credentialProbe.settingsFile is not declared' };
  const file = path.normalize(spec.trim().replace(/^<home>/, os.homedir()));
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { error: `cannot read ${spec}: ${e.code ?? e.message}` }; }
  const entries = Object.values(doc?.modelProviders ?? {}).flat().filter((e) => e && typeof e === 'object');
  const entry = entries.find((e) => e.id === card.model) ?? null;
  if (!entry?.baseUrl) return { error: `${spec} has no modelProviders entry with id '${card.model}' and a baseUrl` };
  return { baseUrl: String(entry.baseUrl).replace(/\/+$/, '') };
};

async function probeOpenAiModels(key, card) {
  const secret = resolveRefreshedSecret(card);
  const base = { provider: key, kind: 'openai-models', credentialSource: secret?.source ?? null,
    credentialFingerprint: fingerprintOf(secret?.value ?? null) };
  if (!secret?.value) return { ok: false, ...base, detail: `no credential resolvable (${secret?.source ?? 'credentialRefresh'})` };
  const { baseUrl, error } = settingsBaseUrl(card);
  if (error) return { ok: false, ...base, detail: error };
  const url = `${baseUrl}/models`;
  try {
    const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${secret.value}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    // The body is never echoed: a provider error could quote the header back.
    await res.arrayBuffer().catch(() => null);
    const ok = res.status >= 200 && res.status < 300;
    return { ok, ...base, status: res.status, url,
      detail: ok ? `GET ${url} answered ${res.status}` : `GET ${url} answered ${res.status}${res.status === 401 || res.status === 403 ? ' (credential rejected)' : ''}` };
  } catch (e) {
    return { ok: false, ...base, url, detail: `GET ${url} failed: ${e?.name === 'TimeoutError' ? `timeout after ${PROBE_TIMEOUT_MS}ms` : (e?.cause?.code ?? e?.name ?? 'error')}` };
  }
}

export async function probeProviderCredential(provider, { accounts } = {}) {
  const key = providerKeyOf(provider);
  const card = agentCardOf(key);
  if (!card) return { ok: false, provider: key, kind: null, detail: `no agent card modules/models/agents/${key}.yaml` };
  if (card.credentialProbe?.kind === 'openai-models') return probeOpenAiModels(key, card);
  const quota = probeQuota(key);
  const current = credentialFingerprintOf(key, { card, accounts });
  const ok = quota?.state === 'ok' || quota?.state === 'limited';
  return { ok, provider: key, kind: `quota:${card.quota?.probe ?? 'none'}`, status: quota?.state ?? null,
    detail: `quota probe ${quota?.state ?? 'unknown'}: ${quota?.detail ?? 'no detail'}`,
    credentialFingerprint: current.fingerprint, credentialSource: current.source };
}
