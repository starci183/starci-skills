import { validatorFor, runValidatorCli } from '../../validation.mjs';
import crypto from 'node:crypto';
const fingerprint = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, result, gaps, evidenceRefs } = value.output;
  if (outcome === 'reconciled') {
    if (result === null) errors.push('$.output.result: reconciled requires a structured authority repair');
    if ((result?.artifactRefs.length ?? 0) === 0) errors.push('$.output.result.artifactRefs: reconciled requires a published artifact');
    if ((result?.changedGrammarRefs.length ?? 0) === 0) errors.push('$.output.result.changedGrammarRefs: reconciled requires exact changed Grammar authority');
    if (result) {
      const boundaryByPath = new Map(result.authorityBoundary.map((entry) => [entry.path, entry]));
      if (boundaryByPath.size !== result.authorityBoundary.length) errors.push('$.output.result.authorityBoundary: paths must be unique');
      if (result.authorityBoundaryFingerprint !== fingerprint(result.authorityBoundary)) errors.push('$.output.result.authorityBoundaryFingerprint: must hash the exact ordered authorityBoundary');
      if (result.beforeAuthorityRevision === result.afterAuthorityRevision) errors.push('$.output.result.afterAuthorityRevision: publish must advance the authority revision');
      const effectPaths = result.effectRecords.map(({ path }) => path);
      if (new Set(effectPaths).size !== effectPaths.length) errors.push('$.output.result.effectRecords: paths must be unique');
      if (result.artifactRefs.length !== effectPaths.length || result.artifactRefs.some((path, index) => path !== effectPaths[index])) errors.push('$.output.result.artifactRefs: must equal effect record paths in order');
      for (const effect of result.effectRecords) {
        const boundary = boundaryByPath.get(effect.path);
        if (!boundary) errors.push(`$.output.result.effectRecords: ${effect.path} falls outside the frozen Grammar boundary`);
        else if (boundary.beforeSha256 !== effect.beforeSha256) errors.push(`$.output.result.effectRecords: ${effect.path} before hash differs from the frozen boundary`);
        if (effect.effect === 'created' && (effect.beforeSha256 !== null || effect.afterSha256 === null)) errors.push(`$.output.result.effectRecords: created ${effect.path} requires null before and hashed after state`);
        if (effect.effect === 'updated' && (effect.beforeSha256 === null || effect.afterSha256 === null || effect.beforeSha256 === effect.afterSha256)) errors.push(`$.output.result.effectRecords: updated ${effect.path} requires distinct before and after hashes`);
        if (effect.effect === 'deleted' && (effect.beforeSha256 === null || effect.afterSha256 !== null)) errors.push(`$.output.result.effectRecords: deleted ${effect.path} requires hashed before and null after state`);
      }
      const publishedEffect = result.effectRecords.find(({ path }) => path === result.publishedGrammar.artifactRef);
      if (!publishedEffect || publishedEffect.afterSha256 !== result.publishedGrammar.contentSha256) errors.push('$.output.result.publishedGrammar: artifact and content hash must match a non-deleted effect record');
      if (!result.changedGrammarRefs.includes(result.publishedGrammar.exportRef)) errors.push('$.output.result.changedGrammarRefs: must include the published Grammar export');
    }
    if (gaps.length !== 0) errors.push('$.output.gaps: reconciled cannot retain gaps');
    if (evidenceRefs.length === 0) errors.push('$.output.evidenceRefs: reconciled requires exact evidence');
  }
  if (outcome === 'blocked') {
    if (result !== null) errors.push('$.output.result: blocked authority repair requires null');
    if (gaps.length === 0) errors.push('$.output.gaps: blocked authority repair requires exact gaps');
    if (evidenceRefs.length === 0) errors.push('$.output.evidenceRefs: blocked authority repair requires exact evidence');
  }
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
