import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exactObject, naturalNumber, nonEmptyText, runValidatorCli, uniqueStrings, validateEnvelope } from '../../validation.mjs';

const payloadKeys = ['uiEvidenceRef', 'uiEvidenceHash', 'testAccountRef', 'scenarioReceipts', 'selected', 'passed', 'failed', 'skipped', 'failedScenarioIds', 'boundaryDriftReasons', 'stopReasons', 'secretsRedacted'];
const receiptKeys = ['scenarioId', 'pageIds', 'viewportIds', 'interactionCount', 'assertionCount', 'screenshotRefs', 'traceRef', 'accessibilityRef', 'status', 'ordinaryUserPath', 'secretsRedacted'];
export function validateOutput(value) {
  const errors = [];
  const envelope = validateEnvelope(value, { kind: 'test.ui.output', routes: [['proof.run', 'ready'], ['code.repair', 'repair'], ['layout.review', 'rejected'], ['test.review', 'blocked']] }, errors);
  if (!envelope) return { valid: false, errors };
  if (!exactObject(value.payload, payloadKeys, '/payload', errors)) return { valid: false, errors };
  for (const key of ['uiEvidenceRef', 'uiEvidenceHash', 'testAccountRef']) nonEmptyText(value.payload[key], `/payload/${key}`, errors);
  for (const key of ['selected', 'passed', 'failed', 'skipped']) naturalNumber(value.payload[key], `/payload/${key}`, errors);
  if (value.payload.secretsRedacted !== true) errors.push('/payload/secretsRedacted: expected true');
  uniqueStrings(value.payload.failedScenarioIds, '/payload/failedScenarioIds', errors); uniqueStrings(value.payload.boundaryDriftReasons, '/payload/boundaryDriftReasons', errors); uniqueStrings(value.payload.stopReasons, '/payload/stopReasons', errors);
  if (!Array.isArray(value.payload.scenarioReceipts)) errors.push('/payload/scenarioReceipts: expected array');
  else value.payload.scenarioReceipts.forEach((receipt, index) => { const at = `/payload/scenarioReceipts/${index}`; if (!exactObject(receipt, receiptKeys, at, errors)) return; nonEmptyText(receipt.scenarioId, `${at}/scenarioId`, errors); uniqueStrings(receipt.pageIds, `${at}/pageIds`, errors, { min: 1 }); if (JSON.stringify(receipt.viewportIds) !== JSON.stringify(['wide', 'intermediate', 'compact'])) errors.push(`${at}/viewportIds: all three viewport classes required`); naturalNumber(receipt.interactionCount, `${at}/interactionCount`, errors); naturalNumber(receipt.assertionCount, `${at}/assertionCount`, errors); uniqueStrings(receipt.screenshotRefs, `${at}/screenshotRefs`, errors, { min: 3 }); nonEmptyText(receipt.traceRef, `${at}/traceRef`, errors); nonEmptyText(receipt.accessibilityRef, `${at}/accessibilityRef`, errors); if (!['pass', 'fail', 'blocked'].includes(receipt.status)) errors.push(`${at}/status: invalid`); if (receipt.ordinaryUserPath !== true || receipt.secretsRedacted !== true) errors.push(`${at}: ordinary user path and secret redaction are required`); });
  if (value.status === 'ready') {
    if (!envelope.facts.includes('ui-pass') || !envelope.facts.includes('ui-evidence')) errors.push('/facts: pass requires ui-pass and ui-evidence');
    if (value.payload.selected < 1 || value.payload.passed !== value.payload.selected || value.payload.failed !== 0 || value.payload.skipped !== 0 || value.payload.scenarioReceipts.length !== value.payload.selected || value.payload.failedScenarioIds.length || value.payload.boundaryDriftReasons.length || value.payload.stopReasons.length) errors.push('/payload: ready requires complete real-user browser proof');
  } else if (value.status === 'repair') {
    if (!envelope.facts.includes('ui-failed') || !envelope.facts.includes('in-boundary-repair') || value.payload.failed < 1 || value.payload.failedScenarioIds.length < 1 || value.payload.boundaryDriftReasons.length) errors.push('/payload: repair requires in-boundary UI failure evidence');
  } else if (value.status === 'rejected') {
    if (!envelope.facts.includes('boundary-drift') || !envelope.facts.includes('layout-feedback-recorded') || value.payload.boundaryDriftReasons.length < 1) errors.push('/payload: rejected requires boundary drift and layout regeneration feedback');
  } else if (!envelope.facts.includes('ui-blocked') || value.payload.stopReasons.length < 1) errors.push('/payload: blocked requires ui-blocked and stop reasons');
  return { valid: errors.length === 0, errors };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>').catch((error) => { console.error(error.message); process.exitCode = 1; });
