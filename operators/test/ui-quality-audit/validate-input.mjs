import path from 'node:path';
import { validatorFor, runValidatorCli } from '../../validation.mjs';

const guards = [
  { stage: 'test.ui', status: 'ready', facts: ['unit-pass', 'e2e-pass', 'e2e-evidence', 'seed-evidence'] },
  { stage: 'ui.quality.audit', status: 'ready', facts: [] }
];
const profiles = {
  economical: 'orchestration/modes/economical.json',
  balanced: 'orchestration/modes/balanced.json',
  parallel: 'orchestration/modes/parallel.json'
};
const expectedKnowledge = ['fe.ui-quality-review'];

function refs(value, output = []) {
  if (typeof value === 'string' && value.startsWith('session://')) output.push(value);
  else if (Array.isArray(value)) for (const item of value) refs(item, output);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) refs(item, output);
  return output;
}

function semanticErrors(value) {
  const errors = [];
  const guard = guards.find((item) => item.stage === value.stage && item.status === value.status);
  if (!guard) return ['$: undeclared input state'];
  for (const fact of guard.facts) if (!value.facts.includes(fact)) errors.push(`$.facts: missing ${fact}`);
  const { loads, session } = value.payload;
  if (loads.orchestration.profileRef !== profiles[loads.orchestration.mode]) errors.push('$.payload.loads.orchestration.profileRef: does not match mode');
  const ids = loads.knowledge.map((item) => item.id);
  if (JSON.stringify(ids) !== JSON.stringify(expectedKnowledge)) errors.push('$.payload.loads.knowledge: exact ordered knowledge bindings required');
  const prefix = `session://tasks/${session.taskId}/`;
  for (const ref of refs(value.payload)) if (!ref.startsWith(prefix)) errors.push(`$: foreign session ref ${ref}`);
  const paths = loads.source.targetFiles.map((item) => item.path.replaceAll('\\', '/'));
  if (new Set(paths).size !== paths.length) errors.push('$.payload.loads.source.targetFiles: duplicate path');
  for (const [index, target] of paths.entries()) {
    if (path.isAbsolute(target) || target === '..' || target.startsWith('../') || target.includes('/../')) errors.push(`$.payload.loads.source.targetFiles[${index}].path: unsafe path`);
  }
  if (loads.source.repositoryContext !== false) errors.push('$.payload.loads.source.repositoryContext: broad context forbidden');
  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semanticErrors);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
