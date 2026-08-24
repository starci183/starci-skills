import path from 'node:path';
import { validatorFor, runValidatorCli } from '../../validation.mjs';

const profiles = {
  economical: 'orchestration/modes/economical.json',
  balanced: 'orchestration/modes/balanced.json',
  parallel: 'orchestration/modes/parallel.json'
};

function sessionRefs(value, refs = []) {
  if (typeof value === 'string' && value.startsWith('session://')) refs.push(value);
  else if (Array.isArray(value)) for (const item of value) sessionRefs(item, refs);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) sessionRefs(item, refs);
  return refs;
}

function semanticErrors(value) {
  const errors = [];
  if (value.stage !== 'platform.mcp.config' || value.status !== 'ready') errors.push('$: undeclared input state');
  const { provided, loads, session } = value.payload;
  if (loads.business !== null) errors.push('$.payload.loads.business: must be null');
  if (loads.knowledge.length !== 1 || loads.knowledge[0]?.id !== 'platform.mcp-publication') errors.push('$.payload.loads.knowledge: exact platform.mcp-publication binding required');
  if (loads.orchestration.profileRef !== profiles[loads.orchestration.mode]) errors.push('$.payload.loads.orchestration.profileRef: does not match mode');
  if (provided.approvalRef == null) errors.push('$.payload.provided.approvalRef: generated-config write requires approval');

  const prefix = 'session://tasks/' + session.taskId + '/';
  for (const ref of sessionRefs(value.payload)) if (!ref.startsWith(prefix)) errors.push('$: session ref is outside task ' + session.taskId + ': ' + ref);

  const paths = loads.source.targetFiles.map((target) => target.path.replaceAll('\\', '/'));
  if (new Set(paths).size !== paths.length) errors.push('$.payload.loads.source.targetFiles: duplicate path');
  for (const [index, target] of paths.entries()) {
    if (path.isAbsolute(target) || target === '..' || target.startsWith('../') || target.includes('/../')) errors.push('$.payload.loads.source.targetFiles[' + index + '].path: unsafe repository-relative path');
  }
  if (loads.source.targetFiles.filter((target) => target.access === 'write').length !== 1) errors.push('$.payload.loads.source.targetFiles: exactly one config target must be writable');
  if (loads.source.repositoryContext !== false) errors.push('$.payload.loads.source.repositoryContext: broad repository context is forbidden');
  if (loads.external.resourceRefs.length || loads.external.credentialHandleRefs.length) errors.push('$.payload.loads.external: local config generation cannot load external resources or credentials');
  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semanticErrors);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
