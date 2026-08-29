import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateInput as validateDesignInput } from './fe/design-implementation/validate-input.mjs';
const read = (name) => JSON.parse(readFileSync(new URL(`./fe/${name}/operator.json`, import.meta.url), 'utf8'));
for (const name of ['maintenance-apply', 'consumer-align', 'design-implementation']) {
  test(`${name} exposes one atomic mutation job without operator routing`, () => { const operator = read(name); assert.equal(operator.schemaVersion, 7); assert.equal(typeof operator.job, 'string'); assert.ok(operator.job.length > 20); assert.equal('accepts' in operator, false); assert.equal('emits' in operator, false); assert.equal('knowledgeRefs' in operator, false); });
}
test('design implementation requires exact evidence, authority revision, target, and constraints', () => { const value = { schemaVersion: 7, operatorId: 'fe/design-implementation', context: { evidenceRefs: ['approval://detail', 'source://exact-files', 'test-plan://acceptance'], authorityRevision: 'git:abcdef1' }, input: { targetRef: 'src/components/Dashboard.tsx', constraints: ['approved interface only', 'acceptance plan pinned'] } }; assert.deepEqual(validateDesignInput(value), { valid: true, errors: [] }); delete value.context.authorityRevision; assert.equal(validateDesignInput(value).valid, false); });
test('mutation contracts reject session persistence and workflow facts', () => { const value = { schemaVersion: 7, operatorId: 'fe/design-implementation', context: { evidenceRefs: ['approval://detail'], authorityRevision: 'git:abcdef1' }, input: { targetRef: 'src/Dashboard.tsx', constraints: [] }, facts: ['source-written'] }; assert.equal(validateDesignInput(value).valid, false); });
