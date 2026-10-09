// revision-replace.mjs — the replacement reason `contract-changed`: a seat whose contract lost or reversed a rule, or whose boot prompt changed,
// is replaced by a fresh seat that boots from the stores (modules/kernel/revision-scope.yaml). It is distinct from the rotation by wakes or
// tokens (modules/reconciler/seat-cost.yaml rotation) and uses the same replacement path; this module only decides that it is due and says why.

export const CONTRACT_CHANGED = 'contract-changed';
const NAMED = 3;

/** The rotation-shaped reason {due, reason} of a notice in state replace-due, or null. */
export function contractReplacement(notice) {
  if (notice?.state !== 'replace-due') return null;
  const names = notice.replaceFiles.slice(0, NAMED).join(', ');
  const more = notice.replaceFiles.length > NAMED ? ` and ${notice.replaceFiles.length - NAMED} more` : '';
  const listed = names ? ` (${names}${more})` : '';
  const count = notice.replaceFiles.length || 'an unmeasurable set of';
  return { due: true, reason: `${CONTRACT_CHANGED}: ${count} rule file(s) changed or lost a rule between ${String(notice.from).slice(0, 12)} and ${String(notice.to).slice(0, 12)}${listed}` };
}
