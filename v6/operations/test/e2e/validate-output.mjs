import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exactObject, naturalNumber, nonEmptyText, runValidatorCli, uniqueStrings, validateEnvelope } from '../../validation.mjs';

const payloadKeys = ['e2eEvidenceRef', 'e2eEvidenceHash', 'scenarioReceipts', 'selected', 'passed', 'failed', 'skipped', 'cleanupComplete', 'failedScenarioIds', 'stopReasons'];
const receiptKeys = ['scenarioId', 'setupRef', 'actionRef', 'observableRef', 'resetRef', 'status', 'evidenceRefs'];
export function validateOutput(value) {
  const errors = [];
  const envelope = validateEnvelope(value, { kind: 'test.e2e.output', routes: [['test.ui', 'ready'], ['code.repair', 'repair'], ['test.review', 'blocked']] }, errors);
  if (!envelope) return { valid: false, errors };
  if (!exactObject(value.payload, payloadKeys, '/payload', errors)) return { valid: false, errors };
  nonEmptyText(value.payload.e2eEvidenceRef, '/payload/e2eEvidenceRef', errors); nonEmptyText(value.payload.e2eEvidenceHash, '/payload/e2eEvidenceHash', errors);
  for (const key of ['selected', 'passed', 'failed', 'skipped']) naturalNumber(value.payload[key], `/payload/${key}`, errors);
  if (typeof value.payload.cleanupComplete !== 'boolean') errors.push('/payload/cleanupComplete: expected boolean');
  uniqueStrings(value.payload.failedScenarioIds, '/payload/failedScenarioIds', errors); uniqueStrings(value.payload.stopReasons, '/payload/stopReasons', errors);
  if (!Array.isArray(value.payload.scenarioReceipts)) errors.push('/payload/scenarioReceipts: expected array');
  else value.payload.scenarioReceipts.forEach((receipt, index) => { const at = `/payload/scenarioReceipts/${index}`; if (!exactObject(receipt, receiptKeys, at, errors)) return; for (const key of ['scenarioId', 'setupRef', 'actionRef', 'observableRef', 'resetRef']) nonEmptyText(receipt[key], `${at}/${key}`, errors); if (!['pass', 'fail', 'blocked'].includes(receipt.status)) errors.push(`${at}/status: invalid`); uniqueStrings(receipt.evidenceRefs, `${at}/evidenceRefs`, errors, { min: 1 }); });
  if (value.status === 'ready') {
    if (!envelope.facts.includes('e2e-pass') || !envelope.facts.includes('e2e-evidence')) errors.push('/facts: pass requires e2e-pass and e2e-evidence');
    if (value.payload.selected < 1 || value.payload.passed !== value.payload.selected || value.payload.failed !== 0 || value.payload.skipped !== 0 || value.payload.scenarioReceipts.length !== value.payload.selected || value.payload.cleanupComplete !== true || value.payload.failedScenarioIds.length || value.payload.stopReasons.length) errors.push('/payload: ready requires complete passing scenarios and cleanup');
  } else if (value.status === 'repair') {
    if (!envelope.facts.includes('e2e-failed') || !envelope.facts.includes('in-boundary-repair') || value.payload.failed < 1 || value.payload.failedScenarioIds.length < 1) errors.push('/payload: repair requires typed E2E failure evidence');
  } else if (!envelope.facts.includes('e2e-blocked') || value.payload.stopReasons.length < 1) errors.push('/payload: blocked requires e2e-blocked and stop reasons');
  return { valid: errors.length === 0, errors };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>').catch((error) => { console.error(error.message); process.exitCode = 1; });
