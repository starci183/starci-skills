import { canonicalReceiptById, isCanonicalReceipt } from '../runtime/trace.mjs';

const consumedPublicSkillReceipts = new WeakSet();

export function validatePublicSkillReceipt(receipt, {
  label = 'returnReceipt',
  allowedTypes = ['RETURN', 'RESUME'],
  expectedMissionId = null,
  expectedSkillId = null,
  expectedParentId = null,
  expectedParentType = 'CALL',
  consume = true,
} = {}) {
  const errors = [];
  if (!isCanonicalReceipt(receipt)) return [`${label} is not a runtime-issued immutable receipt`];
  if (!allowedTypes.includes(receipt.type)) errors.push(`${label} type must be ${allowedTypes.join(' or ')}`);
  if (expectedMissionId !== null && receipt.missionId !== expectedMissionId) errors.push(`${label} mission identity mismatch`);
  if (expectedSkillId !== null && receipt.skillId !== expectedSkillId) errors.push(`${label} Skill identity mismatch`);
  if (expectedParentId !== null && receipt.parentId !== expectedParentId) errors.push(`${label} parent identity mismatch`);
  if (expectedParentId !== null) {
    const callReceipt = canonicalReceiptById(expectedParentId);
    const sameOperator = expectedParentType === 'WAIT' ? callReceipt?.operatorId === null : callReceipt?.operatorId === receipt.operatorId;
    if (!callReceipt || callReceipt.type !== expectedParentType || callReceipt.missionId !== receipt.missionId || callReceipt.skillId !== receipt.skillId || !sameOperator) {
      errors.push(`${label} expected parent is not the exact canonical peer ${expectedParentType}`);
    }
  }
  if (consumedPublicSkillReceipts.has(receipt)) errors.push(`${label} was already consumed by a public Skill input`);
  if (errors.length === 0 && consume) consumedPublicSkillReceipts.add(receipt);
  return errors;
}
