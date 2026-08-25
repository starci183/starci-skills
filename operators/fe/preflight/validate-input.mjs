import { validatorFor, runValidatorCli } from '../../validation.mjs';

const guards = {
  "business.freshness\u0000ready": {
    "all": ["business-fresh-receipt-ready"],
    "none": []
  }
};
const profileByMode = {
  economical: 'orchestration/modes/economical.json',
  balanced: 'orchestration/modes/balanced.json',
  parallel: 'orchestration/modes/parallel.json'
};

function semanticErrors(value) {
  const errors = [];
  const guard = guards[`${value.stage}\u0000${value.status}`] ?? { all: [], none: [] };
  for (const fact of guard.all) if (!value.facts.includes(fact)) errors.push(`$.facts: missing ${fact}`);
  for (const fact of guard.none) if (value.facts.includes(fact)) errors.push(`$.facts: forbidden ${fact}`);

  const { provided, loads, session } = value.payload;
  if (loads.orchestration.profileRef !== profileByMode[loads.orchestration.mode]) errors.push('$.payload.loads.orchestration.profileRef: does not match mode');

  const expectedReceipts = new Map([
    ['request', provided.requestRef],
    ['workspace-route', provided.routeReceiptRef],
    ['business-freshness', provided.businessFreshnessReceiptRef]
  ]);
  const seenRoles = new Set();
  for (const [index, receipt] of loads.receipts.entries()) {
    if (seenRoles.has(receipt.role)) errors.push(`$.payload.loads.receipts[${index}].role: duplicate ${receipt.role}`);
    seenRoles.add(receipt.role);
    if (receipt.ref !== expectedReceipts.get(receipt.role)) errors.push(`$.payload.loads.receipts[${index}].ref: does not match provided ${receipt.role} receipt`);
  }
  for (const role of expectedReceipts.keys()) if (!seenRoles.has(role)) errors.push(`$.payload.loads.receipts: missing ${role} receipt`);

  const prefix = `session://tasks/${session.taskId}/`;
  const refs = [provided.requestRef, provided.routeReceiptRef, provided.businessFreshnessReceiptRef, ...loads.receipts.map((item) => item.ref), session.inputRef, session.outputRef, session.scratchPrefix];
  for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside task ${session.taskId}: ${ref}`);

  for (const [index, root] of provided.writeRoots.entries()) {
    const normalized = root.replaceAll('\\', '/');
    if (/^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) errors.push(`$.payload.provided.writeRoots[${index}]: must be a safe repository-relative path`);
  }
  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
}
