import { validatorFor, runValidatorCli } from '../../validation.mjs';
const semantic = (value) => {
  const errors = [];
  const { outcome, result } = value.output;
  const owners = result?.ownerAssessments?.map(({ owner }) => owner) ?? [];
  if (outcome === 'repair' && !owners.includes('implementation')) {
    errors.push('$.output.result.ownerAssessments: repair requires an implementation-owned finding');
  }
  if (outcome === 'authority-repair' && !owners.some((owner) => owner === 'grammar' || owner === 'ui-knowledge')) {
    errors.push('$.output.result.ownerAssessments: authority-repair requires a Grammar or UI-knowledge owner');
  }
  if (outcome === 'business-required' && !owners.some((owner) => owner === 'business' || owner === 'product-authority')) {
    errors.push('$.output.result.ownerAssessments: business-required requires business or product authority ownership');
  }
  if (outcome === 'backend-required' && !owners.includes('backend')) {
    errors.push('$.output.result.ownerAssessments: backend-required requires backend ownership');
  }
  const refs = result?.ownerAssessments?.map(({ findingRef }) => findingRef) ?? [];
  if (new Set(refs).size !== refs.length) {
    errors.push('$.output.result.ownerAssessments: duplicate finding ownership is forbidden');
  }
  const ledgerRefs = result?.findingLedger?.map(({ findingRef }) => findingRef) ?? [];
  const ledgerFingerprints = result?.findingLedger?.map(({ findingFingerprint }) => findingFingerprint) ?? [];
  if (new Set(ledgerRefs).size !== ledgerRefs.length) errors.push('$.output.result.findingLedger: duplicate findingRef values are forbidden');
  if (new Set(ledgerFingerprints).size !== ledgerFingerprints.length) errors.push('$.output.result.findingLedger: duplicate finding fingerprints are forbidden');
  if (JSON.stringify(refs) !== JSON.stringify(ledgerRefs)) errors.push('$.output.result.ownerAssessments: must cover the complete finding ledger in exact order');
  if (outcome === 'blocked' && owners.length > 0) errors.push('$.output.outcome: a classified owner is routable and cannot be converted to blocked');
  if (outcome === 'blocked' && value.output.gaps.length === 0) errors.push('$.output.gaps: blocked requires an exact non-routable gap');
  if (outcome === 'business-required' && value.output.handoff?.skillId !== 'starci-business-process') errors.push('$.output.handoff.skillId: business-required must CALL starci-business-process');
  if (outcome === 'backend-required' && value.output.handoff?.skillId !== 'starci-backend-process') errors.push('$.output.handoff.skillId: backend-required must CALL starci-backend-process');
  if (!['business-required','backend-required'].includes(outcome) && value.output.handoff !== null) errors.push('$.output.handoff: only cross-domain outcomes may carry a handoff');
  return errors;
};
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url), semantic);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
