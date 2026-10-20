import {sealProvisionValues} from './provision-operation.mjs';
import {fail, verified, uncertain} from './sonar-managed-results.mjs';

const tokenList = async (client, token) => {
  const answer = await client.tokens(token.login);
  return answer.ok && Array.isArray(answer.data?.userTokens) ? {ok: true, rows: answer.data.userTokens} : {ok: false};
};
const tokenMatches = (actual, expected) => actual?.name === expected.name && actual.type === expected.type
  && (expected.type !== 'PROJECT_ANALYSIS_TOKEN' || actual.project?.key === expected.projectKey || actual.projectKey === expected.projectKey);

async function revokeAction(client, token, callbacks, reconcile) {
  const before = await tokenList(client, token);
  if (!before.ok) return fail('sonar-token-read-unavailable');
  const existing = before.rows.find(row => row.name === token.name);
  if (!existing) return verified('sonar-token-absent', {resourceId: token.name});
  if (!tokenMatches(existing, token)) return fail('sonar-token-scope-conflict');
  if (reconcile) return uncertain('sonar-token-revocation-not-observed');
  callbacks.checkpoint({phase: 'token-revoke-intent', resourceId: token.name});
  const answer = await client.revokeToken(token);
  if (answer.ok) callbacks.acknowledge({phase: 'token-revoke-acknowledged', resourceId: token.name});
  const after = await tokenList(client, token);
  if (after.ok && !after.rows.some(row => row.name === token.name)) return verified('sonar-token-revoked', {writeAck: answer.ok, resourceId: token.name});
  return uncertain('sonar-token-revoke-unreconciled', {writeAck: answer.ok});
}

async function existingToken(client, token, existing, callbacks) {
  if (!tokenMatches(existing, token)) return fail('sonar-token-scope-conflict');
  if (!callbacks.credentials.existing) return fail('sonar-token-value-unrecoverable', {outcome: 'partial', resourceId: token.name});
  const accepted = await client.validateToken(callbacks.credentials.existing);
  if (!accepted.ok || accepted.data?.valid !== true) return fail('sonar-token-existing-credential-unverified', {outcome: 'partial'});
  // A mutable key and a historical receipt cannot bind the current value to the provider token name.
  return fail('sonar-token-value-binding-unverified', {outcome: 'partial', resourceId: token.name,
    proof: {name: token.name, type: token.type, credentialAccepted: true, valueToNameBindingVerified: false}});
}

const generatedIdentity = (actual, token) => actual.name === token.name && actual.type === token.type
  && (token.projectKey === undefined || actual.projectKey === token.projectKey)
  && (token.login === undefined || actual.login === token.login);

/** Seal a newly generated in-memory value. Any ambiguous sink result retains its exact provider name. */
async function sealGeneratedToken(client, target, token, value, callbacks, env) {
  const accepted = await client.validateToken(value);
  if (!accepted.ok || accepted.data?.valid !== true) return fail('sonar-token-generated-auth-unverified', {outcome: 'partial', writeAck: true, resourceId: token.name});
  let sealed;
  try {sealed = sealProvisionValues(target.destination, value, {repoRoot: target.repoRoot, env});}
  catch {return fail('sonar-token-seal-unreconciled', {outcome: 'partial', writeAck: true, resourceId: token.name});}
  callbacks.checkpoint({phase: 'token-sealed', generationName: token.name, destinationRef: sealed.destinationRef});
  return null;
}

async function generateToken(client, target, token, callbacks, {action, env}) {
  callbacks.checkpoint({phase: 'token-generate-intent', generationName: token.name});
  const generated = await client.generateToken(token);
  if (!generated.ok || typeof generated.data?.token !== 'string' || !generated.data.token)
    return uncertain('sonar-token-generate-unreconciled');
  callbacks.acknowledge({phase: 'token-generate-acknowledged', generationName: token.name});
  if (!generatedIdentity(generated.data, token)) return fail('sonar-token-generated-identity-unverified', {outcome: 'partial', writeAck: true});
  const unsealed = await sealGeneratedToken(client, target, token, generated.data.token, callbacks, env);
  if (unsealed) return unsealed;
  if (action === 'rotate') {
    const revoked = await revokeAction(client, {...token, name: token.previousName}, callbacks, false);
    if (revoked.outcome !== 'verified') return fail('sonar-token-rotation-old-revoke-unreconciled', {outcome: 'partial', writeAck: true, resourceId: token.name});
  }
  return verified('sonar-token-sealed', {writeAck: true, resourceId: token.name,
    proof: {name: token.name, type: token.type, ...(token.projectKey ? {projectKey: token.projectKey} : {}),
      credentialAccepted: true, custodyWritten: true, valueToNameBindingVerified: true}});
}

/** The named token lifecycle never retries a mint, revoke or seal during reconciliation. */
export async function sonarTokenAction(client, target, request, callbacks, {action, reconcile, env, has}) {
  const token = request.token, capabilities = await client.capabilities();
  if (!lifecycleSupported(capabilities, token, has)) return fail('sonar-token-api-unsupported');
  if (action === 'revoke') return revokeAction(client, token, callbacks, reconcile);
  const listed = await tokenList(client, token);
  if (!listed.ok) return fail('sonar-token-read-unavailable');
  const existing = listed.rows.find(row => row.name === token.name);
  if (existing) return existingToken(client, token, existing, callbacks);
  if (reconcile) return uncertain('sonar-token-generation-not-observed');
  if (!generationSupported(capabilities, target, token, has)) return fail('sonar-token-api-unsupported');
  if (action === 'rotate' && !token.previousName) return fail('sonar-token-rotation-source-missing');
  return generateToken(client, target, token, callbacks, {action, env});
}

const tokenParameters = token => ['name', ...(token.login ? ['login'] : [])];
const lifecycleSupported = (capabilities, token, has) => capabilities.ok
  && has(capabilities.data, 'api/user_tokens', 'search', token.login ? ['login'] : [])
  && has(capabilities.data, 'api/user_tokens', 'revoke', tokenParameters(token), true);
const generationSupported = (capabilities, target, token, has) => Boolean(target.destination)
  && has(capabilities.data, 'api/user_tokens', 'generate', [...tokenParameters(token), 'type',
    ...(token.projectKey ? ['projectKey'] : []), ...(token.expirationDate ? ['expirationDate'] : [])], true);
