import { createHash } from 'node:crypto';
import { validatorFor } from '../../operators/validation.mjs';

const sortValue = (value) => Array.isArray(value)
  ? value.map(sortValue)
  : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]))
    : value;

export const fingerprintGrammarAudit = (audit) => {
  const { auditFingerprint: _ignored, ...body } = audit;
  return `sha256:${createHash('sha256').update(JSON.stringify(sortValue(body))).digest('hex')}`;
};

export const validateGrammarAudit = validatorFor(new URL('./grammar-audit.schema.json', import.meta.url), (value) => {
  const errors = [];
  const requiredViewports = new Set(['wide', 'intermediate', 'compact']);
  const seenViewports = new Set(value.checks.map((check) => check.viewport));
  for (const viewport of requiredViewports) if (!seenViewports.has(viewport)) errors.push(`missing ${viewport} Grammar audit viewport`);
  const checkKeys = value.checks.map((check) => `${check.cellRef}:${check.ownerRef}`);
  if (new Set(checkKeys).size !== checkKeys.length) errors.push('Grammar audit checks must bind each proof cell and owner once');
  for (const check of value.checks) {
    if (check.ownerLayer === 'grammar' && !check.authorityRef.startsWith('grammar://')) errors.push(`${check.ownerRef}/${check.stateRef} has mismatched Grammar authority`);
    if (check.ownerLayer !== 'grammar' && !check.authorityRef.startsWith('application://')) errors.push(`${check.ownerRef}/${check.stateRef} has mismatched application authority`);
    if (check.boundaryOwnerRefs.length > 1) errors.push(`${check.ownerRef}/${check.stateRef} has duplicate boundary owners`);
    if (check.insetOwnerRefs.length > 1) errors.push(`${check.ownerRef}/${check.stateRef} has duplicate inset owners`);
    if (check.inlineStartPx < check.minimumInlineClearancePx || check.inlineEndPx < check.minimumInlineClearancePx) errors.push(`${check.ownerRef}/${check.stateRef} violates safe inline clearance`);
    if (check.dividerCount > 1) errors.push(`${check.ownerRef}/${check.stateRef} draws duplicate dividers`);
    if (check.iconFamilyRefs.length > 1) errors.push(`${check.ownerRef}/${check.stateRef} mixes icon families`);
    for (const evidenceRef of check.evidenceRefs) if (!value.evidenceRefs.includes(evidenceRef)) errors.push(`${check.ownerRef}/${check.stateRef} evidence is absent from the audit evidence set`);
  }
  if (value.status === 'passed' && value.violations.length !== 0) errors.push('passed Grammar audit cannot retain violations');
  if (value.status === 'failed' && value.violations.length === 0) errors.push('failed Grammar audit requires exact violations');
  if (value.status === 'passed' && errors.length !== 0) errors.push('Grammar audit cannot pass failed owner, inset, divider, clearance, or icon checks');
  if (value.auditFingerprint !== fingerprintGrammarAudit(value)) errors.push('$.auditFingerprint: must bind the exact Grammar audit body');
  return errors;
});
