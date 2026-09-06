import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { documentationReadinessSkips, scopeHash, frozenScopeErrors } from './mission-scope.mjs';
import { discoveryFor, answerFor } from './v23-test-fixture.mjs';
import { RUNTIME_REVISION } from './workflow-root.mjs';
import { expectedCheckIds, authorizationClasses } from '../operators/environment-preflight/validate.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportSchema = JSON.parse(readFileSync(path.join(root, 'templates/kinds/readiness-report.schema.json')));
const environmentSchema = JSON.parse(readFileSync(path.join(root, 'readiness/initialization/stacks/environment.schema.json')));
const ids = expectedCheckIds(reportSchema, ['be'], authorizationClasses(environmentSchema), ['declared-service']);
function fixture(stage = 'handoff') {
  const mission = { goal: 'A reviewable business handoff', verification: 'Review the documented outcome', sourceRef: 'user:handoff', doneWhen: [{ producedBy: 'business.decide', evidence: 'The business authority is published' }], discovery: discoveryFor('fixture', { stage, tags: stage === 'handoff' ? ['business', 'documentation'] : ['documentation'] }) };
  mission.confirmation = { scopeHash: scopeHash(mission), sourceRef: 'user:scope-answer', authority: answerFor(mission) };
  const state = { id: 'handoff-test', runtimeRevision: RUNTIME_REVISION, project: 'fixture', lifecycle: { phase: 'confirmed' }, mission, chain: [['1/1'], ['2/1'], ['3/1']], steps: { '1/1': 'environment.preflight', '2/1': 'workspace.bind', '3/1': 'business.decide' }, planned: { '1/1': { requirements: { runtimeRoles: [], flow: null } }, '2/1': { requirements: { role: 'be', checkout: 'routed', declaredWriteRoots: [] } }, '3/1': { requirements: {} } } };
  const request = { sessionId: state.id, operatorId: 'environment.preflight', step: 1, parallel: 1, requirements: { project: state.project, roles: ['be'], runtimeRoles: [], flow: null } };
  assert.deepEqual(frozenScopeErrors(state), []);
  return { state, request };
}
test('confirmed handoff skips unrelated readiness while retaining declaration and Git branch identity', () => {
  const { state, request } = fixture();
  const skips = documentationReadinessSkips(state, request, ids);
  assert.deepEqual(ids.filter(id => !skips.has(id)), ['declaration.be', 'checkout.be.branch']);
  assert.ok(skips.has('host.container') && skips.has('identity.custody') && skips.has('host.browser') && skips.has('host.playwright'));
  for (const cls of authorizationClasses(environmentSchema)) assert.ok(skips.has(`approval.${cls}`));
});
test('documentation-only implement stage uses the same scoped checks as a handoff', () => {
  const { state, request } = fixture('implement');
  assert.deepEqual(frozenScopeErrors(state), []);
  assert.deepEqual(ids.filter(id => !documentationReadinessSkips(state, request, ids).has(id)), ['declaration.be', 'checkout.be.branch']);
});
test('a confirmed publish or deploy stage retains operation readiness even for document artifacts', () => {
  for (const stage of ['publish', 'deploy']) {
    const { state, request } = fixture(stage);
    assert.deepEqual(frozenScopeErrors(state), []);
    assert.equal(documentationReadinessSkips(state, request, ids).size, 0);
  }
});
test('a request flag cannot skip product writes, runtime, flow or an unconfirmed/mutated mission', () => {
  for (const edit of [
    (s, r) => { r.requirements.runtimeRoles = ['be']; },
    (s, r) => { r.requirements.flow = 'login'; },
    s => { s.planned['2/1'].requirements.declaredWriteRoots = ['src']; },
    s => { s.planned['2/1'].requirements.checkout = 'session'; },
    s => { s.steps['3/1'] = 'runtime.serve'; },
    s => { s.steps['3/1'] = 'backend.generate'; },
    s => { s.steps['3/1'] = 'git.publish'; },
    s => { s.steps['3/1'] = 'uat.verify'; },
    s => { s.lifecycle.phase = 'draft'; },
    s => { delete s.mission.confirmation; },
    s => { s.mission.discovery.stage = 'deploy'; },
    s => { s.steps['3/1'] = 'release.deploy'; },
    s => { s.steps['3/1'] = 'interface.audit'; },
    s => { s.mission.goal = 'A changed goal'; },
    s => { delete s.planned['2/1']; },
    (s, r) => { r.requirements.roles = ['undeclared']; },
  ]) {
    for (const stage of ['handoff', 'implement']) {
      const { state, request } = fixture(stage); edit(state, request);
      assert.equal(documentationReadinessSkips(state, request, ids).size, 0);
    }
  }
});
