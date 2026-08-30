import { validatorFor } from '../../operators/validation.mjs';

export const validateGrammarAudit = validatorFor(new URL('./grammar-audit.schema.json', import.meta.url), (value) => {
  const errors = [];
  const requiredStates = new Set(['wide', 'intermediate', 'compact']);
  const seenStates = new Set(value.checks.map((check) => check.state));
  for (const state of requiredStates) if (!seenStates.has(state)) errors.push(`missing ${state} Grammar audit state`);
  for (const check of value.checks) {
    if (check.boundaryOwnerRefs.length > 1) errors.push(`${check.ownerRef}/${check.state} has duplicate boundary owners`);
    if (check.insetOwnerRefs.length > 1) errors.push(`${check.ownerRef}/${check.state} has duplicate inset owners`);
    if (check.inlineStartPx < check.minimumInlineClearancePx || check.inlineEndPx < check.minimumInlineClearancePx) errors.push(`${check.ownerRef}/${check.state} violates safe inline clearance`);
    if (check.dividerCount > 1) errors.push(`${check.ownerRef}/${check.state} draws duplicate dividers`);
    if (check.iconFamilyRefs.length > 1) errors.push(`${check.ownerRef}/${check.state} mixes icon families`);
  }
  if (value.status === 'passed' && value.violations.length !== 0) errors.push('passed Grammar audit cannot retain violations');
  if (value.status === 'failed' && value.violations.length === 0) errors.push('failed Grammar audit requires exact violations');
  if (value.status === 'passed' && errors.length !== 0) errors.push('Grammar audit cannot pass failed owner, inset, divider, clearance, or icon checks');
  return errors;
});
