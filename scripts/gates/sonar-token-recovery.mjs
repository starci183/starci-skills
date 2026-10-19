import {sopsIdentityEnv} from '../../engine/secrets.mjs';
import {sonarAnalysisEnvironment} from './sonar-credentials.mjs';

/**
 * The legacy mint owner preserves a generated name across a lost response or failed seal.
 * Compensation is proved by a fresh name lookup; a revoke ACK alone cannot prove absence.
 * Provider calls and the native custody writer are supplied by their existing owner.
 */
export async function mintSonarToken(cfg, {admin, ref, type, projectKey = null, label}, {call, writeCustody, remember}) {
  const selected = sopsIdentityEnv(sonarAnalysisEnvironment(cfg), {identity: cfg.identity});
  if (selected.error) return {present: false, name: ref, identityRefusal: selected.error.identityRefusal, reason: selected.error.message};
  const name = `sonar-local-${label}-${Date.now().toString(36)}`.slice(0, 100);
  const generated = await call(cfg, 'POST', '/api/user_tokens/generate', {token: admin.value, form: {name, type, ...(projectKey ? {projectKey} : {})}});
  const value = generated.status === 200 ? remember(String(generated.json?.token ?? '')) : '';
  if (!value) return {present: false, name: ref, minted: name,
    ...(!generated.reachable || generated.status === 200 || generated.status >= 500 ? {effect: 'unknown'} : {}),
    reason: `token generate for ${label} failed: HTTP ${generated.status} ${generated.text ?? generated.error ?? ''}`};
  const stored = writeCustody(cfg, ref, value, {env: selected.env});
  if (stored.ok) return {present: true, value, via: 'minted', name: ref, minted: name};
  const revoked = await call(cfg, 'POST', '/api/user_tokens/revoke', {token: admin.value, form: {name}});
  const after = await call(cfg, 'GET', '/api/user_tokens/search', {token: admin.value});
  const absent = after.status === 200 && Array.isArray(after.json?.userTokens) && !after.json.userTokens.some(item => item.name === name);
  return {present: false, name: ref, minted: name, effect: absent ? 'compensated' : 'unknown',
    compensation: {acknowledged: [200, 204].includes(revoked.status), verifiedAbsent: absent},
    ...(stored.identityRefusal ? {identityRefusal: stored.identityRefusal} : {}),
    reason: `minted ${name} but could not store it (${stored.reason}); ${absent ? 'revocation verified' : 'revocation remains unverified; reconcile this token name before retrying'}`};
}
