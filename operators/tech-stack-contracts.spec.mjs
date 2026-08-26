import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const operatorIds = [
  'core/handoff-emit',
  'core/handoff-ack',
  'tech-stack/discover',
  'tech-stack/topology-model',
  'tech-stack/compatibility-check',
  'tech-stack/constraint-publish'
];

const stringFor = (rule) => {
  if (rule.pattern?.includes('sha256')) return `sha256:${'a'.repeat(64)}`;
  if (rule.pattern?.includes('session:')) return 'session://tasks/task-1/value';
  if (rule.pattern?.includes('[a-z0-9]')) return 'starci';
  return 'value';
};

function sample(root, rule = root) {
  if (rule.$ref?.startsWith('#/')) return sample(root, rule.$ref.slice(2).split('/').reduce((node, part) => node[part], root));
  if (Object.hasOwn(rule, 'const')) return rule.const;
  if (rule.enum) return rule.enum[0];
  const type = Array.isArray(rule.type) ? rule.type.find((item) => item !== 'null') : rule.type;
  if (type === 'object') return Object.fromEntries((rule.required ?? []).map((key) => [key, sample(root, rule.properties[key])]));
  if (type === 'array') return Array.from({ length: rule.minItems ?? 0 }, () => sample(root, rule.items));
  if (type === 'integer' || type === 'number') return rule.minimum ?? 1;
  if (type === 'boolean') return false;
  return stringFor(rule);
}

for (const id of operatorIds) {
  test(`${id} validates closed inputs and evidence-bound outcomes`, async () => {
    const root = new URL(`./${id}/`, import.meta.url);
    const inputSchema = JSON.parse(await readFile(new URL('input.schema.json', root), 'utf8'));
    const outputSchema = JSON.parse(await readFile(new URL('output.schema.json', root), 'utf8'));
    const { validateInput } = await import(new URL('validate-input.mjs', root));
    const { validateOutput } = await import(new URL('validate-output.mjs', root));

    const input = sample(inputSchema);
    input.payload.session.taskId = 'task-1';
    assert.equal(validateInput(input).valid, true, 'canonical input should pass');
    assert.equal(validateInput({ ...input, unexpected: true }).valid, false, 'unknown input fields should fail');

    const output = sample(outputSchema);
    output.payload.evidenceRefs = ['evidence:1'];
    assert.equal(validateOutput(output).valid, true, 'evidenced successful output should pass');
    output.payload.evidenceRefs = [];
    assert.equal(validateOutput(output).valid, false, 'successful output without evidence should fail');

    const blocked = sample(outputSchema);
    blocked.payload.decision = outputSchema.properties.payload.properties.decision.enum.at(-1);
    blocked.payload.state.status = 'blocked';
    blocked.status = 'blocked';
    assert.equal(validateOutput(blocked).valid, true, 'blocked output may carry findings without success evidence');
  });
}
