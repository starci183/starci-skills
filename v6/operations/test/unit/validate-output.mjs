import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exactObject, naturalNumber, nonEmptyText, runValidatorCli, uniqueStrings, validateEnvelope } from '../../validation.mjs';

const payloadKeys = ['unitEvidenceRef', 'unitEvidenceHash', 'commandReceipts', 'selected', 'passed', 'failed', 'skipped', 'failedTargetRefs', 'stopReasons'];
const receiptKeys = ['commandRef', 'status', 'selected', 'passed', 'failed', 'skipped', 'evidenceRef'];
export function validateOutput(value) {
  const errors = [];
  const envelope = validateEnvelope(value, { kind: 'test.unit.output', routes: [['test.e2e', 'ready'], ['code.repair', 'repair'], ['test.review', 'blocked']] }, errors);
  if (!envelope) return { valid: false, errors };
  if (!exactObject(value.payload, payloadKeys, '/payload', errors)) return { valid: false, errors };
  nonEmptyText(value.payload.unitEvidenceRef, '/payload/unitEvidenceRef', errors); nonEmptyText(value.payload.unitEvidenceHash, '/payload/unitEvidenceHash', errors);
  for (const key of ['selected', 'passed', 'failed', 'skipped']) naturalNumber(value.payload[key], `/payload/${key}`, errors);
  uniqueStrings(value.payload.failedTargetRefs, '/payload/failedTargetRefs', errors); uniqueStrings(value.payload.stopReasons, '/payload/stopReasons', errors);
  if (!Array.isArray(value.payload.commandReceipts)) errors.push('/payload/commandReceipts: expected array');
  else value.payload.commandReceipts.forEach((receipt, index) => {
    const at = `/payload/commandReceipts/${index}`; if (!exactObject(receipt, receiptKeys, at, errors)) return;
    nonEmptyText(receipt.commandRef, `${at}/commandRef`, errors); nonEmptyText(receipt.evidenceRef, `${at}/evidenceRef`, errors);
    if (!['pass', 'fail', 'blocked'].includes(receipt.status)) errors.push(`${at}/status: invalid`);
    for (const key of ['selected', 'passed', 'failed', 'skipped']) naturalNumber(receipt[key], `${at}/${key}`, errors);
  });
  if (value.status === 'ready') {
    if (!envelope.facts.includes('unit-pass') || !envelope.facts.includes('unit-evidence')) errors.push('/facts: pass requires unit-pass and unit-evidence');
    if (value.payload.selected < 1 || value.payload.passed < 1 || value.payload.failed !== 0 || value.payload.skipped !== 0 || value.payload.commandReceipts.length < 1 || value.payload.failedTargetRefs.length || value.payload.stopReasons.length) errors.push('/payload: ready requires nonzero pass evidence and zero failures, skips, and stops');
  } else if (value.status === 'repair') {
    if (!envelope.facts.includes('unit-failed') || !envelope.facts.includes('in-boundary-repair')) errors.push('/facts: repair requires unit-failed and in-boundary-repair');
    if (value.payload.failed < 1 || value.payload.failedTargetRefs.length < 1) errors.push('/payload: repair requires failed tests and targets');
  } else {
    if (!envelope.facts.includes('unit-blocked') || value.payload.stopReasons.length < 1) errors.push('/payload: blocked requires unit-blocked and stop reasons');
  }
  return { valid: errors.length === 0, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>').catch((error) => { console.error(error.message); process.exitCode = 1; });
