// sonar-new-code-action.mjs - the New Code part of `starci sonar project ensure`: read the project's New Code definition, write the declared
// one when the readback differs (sonar.leak.period on SonarQube Cloud, api/new_code_periods elsewhere) and verify it only by the readback.
// The managed-action owner (sonar-manage.mjs) resolves the target, authority and credentials and passes its API capability reader `has`.
import {fail, verified, uncertain} from './sonar-managed-results.mjs';
import {newCodeMatches, newCodeProof, newCodeWrite} from '../lib/sonar-new-code.mjs';

/** The project's New Code definition as the provider reports it: {ok, data} of api/settings/values (Cloud) or api/new_code_periods/show. */
const newCodeRead = (client, request, provider) => (provider === 'sonar-cloud'
  ? client.settings(request.projectKey, [newCodeWrite(provider, request.projectKey, request.newCodePeriod).key])
  : client.newCodePeriod(request.projectKey));

/**
 * Ensure the declared New Code definition (the target's `newCodePeriod`, else knowledge/sonar-gate.yaml `gate.newCodePeriod`): read it, write it when
 * it differs (api/settings/set of sonar.leak.period on SonarQube Cloud, api/new_code_periods/set elsewhere), verified only by the readback.
 */
export async function newCodeAction(client, request, callbacks, {reconcile, provider, has}) {
  const period = request.newCodePeriod, write = newCodeWrite(provider, request.projectKey, period);
  const before = await newCodeRead(client, request, provider);
  if (!before.ok && !(write.kind === 'period' && before.status === 404)) return fail('sonar-new-code-read-unavailable');
  let writeAck = false;
  if (!before.ok || !newCodeMatches(provider, before.data, period)) {
    if (reconcile) return uncertain('sonar-new-code-unreconciled');
    const capabilities = await client.capabilities();
    const supported = write.kind === 'setting'
      ? has(capabilities.data, 'api/settings', 'set', ['key', 'component', 'value'], true)
      : has(capabilities.data, 'api/new_code_periods', 'set', ['project', 'type'], true);
    if (!capabilities.ok || !supported) return fail('sonar-new-code-api-unsupported');
    callbacks.checkpoint({phase: 'new-code-write-intent', resourceId: request.projectKey});
    const answer = write.kind === 'setting' ? await client.setSetting(request.projectKey, write.key, write.value) : await client.setNewCodePeriod(write.form);
    if (answer.ok) callbacks.acknowledge({phase: 'new-code-write-acknowledged', resourceId: request.projectKey});
    writeAck = answer.ok;
  }
  const after = await newCodeRead(client, request, provider);
  if (!after.ok || !newCodeMatches(provider, after.data, period)) return uncertain('sonar-new-code-unreconciled', {writeAck});
  return verified('sonar-new-code-readback', {writeAck, resourceId: request.projectKey, proof: {newCode: newCodeProof(period)}});
}
