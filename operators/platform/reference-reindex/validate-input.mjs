import path from 'node:path';
import { runValidatorCli, validatorFor } from '../../validation.mjs';

const collectSessionRefs = (value, refs = []) => {
  if (typeof value === 'string' && value.startsWith('session://')) refs.push(value);
  else if (Array.isArray(value)) for (const item of value) collectSessionRefs(item, refs);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectSessionRefs(item, refs);
  return refs;
};

const duplicate = (values) => new Set(values).size !== values.length;

function semantic(value) {
  const errors = [];
  if (!value.facts.includes('platform-mcp-config-ready')) errors.push('/facts: missing platform-mcp-config-ready');
  const { provided, loads, session } = value.payload;
  const artifactRefs = new Set(loads.artifacts.map((item) => item.ref));
  for (const ref of Object.values(provided)) if (!artifactRefs.has(ref)) errors.push(`/payload/loads/artifacts: missing ${ref}`);
  const prefix = `session://tasks/${session.taskId}/`;
  for (const ref of collectSessionRefs(value.payload)) if (!ref.startsWith(prefix)) errors.push(`/: foreign task ref ${ref}`);

  const referenceIds = loads.references.map((item) => item.id);
  if (duplicate(referenceIds)) errors.push('/payload/loads/references: duplicate id');
  for (const reference of loads.references) {
    const normalized = reference.path.replaceAll('\\', '/');
    if (path.isAbsolute(normalized) || normalized !== `.worktrees/references/${reference.id}`) errors.push(`/payload/loads/references: ${reference.id} has non-canonical path`);
    if (reference.id !== `${reference.project}-${reference.role}`) errors.push(`/payload/loads/references: ${reference.id} must equal <project>-<role>`);
    if (reference.targetRevision !== reference.checkoutRevision) errors.push(`/payload/loads/references: ${reference.id} checkout is not frozen at target revision`);
    const filePaths = reference.currentFiles.map((item) => item.path.replaceAll('\\', '/'));
    if (duplicate(filePaths)) errors.push(`/payload/loads/references: ${reference.id} has duplicate file paths`);
  }

  const partitionIds = loads.index.partitions.map((item) => item.referenceId);
  if (duplicate(partitionIds)) errors.push('/payload/loads/index/partitions: duplicate referenceId');
  for (const id of partitionIds) if (!referenceIds.includes(id)) errors.push(`/payload/loads/index/partitions: unknown reference ${id}`);
  for (const partition of loads.index.partitions) {
    const filePaths = partition.indexedFiles.map((item) => item.path.replaceAll('\\', '/'));
    if (duplicate(filePaths)) errors.push(`/payload/loads/index/partitions: ${partition.referenceId} has duplicate file paths`);
  }

  const profiles = {
    economical: 'orchestration/modes/economical.json',
    balanced: 'orchestration/modes/balanced.json',
    parallel: 'orchestration/modes/parallel.json'
  };
  if (loads.orchestration.profileRef !== profiles[loads.orchestration.mode]) errors.push('/payload/loads/orchestration/profileRef: mode mismatch');
  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
