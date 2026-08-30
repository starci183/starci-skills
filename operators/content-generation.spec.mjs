import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const json = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const machine = json('../skills/starci-content-generate/machine.json');
const output = (name) => json(`./content/${name}/output.schema.json`).properties.output.properties;

test('content mission builds the full bundle before independent review', () => {
  assert.equal(machine.states.brainstorm.on.find((edge) => edge.when.outputEquals.outcome === 'ready').target, 'write');
  assert.equal(machine.states.write.on.find((edge) => edge.when.outputEquals.outcome === 'ready').target, 'image');
  assert.equal(machine.states.image.on.find((edge) => edge.when.outputEquals.outcome === 'ready').target, 'code');
  assert.equal(machine.states.code.on.find((edge) => edge.when.outputEquals.outcome === 'ready').target, 'e2e');
  assert.equal(machine.states.e2e.on.find((edge) => edge.when.outputEquals.outcome === 'passed').target, 'review');
});

test('review routes every finding back to its atomic owner', () => {
  const routes = Object.fromEntries(machine.states.review.on.map((edge) => [edge.when.outputEquals.outcome, edge.target]));
  assert.deepEqual(routes, { approved:'complete', 'revise-brainstorm':'brainstorm', 'revise-write':'write', 'revise-image':'image', 'revise-code':'code', 'revise-e2e':'e2e', blocked:'blocked' });
  assert.equal(machine.states.e2e.on.find((edge) => edge.when.outputEquals.outcome === 'failed').target, 'code');
});

test('teacher and critic are fresh Sol while scaled realization is Luna', () => {
  assert.equal(output('brainstorm').aiExecution.$ref, '#/$defs/solExecution');
  assert.equal(output('review').aiExecution.$ref, '#/$defs/solExecution');
  assert.equal(output('write').aiExecution.$ref, '#/$defs/lunaExecution');
  assert.equal(output('code').aiExecution.oneOf[0].$ref, '#/$defs/lunaExecution');
  assert.equal(output('e2e').aiExecution.oneOf[0].$ref, '#/$defs/lunaExecution');
  for (const name of ['brainstorm', 'review']) {
    const execution = json(`./content/${name}/output.schema.json`).$defs.solExecution.properties;
    assert.equal(execution.model.const, 'gpt-5.6-sol');
    assert.equal(execution.isolation.const, 'fresh');
    assert.equal(execution.forkTurns.const, 'none');
  }
});

test('content code and E2E are capped at four equivalent tracks', () => {
  assert.equal(json('../skills/starci-content-generate/input.schema.json').properties.options.properties.implementationLanguages.maxItems, 4);
  assert.equal(json('./content/code/input.schema.json').properties.input.properties.implementationLanguages.maxItems, 4);
  assert.equal(json('./content/e2e/input.schema.json').properties.input.properties.implementationLanguages.maxItems, 4);
});
