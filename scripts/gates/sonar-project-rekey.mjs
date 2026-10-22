// sonar-project-rekey.mjs - `starci sonar project rekey`: move a declared Sonar project to its new key in place
// (api/projects/update_key), so its analyses, issues and quality gate stay with it. The managed-action owner
// (sonar-manage.mjs) resolves the target, authority and credentials and passes its API capability reader `has`.
import {fail, verified, uncertain} from './sonar-managed-results.mjs';

/** The project identity a key move keeps: key, kind and organization (the display name is the server's own and stays). */
const projectAt = (component, key, organization) => component?.key === key && component.qualifier === 'TRK'
  && (organization === undefined || component.organization === organization);

/** Observe both keys before a move: {after} when the declared key already holds the project, {before} when only the old one does, or {failure}. */
async function rekeyObserved(client, request) {
  const {projectKey, previousKey, organization} = request;
  const now = await client.project(projectKey), old = await client.project(previousKey);
  if ((!now.ok && now.status !== 404) || (!old.ok && old.status !== 404)) return {failure: fail('sonar-project-read-unavailable')};
  if (now.ok && old.ok) return {failure: fail('sonar-project-rekey-conflict')};
  if (now.ok) return projectAt(now.data?.component, projectKey, organization) ? {after: now.data.component} : {failure: fail('sonar-project-conflict')};
  if (!old.ok) return {failure: fail('sonar-project-rekey-source-missing')};
  return projectAt(old.data?.component, previousKey, organization) ? {before: old.data.component} : {failure: fail('sonar-project-conflict')};
}

/**
 * Move the project of the declared previousKey to the declared projectKey (api/projects/update_key). Idempotent: a project already
 * at the new key, with the old key gone, is verified without a write. Verified only when the new key reads back and the old one is 404.
 */
export async function projectRekey(client, request, callbacks, {reconcile, has}) {
  const {projectKey, previousKey, organization} = request;
  if (!previousKey) return fail('sonar-project-rekey-undeclared');
  const observed = await rekeyObserved(client, request);
  if (observed.failure) return observed.failure;
  const proof = component => ({projectKey, name: component.name});
  if (observed.after) return verified('sonar-project-rekey-readback', {resourceId: projectKey, proof: proof(observed.after)});
  if (reconcile) return uncertain('sonar-project-rekey-not-observed');
  const capabilities = await client.capabilities();
  if (!capabilities.ok || !has(capabilities.data, 'api/projects', 'update_key', ['from', 'to'], true)) return fail('sonar-project-api-unsupported');
  callbacks.checkpoint({phase: 'project-rekey-intent', resourceId: previousKey});
  const answer = await client.updateKey({from: previousKey, to: projectKey});
  if (answer.ok) callbacks.acknowledge({phase: 'project-rekey-acknowledged', resourceId: projectKey});
  const after = await client.project(projectKey), gone = await client.project(previousKey);
  if (after.ok && projectAt(after.data?.component, projectKey, organization) && gone.status === 404)
    return verified('sonar-project-rekey-readback', {writeAck: answer.ok, resourceId: projectKey, proof: proof(after.data.component)});
  return uncertain('sonar-project-rekey-unreconciled', {writeAck: answer.ok});
}
