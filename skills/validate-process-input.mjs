import { validatorFor } from '../operators/validation.mjs';
import { assertCanonicalReceipts } from '../runtime/trace.mjs';

const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export function processInputValidator(schemaUrl, { skillId, requiredByMode, mutationModes = [], scopeCheck = () => [] }) {
  const mutations = new Set(mutationModes);
  return validatorFor(schemaUrl, (value) => {
    const errors = [];
    const options = value.options;
    try {
      assertCanonicalReceipts([...options.receiptHistory, ...(options.receipt ? [options.receipt] : [])], 'options receipts');
    } catch (error) {
      errors.push(error.message);
    }
    const mode = options.intentMode === 'resume' ? options.resumeTarget : options.intentMode;
    for (const name of requiredByMode[mode] ?? []) {
      if (!options.prerequisiteRefs.some((ref) => ref.includes(name))) errors.push(`missing prerequisite ${name}`);
    }
    const mutates = mutations.has(mode);
    if (mutates) {
      if (!value.scope.externalMutation || value.scope.writeRoots.length === 0 || !value.scope.approvalRef) errors.push('mutation intent requires writeRoots, externalMutation, and approval');
    } else if (value.scope.externalMutation || value.scope.writeRoots.length || value.scope.approvalRef !== null) {
      errors.push('read-only intent cannot declare mutation authority');
    }
    errors.push(...scopeCheck(value, { mode, mutates }));
    if (options.intentMode === 'resume') {
      const resume = options.receipt;
      const history = options.receiptHistory;
      if ([...history, resume].some((receipt) => receipt?.skillId !== skillId)) errors.push('resume lifecycle contains a receipt owned by another skill');
      if (resume?.type !== 'RESUME' || resume.skillId !== skillId) errors.push('resume requires canonical RESUME receipt addressed to this skill');
      const returned = history.at(-1);
      const called = history.at(-2);
      if (returned?.type !== 'RETURN' || called?.type !== 'CALL') errors.push('resume history must end CALL then RETURN');
      else {
        if (returned.parentId !== called.receiptId || resume.parentId !== returned.receiptId) errors.push('receipt parent chain mismatch');
        if (called.childId !== returned.childId || resume.childId !== returned.childId) errors.push('receipt child mismatch');
        for (const key of ['payloadRef', 'sourceHeads']) {
          if (!same(called.trace?.[key], returned.trace?.[key]) || !same(returned.trace?.[key], resume.trace?.[key])) errors.push(`${key} binding mismatch`);
        }
        if (resume.trace?.resumeState !== options.resumeTarget) errors.push('resume target mismatch');
      }
    } else if (options.receipt !== null) errors.push('new intent cannot consume a resume receipt');
    const fingerprints = [...options.receiptHistory.map((item) => item.progressFingerprint), ...(options.receipt ? [options.receipt.progressFingerprint] : [])];
    if (fingerprints.length >= 3 && new Set(fingerprints.slice(-3)).size === 1) errors.push('no-progress across three runtime receipts');
    return errors;
  });
}
