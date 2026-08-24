import path from 'node:path';
import { runValidatorCli, validatorFor } from '../../validation.mjs';
const profiles = { economical: 'orchestration/modes/economical.json', balanced: 'orchestration/modes/balanced.json', parallel: 'orchestration/modes/parallel.json' };
function refs(value, found = []) { if (typeof value === 'string' && value.startsWith('session://')) found.push(value); else if (Array.isArray(value)) for (const item of value) refs(item, found); else if (value && typeof value === 'object') for (const item of Object.values(value)) refs(item, found); return found; }
function semantic(value) {
  const errors = [], provided = Object.values(value.payload.provided).sort(), artifacts = value.payload.loads.artifacts.map((item) => item.ref).sort();
  if (JSON.stringify(provided) !== JSON.stringify(artifacts)) errors.push('$.payload.loads.artifacts: exact provided bindings required');
  if (JSON.stringify(value.payload.loads.knowledge.map((item) => item.id)) !== JSON.stringify(['platform.observability'])) errors.push('$.payload.loads.knowledge: exact ordered knowledge binding required');
  const { orchestration, source } = value.payload.loads;
  if (orchestration.profileRef !== profiles[orchestration.mode]) errors.push('$.payload.loads.orchestration.profileRef: must match mode');
  const paths = source.targetFiles.map((item) => item.path.replaceAll('\\', '/'));
  if (source.repositoryContext !== false || source.loadMode !== 'exact-files') errors.push('$.payload.loads.source: broad context forbidden');
  if (new Set(paths).size !== paths.length) errors.push('$.payload.loads.source.targetFiles: duplicate normalized path');
  paths.forEach((item, index) => { if (path.isAbsolute(item) || item === '..' || item.startsWith('../') || item.includes('/../')) errors.push(`$.payload.loads.source.targetFiles[${index}].path: unsafe path`); });
  const prefix = `session://tasks/${value.payload.session.taskId}/`; for (const ref of refs(value.payload)) if (!ref.startsWith(prefix)) errors.push(`$: foreign session ref ${ref}`);
  return errors;
}
export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
