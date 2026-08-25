import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readJson = (relativePath) => JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));

const mutationOperators = [
  { id: 'maintenance-apply', successStage: 'fe.maintenance.maintenance-apply.result', completionFact: 'fe-maintenance-apply-complete' },
  { id: 'consumer-align', successStage: 'fe.maintenance.complete', completionFact: 'fe-consumer-align-complete' },
];

for (const target of mutationOperators) {
  test(`${target.id} requires a pinned acceptance test plan before frontend source mutation`, () => {
    const inputSchema = readJson(`./fe/${target.id}/input.schema.json`);
    const provided = inputSchema.properties.payload.properties.provided;

    assert.ok(provided.required.includes('testPlanRef'));
    assert.deepEqual(provided.properties.testPlanRef, { $ref: '#/$defs/sessionRef' });
  });

  test(`${target.id} marks a successful mutation as source written for downstream proof`, () => {
    const operator = readJson(`./fe/${target.id}/operator.json`);
    const success = operator.emits.find((entry) => entry.stage === target.successStage);

    assert.ok(success);
    assert.ok(success.factsAdd.includes(target.completionFact));
    assert.ok(success.factsAdd.includes('source-written'));
    assert.match(operator.sideEffects.join('\n'), /acceptance-test-plan references/);
  });
}

test('feedback-request persists one bounded request with a per-session accepts/rejects ledger', () => {
  const operator = readJson('./fe/feedback-request/operator.json');
  const input = readJson('./fe/feedback-request/input.schema.json');
  const request = readJson('../requests/request.schema.json');

  assert.match(operator.sideEffects.join('\n'), /\.claude\/requests\/<stable-id>\.request\.json/);
  assert.equal(input.properties.payload.properties.loads.properties.exactTargets.items.properties.path.pattern,
    '^\\.claude/requests/[a-z0-9][a-z0-9._-]*\\.request\\.json$');
  const session = request.properties.feedbackSessions.items;
  assert.ok(session.required.includes('accepts'));
  assert.ok(session.required.includes('rejects'));
  assert.equal(session.properties.accepts.minItems, 1);
  assert.equal(session.properties.rejects.minItems, 1);
});

test('request-review durably approves or rejects one request without resolving authority', () => {
  const operator = readJson('./fe/request-review/operator.json');
  const input = readJson('./fe/request-review/input.schema.json');
  const output = readJson('./fe/request-review/output.schema.json');
  const request = readJson('../requests/request.schema.json');

  assert.match(operator.sideEffects.join('\n'), /only the approved \.claude\/requests\/<stable-id>\.request\.json review and status fields/);
  assert.deepEqual(input.properties.payload.properties.provided.properties.decision.enum, ['approved', 'rejected']);
  assert.deepEqual(input.properties.payload.properties.provided.properties.priority.enum, ['normal', 'urgent']);
  assert.ok(output.properties.payload.properties.decision.enum.includes('approved'));
  assert.ok(request.properties.status.enum.includes('approved'));
  assert.ok(request.required.includes('review'));
  assert.ok(request.properties.review.anyOf[1].properties.priority.enum.includes('urgent'));
});

test('learning-resolve accepts only a reviewed request binding', () => {
  const operator = readJson('./fe/learning-resolve/operator.json');
  const input = readJson('./fe/learning-resolve/input.schema.json');
  const accepted = operator.accepts.find((entry) => entry.stage === 'fe.maintenance.learning-resolve');
  const provided = input.properties.payload.properties.provided;
  const upstreamRole = input.properties.payload.properties.loads.properties.upstream.items.properties.role;

  assert.ok(accepted.allFacts.includes('feedback-request-reviewed'));
  assert.ok(provided.required.includes('requestRef'));
  assert.ok(upstreamRole.enum.includes('approved-request'));
});
