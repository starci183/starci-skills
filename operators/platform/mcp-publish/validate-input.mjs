import path from 'node:path';
import { runValidatorCli, validatorFor } from '../../validation.mjs';

const profiles = { economical: 'orchestration/modes/economical.json', balanced: 'orchestration/modes/balanced.json', parallel: 'orchestration/modes/parallel.json' };
function refs(value, found = []) { if (typeof value === 'string' && value.startsWith('session://')) found.push(value); else if (Array.isArray(value)) for (const item of value) refs(item, found); else if (value && typeof value === 'object') for (const item of Object.values(value)) refs(item, found); return found; }
function semantic(value) {
  const errors = [];
  if (!value.facts.includes('platform-source-index-ready')) errors.push('$.facts: missing platform-source-index-ready');
  const provided = Object.values(value.payload.provided).filter((item) => item !== null).sort();
  const artifacts = value.payload.loads.artifacts.map((item) => item.ref).sort();
  if (JSON.stringify(provided) !== JSON.stringify(artifacts)) errors.push('$.payload.loads.artifacts: must bind every provided ref exactly once and no others');
  if (JSON.stringify(value.payload.loads.knowledge.map((item) => item.id)) !== JSON.stringify(['platform.mcp-publication'])) errors.push('$.payload.loads.knowledge: exact ordered knowledge binding required');
  const { orchestration, source } = value.payload.loads;
  if (orchestration.profileRef !== profiles[orchestration.mode]) errors.push('$.payload.loads.orchestration.profileRef: must match mode');
  if (source.repositoryContext !== false || source.loadMode !== 'exact-files') errors.push('$.payload.loads.source: broad source context is forbidden');
  const paths = source.targetFiles.map((item) => item.path.replaceAll('\\', '/'));
  if (new Set(paths).size !== paths.length) errors.push('$.payload.loads.source.targetFiles: duplicate normalized path');
  paths.forEach((item, index) => { if (path.isAbsolute(item) || item === '..' || item.startsWith('../') || item.includes('/../')) errors.push(`$.payload.loads.source.targetFiles[${index}].path: unsafe path`); });
  const prefix = `session://tasks/${value.payload.session.taskId}/`;
  for (const ref of refs(value.payload)) if (!ref.startsWith(prefix)) errors.push(`$: foreign session ref ${ref}`);
  return errors;
}
export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
