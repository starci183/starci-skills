import { runValidatorCli, validatorFor } from '../../validation.mjs';

const FULL_REASONS = new Set([
  'manual-full',
  'generation-missing-or-corrupt',
  'index-contract-changed',
  'history-not-comparable',
  'incremental-cost-crossed',
  'affected-record-budget-crossed',
  'delete-budget-crossed'
]);

function semantic(value) {
  const errors = [];
  const { decision, state, produced, findings } = value.payload;
  if (decision !== value.status || state.emits.stage !== value.stage || state.emits.status !== value.status) errors.push('/: emitted route mismatch');
  if (value.status === 'ready') {
    if (state.status !== 'completed' || state.code !== 'platform-reference-index-ready' || state.retryable !== false) errors.push('/payload/state: ready semantics mismatch');
    if (!value.facts.includes('platform-reference-index-ready') || !state.emits.factsAdd.includes('platform-reference-index-ready')) errors.push('/facts: missing platform-reference-index-ready');
    if (!produced.runtime.protocolProved || !produced.runtime.queryProved) errors.push('/payload/produced/runtime: protocol and query proof are required');
    for (const reference of produced.references) {
      const metrics = reference.metrics;
      const changedFiles = metrics.addedFiles + metrics.modifiedFiles + metrics.deletedFiles;
      const costRatio = metrics.incrementalCost / metrics.fullCost;
      if (reference.generation === null || reference.afterRevision === null) errors.push(`/payload/produced/references: ${reference.id} has no active generation or revision`);
      if (reference.action === 'noop') {
        if (reference.reason !== 'no-eligible-drift' || changedFiles !== 0 || metrics.changedBytes !== 0 || metrics.affectedRecords !== 0) errors.push(`/payload/produced/references: ${reference.id} invalid noop evidence`);
      } else if (reference.action === 'incremental') {
        if (reference.reason !== 'compatible-delta' || changedFiles === 0 || produced.policy.manualFull || costRatio >= produced.policy.incrementalCostCeiling || metrics.affectedRecordRatio >= produced.policy.maxAffectedRecordRatio || metrics.deleteRatio >= produced.policy.maxDeleteRatio) errors.push(`/payload/produced/references: ${reference.id} invalid incremental evidence`);
      } else if (reference.action === 'full') {
        if (!FULL_REASONS.has(reference.reason)) errors.push(`/payload/produced/references: ${reference.id} invalid full reason`);
        if (produced.policy.manualFull && reference.reason !== 'manual-full') errors.push(`/payload/produced/references: ${reference.id} must report manual-full`);
        if (reference.reason === 'incremental-cost-crossed' && costRatio < produced.policy.incrementalCostCeiling) errors.push(`/payload/produced/references: ${reference.id} cost budget did not cross`);
        if (reference.reason === 'affected-record-budget-crossed' && metrics.affectedRecordRatio < produced.policy.maxAffectedRecordRatio) errors.push(`/payload/produced/references: ${reference.id} record budget did not cross`);
        if (reference.reason === 'delete-budget-crossed' && metrics.deleteRatio < produced.policy.maxDeleteRatio) errors.push(`/payload/produced/references: ${reference.id} delete budget did not cross`);
      } else errors.push(`/payload/produced/references: ${reference.id} ready output cannot be not-committed`);
    }
  } else {
    if (state.status !== 'blocked' || state.code !== 'platform-reference-index-blocked' || findings.length === 0) errors.push('/payload/state: blocked semantics mismatch');
    if (state.emits.factsAdd.length) errors.push('/payload/state/emits/factsAdd: blocked output cannot add facts');
    for (const reference of produced.references) if (reference.action !== 'not-committed' || reference.generation !== null || reference.afterRevision !== null) errors.push(`/payload/produced/references: ${reference.id} blocked output claims commit`);
    if (produced.durableWrites.length) errors.push('/payload/produced/durableWrites: blocked output cannot claim writes');
  }
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
