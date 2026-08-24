import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exactObject, nonEmptyText, runValidatorCli, uniqueStrings, validateEnvelope } from '../../validation.mjs';

const payloadKeys = ['workspaceRouteRef', 'sourceReferenceRef', 'manifestRef', 'appUrl', 'testAccountRef', 'credentialProviderRef', 'selectedFlowRef', 'selectedFlowHash', 'approvedLayoutRef', 'approvedLayoutHash', 'seedEvidenceRef', 'seedEvidenceHash', 'scenarioRefs', 'viewportIds', 'evidenceRoot'];
export function validateInput(value) {
  const errors = [];
  const envelope = validateEnvelope(value, { kind: 'test.ui.input', routes: [['test.ui', 'ready']] }, errors);
  if (!envelope) return { valid: false, errors };
  for (const fact of ['unit-pass', 'e2e-pass', 'e2e-evidence', 'seed-evidence']) if (!envelope.facts.includes(fact)) errors.push(`/facts: ${fact} is required`);
  if (!exactObject(value.payload, payloadKeys, '/payload', errors)) return { valid: false, errors };
  for (const key of ['workspaceRouteRef', 'manifestRef', 'appUrl', 'testAccountRef', 'credentialProviderRef', 'selectedFlowRef', 'selectedFlowHash', 'approvedLayoutRef', 'approvedLayoutHash', 'seedEvidenceRef', 'seedEvidenceHash', 'evidenceRoot']) nonEmptyText(value.payload[key], `/payload/${key}`, errors);
  if (value.payload.sourceReferenceRef !== 'starci-academy-fe') errors.push('/payload/sourceReferenceRef: expected starci-academy-fe');
  if (!/^https?:\/\//.test(value.payload.appUrl ?? '')) errors.push('/payload/appUrl: expected http(s) URL');
  uniqueStrings(value.payload.scenarioRefs, '/payload/scenarioRefs', errors, { min: 1 });
  if (JSON.stringify(value.payload.viewportIds) !== JSON.stringify(['wide', 'intermediate', 'compact'])) errors.push('/payload/viewportIds: expected wide, intermediate, compact');
  if (JSON.stringify(value).match(/"(username|email|password|token|cookie|secret)"\s*:/i)) errors.push('/payload: raw account or credential fields are forbidden');
  return { valid: errors.length === 0, errors };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) runValidatorCli(validateInput, 'usage: node validate-input.mjs <input.json>').catch((error) => { console.error(error.message); process.exitCode = 1; });
