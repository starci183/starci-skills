const approvedEvidenceRefs = (authority) => [
  authority.directionRef,
  authority.directionFingerprint,
  authority.approvalRef,
];

export function directionContractErrors({ uxUiChangeLevel, directionMode, directionEvidence }) {
  const errors = [];
  const classification = directionEvidence.classification;
  const authority = directionEvidence.approvedDirectionAuthority;
  const validClassifications = {
    none: ['not-applicable', 'approved'],
    dominant: ['dominant'],
    alternatives: ['ambiguous', 'comparison-requested'],
  }[directionMode];
  if (!validClassifications.includes(classification)) errors.push('directionEvidence.classification must justify directionMode');
  if (uxUiChangeLevel === 'refine' && (directionMode !== 'none' || classification !== 'not-applicable')) {
    errors.push('refine requires not-applicable direction evidence with directionMode none');
  }
  if (uxUiChangeLevel !== 'refine' && directionMode === 'none' && classification !== 'approved') {
    errors.push('reconstruct/new directionMode none requires approved direction evidence');
  }
  if (uxUiChangeLevel !== 'refine' && classification === 'not-applicable') {
    errors.push('not-applicable direction evidence is valid only for refine');
  }
  if (classification === 'approved' && authority === null) {
    errors.push('approved direction evidence requires an exact approvedDirectionAuthority');
  }
  if (classification !== 'approved' && authority !== null) {
    errors.push('approvedDirectionAuthority is valid only for approved direction evidence');
  }
  if (authority) {
    for (const ref of approvedEvidenceRefs(authority)) {
      if (!directionEvidence.evidenceRefs.includes(ref)) errors.push(`approved direction evidenceRefs must include ${ref}`);
    }
  }
  return errors;
}

export function directionAuthorityContextErrors(directionEvidence, { authorityRefs, evidenceRefs = null, label = 'context' }) {
  const authority = directionEvidence.approvedDirectionAuthority;
  if (!authority) return [];
  const errors = [];
  for (const ref of [authority.directionRef, authority.approvalRef]) {
    if (!authorityRefs.includes(ref)) errors.push(`${label}.authorityRefs must include exact approved direction authority ${ref}`);
  }
  if (evidenceRefs) {
    for (const ref of approvedEvidenceRefs(authority)) {
      if (!evidenceRefs.includes(ref)) errors.push(`${label}.evidenceRefs must include exact approved direction evidence ${ref}`);
    }
  }
  return errors;
}
